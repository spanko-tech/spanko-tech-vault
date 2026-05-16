// Systems/Oraculum/Modules/Research.js
// Deep research engine using Gemini 2.5 Flash with Google Search grounding.
//
// Two layers of persistence:
//   1. Vault JSON (Systems/Oraculum/Data/research_queue.json + research_results.json)
//      → permanent, syncs across devices via Obsidian Sync.
//   2. localStorage cache (via Cache.js) keyed by topic-batch hash
//      → 30-day TTL, avoids re-firing identical batches.
//
// Quota awareness (free tier, late 2025):
//   Gemini 2.5 Flash → 5 RPM, 250K TPM, 20 RPD
//   Search grounding → 1.5K/day
// We rate-limit ourselves to one batch every ~12s and surface usage stats in the UI.

const C  = await dc.require("Systems/Oraculum/Modules/Cache.js");
const G  = await dc.require("Systems/Oraculum/Modules/GeminiClient.js");
const V  = await dc.require("Toolkit/Datacore/Vault.js");

// ── Storage paths ─────────────────────────────────────────────────────────
const QUEUE_PATH      = "Systems/Oraculum/Data/research_queue.json";
const RESULTS_PATH    = "Systems/Oraculum/Data/research_results.json";
const INDEX_PATH      = "Systems/Oraculum/Data/research_index.json"; // compact topic list, fast to read
const RESEARCH_FOLDER = "Systems/Oraculum/Data/Research"; // per-topic JSON files for targeted AI reading

// ── Model + endpoint ──────────────────────────────────────────────────────
// Gemini 2.5 Flash — separate from the Gemma chat model. Same API key.
const RESEARCH_MODEL = "gemini-2.5-flash";
const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

// ── Vault JSON helpers ────────────────────────────────────────────────────
async function _readJson(path, fallback) {
    try {
        if (!(await dc.app.vault.adapter.exists(path))) return fallback;
        const raw = await dc.app.vault.adapter.read(path);
        return JSON.parse(raw);
    } catch (e) {
        console.warn("Research: failed to read", path, e);
        return fallback;
    }
}

async function _writeJson(path, data) {
    const folder = path.substring(0, path.lastIndexOf("/"));
    await V.ensureFolder(folder);
    await dc.app.vault.adapter.write(path, JSON.stringify(data, null, 2));
}

/** Write a single result to Systems/Oraculum/Data/Research/{safeName}.json for targeted AI access. */
async function _writeTopicFile(result) {
    await V.ensureFolder(RESEARCH_FOLDER);
    const safeName = V.safeName(result.topic);
    await dc.app.vault.adapter.write(
        `${RESEARCH_FOLDER}/${safeName}.json`,
        JSON.stringify(result, null, 2)
    );
}

function _id() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function _hashStr(s) {
    let h = 5381;
    for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
    return (h >>> 0).toString(36);
}

// ── Queue management ──────────────────────────────────────────────────────

async function getQueue() {
    return await _readJson(QUEUE_PATH, []);
}

async function queueTopic({ topic, rationale, context, session_id }) {
    if (!topic || !topic.trim()) throw new Error("topic is required");
    const queue = await getQueue();
    // Dedup: if an identical topic is already queued, return it instead of adding a dupe.
    const lc = topic.trim().toLowerCase();
    const existing = queue.find(q => q.topic.trim().toLowerCase() === lc);
    if (existing) return { ...existing, deduped: true };

    const entry = {
        id: _id(),
        topic: topic.trim(),
        rationale: rationale?.trim() || "",
        context: context?.trim() || "",
        session_id: session_id || null,
        queued_at: new Date().toISOString(),
        status: "pending",
    };
    queue.push(entry);
    await _writeJson(QUEUE_PATH, queue);
    return entry;
}

async function removeFromQueue(id) {
    const queue = await getQueue();
    const next = queue.filter(q => q.id !== id);
    await _writeJson(QUEUE_PATH, next);
    return queue.length - next.length;
}

async function clearQueue() {
    await _writeJson(QUEUE_PATH, []);
}

// ── Results management ────────────────────────────────────────────────────

async function getResults() {
    // Fast path: aggregate file exists and has data
    const stored = await _readJson(RESULTS_PATH, null);
    if (Array.isArray(stored) && stored.length > 0) return stored;

    // Self-heal: rebuild from per-topic files (happens after migration / first run)
    try {
        const adapter = dc.app.vault.adapter;
        if (!(await adapter.exists(RESEARCH_FOLDER))) return [];
        const listing = await adapter.list(RESEARCH_FOLDER);
        const files = (listing.files ?? []).filter(f => f.endsWith(".json"));
        if (files.length === 0) return [];
        const results = [];
        for (const f of files) {
            try {
                const raw = await adapter.read(f);
                const data = JSON.parse(raw);
                if (data && data.topic) results.push(data);
            } catch {}
        }
        results.sort((a, b) => new Date(a.ran_at) - new Date(b.ran_at));
        if (results.length > 0) await _writeJson(RESULTS_PATH, results);
        return results;
    } catch (e) {
        console.warn("Research: failed to rebuild from topic files", e);
        return [];
    }
}

/** Rebuild the compact index from the full results — called after any write. */
async function _rebuildIndex(results) {
    const index = results.map(r => ({
        id:     r.id,
        topic:  r.topic,
        depth:  r.depth,
        ran_at: r.ran_at,
        summary: r.summary,  // one paragraph — cheap for the model to read
        findings_count: (r.findings || []).length,
    }));
    await _writeJson(INDEX_PATH, index);
}

async function saveResult(result) {
    const all = await getResults();
    // Dedup: replace existing entry with same topic (case-insensitive) instead of appending
    const lc = result.topic?.toLowerCase().trim();
    const idx = lc ? all.findIndex(r => r.topic?.toLowerCase().trim() === lc) : -1;
    if (idx >= 0) all[idx] = result; else all.push(result);
    await _writeJson(RESULTS_PATH, all);
    await _writeTopicFile(result);
    await _rebuildIndex(all);
}

/**
 * List all researched topics — compact, no findings body.
 * Use this for a quick overview; use searchResults for content-aware lookup.
 */
async function listResearchTopics() {
    const index = await _readJson(INDEX_PATH, null);
    if (index) return index.slice().reverse();
    // Fallback: build from full results on first call
    const all = await getResults();
    await _rebuildIndex(all);
    return all.map(r => ({ id: r.id, topic: r.topic, depth: r.depth, ran_at: r.ran_at, summary: r.summary, findings_count: (r.findings||[]).length })).reverse();
}

/**
 * Substring-search prior research results. Returns up to `limit` matches.
 * Searches topic, rationale, summary, and findings text.
 */
async function searchResults(query) {
    const q = (query || "").trim().toLowerCase();

    // No query → return the full compact index (no findings body loaded)
    if (!q) {
        return await listResearchTopics();
    }

    // With query → need full results for findings-body search
    const all = await getResults();
    const matches = [];
    for (const r of all) {
        const hay = [
            r.topic,
            r.rationale,
            r.summary,
            ...(r.findings || []).map(f => `${f.heading}\n${f.body}`),
        ].join("\n").toLowerCase();
        if (hay.includes(q)) matches.push(r);
    }
    return matches.reverse();
}

// ── Gemini 2.5 Flash with Search grounding ────────────────────────────────
// Uses G.post (re-exported from GeminiClient.js) — same requestUrl/fetch wrapper.

const DEPTH_PROMPTS = {
    shallow:  { paragraphs: "1–2", findings: "3–5",  guidance: "Cover the essentials briefly." },
    standard: { paragraphs: "3–5", findings: "5–8",  guidance: "Be thorough but focused." },
    deep:     { paragraphs: "6–10", findings: "8–12", guidance: "Treat this like a mini whitepaper. Surface tradeoffs, contrarian views, and recent (2024–2025) developments. Be exhaustive." },
};

const TOPIC_SEP = "===TOPIC_RESULT===";

function _buildBatchPrompt(entries, depth) {
    const d = DEPTH_PROMPTS[depth] || DEPTH_PROMPTS.standard;

    const topicList = entries.map((e, i) => {
        const ctx = [e.rationale, e.context].filter(Boolean).join(" — ");
        return `TOPIC ${i + 1}: ${e.topic}${ctx ? `\n  Context: ${ctx}` : ""}`;
    }).join("\n");

    return `You are a research assistant. Use Google Search to deeply research each topic below.

For EACH topic, output a JSON block separated by the delimiter "${TOPIC_SEP}".
There must be EXACTLY ${entries.length} delimiter-separated blocks — one per topic, in order.

Each block must be valid JSON matching this schema exactly:
{
  "topic": "<topic string verbatim>",
  "summary": "<3-sentence executive summary>",
  "findings": [{"heading": "...", "body": "2-4 sentences..."}],
  "open_questions": ["..."],
  "vault_suggestions": [{"action": "create_knowledge_note"|"create_idea_note"|"extend_existing", "title_or_path": "...", "why": "..."}]
}

Rules:
- Use Google Search. Prefer 2024–2025 sources. Cite inline with [1], [2] etc.
- ${d.guidance}
- Write ${d.paragraphs} paragraphs worth of content across summary + findings.
- Extract ${d.findings} findings per topic.
- No prose outside the JSON blocks. No code fences. Only the delimiter and JSON.

Format your output EXACTLY like this (no extra text before, between, or after):
${TOPIC_SEP}
{"topic": "...", ...}
${TOPIC_SEP}
{"topic": "...", ...}

TOPICS:
${topicList}

Begin. Output ${entries.length} ${TOPIC_SEP}-delimited JSON blocks now.`;
}

function _extractJson(text) {
    // Strip code fences and find first { ... last } pair.
    const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
    const start = cleaned.indexOf("{");
    const end   = cleaned.lastIndexOf("}");
    if (start === -1 || end === -1) throw new Error("No JSON object found in response");
    return JSON.parse(cleaned.slice(start, end + 1));
}

function _splitBatchResponse(text, expectedCount) {
    // Split on the delimiter, filter blank segments, parse each JSON block.
    const parts = text.split(TOPIC_SEP)
        .map(s => s.trim())
        .filter(s => s.length > 0 && s.includes("{"));

    const parsed = [];
    for (const part of parts) {
        try {
            const obj = _extractJson(part);
            if (obj && typeof obj === "object") parsed.push(obj);
        } catch {
            // Skip unparseable segments but continue
        }
    }

    // Fallback: if delimiter didn't work, try the old topics-array format
    if (parsed.length === 0) {
        try {
            const whole = _extractJson(text);
            if (whole.topics) return whole.topics;
            return [whole];
        } catch { return []; }
    }

    return parsed;
}

function _extractCitations(candidate) {
    const meta = candidate?.groundingMetadata;
    if (!meta) return [];
    const chunks = meta.groundingChunks || [];
    return chunks.map((c, i) => ({
        index: i + 1,
        uri:   c.web?.uri   || c.retrievedContext?.uri  || "",
        title: c.web?.title || c.retrievedContext?.title || "",
    })).filter(c => c.uri);
}

/**
 * Run research batch — ONE Gemini call for all topics using delimiter-separated output.
 * Falls back to per-topic calls if the response can't be split correctly.
 * Each topic gets its own cache slot. Returns { ok, results, skipped, totalCalls }.
 */
async function runBatch(topicEntries, { depth = "standard", signal, force = false } = {}) {
    if (!topicEntries?.length) throw new Error("No topics provided");

    const apiKey = G.getApiKey();
    if (!apiKey) throw new Error("__NO_KEY__");

    // Split into cached vs uncached
    const toResearch = [];
    const skipped = [];
    for (const entry of topicEntries) {
        const cacheKey = "research:" + _hashStr(depth + "|" + entry.topic.toLowerCase().trim());
        if (!force && C.get(cacheKey, C.TTL.RESEARCH_MS)) {
            skipped.push(entry.topic);
        } else {
            toResearch.push(entry);
        }
    }

    const existingResults = await getResults();
    const persisted = [];
    let totalCalls = 0;

    if (toResearch.length > 0) {
        const prompt = _buildBatchPrompt(toResearch, depth);
        const body = {
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            tools: [{ google_search: {} }],
            generationConfig: { temperature: 0.3, maxOutputTokens: 16384 },
        };
        const url = `${API_BASE}/${RESEARCH_MODEL}:generateContent?key=${apiKey}`;

        const delays = [5000, 15000, 30000];
        let attempt = 0, lastStatus, lastText;
        while (true) {
            if (signal?.aborted) throw new DOMException("Stopped", "AbortError");
            ({ status: lastStatus, text: lastText } = await G.post(url, body, signal));
            if ((lastStatus === 429 || lastStatus === 500 || lastStatus === 503) && attempt < delays.length) {
                await new Promise(r => setTimeout(r, delays[attempt++]));
                continue;
            }
            break;
        }
        totalCalls++;

        if (lastStatus >= 400) {
            throw new Error(`Gemini Research API error ${lastStatus}: ${lastText.slice(0, 400)}`);
        }

        let response;
        try { response = JSON.parse(lastText); }
        catch { throw new Error(`Non-JSON Gemini response: ${lastText.slice(0, 200)}`); }

        const candidate = response.candidates?.[0];
        const text = candidate?.content?.parts?.map(p => p.text || "").join("") || "";
        const citations = _extractCitations(candidate);

        let parsed = _splitBatchResponse(text, toResearch.length);

        // If we got fewer results than topics, fall back to per-topic calls for the remainder.
        const covered = new Set(parsed.map(r => r.topic?.toLowerCase().trim()));
        const needFallback = toResearch.filter(e => !covered.has(e.topic.toLowerCase().trim()));

        // Map parsed results to queue entries (by index or topic match)
        for (let i = 0; i < parsed.length; i++) {
            const r = parsed[i];
            const original = toResearch.find(e => e.topic.toLowerCase().trim() === r.topic?.toLowerCase().trim())
                          || toResearch[i]
                          || {};
            const resultEntry = {
                id: _id(),
                topic: r.topic || original.topic,
                rationale: original.rationale || "",
                context: original.context || "",
                depth,
                ran_at: new Date().toISOString(),
                summary: r.summary || "",
                findings: r.findings || [],
                open_questions: r.open_questions || [],
                vault_suggestions: r.vault_suggestions || [],
                citations,
                queue_id: original.id || null,
            };
            existingResults.push(resultEntry);
            persisted.push(resultEntry);
            const cacheKey = "research:" + _hashStr(depth + "|" + resultEntry.topic.toLowerCase().trim());
            C.set(cacheKey, { ok: true, result: resultEntry, citations });
        }

        // Fallback: fire individual calls for any topics Gemini missed
        for (const entry of needFallback) {
            if (signal?.aborted) break;
            console.warn(`Research: fallback per-topic call for "${entry.topic}"`);
            await new Promise(r => setTimeout(r, 13000)); // rate limit
            const singlePrompt = _buildBatchPrompt([entry], depth);
            const singleBody = { ...body, contents: [{ role: "user", parts: [{ text: singlePrompt }] }] };
            const { status, text: sText } = await G.post(url, singleBody, signal);
            totalCalls++;
            if (status < 400) {
                try {
                    const sResp = JSON.parse(sText);
                    const sCand = sResp.candidates?.[0];
                    const sRawText = sCand?.content?.parts?.map(p => p.text || "").join("") || "";
                    const sCitations = _extractCitations(sCand);
                    const sParsed = _splitBatchResponse(sRawText, 1);
                    const r = sParsed[0] || {};
                    const resultEntry = {
                        id: _id(),
                        topic: r.topic || entry.topic,
                        rationale: entry.rationale || "",
                        context: entry.context || "",
                        depth,
                        ran_at: new Date().toISOString(),
                        summary: r.summary || "",
                        findings: r.findings || [],
                        open_questions: r.open_questions || [],
                        vault_suggestions: r.vault_suggestions || [],
                        citations: sCitations,
                        queue_id: entry.id || null,
                    };
                    existingResults.push(resultEntry);
                    persisted.push(resultEntry);
                    const cacheKey = "research:" + _hashStr(depth + "|" + resultEntry.topic.toLowerCase().trim());
                    C.set(cacheKey, { ok: true, result: resultEntry, citations: sCitations });
                } catch { skipped.push(entry.topic); }
            } else {
                skipped.push(entry.topic);
            }
        }
    }

    // Atomic write + rebuild compact index
    if (persisted.length) {
        // Dedup: re-read original file, remove any stale entries whose topic was just researched,
        // then append the fresh results. Handles re-research (force:true) cleanly.
        const persistedTopics = new Set(persisted.map(p => p.topic?.toLowerCase().trim()).filter(Boolean));
        const base = (await _readJson(RESULTS_PATH, [])).filter(
            r => !persistedTopics.has(r.topic?.toLowerCase().trim())
        );
        const merged = [...base, ...persisted];
        await _writeJson(RESULTS_PATH, merged);
        await Promise.all(persisted.map(_writeTopicFile));
        await _rebuildIndex(merged);
    }

    // Remove all fired topics from queue (including those that may have errored — don't re-queue silently)
    const doneIds = new Set(topicEntries.map(t => t.id).filter(Boolean));
    const queue = await getQueue();
    await _writeJson(QUEUE_PATH, queue.filter(q => !doneIds.has(q.id)));

    return { ok: true, results: persisted, skipped, totalCalls };
}

// ── Memory notes ──────────────────────────────────────────────────────────
// Saves a research result as a human-readable Markdown note in Systems/Oraculum/Memory/.
// These notes join the semantic index and are discoverable by search_notes /
// semantic_search in all future conversations — Oraculum's long-term memory.

const MEMORY_FOLDER = "Systems/Oraculum/Memory";

async function saveToMemory(result) {
    if (!result?.topic) throw new Error("result.topic is required");

    const safeTopic = V.safeName(result.topic).slice(0, 80);
    const path = `${MEMORY_FOLDER}/${safeTopic}.md`;

    await V.ensureFolder(MEMORY_FOLDER);

    const date = result.ran_at
        ? new Date(result.ran_at).toISOString().slice(0, 10)
        : new Date().toISOString().slice(0, 10);

    // Build frontmatter
    const fm = [
        "---",
        `title: "${result.topic.replace(/"/g, '\\"')}"`,
        `researched: ${date}`,
        `depth: ${result.depth || "standard"}`,
        `source: deep_research`,
        `tags:`,
        `  - oraculum/memory`,
        "---",
    ].join("\n");

    // Build body
    const lines = [`# ${result.topic}`, ""];

    if (result.summary) {
        lines.push("## Summary", "", result.summary, "");
    }

    if (result.findings?.length) {
        lines.push("## Findings", "");
        for (const f of result.findings) {
            lines.push(`### ${f.heading}`, "", f.body || "", "");
        }
    }

    if (result.open_questions?.length) {
        lines.push("## Open Questions", "");
        for (const q of result.open_questions) lines.push(`- ${q}`);
        lines.push("");
    }

    if (result.vault_suggestions?.length) {
        lines.push("## Vault Suggestions", "");
        for (const s of result.vault_suggestions) {
            lines.push(`- **${s.action}** → \`${s.title_or_path}\` — ${s.why}`);
        }
        lines.push("");
    }

    if (result.citations?.length) {
        lines.push("## Sources", "");
        for (const c of result.citations) {
            lines.push(`${c.index}. [${c.title || c.uri}](${c.uri})`);
        }
        lines.push("");
    }

    const body = fm + "\n" + lines.join("\n");

    // Write (overwrite if already exists — research may be refreshed)
    await dc.app.vault.adapter.write(path, body);
    return { ok: true, path };
}

// ── Delete a single result ────────────────────────────────────────────────

/**
 * Remove a result by ID from research_results.json and its per-topic file.
 * Rebuilds the compact index afterward.
 */
async function deleteResult(id) {
    const all = await getResults();
    const entry = all.find(r => r.id === id);
    const next  = all.filter(r => r.id !== id);
    await _writeJson(RESULTS_PATH, next);
    await _rebuildIndex(next);
    if (entry) {
        const safeName = V.safeName(entry.topic);
        const filePath = `${RESEARCH_FOLDER}/${safeName}.json`;
        try {
            if (await dc.app.vault.adapter.exists(filePath))
                await dc.app.vault.adapter.remove(filePath);
        } catch {}
    }
    return next.length;
}

// ── Stats ─────────────────────────────────────────────────────────────────

async function getStats() {
    const queue = await getQueue();
    const results = await getResults();
    const cache = C.stats();

    // Count memory notes
    let memoryCount = 0;
    try {
        const folder = dc.app.vault.getAbstractFileByPath(MEMORY_FOLDER);
        memoryCount = folder?.children?.filter(f => f.extension === "md").length ?? 0;
    } catch {}

    return {
        queued: queue.length,
        researched: results.length,
        memory_notes: memoryCount,
        cache_entries: cache.count,
        cache_bytes: cache.bytes,
    };
}

return {
    RESEARCH_MODEL, MEMORY_FOLDER,
    getQueue, queueTopic, removeFromQueue, clearQueue,
    getResults, listResearchTopics, searchResults, saveResult,
    runBatch, getStats, saveToMemory, deleteResult,
};
