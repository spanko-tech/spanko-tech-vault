// Systems/Oraculum/Modules/Embeddings.js
// Semantic search index for Oraculum — vector embeddings via Gemini gemini-embedding-2.
// Index stored as Systems/Oraculum/Data/embeddings.json — syncs automatically via Obsidian Sync.
// Loaded with: const E = await dc.require("Systems/Oraculum/Modules/Embeddings.js");
//
// Exports:
//   indexVault(apiKey, onProgress?)        — embed all new/changed notes, persist to vault file
//   semanticSearch(query, apiKey, options?) — cosine similarity search
//   getIndexStats()                         — { total, stale, lastUpdated }
//   getIndexNotes()                         — all indexed notes without vectors (for Settings UI)
//   clearIndex()                            — wipe all stored embeddings
//   getExcludedFolders()                    — string[] from localStorage
//   setExcludedFolders(folders)             — persist to localStorage
//
// Embed text built from: title · domain/topic · tags · created/mtime · author/type (media) · summary preamble · body
//
// ⚠ Do NOT edit Systems/Oraculum/Data/embeddings.json manually. It is a machine-generated
// index file. Manual edits are overwritten on the next Update Index run and may
// corrupt the in-memory cache. Clear or rebuild via Oraculum Settings UI only.

const EMBED_MODEL    = "gemini-embedding-2";
const EMBED_URL      = `https://generativelanguage.googleapis.com/v1beta/models/${EMBED_MODEL}:embedContent`;
const INDEX_PATH     = "Systems/Oraculum/Data/embeddings.json";
const EXCLUDED_KEY   = "oraculum:embed-excluded-folders";
const MAX_CHARS      = 30000; // Gemini Embedding 2 supports ~32K chars (8192 tokens); this is a safety ceiling only

// ── Rate limiting (RPM + TPM) ──────────────────────────────────────────────────
// Gemini Embedding 2 limits: 100 RPM / 30K TPM.
// We enforce BOTH limits via sliding 60-second windows:
//   - RPM: track call count — wait if ≥ RPM_LIMIT calls in the last 60s
//   - TPM: track token count — wait if adding this note would exceed TPM_LIMIT
// Whichever is the binding constraint causes the wait; the other may be slack.
//
// Token estimate: ~4 chars per token (standard for English text).
const RPM_LIMIT = 95;    // slightly under 100 RPM for safety
const TPM_LIMIT = 29000; // slightly under 30K TPM for safety

const _tokenWindow = []; // { tokens: number, ts: number }[]
const _callWindow  = []; // number[] (timestamps)

function _pruneWindows() {
    const cutoff = Date.now() - 60_000;
    while (_tokenWindow.length > 0 && _tokenWindow[0].ts < cutoff) _tokenWindow.shift();
    while (_callWindow.length  > 0 && _callWindow[0]     < cutoff) _callWindow.shift();
}

function estimateTokens(text) {
    return Math.ceil(text.length / 4);
}

// Call BEFORE each embed request. Waits until both RPM and TPM have headroom,
// then records the call. Both windows are checked on every iteration.
async function throttleForTokens(tokens) {
    while (true) {
        _pruneWindows();
        const rpmOk = _callWindow.length < RPM_LIMIT;
        const tpmOk = _tokenWindow.reduce((s, e) => s + e.tokens, 0) + tokens <= TPM_LIMIT;
        if (rpmOk && tpmOk) break;

        // Wait until the oldest offending entry expires from whichever window is blocking
        let waitMs = 500;
        if (!rpmOk) {
            waitMs = Math.max(waitMs, (_callWindow[0] + 60_000) - Date.now() + 100);
        }
        if (!tpmOk) {
            waitMs = Math.max(waitMs, (_tokenWindow[0]?.ts + 60_000) - Date.now() + 100);
        }
        await new Promise(r => setTimeout(r, waitMs));
    }

    const now = Date.now();
    _callWindow.push(now);
    _tokenWindow.push({ tokens, ts: now });
}

// Default folders to skip — issues are noisy and not worth embedding (archived issues are included via ! override)
const DEFAULT_EXCLUDED = ["Systems/Issues", "!Systems/Issues/Archived", "Toolkit", ".obsidian", "Systems/Oraculum"];

function getExcludedFolders() {
    try {
        const stored = localStorage.getItem(EXCLUDED_KEY);
        return stored ? JSON.parse(stored) : [...DEFAULT_EXCLUDED];
    } catch { return [...DEFAULT_EXCLUDED]; }
}

function setExcludedFolders(folders) {
    localStorage.setItem(EXCLUDED_KEY, JSON.stringify(folders));
}

function isExcluded(path, excluded) {
    const excl = excluded.filter(s => !s.startsWith("!"));
    const incl = excluded.filter(s => s.startsWith("!")).map(s => s.slice(1));
    const blocked = excl.some(f => path.startsWith(f + "/") || path.startsWith(f + "\\"));
    if (!blocked) return false;
    // A ! rule overrides — path is allowed if it starts with any include prefix
    const allowed = incl.some(f => path.startsWith(f + "/") || path.startsWith(f + "\\"));
    return !allowed;
}

// ── Vault file storage ─────────────────────────────────────────────────────────
// In-memory cache avoids re-reading the file on every search within a session.

let _cache = null; // { version, lastUpdated, notes: { [path]: record } }

async function loadIndex() {
    if (_cache) return _cache;
    try {
        const exists = await app.vault.adapter.exists(INDEX_PATH);
        if (!exists) {
            _cache = { version: 1, lastUpdated: null, notes: {} };
            return _cache;
        }
        const text = await app.vault.adapter.read(INDEX_PATH);
        _cache = JSON.parse(text);
        if (!_cache.notes) _cache.notes = {};
    } catch (e) {
        console.warn("[Embeddings] Could not read index file, starting fresh:", e);
        _cache = { version: 1, lastUpdated: null, notes: {} };
    }
    return _cache;
}

async function saveIndex(index) {
    const folder = INDEX_PATH.substring(0, INDEX_PATH.lastIndexOf("/"));
    if (!(await app.vault.adapter.exists(folder))) {
        await app.vault.createFolder(folder);
    }
    await app.vault.adapter.write(INDEX_PATH, JSON.stringify(index));
    _cache = index;
}

// ── Content helpers ────────────────────────────────────────────────────────────

// djb2 XOR hash over the full file content — far more robust than length+prefix.
// Collisions are theoretically possible but astronomically unlikely for vault notes.
function contentHash(raw) {
    let h = 5381;
    for (let i = 0; i < raw.length; i++) {
        h = ((h << 5) + h) ^ raw.charCodeAt(i);
        h = h >>> 0; // keep as unsigned 32-bit integer
    }
    return h.toString(36) + ":" + raw.length;
}

function parseFrontmatter(raw) {
    if (!raw.startsWith("---")) return {};
    const end = raw.indexOf("\n---", 3);
    if (end === -1) return {};
    const yaml = raw.slice(3, end);
    const result = {};
    for (const line of yaml.split("\n")) {
        const colon = line.indexOf(":");
        if (colon === -1) continue;
        const key = line.slice(0, colon).trim();
        const val = line.slice(colon + 1).trim().replace(/^["']|["']$/g, "");
        if (key) result[key] = val;
    }
    return result;
}

function stripFrontmatter(raw) {
    if (!raw.startsWith("---")) return raw;
    const end = raw.indexOf("\n---", 3);
    return end === -1 ? raw : raw.slice(end + 4).trimStart();
}

function escapeRegex(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Extract the content of a named markdown section (## Heading … next ## Heading).
// Returns empty string if the section is not present.
function extractSection(body, heading) {
    const re = new RegExp(`^#{1,3}\\s+${escapeRegex(heading)}\\s*$`, "im");
    const m  = re.exec(body);
    if (!m) return "";
    const after = body.slice(m.index + m[0].length);
    const next  = /^#{1,3}\s/m.exec(after);
    return (next ? after.slice(0, next.index) : after).trim();
}

function buildEmbedText(file, raw, fm) {
    const title  = fm.title  ?? file.basename ?? "";
    const domain = fm.domain ?? "";
    const topic  = fm.topic  ?? "";
    const body   = stripFrontmatter(raw);

    const parts = [`${title}`, `${domain} ${topic}`];

    // Tags — explicit semantic categorisation, high signal for retrieval
    const rawTags = fm.tags;
    const tags = Array.isArray(rawTags) ? rawTags : rawTags ? [String(rawTags)] : [];
    if (tags.length > 0) parts.push(`Tags: ${tags.join(" ")}`);

    // Temporal signals — aid recency-aware queries ("what did I write recently?", "my older notes on X")
    if (fm.created) parts.push(`Created: ${fm.created}`);
    const mtime = file.stat?.mtime ? new Date(file.stat.mtime).toISOString().split("T")[0] : null;
    if (mtime) parts.push(`Last modified: ${mtime}`);

    // Media-specific metadata — helps authorship / format queries
    if (fm.author) parts.push(`Author: ${fm.author}`);
    if (fm.type)   parts.push(`Type: ${fm.type}`);

    // Summary section (Knowledge notes) — extract as a priority preamble so the
    // most distilled representation is always within the first MAX_CHARS window
    // even for very long notes, and is weighted slightly higher by the model.
    const summary = extractSection(body, "Summary");
    if (summary) parts.push(summary);

    parts.push(body);

    return parts.join("\n").slice(0, MAX_CHARS);
}

// ── Gemini Embeddings API ──────────────────────────────────────────────────────

function validateEmbedding(vec) {
    if (!Array.isArray(vec) || vec.length === 0)
        throw new Error(`Embedding API returned invalid vector (type: ${typeof vec}, length: ${vec?.length ?? "null"})`);
    return vec;
}

async function embedText(text, apiKey) {
    const body = JSON.stringify({
        model:   `models/${EMBED_MODEL}`,
        content: { parts: [{ text }] },
    });
    const headers = { "Content-Type": "application/json", "x-goog-api-key": apiKey };

    if (typeof requestUrl !== "undefined") {
        const r    = await requestUrl({ url: EMBED_URL, method: "POST", headers, body, throw: false });
        const json = JSON.parse(r.text);
        if (r.status >= 400) throw new Error(`Embedding API ${r.status}: ${json?.error?.message ?? r.text}`);
        return validateEmbedding(json.embedding.values);
    }

    const res  = await fetch(EMBED_URL, { method: "POST", headers, body });
    const json = await res.json();
    if (!res.ok) throw new Error(`Embedding API ${res.status}: ${json?.error?.message ?? JSON.stringify(json)}`);
    return validateEmbedding(json.embedding.values);
}

// ── Cosine similarity ──────────────────────────────────────────────────────────

function cosineSimilarity(a, b) {
    let dot = 0, magA = 0, magB = 0;
    for (let i = 0; i < a.length; i++) {
        dot  += a[i] * b[i];
        magA += a[i] * a[i];
        magB += b[i] * b[i];
    }
    const denom = Math.sqrt(magA) * Math.sqrt(magB);
    return denom === 0 ? 0 : dot / denom;
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Index all vault notes. Skips notes whose content hasn't changed since last index.
 * Removes orphaned entries for notes that have been deleted from the vault.
 *
 * @param {string}   apiKey      Gemini API key
 * @param {Function} onProgress  Called with { done, total, current, indexed, skipped, errors } after each note
 * @returns {Promise<{ indexed, skipped, errors, removed }>}
 */
async function indexVault(apiKey, onProgress) {
    const excluded = getExcludedFolders();
    const files = dc.app.vault.getMarkdownFiles().filter(f => {
        if (isExcluded(f.path, excluded)) return false;
        const fm = dc.app.metadataCache.getFileCache(f)?.frontmatter;
        if (fm?.dashboard === true) return false;
        if (fm?.indexed === false) return false;
        return true;
    });
    const index = await loadIndex();

    // Remove orphaned entries (notes deleted from vault)
    const vaultPaths = new Set(files.map(f => f.path));
    let removed = 0;
    for (const path of Object.keys(index.notes)) {
        if (!vaultPaths.has(path)) {
            delete index.notes[path];
            removed++;
        }
    }

    // Migration: backfill contentChars for entries indexed before this field existed.
    // Reads files locally — no API calls, runs once per entry and never again.
    let migrated = 0;
    for (const [path, entry] of Object.entries(index.notes)) {
        if (entry.contentChars != null) continue;
        try {
            const file = dc.app.vault.getAbstractFileByPath(path);
            if (!file) continue;
            const raw = await dc.app.vault.read(file);
            const fm  = dc.app.metadataCache.getFileCache(file)?.frontmatter ?? {};
            entry.contentChars = buildEmbedText(file, raw, fm).length;
            migrated++;
        } catch (e) { entry.contentChars = 0; }
    }
    if (migrated > 0) await saveIndex(index);

    let indexed = 0, skipped = 0, errors = 0;
    const total = files.length;

    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const path = file.path;

        try {
            const raw  = await dc.app.vault.read(file);
            const hash = contentHash(raw);

            // Skip if already indexed and content unchanged
            const existing = index.notes[path];
            if (existing && existing.contentHash === hash) {
                skipped++;
                onProgress?.({ done: i + 1, total, current: file.basename, indexed, skipped, errors });
                continue;
            }

            const fm   = dc.app.metadataCache.getFileCache(file)?.frontmatter ?? {};
            const text = buildEmbedText(file, raw, fm);

            // Throttle based on actual token cost — respects both RPM and TPM limits
            await throttleForTokens(estimateTokens(text));

            const embedding = await embedText(text, apiKey);

            index.notes[path] = {
                path,
                contentHash: hash,
                embedding,
                contentChars: text.length,
                title:     String(fm.title ?? file.basename ?? path),
                domain:    String(fm.domain ?? ""),
                topic:     String(fm.topic  ?? ""),
                indexedAt: Date.now(),
            };

            indexed++;

        } catch (err) {
            errors++;
            console.error(`[Embeddings] Failed to index ${path}:`, err);
        }

        onProgress?.({ done: i + 1, total, current: file.basename, indexed, skipped, errors });
    }

    index.lastUpdated = Date.now();
    await saveIndex(index);
    return { indexed, skipped, errors, removed };
}

/**
 * Search the index by semantic similarity.
 *
 * @param {string} query    Natural-language search query
 * @param {string} apiKey   Gemini API key
 * @param {object} options  { limit=15, domain?, topic? }
 * @returns {Promise<{ results: Array<{path,title,domain,topic,score}> }>}
 */
async function semanticSearch(query, apiKey, { limit = 15, domain, topic, folder } = {}) {
    const index   = await loadIndex();
    const records = Object.values(index.notes);

    if (records.length === 0) {
        return {
            error: "The semantic index is empty. Open Settings > Semantic Index and click Update Index to build it.",
            results: [],
        };
    }

    const queryVec = await embedText(query, apiKey);

    let scored = records.map(r => ({
        path:   r.path,
        title:  r.title,
        domain: r.domain,
        topic:  r.topic,
        score:  Math.round(cosineSimilarity(queryVec, r.embedding) * 1000) / 1000,
    }));

    if (domain) scored = scored.filter(r => r.domain === domain);
    if (topic)  scored = scored.filter(r => r.topic  === topic);
    if (folder) scored = scored.filter(r => r.path.startsWith(folder));

    scored.sort((a, b) => b.score - a.score);
    return { results: scored.slice(0, limit) };
}

async function getIndexStats() {
    const index   = await loadIndex();
    const records = Object.values(index.notes);

    if (records.length === 0) return { total: 0, stale: 0, lastUpdated: null };

    let stale = 0;
    for (const r of records) {
        const file = dc.app.vault.getAbstractFileByPath(r.path);
        if (!file) { stale++; continue; }
        if ((file.stat?.mtime ?? 0) > r.indexedAt) stale++;
    }

    return { total: records.length, stale, lastUpdated: index.lastUpdated };
}

async function clearIndex() {
    const empty = { version: 1, lastUpdated: null, notes: {} };
    await saveIndex(empty);
}

// Returns all indexed notes (without embedding vectors) sorted by domain → title.
async function getIndexNotes() {
    const index = await loadIndex();
    return Object.values(index.notes)
        .map(({ path, title, domain, topic, contentChars, indexedAt }) => ({ path, title, domain, topic, contentChars, indexedAt }))
        .sort((a, b) => {
            const d = (a.domain ?? "").localeCompare(b.domain ?? "");
            return d !== 0 ? d : (a.title ?? "").localeCompare(b.title ?? "");
        });
}

return { indexVault, semanticSearch, getIndexStats, getIndexNotes, clearIndex, getExcludedFolders, setExcludedFolders };
