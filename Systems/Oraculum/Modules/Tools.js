// Oraculum tool declarations and implementations.
// Loaded with: const T = await dc.require("Systems/Oraculum/Modules/Tools.js");
//
// TOOL_DECLARATIONS  → pass to Gemini API as functionDeclarations
// executeTool(name, args) → dispatch and run a tool by name
//
// Schema types are UPPERCASE per Gemini API docs (OBJECT, STRING, NUMBER, BOOLEAN, ARRAY).
// Lowercase types cause "500 Internal" errors with Gemma 4.

// ─── Module imports ─────────────────────────────────────────────────────────
// Research module — Gemini 2.5 Flash + Search grounding for batched deep research.
const R = await dc.require("Systems/Oraculum/Modules/Research.js");
// Shared HTTP helpers (httpGet, fetchPageText).
const W = await dc.require("Toolkit/Datacore/Web.js");
// localStorage cache shared with Research.js.
const C = await dc.require("Toolkit/Datacore/Cache.js");
// Vault helpers (safeName, ensureFolder, today, fmtDate, setField…).
const V = await dc.require("Toolkit/Datacore/Vault.js");

// ─── Supadata API ─────────────────────────────────────────────────────────────
// Key stored in localStorage under "oraculum:supadata-key".
// Powers fetch_video_transcript and fetch_social_metadata tools.
// Gemini API key (same key used by GeminiClient.js for generation — reused for embeddings).
function getGeminiApiKey() { return (typeof localStorage !== "undefined" ? localStorage.getItem("oraculum:gemini-api-key") : null) || null; }

const LS_SUPADATA_KEY = "oraculum:supadata-key";
function getSupadataKey()   { return (typeof localStorage !== "undefined" ? localStorage.getItem(LS_SUPADATA_KEY) : null) || null; }
function saveSupadataKey(k) { if (typeof localStorage !== "undefined") localStorage.setItem(LS_SUPADATA_KEY, k.trim()); }
function clearSupadataKey() { if (typeof localStorage !== "undefined") localStorage.removeItem(LS_SUPADATA_KEY); }

async function supadataGet(path, params = {}) {
    const apiKey = getSupadataKey();
    if (!apiKey) return { ok: false, error: "__NO_SUPADATA_KEY__", status: 0, json: null };
    const url = new URL(`https://api.supadata.ai/v1${path}`);
    for (const [k, v] of Object.entries(params)) {
        if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
    }
    const headers = { "x-api-key": apiKey };
    if (typeof requestUrl !== "undefined") {
        try {
            const r = await requestUrl({ url: url.toString(), headers, throw: false });
            let json; try { json = JSON.parse(r.text); } catch (_) {}
            return { ok: r.status < 400, status: r.status, text: r.text, json };
        } catch (e) { return { ok: false, status: 0, text: "", error: e.message, json: null }; }
    }
    const r = await fetch(url.toString(), { headers });
    const text = await r.text();
    let json; try { json = JSON.parse(text); } catch (_) {}
    return { ok: r.ok, status: r.status, text, json };
}

// ─── Optional integration API keys ────────────────────────────────────────────
// All optional. Tools fall back to anonymous/free-tier behavior when missing.
const LS_GITHUB_KEY     = "oraculum:github-token";
const LS_STACKEX_KEY    = "oraculum:stackexchange-key";
const LS_GOOGLEBOOKS_KEY    = "oraculum:googlebooks-key";    // optional, raises 1k → 100k req/day
const LS_OPENLIBRARY_EMAIL  = "oraculum:openlibrary-email";  // optional, identifies requests → 3 req/s instead of 1

function getGithubToken()    { return (typeof localStorage !== "undefined" ? localStorage.getItem(LS_GITHUB_KEY) : null) || null; }
function saveGithubToken(k)  { if (typeof localStorage !== "undefined") localStorage.setItem(LS_GITHUB_KEY, k.trim()); }
function clearGithubToken()  { if (typeof localStorage !== "undefined") localStorage.removeItem(LS_GITHUB_KEY); }

function getStackExKey()     { return (typeof localStorage !== "undefined" ? localStorage.getItem(LS_STACKEX_KEY) : null) || null; }
function saveStackExKey(k)   { if (typeof localStorage !== "undefined") localStorage.setItem(LS_STACKEX_KEY, k.trim()); }
function clearStackExKey()   { if (typeof localStorage !== "undefined") localStorage.removeItem(LS_STACKEX_KEY); }

function getGoogleBooksKey()    { return (typeof localStorage !== "undefined" ? localStorage.getItem(LS_GOOGLEBOOKS_KEY) : null) || null; }
function saveGoogleBooksKey(k)  { if (typeof localStorage !== "undefined") localStorage.setItem(LS_GOOGLEBOOKS_KEY, k.trim()); }
function clearGoogleBooksKey()  { if (typeof localStorage !== "undefined") localStorage.removeItem(LS_GOOGLEBOOKS_KEY); }

function getOpenLibraryEmail()    { return (typeof localStorage !== "undefined" ? localStorage.getItem(LS_OPENLIBRARY_EMAIL) : null) || null; }
function saveOpenLibraryEmail(k)  { if (typeof localStorage !== "undefined") localStorage.setItem(LS_OPENLIBRARY_EMAIL, k.trim()); }
function clearOpenLibraryEmail()  { if (typeof localStorage !== "undefined") localStorage.removeItem(LS_OPENLIBRARY_EMAIL); }


function getFile(path) {
    return dc.app.vault.getFileByPath?.(path) ?? dc.app.vault.getAbstractFileByPath(path);
}

/**
 * Create a note with frontmatter + body. Returns {path} or {error}.
 * frontmatter is an object; values may be strings, numbers, arrays of strings.
 */
async function createNote(folder, fileName, frontmatter, body) {
    await V.ensureFolder(folder);

    // Find a unique path — Windows-style (2), (3), ... if the name is taken
    let path = `${folder}/${V.safeName(fileName)}.md`;
    let n = 2;
    while (getFile(path)) {
        path = `${folder}/${V.safeName(fileName)} (${n}).md`;
        n++;
    }

    const fmLines = ["---"];
    for (const [k, v] of Object.entries(frontmatter)) {
        if (v == null || v === "") continue;
        if (Array.isArray(v)) {
            fmLines.push(`${k}:`);
            for (const item of v) fmLines.push(`  - ${item}`);
        } else if (typeof v === "string" && (v.includes(":") || v.includes("#"))) {
            fmLines.push(`${k}: "${v.replace(/"/g, '\\"')}"`);
        } else {
            fmLines.push(`${k}: ${v}`);
        }
    }
    fmLines.push("---", "");

    const content = fmLines.join("\n") + (body ?? "");
    await dc.app.vault.create(path, content);
    return { success: true, path };
}

/**
 * Find a file by basename (case-insensitive) within a folder prefix.
 */
function findByName(name, folderPrefix) {
    const target = String(name).toLowerCase();
    return dc.app.vault.getMarkdownFiles().find(
        f =>
            (!folderPrefix || f.path.startsWith(folderPrefix)) &&
            f.basename.toLowerCase() === target
    );
}

// ─── Tool: search_notes ───────────────────────────────────────────────────────

async function search_notes({ query, folder, limit = 10 }) {
    const files = dc.app.vault.getMarkdownFiles();
    const scope = folder ? files.filter(f => f.path.startsWith(folder)) : files;

    const q = query.toLowerCase();
    const results = [];
    for (const file of scope) {
        if (results.length >= limit) break;
        try {
            const content = await dc.app.vault.cachedRead(file);
            if (
                content.toLowerCase().includes(q) ||
                file.basename.toLowerCase().includes(q)
            ) {
                results.push({
                    path: file.path,
                    title: file.basename,
                    excerpt: content
                        .replace(/^---[\s\S]*?---/, "")
                        .trim()
                        .slice(0, 300),
                });
            }
        } catch (_) {}
    }

    return results.length ? { results } : { results: [], info: `No notes match "${query}".` };
}

// ─── Tool: get_note ───────────────────────────────────────────────────────────

async function get_note({ path, section }) {
    const file = getFile(path);
    if (!file) return { error: `Note not found: ${path}` };

    const content = await dc.app.vault.read(file);

    if (!section) {
        return {
            path,
            content: content.length > 4000 ? content.slice(0, 4000) + "\n…[truncated]" : content,
        };
    }

    // Extract a specific section by heading text (any level, case-insensitive)
    const lines = content.split("\n");
    const headingIdx = lines.findIndex(l =>
        /^#+\s+/.test(l) && l.replace(/^#+\s+/, "").trim().toLowerCase() === section.toLowerCase()
    );
    if (headingIdx === -1) return { error: `Section "${section}" not found in ${path}` };

    const headingLevel = lines[headingIdx].match(/^(#+)/)[1].length;
    const sectionLines = [lines[headingIdx]];
    for (let i = headingIdx + 1; i < lines.length; i++) {
        const m = lines[i].match(/^(#+)\s+/);
        if (m && m[1].length <= headingLevel) break;
        sectionLines.push(lines[i]);
    }

    return { path, section, content: sectionLines.join("\n") };
}

// ─── Tool: get_frontmatter ────────────────────────────────────────────────────

async function get_frontmatter({ path }) {
    const file = getFile(path);
    if (!file) return { error: `Note not found: ${path}` };
    const meta = dc.app.metadataCache.getFileCache(file);
    return { path, frontmatter: meta?.frontmatter ?? {} };
}

// ─── Tool: update_frontmatter ─────────────────────────────────────────────────

async function update_frontmatter({ path, updates }) {
    const file = getFile(path);
    if (!file) return { error: `Note not found: ${path}` };
    if (!updates || typeof updates !== "object") return { error: "updates must be an object" };

    await dc.app.fileManager.processFrontMatter(file, fm => {
        for (const [k, v] of Object.entries(updates)) {
            fm[k] = v;
        }
    });
    return { success: true, path, updated: Object.keys(updates) };
}

// ─── Tool: append_to_note ─────────────────────────────────────────────────────

async function append_to_note({ path, content, section }) {
    const file = getFile(path);
    if (!file) return { error: `Note not found: ${path}` };

    const existing = await dc.app.vault.read(file);

    let next;
    if (!section) {
        next = existing.replace(/\s*$/, "") + "\n\n" + content + "\n";
    } else {
        const lines = existing.split("\n");
        const headingIdx = lines.findIndex(l =>
            /^#+\s+/.test(l) && l.replace(/^#+\s+/, "").trim().toLowerCase() === section.toLowerCase()
        );
        if (headingIdx === -1) return { error: `Section "${section}" not found` };

        const headingLevel = lines[headingIdx].match(/^(#+)/)[1].length;
        let insertIdx = lines.length;
        for (let i = headingIdx + 1; i < lines.length; i++) {
            const m = lines[i].match(/^(#+)\s+/);
            if (m && m[1].length <= headingLevel) { insertIdx = i; break; }
        }
        lines.splice(insertIdx, 0, "", content, "");
        next = lines.join("\n");
    }

    await dc.app.vault.modify(file, next);
    return { success: true, path };
}

// ─── Tool: list_folder ────────────────────────────────────────────────────────

async function list_folder({ path }) {
    const folder = dc.app.vault.getAbstractFileByPath(path);
    if (!folder || !folder.children) return { error: `Folder not found: ${path}` };
    return {
        path,
        items: folder.children.map(c => ({
            name: c.name,
            path: c.path,
            type: c.children ? "folder" : "file",
        })),
    };
}

// ─── Discovery tools ──────────────────────────────────────────────────────────
// These let the model browse the vault by frontmatter fields without reading
// every note. They are ESSENTIAL for "should I do X or Y" research questions
// and for mapping user intent to existing structure (existing topic? new one?).

/**
 * Aggregate unique values of a single frontmatter field across notes in a folder.
 * Returns a count for each value so the model can spot popular topics/categories.
 */
async function list_field_values({ field, folder }) {
    const files = dc.app.vault.getMarkdownFiles()
        .filter(f => !folder || f.path.startsWith(folder));

    const counts = {};
    for (const file of files) {
        const v = dc.app.metadataCache.getFileCache(file)?.frontmatter?.[field];
        if (v == null || v === "") continue;
        const items = Array.isArray(v) ? v : [v];
        for (const item of items) {
            const key = String(item).replace(/^\[\[|\]\]$/g, "").trim();
            if (!key) continue;
            counts[key] = (counts[key] ?? 0) + 1;
        }
    }

    const values = Object.entries(counts)
        .map(([value, count]) => ({ value, count }))
        .sort((a, b) => b.count - a.count);

    return { field, folder: folder ?? "(all)", values };
}

/**
 * Find notes by a frontmatter field value (exact or substring match).
 * Returns lightweight summaries — no body — so the model can decide what to read.
 */
async function find_by_field({ field, value, folder, exact = false, limit = 50 }) {
    const target = String(value).toLowerCase();
    const files = dc.app.vault.getMarkdownFiles()
        .filter(f => !folder || f.path.startsWith(folder));

    const matches = [];
    for (const file of files) {
        if (matches.length >= limit) break;
        const fm = dc.app.metadataCache.getFileCache(file)?.frontmatter;
        const v = fm?.[field];
        if (v == null) continue;
        const items = Array.isArray(v) ? v : [v];
        const hit = items.some(item => {
            const s = String(item).replace(/^\[\[|\]\]$/g, "").toLowerCase();
            return exact ? s === target : s.includes(target);
        });
        if (hit) {
            matches.push({
                path: file.path,
                title: file.basename,
                frontmatter: fm,
            });
        }
    }

    return { field, value, count: matches.length, matches };
}

/**
 * List notes by tag (substring match on full tag string).
 * Returns lightweight summaries.
 */
async function find_by_tag({ tag, limit = 50 }) {
    const target = String(tag).toLowerCase().replace(/^#/, "");
    const matches = [];
    for (const file of dc.app.vault.getMarkdownFiles()) {
        if (matches.length >= limit) break;
        const cache = dc.app.metadataCache.getFileCache(file);
        const tagsFM = cache?.frontmatter?.tags ?? [];
        const tagsArr = Array.isArray(tagsFM) ? tagsFM : [tagsFM];
        const inlineTags = (cache?.tags ?? []).map(t => String(t.tag).replace(/^#/, ""));
        const all = [...tagsArr.map(String), ...inlineTags];
        if (all.some(t => t.toLowerCase().includes(target))) {
            matches.push({
                path: file.path,
                title: file.basename,
                frontmatter: cache?.frontmatter ?? {},
            });
        }
    }
    return { tag, count: matches.length, matches };
}

/**
 * Generic listing of notes in a folder with all their frontmatter.
 * Useful for "list_resources", "list_media", etc. without hardcoding each.
 */
async function list_notes_in({ folder, status, type }) {
    const files = dc.app.vault.getMarkdownFiles()
        .filter(f => f.path.startsWith(folder));

    const items = files.map(file => {
        const fm = dc.app.metadataCache.getFileCache(file)?.frontmatter ?? {};
        return { path: file.path, title: file.basename, frontmatter: fm };
    });

    const filtered = items.filter(i =>
        (!status || i.frontmatter.status === status) &&
        (!type   || i.frontmatter.type   === type)
    );

    return { folder, count: filtered.length, items: filtered };
}

// ─── ANIMA: Habits ────────────────────────────────────────────────────────────

async function list_habits() {
    const todayKey = "d_" + V.today();
    const files = dc.app.vault
        .getMarkdownFiles()
        .filter(f => f.path.startsWith("Systems/Habits/") && f.basename !== "Habits");

    return {
        habits: files.map(file => {
            const meta = dc.app.metadataCache.getFileCache(file);
            const fm = meta?.frontmatter ?? {};
            const log = fm.log ?? [];
            const logArr = Array.isArray(log) ? log : [log];
            return {
                name: file.basename,
                frequency: fm.frequency ?? "Daily",
                category: fm.category ?? null,
                done_today: logArr.includes(todayKey),
                last_seven: logArr.slice(-7).map(d => String(d).replace("d_", "")),
            };
        }),
    };
}

/**
 * Compute streak, completion rate, and best streak for a habit over N days.
 */
async function get_habit_insights({ habit_name, days = 30 }) {
    const file = findByName(habit_name, "Systems/Habits/");
    if (!file) return { error: `Habit "${habit_name}" not found` };

    const meta = dc.app.metadataCache.getFileCache(file);
    const log = meta?.frontmatter?.log ?? [];
    const logArr = (Array.isArray(log) ? log : [log]).map(d => String(d).replace("d_", ""));

    const logSet = new Set(logArr);
    const todayStr = V.today();
    const msPerDay = 86400000;

    // Build window of `days` days ending today
    const window = [];
    for (let i = days - 1; i >= 0; i--) {
        const d = new Date(Date.now() - i * msPerDay);
        window.push(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`);
    }

    const windowDone = window.filter(d => logSet.has(d)).length;
    const completionRate = Math.round((windowDone / days) * 100);

    // Current streak (backwards from today)
    let currentStreak = 0;
    for (let i = 0; i < 365; i++) {
        const d = new Date(Date.now() - i * msPerDay);
        const ds = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
        if (logSet.has(ds)) currentStreak++;
        else break;
    }

    // Best streak across all logged dates
    const sorted = [...logArr].sort();
    let bestStreak = 0, run = 0, prev = null;
    for (const ds of sorted) {
        if (prev) {
            const diff = (new Date(ds) - new Date(prev)) / msPerDay;
            run = diff === 1 ? run + 1 : 1;
        } else { run = 1; }
        if (run > bestStreak) bestStreak = run;
        prev = ds;
    }

    return {
        habit: file.basename,
        window_days: days,
        done_in_window: windowDone,
        completion_rate_pct: completionRate,
        current_streak: currentStreak,
        best_streak: bestStreak,
        total_logged: logArr.length,
        last_five: logArr.slice(-5),
    };
}

async function log_habit({ habit_name, date }) {
    const dateKey = "d_" + (date ?? V.today());
    const file = findByName(habit_name, "Systems/Habits/");
    if (!file) {
        const names = dc.app.vault
            .getMarkdownFiles()
            .filter(f => f.path.startsWith("Systems/Habits/") && f.basename !== "Habits")
            .map(f => f.basename)
            .join(", ");
        return { error: `Habit "${habit_name}" not found. Available: ${names}` };
    }

    let alreadyLogged = false;
    await dc.app.fileManager.processFrontMatter(file, fm => {
        if (!Array.isArray(fm.log)) fm.log = [];
        if (fm.log.includes(dateKey)) alreadyLogged = true;
        else fm.log.push(dateKey);
    });

    return { success: true, habit: file.basename, date: dateKey.replace("d_", ""), alreadyLogged };
}

async function create_habit({ name, frequency = "Daily", category }) {
    return createNote("Systems/Habits", name, {
        log: [],
        frequency,
        ...(category ? { category } : {}),
        tags: ["system/habits/habit"],
        created: V.today(),
    }, `# ${name}\n`);
}

// ─── ANIMA: Job Applications ──────────────────────────────────────────────────

async function list_job_applications({ status } = {}) {
    const files = dc.app.vault
        .getMarkdownFiles()
        .filter(f => f.path.startsWith("Systems/Job Search/") && f.path !== "Systems/Job Search/Job Search.md");

    const apps = files.map(file => {
        const fm = dc.app.metadataCache.getFileCache(file)?.frontmatter ?? {};
        return {
            path: file.path,
            company: fm.company,
            role: fm.role,
            status: fm.status,
            applied: fm.applied,
        };
    });

    return { applications: status ? apps.filter(a => a.status === status) : apps };
}

async function create_job_application({ company, role, status = "Applied", applied, url }) {
    const fileName = `${company} - ${role}`;
    return createNote("Systems/Job Search", fileName, {
        company,
        role,
        status,
        applied: applied ?? V.today(),
        url,
        tags: ["system/jobs/application"],
        created: V.today(),
    }, `# ${company} - ${role}\n\n## Role\n\n## Why interesting\n\n## Compensation\n\n## Contacts\n\n## Follow-ups\n\n## Notes\n`);
}

async function update_job_status({ company, role, new_status }) {
    const fileName = `${company} - ${role}`;
    const file = findByName(fileName, "Systems/Job Search/");
    if (!file) return { error: `Application "${fileName}" not found` };

    await dc.app.fileManager.processFrontMatter(file, fm => {
        fm.status = new_status;
        // Match dashboard behaviour: auto-set applied date when moving to Applied
        if (new_status === "Applied" && !fm.applied) fm.applied = V.today();
    });
    return { success: true, path: file.path, new_status };
}

// ─── COGITO: Notes ────────────────────────────────────────────────────────────

const NOTE_TEMPLATES = {
    Knowledge: "## Summary\n\n## How it works\n\n## Why it matters\n\n## References\n",
    Process:   "## When to use\n\n## Steps\n\n## Watch out for\n\n## References\n",
    Idea:      "## Pitch\n\n## Why\n\n## Open questions\n",
    Reference: "## Overview\n\n## Notes\n",
};

async function create_note({ title, domain = "Reference", topic, status = "Stub" }) {
    const tpl = NOTE_TEMPLATES[domain] ?? NOTE_TEMPLATES.Basic;
    return createNote("Systems/Cogito/Notes", title, {
        status,
        domain,
        topic,
        tags: ["system/cogito/note"],
        created: V.today(),
    }, `# ${title}\n\n${tpl}`);
}

// ─── COGITO: Media ────────────────────────────────────────────────────────────

async function create_media_note({ title, type, author, source, topic, status = "Backlog" }) {
    return createNote("Systems/Cogito/Media", title, {
        status,
        type,
        author,
        topic,
        source,
        tags: ["system/cogito/media"],
        created: V.today(),
    }, `# ${title}\n`);
}

async function update_media_status({ title, new_status }) {
    const file = findByName(title, "Systems/Cogito/Media/");
    if (!file) return { error: `Media note "${title}" not found` };
    await dc.app.fileManager.processFrontMatter(file, fm => { fm.status = new_status; });
    return { success: true, path: file.path, new_status };
}

// ─── FABRICA: Projects ────────────────────────────────────────────────────────

async function list_projects({ status } = {}) {
    const files = dc.app.vault
        .getMarkdownFiles()
        .filter(f => f.path.startsWith("Systems/Projects/") && f.path !== "Systems/Projects/Projects.md");

    const projects = files.map(file => {
        const fm = dc.app.metadataCache.getFileCache(file)?.frontmatter ?? {};
        return {
            path: file.path,
            name: file.basename,
            status: fm.status,
            category: fm.category,
            summary: fm.summary,
        };
    });

    return { projects: status ? projects.filter(p => p.status === status) : projects };
}

async function create_project({ name, category, status = "Idea", summary, stack }) {
    return createNote("Systems/Projects", name, {
        status,
        category,
        stack,
        summary,
        tags: ["system/projects/project"],
        created: V.today(),
    }, `# ${name}\n\n## Goals\n\n## Stack\n\n## Resources\n\n## Notes\n`);
}

// ─── FABRICA: Presentations ───────────────────────────────────────────────────

/**
 * Returns the slide pattern vocabulary. Pure function — no vault access needed.
 * Call this before writing a presentation body so you can choose the right layout
 * per slide based on its content type.
 */
async function get_slide_patterns() {
    return {
        description: "Slide layout patterns for Advanced Slides (Reveal.js). Pick the pattern that fits the content — don't mix patterns within one slide.",
        patterns: [
            {
                name: "title-slide",
                best_for: "Opening slide only. One per deck.",
                note: "If title is > 4 words, add <!-- .slide: style=\"font-size:0.75em;\" --> so it fits.",
                syntax: [
                    "# Presentation Title",
                    "### One-line hook or subtitle",
                    "",
                    "Note: Speaker notes here.",
                ].join("\n"),
            },
            {
                name: "section-divider",
                best_for: "Between major topics. Use every 2-4 content slides for visual rhythm.",
                note: "Color palette: #1e3a5f (blue/tech), #1a3a2a (green/success), #3a1a1a (red/warning), #2a1a3a (purple/concepts).",
                syntax: [
                    "<!-- .slide: data-background-color=\"#1e3a5f\" -->",
                    "## Section Title",
                ].join("\n"),
            },
            {
                name: "content",
                best_for: "Standard explanation or fact slide. Max 3–4 bullets, ≤10 words each.",
                syntax: [
                    "## Slide Title",
                    "",
                    "- Short point",
                    "- Short point",
                    "- Short point",
                ].join("\n"),
            },
            {
                name: "fragment-build",
                best_for: "Step-by-step processes, building an argument — when the audience needs to absorb each point before seeing the next. Max 4 steps.",
                note: "Add <!-- .element: class=\"fragment\" --> to EVERY bullet for sequential reveal.",
                syntax: [
                    "## Slide Title",
                    "",
                    "- Step one <!-- .element: class=\"fragment\" -->",
                    "- Step two <!-- .element: class=\"fragment\" -->",
                    "- Step three <!-- .element: class=\"fragment\" -->",
                ].join("\n"),
            },
            {
                name: "two-column",
                best_for: "Comparisons: OOP vs DOD, before vs after, pros vs cons. Max 3 bullets per column.",
                syntax: [
                    "## Compare",
                    "",
                    "<div style=\"display:grid;grid-template-columns:1fr 1fr;gap:2em\">",
                    "<div>",
                    "",
                    "### Left",
                    "- Point A",
                    "- Point B",
                    "",
                    "</div>",
                    "<div>",
                    "",
                    "### Right",
                    "- Point X",
                    "- Point Y",
                    "",
                    "</div>",
                    "</div>",
                ].join("\n"),
            },
            {
                name: "big-quote",
                best_for: "Key insight, memorable statement, or quote. One powerful sentence only.",
                syntax: [
                    "<!-- .slide: style=\"text-align:center;\" -->",
                    "",
                    "> \"Your memorable statement here.\"",
                ].join("\n"),
            },
            {
                name: "impact-number",
                best_for: "Dramatic metric or statistic. One big number + one short label.",
                syntax: [
                    "<!-- .slide: style=\"text-align:center;\" -->",
                    "",
                    "# 100×",
                    "",
                    "slower than L1 cache",
                ].join("\n"),
            },
            {
                name: "code-walkthrough",
                best_for: "Explaining code step by step. Use line-highlight ranges to guide focus through the code.",
                note: "No bullet points on code slides. Use ranges like [1-3|4-6|7] for progressive highlighting.",
                syntax: [
                    "## Code Title",
                    "",
                    "```language [1-3|4-6]",
                    "// your code here",
                    "```",
                    "",
                    "One sentence explaining what the highlighted lines do.",
                ].join("\n"),
            },
            {
                name: "summary",
                best_for: "End-of-section recap or final slide. Use checkmarks for completed points.",
                syntax: [
                    "## Key Takeaways",
                    "",
                    "- ✅ Point one",
                    "- ✅ Point two",
                    "- ✅ Point three",
                ].join("\n"),
            },
        ],
        hard_rules: [
            "Max 3-4 bullets per slide. More content = new slide.",
            "Bullets must be ≤ 10 words. Never use full sentences as bullets.",
            "Never mix bullet points and a code block on the same slide.",
            "Tables: max 5 rows. Split larger tables across two slides.",
            "A 10-minute talk = ~10-15 slides. More is fine; fewer dense ones is not.",
            "Every deck needs at least one section-divider.",
        ],
    };
}

async function list_presentations({ category, status } = {}) {
    const files = dc.app.vault
        .getMarkdownFiles()
        .filter(f => f.path.startsWith("Systems/Presentations/") && f.path !== "Systems/Presentations/Presentations.md");

    const presentations = files.map(file => {
        const fm = dc.app.metadataCache.getFileCache(file)?.frontmatter ?? {};
        return {
            path:     file.path,
            title:    file.basename,
            category: fm.category,
            status:   fm.status,
            created:  fm.created,
        };
    });

    return {
        presentations: presentations.filter(p =>
            (!category || p.category === category) &&
            (!status   || p.status   === status)
        ),
    };
}

async function create_presentation({ title, category = "Technical", status = "Idea" }) {
    const withRefs = ["Technical", "Deep Dive"].includes(category);
    // Scaffold shows pattern examples — the AI will replace this via write_note_body.
    // title-slide → section-divider → content pattern modelled here.
    const parts = [
        `# ${title}`,
        `### One-line hook or subtitle`,
        ``,
        `Note: Speaker notes go here.`,
        ``,
        `---`,
        `<!-- .slide: data-background-color="#1e3a5f" -->`,
        `## Section`,
        ``,
        `---`,
        ``,
        `## Slide Title`,
        ``,
        `- Point one`,
        `- Point two`,
        `- Point three`,
    ];
    if (withRefs) parts.push(``, `---`, ``, `## References`, ``);

    return createNote("Systems/Presentations", title, {
        theme:           "moon",
        highlightTheme:  "github-dark",
        transition:      "slide",
        category,
        status,
        tags:    ["system/presentations/presentation"],
        created: V.today(),
        aliases: [],
    }, parts.join("\n"));
}

// ─── FABRICA: Issues ──────────────────────────────────────────────────────────

async function list_issues({ project, status } = {}) {
    const files = dc.app.vault
        .getMarkdownFiles()
        .filter(f => f.path.startsWith("Systems/Issues/") && f.path !== "Systems/Issues/Issues.md");

    const issues = files.map(file => {
        const fm = dc.app.metadataCache.getFileCache(file)?.frontmatter ?? {};
        return {
            path: file.path,
            title: file.basename,
            project: typeof fm.project === "string" ? fm.project.replace(/^\[\[|\]\]$/g, "") : fm.project,
            status: fm.status,
            priority: fm.priority,
        };
    });

    return {
        issues: issues.filter(i =>
            (!status || i.status === status) &&
            (!project || (i.project && String(i.project).toLowerCase().includes(project.toLowerCase())))
        ),
    };
}

async function create_issue({ project, title, priority = "Med", status = "Backlog" }) {
    const folder = `Systems/Issues/${V.safeName(project)}/${status}`;
    return createNote(folder, title, {
        project: `[[${project}]]`,
        status,
        priority,
        tags: ["system/issues/issue"],
        created: V.today(),
    }, `# ${title}\n`);
}

async function update_issue_status({ title, new_status }) {
    const file = findByName(title, "Systems/Issues/");
    if (!file) return { error: `Issue "${title}" not found` };

    await dc.app.fileManager.processFrontMatter(file, fm => {
        fm.status = new_status;
        if (new_status === "Done") fm.done = V.today();
    });

    const I = await dc.require("Toolkit/Datacore/Issues.js");
    const fm = dc.app.metadataCache.getFileCache(file)?.frontmatter ?? {};
    const project = fm.project ?? "Unfiled";
    const newPath = await I.moveIssueTo(file.path, project, new_status);
    return { success: true, path: newPath, new_status, moved: newPath !== file.path };
}

// ─── FABRICA: Releases ────────────────────────────────────────────────────────

async function create_release({ project, version, status = "Planned", date, breaking = "No" }) {
    const folder = `Systems/Releases/${V.safeName(project)}`;
    return createNote(folder, version, {
        project,
        version,
        status,
        date: date ?? V.today(),
        breaking,
        tags: ["system/releases/release"],
        created: V.today(),
    }, `# ${version}\n\n## Highlights\n\n## Added\n\n## Changed\n\n## Fixed\n\n## Breaking\n`);
}

// ─── FABRICA: Resources ───────────────────────────────────────────────────────

async function create_resource({ name, url, vendor, category, projects }) {
    const fm = {
        url,
        vendor,
        category,
        tags: ["system/resources/resource"],
        created: V.today(),
    };
    if (projects?.length) fm.projects = projects.map(p => `[[${p}]]`);
    return createNote("Systems/Resources", name, fm, `# ${name}\n\n## Notes\n\n## Use cases\n`);
}

// ─── FABRICA: Growth ──────────────────────────────────────────────────────────

async function create_skill({ name, level = "Competent" }) {
    return createNote("Systems/Growth/Skills", name, {
        level,
        tags: ["system/growth/skill"],
        created: V.today(),
    }, `# ${name}\n`);
}

async function create_brag({ title, what, impact, date }) {
    const body = `# ${title}\n\n## What\n${what ?? ""}\n\n## Impact\n${impact ?? ""}\n\n## Skills demonstrated\n`;
    return createNote("Systems/Growth/Brag", title, {
        date: date ?? V.today(),
        tags: ["system/growth/brag"],
        created: V.today(),
    }, body);
}

async function create_adr({ title, context, decision, consequences, status = "Proposed" }) {
    const body = `# ${title}\n\n## Context\n${context ?? ""}\n\n## Decision\n${decision ?? ""}\n\n## Consequences\n${consequences ?? ""}\n\n## Alternatives considered\n`;
    return createNote("Systems/Growth/ADRs", title, {
        status,
        tags: ["system/growth/adr"],
        created: V.today(),
    }, body);
}

async function create_review({ title, went_well, stuck_on, struggled_with, patterns, next }) {
    const body = `# ${title}\n\n## Went well\n${went_well ?? ""}\n\n## Stuck on\n${stuck_on ?? ""}\n\n## Struggled with\n${struggled_with ?? ""}\n\n## Patterns\n${patterns ?? ""}\n\n## Next\n${next ?? ""}\n`;
    return createNote("Systems/Growth/Reviews", title, {
        tags: ["system/growth/review"],
        created: V.today(),
    }, body);
}

async function create_postmortem({ title, date, summary, timeline, root_cause, five_whys, action_items }) {
    const body = `# ${title}\n\n## Summary\n${summary ?? ""}\n\n## Timeline\n${timeline ?? ""}\n\n## Root cause\n${root_cause ?? ""}\n\n## 5 whys\n${five_whys ?? ""}\n\n## Action items\n${action_items ?? ""}\n`;
    return createNote("Systems/Growth/Postmortems", title, {
        date: date ?? V.today(),
        tags: ["system/growth/postmortem"],
        created: V.today(),
    }, body);
}

// ─── Memory & utility tools ───────────────────────────────────────────────────

/** Save a session transcript or summary to Systems/Oraculum/Memory/ */
async function save_session_summary({ title, summary }) {
    return createNote("Systems/Oraculum/Memory", title ?? `Session ${V.today()}`, {
        tags: ["system/oraculum/memory"],
        created: V.today(),
        type: "Session Summary",
    }, `## Transcript\n\n${summary}\n`);
}

/** Append a quick capture item to Cogito/Inbox.md */
async function add_to_inbox({ text, tags }) {
    const file = dc.app.vault.getAbstractFileByPath("Systems/Cogito/Inbox.md");
    if (!file) return { error: "Cogito/Inbox.md not found. Please create it first." };
    const content = await dc.app.vault.cachedRead(file);
    const tagStr = tags?.length ? " " + tags.map(t => `#${t}`).join(" ") : "";
    const line = `- ${text}${tagStr}`;
    await dc.app.vault.modify(file, content.trimEnd() + "\n" + line + "\n");
    return { success: true, path: "Systems/Cogito/Inbox.md", item: line };
}

/**
 * Scan the vault for quality issues using domain-aware lint rules.
 * Each note type is checked against the rules its system actually enforces,
 * not a generic "no backlinks" heuristic (Datacore-managed notes are discovered
 * by tag/query, so backlinks are irrelevant for them).
 */
async function vault_health({ folder }) {
    const { lintFm } = await dc.require("Toolkit/Datacore/LintRules.js");
    const allFiles = dc.app.vault.getMarkdownFiles()
        .filter(f => !folder || f.path.startsWith(folder));

    const issues = [];
    const SKIP_PATHS = ["Toolkit/", "Systems/Oraculum/"];
    const SKIP_BASENAMES = ["README", "Architecture", "Systems", "Setup", "Templates", "Datacore Library"];

    for (const file of allFiles) {
        if (SKIP_PATHS.some(p => file.path.startsWith(p))) continue;
        if (SKIP_BASENAMES.some(n => file.basename === n || file.basename.endsWith(` - ${n}`))) continue;

        const fm = dc.app.metadataCache.getFileCache(file)?.frontmatter ?? {};
        const fileIssues = lintFm(fm, file);
        for (const { issue, severity } of fileIssues) {
            issues.push({ path: file.path, title: file.basename, issue, severity });
        }
    }

    // Sort: high → medium → low
    const ORDER = { high: 0, medium: 1, low: 2 };
    issues.sort((a, b) => (ORDER[a.severity] ?? 9) - (ORDER[b.severity] ?? 9));

    return {
        folder: folder ?? "entire vault",
        total_checked: allFiles.length,
        issue_count: issues.length,
        issues: issues.slice(0, 60),
    };
}

/**
 * Fetch all videos from a public YouTube playlist and return metadata.
 * Does NOT create notes — the AI can then call create_media_note for each.
 */
async function import_youtube_playlist({ playlist_url, limit = 25 }) {
    const idMatch = playlist_url.match(/[?&]list=([A-Za-z0-9_-]+)/);
    if (!idMatch) return { error: "Could not extract playlist ID. Provide a full YouTube URL with ?list=PL..." };
    const playlistId = idMatch[1];

    try {
        const rssUrl = `https://www.youtube.com/feeds/videos.xml?playlist_id=${playlistId}`;
        const res = await W.httpGet(rssUrl);
        if (!res.ok) return { error: `RSS fetch failed (${res.status}). The playlist may be private.` };
        const xml = res.text;

        const entries = [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)].slice(0, limit);
        const videos = entries.map(([, e]) => ({
            title:     e.match(/<title>([^<]+)<\/title>/)?.[1]?.trim(),
            url:       `https://www.youtube.com/watch?v=${e.match(/<yt:videoId>([^<]+)<\/yt:videoId>/)?.[1]}`,
            author:    e.match(/<name>([^<]+)<\/name>/)?.[1]?.trim(),
            published: e.match(/<published>([^<]+)<\/published>/)?.[1]?.slice(0, 10),
        })).filter(v => v.title && v.url && !v.url.endsWith("undefined"));

        return {
            playlist_id: playlistId,
            count: videos.length,
            videos,
            note: "Use create_media_note for each video you want to save. Ask the user how many to import.",
        };
    } catch (e) {
        return { error: `Could not fetch playlist: ${e.message}` };
    }
}

/**
 * Fetch the transcript of a video from any supported platform.
 *
 * Supported: YouTube, TikTok, Instagram, Facebook, X (Twitter), and direct file URLs.
 * Powered by Supadata (api.supadata.ai). Requires a Supadata API key in Settings → Config.
 *
 * @param {string} video_url            Full URL of the video
 * @param {string} [lang="en"]          Preferred language code (ISO 639-1, e.g. "en", "fr")
 * @param {boolean} [include_timestamps=false]  Prefix each segment with [MM:SS]
 */
async function fetch_video_transcript({ video_url, lang = "en", include_timestamps = false }) {
    const cacheKey = `transcript:${video_url}:${lang}:${include_timestamps ? "ts" : "plain"}`;
    const hit = C.get(cacheKey, C.TTL.TRANSCRIPT_MS);
    if (hit) return { ...hit, _cached: true };

    const params = {
        url:  video_url,
        lang,
        text: include_timestamps ? false : true,
    };
    if (include_timestamps) params.chunkSize = 500;

    const sdRes = await supadataGet("/transcript", params);

    if (!sdRes.ok) {
        if (sdRes.error === "__NO_SUPADATA_KEY__")
            return { error: "Supadata API key not configured. Add it in Oraculum Settings → Config → Supadata API Key." };
        if (sdRes.status === 401)
            return { error: "Supadata API key rejected. Check Settings → Config." };
        if (sdRes.status === 402)
            return { error: "Supadata quota exceeded. Check your plan at dash.supadata.ai." };
        if (sdRes.status === 404 || sdRes.json?.error === "not-found")
            return { error: "No transcript available for this video. It may have no captions or be private/age-restricted." };
        return { error: `Transcript fetch failed (HTTP ${sdRes.status}): ${sdRes.json?.message ?? sdRes.text?.slice(0, 200)}` };
    }

    // Handle async job (large videos return jobId instead of content)
    if (sdRes.json?.jobId) {
        const jobId = sdRes.json.jobId;
        for (let i = 0; i < 12; i++) {
            await new Promise(r => setTimeout(r, 3000));
            const jobRes = await supadataGet(`/transcript/${jobId}`);
            if (jobRes.ok && jobRes.json?.status === "completed") { sdRes.json = jobRes.json; break; }
            if (jobRes.json?.status === "failed") return { error: "Transcript generation job failed." };
        }
        if (sdRes.json?.jobId) return { error: "Transcript job timed out after 36 s. Try again." };
    }

    const data = sdRes.json;

    if (include_timestamps) {
        const items = Array.isArray(data?.content) ? data.content : [];
        if (!items.length) return { error: "Transcript returned empty." };
        const lines = items
            .filter(s => s.text?.trim())
            .map(s => {
                const ms = s.offset ?? 0;
                const mm = String(Math.floor(ms / 60000)).padStart(2, "0");
                const ss = String(Math.floor((ms % 60000) / 1000)).padStart(2, "0");
                return `[${mm}:${ss}] ${s.text.trim()}`;
            });
        const transcript = lines.join("\n");
        const result = {
            video_url,
            lang:               data.lang ?? lang,
            available_languages: data.availableLangs ?? [],
            char_count:          transcript.length,
            segment_count:       lines.length,
            transcript,
        };
        C.set(cacheKey, result);
        return result;
    } else {
        let transcript;
        if (typeof data?.content === "string") {
            transcript = data.content;
        } else if (Array.isArray(data?.content)) {
            transcript = data.content.map(s => s.text ?? "").join(" ").replace(/\s{2,}/g, " ").trim();
        } else {
            return { error: "Unexpected transcript format from Supadata." };
        }
        if (!transcript) return { error: "Transcript returned empty." };
        const result = {
            video_url,
            lang:               data.lang ?? lang,
            available_languages: data.availableLangs ?? [],
            char_count:          transcript.length,
            transcript,
        };
        C.set(cacheKey, result);
        return result;
    }
}

/**
 * Fetch metadata from a social media video or post.
 *
 * Supported platforms: YouTube, TikTok, Instagram, Twitter/X, Facebook.
 * Returns title, author, stats (views/likes/comments), duration, thumbnail, tags.
 * Powered by Supadata. Requires a Supadata API key in Settings → Config.
 *
 * @param {string} url   Full URL of the video or post
 */
async function fetch_social_metadata({ url }) {
    const cacheKey = `social_meta:${url}`;
    const hit = C.get(cacheKey);
    if (hit) return { ...hit, _cached: true };

    const sdRes = await supadataGet("/metadata", { url });

    if (!sdRes.ok) {
        if (sdRes.error === "__NO_SUPADATA_KEY__")
            return { error: "Supadata API key not configured. Add it in Oraculum Settings → Config → Supadata API Key." };
        if (sdRes.status === 401) return { error: "Supadata API key rejected. Check Settings → Config." };
        if (sdRes.status === 402) return { error: "Supadata quota exceeded. Check your plan at dash.supadata.ai." };
        if (sdRes.status === 404 || sdRes.json?.error === "not-found")
            return { error: "Content not found. The URL may be private, deleted, or unsupported." };
        return { error: `Metadata fetch failed (HTTP ${sdRes.status}): ${sdRes.json?.message ?? sdRes.text?.slice(0, 200)}` };
    }

    const d = sdRes.json ?? {};
    const result = {
        platform:        d.platform,
        type:            d.type,
        url:             d.url,
        title:           d.title,
        description:     d.description,
        author:          d.author?.displayName ?? d.author?.username ?? null,
        author_verified: d.author?.verified ?? null,
        views:           d.stats?.views   ?? null,
        likes:           d.stats?.likes   ?? null,
        comments:        d.stats?.comments ?? null,
        duration_seconds: d.media?.duration ?? null,
        thumbnail_url:   d.media?.thumbnailUrl ?? null,
        tags:            d.tags ?? [],
        created_at:      d.createdAt ?? null,
    };
    C.set(cacheKey, result);
    return result;
}

// ─── Ambitious cross-cutting tools ────────────────────────────────────────────

/**
 * Fetch metadata for a URL using public APIs (no auth required).
 * - YouTube: uses the official oEmbed endpoint (title, author, thumbnail)
 * - Articles / other: uses allOrigins CORS proxy to read Open Graph tags
 * Returns: { title, author, description, url, source }
 */
async function fetch_url_metadata({ url }) {
    const cacheKey = `url_meta:${url}`;
    const hit = C.get(cacheKey);
    if (hit) return { ...hit, _cached: true };

    // YouTube oEmbed — works for youtu.be and youtube.com/watch
    if (/youtube\.com|youtu\.be/.test(url)) {
        try {
            const endpoint = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
            const res = await W.httpGet(endpoint);
            if (res.ok && res.json) {
                const result = {
                    title: res.json.title,
                    author: res.json.author_name,
                    description: null,
                    url,
                    source: "YouTube oEmbed",
                };
                C.set(cacheKey, result);
                return result;
            }
        } catch (_) {}
    }

    // Generic: fetch page directly and parse Open Graph / <title>
    try {
        const res = await W.httpGet(url);
        if (res.ok && res.text) {
            const html = res.text;
            const og = (prop) => {
                const m = html.match(new RegExp(`<meta[^>]+property=["']og:${prop}["'][^>]+content=["']([^"']+)["']`, "i"))
                         || html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:${prop}["']`, "i"));
                return m?.[1] ?? null;
            };
            const titleM = html.match(/<title[^>]*>([^<]+)<\/title>/i);
            const result = {
                title:       og("title") ?? titleM?.[1]?.trim() ?? null,
                author:      og("site_name") ?? null,
                description: og("description") ?? null,
                url,
                source: "Open Graph",
            };
            C.set(cacheKey, result);
            return result;
        }
    } catch (_) {}

    return { error: "Could not fetch metadata for this URL. Please provide a title manually.", url };
}

/**
 * Generic web scraper. Fetches a page directly, strips non-content
 * elements (scripts, styles, nav, footer, header, aside), and returns cleaned text
 * for Gemma to analyze. Works on server-rendered pages (Wikipedia, docs, blogs).
 * Does NOT work on JS-rendered SPAs (Twitter, YouTube app, etc.).
 */
async function scrape_webpage({ url, max_chars }) {
    const cacheKey = `scrape:${url}`;
    const hit = C.get(cacheKey);
    if (hit) return { ...hit, _cached: true };

    const savedLimit = parseInt(localStorage.getItem("oraculum:scraper-limit")) || 12000;
    const limit = Number(max_chars) || savedLimit;

    let directContent = "";
    let title = null;
    let description = null;

    // ── Step 1: direct fetch + DOM parse ────────────────────────────────────
    try {
        const res = await W.httpGet(url);
        if (res.ok && res.text) {
            const doc = new DOMParser().parseFromString(res.text, "text/html");
            for (const tag of ["script", "style", "nav", "header", "footer", "aside", "noscript", "svg", "iframe"]) {
                doc.querySelectorAll(tag).forEach(el => el.remove());
            }
            doc.querySelectorAll('[aria-hidden="true"], [hidden]').forEach(el => el.remove());
            const root = doc.querySelector("main, article, [role='main']") ?? doc.body;
            directContent = (root?.innerText ?? root?.textContent ?? "").replace(/\s{3,}/g, "\n\n").trim();
            title = doc.querySelector("title")?.textContent?.trim() ?? null;
            description = doc.querySelector('meta[name="description"]')?.getAttribute("content")
                       ?? doc.querySelector('meta[property="og:description"]')?.getAttribute("content")
                       ?? null;
        }
    } catch (_) {}

    // ── Step 2: Jina Reader fallback for JS-rendered / sparse pages ──────────
    if (directContent.length < 200) {
        try {
            const jinaRes = await W.httpGet(`https://r.jina.ai/${url}`);
            if (jinaRes.ok && (jinaRes.text ?? "").trim().length > directContent.length) {
                const content = jinaRes.text.trim();
                const result = {
                    url, title, description,
                    content: content.slice(0, limit),
                    truncated: content.length > limit,
                    char_count: Math.min(content.length, limit),
                    method: "jina",
                };
                C.set(cacheKey, result);
                return result;
            }
        } catch (_) {}
    }

    if (!directContent) return { error: "Could not extract text. The site may require JavaScript rendering.", url };

    const result = {
        url, title, description,
        content: directContent.slice(0, limit),
        truncated: directContent.length > limit,
        char_count: Math.min(directContent.length, limit),
        method: "direct",
    };
    C.set(cacheKey, result);
    return result;
}


/**
 * High-level vault overview: note counts, habits done today, open issues, media queue.
 * Powers "how's my vault looking?" / morning briefing questions.
 */
async function get_vault_overview() {
    const todayKey = "d_" + V.today();
    const all = dc.app.vault.getMarkdownFiles();

    // Pillar counts
    const counts = { Systems: 0, Toolkit: 0 };
    for (const f of all) {
        const p = f.path.split("/")[0];
        if (counts[p] !== undefined) counts[p]++;
    }

    // Habits today
    const habitFiles = all.filter(f => f.path.startsWith("Systems/Habits/") && f.basename !== "Habits");
    let habitsDoneToday = 0;
    for (const f of habitFiles) {
        const log = dc.app.metadataCache.getFileCache(f)?.frontmatter?.log ?? [];
        const arr = Array.isArray(log) ? log : [log];
        if (arr.includes(todayKey)) habitsDoneToday++;
    }

    // Media queue by status
    const mediaFiles = all.filter(f => f.path.startsWith("Systems/Cogito/Media/"));
    const mediaCounts = {};
    for (const f of mediaFiles) {
        const s = dc.app.metadataCache.getFileCache(f)?.frontmatter?.status ?? "Unknown";
        mediaCounts[s] = (mediaCounts[s] ?? 0) + 1;
    }

    // Issues by status
    const issueFiles = all.filter(f => f.path.startsWith("Systems/Issues/"));
    const issueCounts = {};
    for (const f of issueFiles) {
        const s = dc.app.metadataCache.getFileCache(f)?.frontmatter?.status ?? "Unknown";
        issueCounts[s] = (issueCounts[s] ?? 0) + 1;
    }

    // Projects active
    const projectFiles = all.filter(f => f.path.startsWith("Systems/Projects/") && !f.path.includes("/"));
    const activeProjects = projectFiles
        .map(f => ({ name: f.basename, status: dc.app.metadataCache.getFileCache(f)?.frontmatter?.status ?? "Unknown" }))
        .filter(p => p.status !== "Archived");

    return {
        today: V.today(),
        total_notes: all.length,
        notes_by_pillar: counts,
        habits: { total: habitFiles.length, done_today: habitsDoneToday },
        media: mediaCounts,
        issues: issueCounts,
        active_projects: activeProjects,
    };
}

/**
 * Find notes related to a given note by shared topic, tags, and domain.
 * Returns candidates sorted by match score.
 */
async function find_related_notes({ path, limit = 10 }) {
    const file = getFile(path);
    if (!file) return { error: `Note not found: ${path}` };

    const meta = dc.app.metadataCache.getFileCache(file);
    const fm = meta?.frontmatter ?? {};
    const sourceTopic = String(fm.topic ?? "").toLowerCase();
    const sourceDomain = String(fm.domain ?? "").toLowerCase();
    const sourceTags = (Array.isArray(fm.tags) ? fm.tags : [fm.tags ?? ""]).map(t => String(t).toLowerCase());
    const sourceType = String(fm.type ?? "").toLowerCase();

    if (!sourceTopic && !sourceTags.length && !sourceDomain) {
        return { error: "Source note has no topic, tags, or domain to match against." };
    }

    const candidates = [];
    for (const f of dc.app.vault.getMarkdownFiles()) {
        if (f.path === path) continue;
        const m = dc.app.metadataCache.getFileCache(f)?.frontmatter ?? {};
        let score = 0;

        const tTopic = String(m.topic ?? "").toLowerCase();
        const tTags  = (Array.isArray(m.tags) ? m.tags : [m.tags ?? ""]).map(t => String(t).toLowerCase());
        const tDomain = String(m.domain ?? "").toLowerCase();

        if (sourceTopic && tTopic && tTopic === sourceTopic) score += 3;
        if (sourceTopic && tTopic && (tTopic.includes(sourceTopic) || sourceTopic.includes(tTopic))) score += 1;
        for (const st of sourceTags) {
            if (!st) continue;
            for (const tt of tTags) {
                if (tt && tt.includes(st.split("/").pop())) score += 1;
            }
        }
        if (sourceDomain && tDomain && tDomain === sourceDomain) score += 1;

        if (score > 0) {
            candidates.push({ path: f.path, title: f.basename, score, frontmatter: m });
        }
    }

    candidates.sort((a, b) => b.score - a.score);
    return {
        source: path,
        related: candidates.slice(0, limit),
    };
}

/**
 * Generate a digest of what happened on a given date across the vault.
 * Shows habits logged, notes created, media finished, issues worked on.
 * Powers "what did I do today?" and weekly review.
 */
async function generate_daily_digest({ date }) {
    const target = date ?? V.today();
    const dateKey = "d_" + target;
    const all = dc.app.vault.getMarkdownFiles();

    // Habits logged on date
    const habitFiles = all.filter(f => f.path.startsWith("Systems/Habits/") && f.basename !== "Habits");
    const habitsLogged = habitFiles
        .filter(f => {
            const log = dc.app.metadataCache.getFileCache(f)?.frontmatter?.log ?? [];
            return (Array.isArray(log) ? log : [log]).includes(dateKey);
        })
        .map(f => f.basename);

    // Notes created on date (created frontmatter field)
    const notesCreated = all
        .filter(f => {
            const created = dc.app.metadataCache.getFileCache(f)?.frontmatter?.created;
            return created && String(created).startsWith(target);
        })
        .map(f => ({ path: f.path, title: f.basename }));

    // Media with status Done that was created/updated on target
    const mediaDone = all
        .filter(f => {
            if (!f.path.startsWith("Systems/Cogito/Media/")) return false;
            const fm = dc.app.metadataCache.getFileCache(f)?.frontmatter ?? {};
            return fm.status === "Done" && String(fm.created ?? "").startsWith(target);
        })
        .map(f => ({ title: f.basename, type: dc.app.metadataCache.getFileCache(f)?.frontmatter?.type }));

    return {
        date: target,
        habits_logged: habitsLogged,
        notes_created: notesCreated,
        media_finished: mediaDone,
        summary: `On ${target}: logged ${habitsLogged.length} habit(s), created ${notesCreated.length} note(s), finished ${mediaDone.length} media item(s).`,
    };
}

// ─── New tools: writing, discovery, vault management ──────────────────────────

/**
 * Replace the body of a note while preserving frontmatter.
 * The AI should read the note first, then pass revised body content.
 */
async function write_note_body({ path, body }) {
    const file = getFile(path);
    if (!file) return { error: `Note not found: ${path}` };
    const raw = await dc.app.vault.read(file);
    // Preserve the frontmatter block (--- ... ---\n)
    const fmMatch = raw.match(/^---\n[\s\S]*?\n---\n?/);
    const fm = fmMatch ? fmMatch[0] : "";
    await dc.app.vault.modify(file, fm + body);
    return { success: true, path };
}

/**
 * Find notes created or recently modified in the last N days.
 * Uses the `created` frontmatter field and file mtime.
 */
async function get_recent_notes({ days = 7, folder, limit = 20 }) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const cutoffStr = cutoff.toISOString().slice(0, 10);

    const SKIP = ["Toolkit/", "Systems/Oraculum/"];

    const files = dc.app.vault.getMarkdownFiles()
        .filter(f => !SKIP.some(p => f.path.startsWith(p)))
        .filter(f => !folder || f.path.startsWith(folder))
        .map(f => {
            const fm = dc.app.metadataCache.getFileCache(f)?.frontmatter ?? {};
            const created = String(fm.created ?? "");
            const mtime = f.stat?.mtime ? new Date(f.stat.mtime).toISOString().slice(0, 10) : null;
            return { path: f.path, title: f.basename, created: created || null, modified: mtime, tags: fm.tags ?? [] };
        })
        .filter(f => (f.created && f.created >= cutoffStr) || (f.modified && f.modified >= cutoffStr))
        .sort((a, b) => {
            const ta = b.modified ?? b.created ?? "";
            const tb = a.modified ?? a.created ?? "";
            return ta > tb ? 1 : -1;
        });

    return { days, total: files.length, notes: files.slice(0, limit) };
}

/**
 * Move or rename a note by changing its vault path.
 * Creates intermediate folders if needed.
 */
async function move_note({ path, new_path }) {
    const file = getFile(path);
    if (!file) return { error: `Note not found: ${path}` };
    if (getFile(new_path)) return { error: `Destination already exists: ${new_path}` };
    const parts = new_path.split("/");
    if (parts.length > 1) await V.ensureFolder(parts.slice(0, -1).join("/"));
    await dc.app.fileManager.renameFile(file, new_path);
    return { success: true, old_path: path, new_path };
}

/**
 * Log several habits at once from a single natural-language message.
 * Much faster than multiple log_habit calls.
 */
async function bulk_log_habits({ habits, date }) {
    const dateKey = "d_" + (date ?? V.today());
    const allHabitFiles = dc.app.vault.getMarkdownFiles()
        .filter(f => f.path.startsWith("Systems/Habits/") && f.basename !== "Habits");

    const results = [];
    for (const habit_name of habits) {
        // Fuzzy match: exact → case-insensitive → partial
        const file = allHabitFiles.find(f => f.basename === habit_name)
                  ?? allHabitFiles.find(f => f.basename.toLowerCase() === habit_name.toLowerCase())
                  ?? allHabitFiles.find(f => f.basename.toLowerCase().includes(habit_name.toLowerCase()));

        if (!file) {
            results.push({ habit: habit_name, success: false, error: "Not found" });
            continue;
        }
        let alreadyLogged = false;
        await dc.app.fileManager.processFrontMatter(file, fm => {
            if (!Array.isArray(fm.log)) fm.log = [];
            if (fm.log.includes(dateKey)) alreadyLogged = true;
            else fm.log.push(dateKey);
        });
        results.push({ habit: file.basename, success: true, alreadyLogged });
    }
    return {
        date: dateKey.replace("d_", ""),
        logged: results.filter(r => r.success && !r.alreadyLogged).length,
        results,
        available: allHabitFiles.map(f => f.basename),
    };
}

/**
 * Show a week's worth of activity: habits logged per day, notes created,
 * issues closed, and media finished. Defaults to the current ISO week (Mon–Sun).
 */
async function get_week_summary({ start_date } = {}) {
    let start;
    if (start_date) {
        start = new Date(start_date);
    } else {
        start = new Date();
        const day = start.getDay();
        start.setDate(start.getDate() - (day === 0 ? 6 : day - 1)); // rewind to Monday
    }
    start.setHours(0, 0, 0, 0);

    const dateRange = [];
    for (let d = new Date(start); dateRange.length < 7; d.setDate(d.getDate() + 1)) {
        dateRange.push(d.toISOString().slice(0, 10));
    }

    const all = dc.app.vault.getMarkdownFiles();

    // Habits: how many days per habit
    const habitFiles = all.filter(f => f.path.startsWith("Systems/Habits/") && f.basename !== "Habits");
    const habitLogs = {};
    for (const f of habitFiles) {
        const log = dc.app.metadataCache.getFileCache(f)?.frontmatter?.log ?? [];
        const arr = Array.isArray(log) ? log : [log];
        const daysLogged = dateRange.filter(d => arr.includes("d_" + d));
        if (daysLogged.length > 0) habitLogs[f.basename] = { days: daysLogged.length, on: daysLogged };
    }

    // Notes created this week
    const notesCreated = all
        .filter(f => {
            const created = String(dc.app.metadataCache.getFileCache(f)?.frontmatter?.created ?? "");
            return dateRange.some(d => created.startsWith(d));
        })
        .map(f => ({ path: f.path, title: f.basename }));

    // Issues closed this week (status=Done, done field matches week)
    const issuesClosed = all
        .filter(f => {
            if (!f.path.startsWith("Systems/Issues/")) return false;
            const fm = dc.app.metadataCache.getFileCache(f)?.frontmatter ?? {};
            return fm.status === "Done" && dateRange.some(d => String(fm.done ?? "").startsWith(d));
        })
        .map(f => ({ title: f.basename, done: dc.app.metadataCache.getFileCache(f)?.frontmatter?.done }));

    // Media finished this week (status=Done, modified this week)
    const mediaFinished = all
        .filter(f => {
            if (!f.path.startsWith("Systems/Cogito/Media/")) return false;
            const fm = dc.app.metadataCache.getFileCache(f)?.frontmatter ?? {};
            if (fm.status !== "Done" || !f.stat?.mtime) return false;
            const mdate = new Date(f.stat.mtime).toISOString().slice(0, 10);
            return dateRange.includes(mdate);
        })
        .map(f => ({ title: f.basename, type: dc.app.metadataCache.getFileCache(f)?.frontmatter?.type }));

    return {
        week: `${dateRange[0]} → ${dateRange[6]}`,
        habits: habitLogs,
        habits_summary: Object.entries(habitLogs).map(([h, v]) => `${h}: ${v.days}/7 days`),
        notes_created: notesCreated.length,
        notes: notesCreated,
        issues_closed: issuesClosed.length,
        issues: issuesClosed,
        media_finished: mediaFinished.length,
        media: mediaFinished,
    };
}

/**
 * Show the full log history for a single habit over the last N days.
 * Great for streaks, gaps, and "did I keep up with X?" questions.
 */
async function get_habit_history({ habit_name, days = 30 }) {
    const habitFiles = dc.app.vault.getMarkdownFiles()
        .filter(f => f.path.startsWith("Systems/Habits/") && f.basename !== "Habits");

    const file = habitFiles.find(f => f.basename === habit_name)
              ?? habitFiles.find(f => f.basename.toLowerCase() === habit_name.toLowerCase())
              ?? habitFiles.find(f => f.basename.toLowerCase().includes(habit_name.toLowerCase()));

    if (!file) {
        return { error: `Habit "${habit_name}" not found. Available: ${habitFiles.map(f => f.basename).join(", ")}` };
    }

    const fm = dc.app.metadataCache.getFileCache(file)?.frontmatter ?? {};
    const log = Array.isArray(fm.log) ? fm.log : [];

    const dates = [];
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days + 1);
    cutoff.setHours(0, 0, 0, 0);
    for (let d = new Date(cutoff); d <= new Date(); d.setDate(d.getDate() + 1)) {
        dates.push(d.toISOString().slice(0, 10));
    }

    const history = dates.map(d => ({ date: d, done: log.includes("d_" + d) }));
    const doneCount = history.filter(h => h.done).length;

    // Current streak
    let currentStreak = 0;
    for (let i = history.length - 1; i >= 0 && history[i].done; i--) currentStreak++;

    return {
        habit: file.basename,
        frequency: fm.frequency ?? "Daily",
        period_days: days,
        done_count: doneCount,
        completion_pct: Math.round((doneCount / dates.length) * 100),
        current_streak: currentStreak,
        history,
    };
}

/**
 * Insert a Mermaid diagram block into a note.
 * Appends to the note end, or inserts after a specific ## section.
 */
async function insert_mermaid({ path, diagram, section }) {
    const file = getFile(path);
    if (!file) return { error: `Note not found: ${path}` };
    const raw = await dc.app.vault.read(file);
    const block = `\`\`\`mermaid\n${diagram.trim()}\n\`\`\``;

    if (section) {
        const rx = new RegExp(`^(##\\s+${section.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "m");
        const match = rx.exec(raw);
        if (match) {
            const afterHeader = raw.slice(match.index + match[0].length);
            const nextIdx = afterHeader.search(/^## /m);
            const insertAt = nextIdx === -1 ? raw.length : match.index + match[0].length + nextIdx;
            const before = raw.slice(0, insertAt).trimEnd();
            const after = nextIdx === -1 ? "" : "\n\n" + raw.slice(insertAt);
            await dc.app.vault.modify(file, `${before}\n\n${block}${after}`);
            return { success: true, path, inserted_after: section };
        }
    }

    await dc.app.vault.modify(file, raw.trimEnd() + `\n\n${block}\n`);
    return { success: true, path, inserted_after: "end of note" };
}

/**
 * Append an annotation (highlight, key takeaway, quote) to a media note.
 * Targets a ## Notes section if present, otherwise creates one.
 */
async function annotate_media({ path, annotation }) {
    const file = getFile(path);
    if (!file) return { error: `Note not found: ${path}` };
    const raw = await dc.app.vault.read(file);
    const entry = `- [${V.today()}] ${annotation}`;

    const sectionRx = /^## (Key Takeaways|Summary|Notable Details|Related Notes)/m;
    const match = sectionRx.exec(raw);
    if (match) {
        const section = match[1];
        const sectionStart = match.index;
        const afterSection = raw.slice(sectionStart + match[0].length);
        const nextIdx = afterSection.search(/^## /m);
        const insertAt = nextIdx === -1 ? raw.length : sectionStart + match[0].length + nextIdx;
        const before = raw.slice(0, insertAt).trimEnd();
        const after = nextIdx === -1 ? "" : "\n\n" + raw.slice(insertAt);
        await dc.app.vault.modify(file, before + "\n" + entry + after);
        return { success: true, path, section };
    }

    await dc.app.vault.modify(file, raw.trimEnd() + "\n\n## Key Takeaways\n" + entry + "\n");
    return { success: true, path, section: "Key Takeaways (created)" };
}

/**
 * Generate a Map of Content note that collects all notes matching a topic.
 * Groups found notes by pillar and creates wikilinks.
 */
async function create_moc({ title, topic, folder }) {
    const topicLower = topic.toLowerCase();
    const all = dc.app.vault.getMarkdownFiles();

    const matches = all.filter(f => {
        if (f.path.startsWith("Toolkit/") || f.path.startsWith("Systems/Oraculum/")) return false;
        const fm = dc.app.metadataCache.getFileCache(f)?.frontmatter ?? {};
        const fTopic = String(fm.topic ?? "").toLowerCase();
        const tags   = (Array.isArray(fm.tags) ? fm.tags : [fm.tags ?? ""]).join(" ").toLowerCase();
        const fname  = f.basename.toLowerCase();
        return fTopic.includes(topicLower) || tags.includes(topicLower) || fname.includes(topicLower);
    });

    if (matches.length === 0) return { error: `No notes found matching topic: "${topic}"` };

    const byPillar = {};
    for (const f of matches) {
        const pillar = f.path.split("/")[0];
        if (!byPillar[pillar]) byPillar[pillar] = [];
        byPillar[pillar].push(f);
    }

    let body = `# ${title}\n\n> Map of Content for **${topic}**\n\n`;
    for (const [pillar, notes] of Object.entries(byPillar)) {
        body += `## ${pillar}\n\n`;
        for (const n of notes) {
            body += `- [[${n.path.replace(/\.md$/, "")}|${n.basename}]]\n`;
        }
        body += "\n";
    }
    body += `---\n*Generated ${V.today()}*\n`;

    const result = await createNote(folder ?? "Systems/Cogito/Notes", title, {
        topic,
        type: "MOC",
        tags: ["system/cogito/note", "moc"],
        created: V.today(),
    }, body);

    return { ...result, links_created: matches.length, pillars: Object.keys(byPillar) };
}

async function semantic_search({ query, limit, domain, topic, folder }) {
    const defaultLimit = parseInt(localStorage.getItem("oraculum:search-limit")) || 15;
    const apiKey = getGeminiApiKey();
    if (!apiKey) return { error: "Gemini API key not found. Check Oraculum Settings → Config." };
    const E = await dc.require("Systems/Oraculum/Modules/Embeddings.js");
    return E.semanticSearch(query, apiKey, { limit: limit ?? defaultLimit, domain, topic, folder });
}

// ─── Tool declarations (uppercase types per Gemini API spec) ──────────────────

const TOOL_DECLARATIONS = [
    // ── Universal ──────────────────────────────────────────────────────────
    {
        name: "search_notes",
        description: "Full-text search across vault notes. Returns up to `limit` matches with path, title, and a short excerpt.",
        parameters: {
            type: "OBJECT",
            properties: {
                query:  { type: "STRING", description: "Keyword or phrase to search for." },
                folder: { type: "STRING", description: "Optional folder prefix to restrict the search, e.g. 'Systems/Cogito/Notes' or 'Systems/Habits'." },
                limit:  { type: "NUMBER", description: "Max results (default 10)." },
            },
            required: ["query"],
        },
    },
    {
        name: "get_note",
        description: "Read a note's content. If `section` is given, returns only that heading's content (e.g., section='Goals').",
        parameters: {
            type: "OBJECT",
            properties: {
                path:    { type: "STRING", description: "Vault-relative path including .md extension." },
                section: { type: "STRING", description: "Optional heading text to extract just that section." },
            },
            required: ["path"],
        },
    },
    {
        name: "get_frontmatter",
        description: "Read just the YAML frontmatter of a note as a JSON object — without loading the full body. Cheaper than get_note when you only need metadata (status, tags, dates, topic). Use before update_frontmatter to see what fields already exist.",
        parameters: {
            type: "OBJECT",
            properties: { path: { type: "STRING", description: "Vault-relative path." } },
            required: ["path"],
        },
    },
    {
        name: "update_frontmatter",
        description: "Update one or more frontmatter fields on a note. Existing fields not in `updates` are preserved.",
        parameters: {
            type: "OBJECT",
            properties: {
                path:    { type: "STRING", description: "Vault-relative path." },
                updates: { type: "OBJECT", description: "Object of {key: value} to set." },
            },
            required: ["path", "updates"],
        },
    },
    {
        name: "append_to_note",
        description: "Append content to the end of a note, or to the end of a specific section if `section` is provided.",
        parameters: {
            type: "OBJECT",
            properties: {
                path:    { type: "STRING", description: "Vault-relative path." },
                content: { type: "STRING", description: "Markdown content to append." },
                section: { type: "STRING", description: "Optional heading text — appends inside that section." },
            },
            required: ["path", "content"],
        },
    },
    {
        name: "list_folder",
        description: "List all files and subfolders inside a vault folder (one level deep). Use when you don't know what's inside a folder before reading notes, or when exploring an unfamiliar vault area. Combine with get_note to drill into specific files.",
        parameters: {
            type: "OBJECT",
            properties: { path: { type: "STRING", description: "Vault-relative folder path." } },
            required: ["path"],
        },
    },

    // ── Discovery (essential for research) ─────────────────────────────────
    {
        name: "list_field_values",
        description: "Aggregate all unique values of a frontmatter field across notes in a folder, with counts. Use this BEFORE creating a note to check if a topic/category already exists. Examples: list_field_values(field='topic', folder='Systems/Cogito/Media') to see all media topics; list_field_values(field='category', folder='Systems/Resources') to see resource categories.",
        parameters: {
            type: "OBJECT",
            properties: {
                field:  { type: "STRING", description: "Frontmatter key, e.g. 'topic', 'category', 'status', 'type'." },
                folder: { type: "STRING", description: "Optional folder prefix to limit scope, e.g. 'Systems/Cogito/Media'." },
            },
            required: ["field"],
        },
    },
    {
        name: "find_by_field",
        description: "Find notes where a frontmatter field matches a value. Returns titles + full frontmatter (no body) so you can decide which to read in detail. Example: find_by_field(field='topic', value='3D', folder='Systems/Cogito/Media') to find media about 3D.",
        parameters: {
            type: "OBJECT",
            properties: {
                field:  { type: "STRING" },
                value:  { type: "STRING" },
                folder: { type: "STRING", description: "Optional folder prefix." },
                exact:  { type: "BOOLEAN", description: "Exact match (true) vs substring (false, default)." },
                limit:  { type: "NUMBER", description: "Max results (default 50)." },
            },
            required: ["field", "value"],
        },
    },
    {
        name: "find_by_tag",
        description: "Find notes with a tag matching a substring. Use to discover notes across the vault by domain (e.g. tag='medieval', tag='system/cogito/media').",
        parameters: {
            type: "OBJECT",
            properties: {
                tag:   { type: "STRING" },
                limit: { type: "NUMBER" },
            },
            required: ["tag"],
        },
    },
    {
        name: "list_notes_in",
        description: "List all notes inside a folder with their full frontmatter, optionally filtered by status or type. Use this to enumerate resources, media, projects, etc. Examples: list_notes_in(folder='Systems/Resources'), list_notes_in(folder='Systems/Cogito/Media', status='Done', type='Video').",
        parameters: {
            type: "OBJECT",
            properties: {
                folder: { type: "STRING" },
                status: { type: "STRING" },
                type:   { type: "STRING" },
            },
            required: ["folder"],
        },
    },

    // ── Anima: Habits ─────────────────────────────────────────────────────
    {
        name: "list_habits",
        description: "List all tracked habits with today's completion status and the last 7 logged dates. Always call this before log_habit to find the exact habit name.",
        parameters: { type: "OBJECT", properties: {} },
    },
    {
        name: "get_habit_insights",
        description: "Compute analytics for a habit: current streak, best streak, completion rate, and done count over a window of days. Use for questions like 'how's my X habit going?' or 'am I keeping up with Y?'.",
        parameters: {
            type: "OBJECT",
            properties: {
                habit_name: { type: "STRING", description: "Habit name (use list_habits first)." },
                days:       { type: "NUMBER", description: "Analysis window in days (default 30)." },
            },
            required: ["habit_name"],
        },
    },
    {
        name: "log_habit",
        description: "Mark a habit as done for today (or a specific date). Map natural language ('I went on a walk') to the matching habit name.",
        parameters: {
            type: "OBJECT",
            properties: {
                habit_name: { type: "STRING", description: "Exact habit name as it appears in the vault." },
                date:       { type: "STRING", description: "YYYY-MM-DD; omit for today." },
            },
            required: ["habit_name"],
        },
    },
    {
        name: "create_habit",
        description: "Create a new tracked habit in Systems/Habits/. Use when the user wants to start tracking something they do regularly. Always confirm the name before creating so it's easy to log naturally ('I went for a walk' should map cleanly to the habit name).",
        parameters: {
            type: "OBJECT",
            properties: {
                name:      { type: "STRING", description: "Habit name (e.g., 'Walking')." },
                frequency: { type: "STRING", description: "'Daily' or 'Weekly'. Defaults to Daily." },
                category:  { type: "STRING", description: "Optional category label (e.g., 'Health', 'Mind'). Groups habits in the dashboard filter." },
            },
            required: ["name"],
        },
    },

    // ── Anima: Job Applications ───────────────────────────────────────────
    {
        name: "list_job_applications",
        description: "List job applications, optionally filtered by status (Applied, Interview, Offer, Rejected, Archived). Call before create_job_application to check if it already exists, or when the user asks about their pipeline.",
        parameters: {
            type: "OBJECT",
            properties: { status: { type: "STRING", description: "Optional status filter." } },
        },
    },
    {
        name: "create_job_application",
        description: "Create a new job application note in Systems/Job Search/. Use fetch_url_metadata on the job URL first to auto-fill the company name and role if not provided. Always confirm the company and role before creating.",
        parameters: {
            type: "OBJECT",
            properties: {
                company: { type: "STRING" },
                role:    { type: "STRING" },
                status:  { type: "STRING", description: "Applied | Interview | Offer | Rejected | Archived (default Applied)." },
                applied: { type: "STRING", description: "YYYY-MM-DD; defaults to today." },
                url:     { type: "STRING", description: "Job posting URL." },
            },
            required: ["company", "role"],
        },
    },
    {
        name: "update_job_status",
        description: "Update a job application's status (Applied → Interview → Offer → Rejected → Archived). Call list_job_applications first to confirm the exact company and role name if not provided.",
        parameters: {
            type: "OBJECT",
            properties: {
                company:    { type: "STRING" },
                role:       { type: "STRING" },
                new_status: { type: "STRING", description: "Applied | Interview | Offer | Rejected | Archived." },
            },
            required: ["company", "role", "new_status"],
        },
    },

    // ── Cogito: Notes ─────────────────────────────────────────────────────
    {
        name: "create_note",
        description: "Create a knowledge note in Systems/Cogito/Notes/. Picks a section template based on `domain`.",
        parameters: {
            type: "OBJECT",
            properties: {
                title:  { type: "STRING" },
                domain: { type: "STRING", description: "Knowledge | Process | Idea | Reference (default Reference)." },
                topic:  { type: "STRING", description: "Subject/topic, e.g., 'System Design'." },
                status: { type: "STRING", description: "Stub | Draft | Mature | Evergreen (default Stub)." },
            },
            required: ["title"],
        },
    },

    // ── Cogito: Media ─────────────────────────────────────────────────────
    {
        name: "create_media_note",
        description: "Create a media consumption note in Systems/Cogito/Media/ for a book, video, article, podcast, talk, game, paper, or course.",
        parameters: {
            type: "OBJECT",
            properties: {
                title:  { type: "STRING" },
                type:   { type: "STRING", description: "Book | Article | Video | Podcast | Talk | Game | Paper | Course." },
                author: { type: "STRING", description: "Author/creator/channel name." },
                source: { type: "STRING", description: "URL or source reference." },
                topic:  { type: "STRING", description: "Subject area." },
                status: { type: "STRING", description: "Backlog | Active | Done | Dropped (default Backlog)." },
            },
            required: ["title", "type"],
        },
    },
    {
        name: "update_media_status",
        description: "Update a media note's status. Use when the user finishes, starts, or drops something they were consuming. Call list_notes_in(folder='Systems/Cogito/Media') or search_notes to find the exact title first.",
        parameters: {
            type: "OBJECT",
            properties: {
                title:      { type: "STRING" },
                new_status: { type: "STRING" },
            },
            required: ["title", "new_status"],
        },
    },

    // ── Fabrica: Projects ─────────────────────────────────────────────────
    {
        name: "list_projects",
        description: "List Fabrica projects, optionally filtered by status (Idea, Active, Paused, Shipped, Archived).",
        parameters: {
            type: "OBJECT",
            properties: { status: { type: "STRING" } },
        },
    },
    {
        name: "create_project",
        description: "Create a new project in Systems/Projects/.",
        parameters: {
            type: "OBJECT",
            properties: {
                name:     { type: "STRING" },
                category: { type: "STRING", description: "Project category (free-form)." },
                status:   { type: "STRING", description: "Idea | Active | Paused | Shipped | Archived (default Idea)." },
                summary:  { type: "STRING", description: "One-line summary." },
                stack:    { type: "STRING", description: "Comma-separated tech stack." },
            },
            required: ["name", "category"],
        },
    },

    // ── Fabrica: Presentations ────────────────────────────────────────────
    {
        name: "list_presentations",
        description: "List presentations in Systems/Presentations/, optionally filtered by category and/or status.",
        parameters: {
            type: "OBJECT",
            properties: {
                category: { type: "STRING", description: "Technical | Deep Dive | Personal | Demo." },
                status:   { type: "STRING", description: "Idea | Drafting | Review | Done." },
            },
        },
    },
    {
        name: "get_slide_patterns",
        description: "Returns the slide visual pattern vocabulary for Advanced Slides decks. Call this BEFORE writing a presentation body. Each pattern includes its syntax and a 'best_for' guide so you can pick the right layout per slide: two-column for comparisons, fragment-build for step-by-step processes, impact-number for stats, section-divider between topics, etc. Also returns hard rules (max bullets, slide count, etc.).",
        parameters: { type: "OBJECT", properties: {} },
    },
    {
        name: "insert_mermaid",
        description: `Insert a Mermaid diagram code block into any note or presentation slide.

DIRECTION RULES (flowchart/graph only):
- In NOTES (Cogito, Fabrica, etc.): use "flowchart TD" — nodes grow DOWNWARD. Good for vertical hierarchies, decision trees, step sequences.
- In PRESENTATIONS (slides): use "flowchart LR" — nodes grow to the RIGHT. Uses widescreen space efficiently. Better for linear flows and pipelines.

OBSIDIAN-SUPPORTED TYPES (safe anywhere):
- flowchart / graph (TD = down, LR = right, RL = left, BT = up)
- sequenceDiagram
- classDiagram
- stateDiagram-v2
- erDiagram
- gantt
- pie

NOT supported in Obsidian (avoid in notes; OK in exported HTML only):
- mindmap, timeline, xychart-beta, requirementDiagram, zenuml, C4Context

QUALITY RULES:
- Keep it simple: ≤10 nodes for readability.
- Label edges when the relationship isn't obvious.
- Don't generate diagrams just to have one — only when they genuinely clarify something that text cannot.`,
        parameters: {
            type: "OBJECT",
            properties: {
                path:    { type: "STRING", description: "Path to the note to insert the diagram into." },
                diagram: { type: "STRING", description: "The full Mermaid diagram code WITHOUT fences. Start with the type keyword, e.g. 'flowchart LR\\n  A --> B'. Use TD for notes (grows down), LR for presentation slides (grows right)." },
                section: { type: "STRING", description: "Optional ## section heading to insert after (e.g. 'How it works'). Omit to append at end." },
            },
            required: ["path", "diagram"],
        },
    },
    {
        name: "create_presentation",
        description: "Create a new presentation note in Systems/Presentations/. WORKFLOW: (1) call get_slide_patterns to see the visual pattern vocabulary, (2) call create_presentation to make the note, (3) call write_note_body to write the full deck choosing appropriate patterns per slide based on content type — comparisons get two-column, processes get fragment-build, key stats get impact-number, section breaks get section-divider, etc.",
        parameters: {
            type: "OBJECT",
            properties: {
                title:    { type: "STRING", description: "Presentation title." },
                category: { type: "STRING", description: "Technical | Deep Dive | Personal | Demo (default Technical)." },
                status:   { type: "STRING", description: "Idea | Drafting | Review | Done (default Idea)." },
            },
            required: ["title"],
        },
    },

    // ── Fabrica: Issues ───────────────────────────────────────────────────
    {
        name: "list_issues",
        description: "List Fabrica issues, optionally filtered by project name and/or status.",
        parameters: {
            type: "OBJECT",
            properties: {
                project: { type: "STRING", description: "Project name (substring match)." },
                status:  { type: "STRING", description: "Backlog | Todo | In Progress | Review | Done." },
            },
        },
    },
    {
        name: "create_issue",
        description: "Create a Fabrica issue under a project. File goes to Systems/Issues/{project}/{status}/.",
        parameters: {
            type: "OBJECT",
            properties: {
                project:  { type: "STRING", description: "Project name." },
                title:    { type: "STRING" },
                priority: { type: "STRING", description: "Low | Med | High | Critical (default Med)." },
                status:   { type: "STRING", description: "Backlog | Todo | In Progress | Review | Done (default Backlog)." },
            },
            required: ["project", "title"],
        },
    },
    {
        name: "update_issue_status",
        description: "Update an issue's status and move it to the matching status folder.",
        parameters: {
            type: "OBJECT",
            properties: {
                title:      { type: "STRING", description: "Issue title." },
                new_status: { type: "STRING", description: "Backlog | Todo | In Progress | Review | Done." },
            },
            required: ["title", "new_status"],
        },
    },

    // ── Fabrica: Releases ─────────────────────────────────────────────────
    {
        name: "create_release",
        description: "Create a release note under Systems/Releases/{project}/. Use when the user ships a version, wants to plan a release, or wants to capture what changed. Call list_projects first if the project name is ambiguous.",
        parameters: {
            type: "OBJECT",
            properties: {
                project:  { type: "STRING" },
                version:  { type: "STRING", description: "Semantic version, e.g., '1.2.0'." },
                status:   { type: "STRING", description: "Planned | In Progress | Released (default Planned)." },
                date:     { type: "STRING", description: "YYYY-MM-DD; defaults to today." },
                breaking: { type: "STRING", description: "'Yes' or 'No' (default 'No')." },
            },
            required: ["project", "version"],
        },
    },

    // ── Fabrica: Resources ────────────────────────────────────────────────
    {
        name: "create_resource",
        description: "Create a resource note in Systems/Resources/. Use for tools, services, libraries, APIs, or references the user wants to save for later. Call list_field_values(field='category', folder='Systems/Resources') first to pick an existing category rather than inventing one.",
        parameters: {
            type: "OBJECT",
            properties: {
                name:     { type: "STRING" },
                url:      { type: "STRING" },
                vendor:   { type: "STRING" },
                category: { type: "STRING" },
                projects: { type: "ARRAY", items: { type: "STRING" }, description: "Project names to link this resource to (e.g. ['MyApp']). Optional." },
            },
            required: ["name"],
        },
    },

    // ── Fabrica: Growth ───────────────────────────────────────────────────
    {
        name: "create_skill",
        description: "Add a skill entry in Systems/Growth/Skills/. Use when the user learns something new or wants to document a capability. The skill note captures what was learned, how, and at what level — useful for CV generation or self-review.",
        parameters: {
            type: "OBJECT",
            properties: {
                name:  { type: "STRING" },
                level: { type: "STRING", description: "Novice | Advanced Beginner | Competent | Proficient | Expert." },
            },
            required: ["name"],
        },
    },
    {
        name: "create_brag",
        description: "Record a brag (win, achievement, positive feedback, or shipped work) in Systems/Growth/Brag/. Use whenever the user mentions something they accomplished. Even small things are worth logging — bragging is good, it feeds performance reviews and motivation.",
        parameters: {
            type: "OBJECT",
            properties: {
                title:  { type: "STRING" },
                what:   { type: "STRING", description: "What you did." },
                impact: { type: "STRING", description: "The impact." },
                date:   { type: "STRING", description: "YYYY-MM-DD; defaults to today." },
            },
            required: ["title"],
        },
    },
    {
        name: "create_adr",
        description: "Record an Architecture Decision Record (ADR) in Systems/Growth/ADRs/. Use when the user makes a significant technical or design decision they want to justify and preserve. ADRs capture context, the decision made, consequences, and alternatives — invaluable for future-you looking at old code.",
        parameters: {
            type: "OBJECT",
            properties: {
                title:        { type: "STRING" },
                context:      { type: "STRING" },
                decision:     { type: "STRING" },
                consequences: { type: "STRING" },
                status:       { type: "STRING", description: "Proposed | Accepted | Superseded | Rejected (default Proposed)." },
            },
            required: ["title"],
        },
    },
    {
        name: "create_review",
        description: "Create a periodic self-review note in Systems/Growth/Reviews/. Use for monthly, quarterly, or sprint retrospectives. Sections mirror the dashboard: Went well, Stuck on, Struggled with, Patterns, Next.",
        parameters: {
            type: "OBJECT",
            properties: {
                title:         { type: "STRING", description: "e.g. '2026-04 Monthly Review'" },
                went_well:     { type: "STRING" },
                stuck_on:      { type: "STRING" },
                struggled_with:{ type: "STRING" },
                patterns:      { type: "STRING" },
                next:          { type: "STRING" },
            },
            required: ["title"],
        },
    },
    {
        name: "create_postmortem",
        description: "Create a postmortem note in Systems/Growth/Postmortems/ for an incident, outage, failed project, or any event worth a structured retrospective. Sections: Summary, Timeline, Root cause, 5 whys, Action items.",
        parameters: {
            type: "OBJECT",
            properties: {
                title:        { type: "STRING" },
                date:         { type: "STRING", description: "YYYY-MM-DD; defaults to today." },
                summary:      { type: "STRING" },
                timeline:     { type: "STRING" },
                root_cause:   { type: "STRING" },
                five_whys:    { type: "STRING" },
                action_items: { type: "STRING" },
            },
            required: ["title"],
        },
    },

    {
        name: "scrape_webpage",
        description: "Fetch and extract readable text from any public URL — Wikipedia, blog posts, documentation, GitHub READMEs, news articles, forum threads. First tries a direct fetch; if the page is JS-rendered (sparse content), automatically retries via Jina Reader (r.jina.ai) which renders SPAs server-side. Use whenever the user shares a link they want summarized, researched, or turned into a vault note. After scraping, analyze the content and propose appropriate note structure.",
        parameters: {
            type: "OBJECT",
            properties: {
                url:       { type: "STRING", description: "The full URL to scrape." },
                max_chars: { type: "NUMBER", description: "Maximum characters to extract. Defaults to the user-configured limit (default 12000). Increase for long articles you want full coverage of." },
            },
            required: ["url"],
        },
    },
    {
        name: "fetch_url_metadata",
        description: "Fetch the title, author/channel, and description for a URL using public APIs — no auth required. Use this FIRST whenever the user gives a URL for a media note so you can auto-fill the title and suggest a note name. Works especially well for YouTube videos. Falls back to Open Graph tags for articles.",
        parameters: {
            type: "OBJECT",
            properties: {
                url: { type: "STRING", description: "The full URL (YouTube, article, etc.)." },
            },
            required: ["url"],
        },
    },
    {
        name: "get_vault_overview",
        description: "Get a high-level overview of the entire vault: note counts by pillar, habits completed today, media backlog size, open issues count, and active projects. Use for 'how's my vault looking?', 'morning briefing', or 'what should I focus on today?' questions.",
        parameters: { type: "OBJECT", properties: {} },
    },
    {
        name: "find_related_notes",
        description: "Given a note path, find other notes in the vault that share the same topic, tags, or domain. Sorted by match score. Use to discover connections, suggest wiki-links, or explore a topic after reading a note.",
        parameters: {
            type: "OBJECT",
            properties: {
                path:  { type: "STRING", description: "Vault-relative path to the source note." },
                limit: { type: "NUMBER", description: "Max results to return (default 10)." },
            },
            required: ["path"],
        },
    },
    {
        name: "generate_daily_digest",
        description: "Generate a digest for a specific date: which habits were logged, which notes were created, which media was finished. Use for 'what did I do today?', 'weekly review', or end-of-day reflection prompts.",
        parameters: {
            type: "OBJECT",
            properties: {
                date: { type: "STRING", description: "YYYY-MM-DD; omit for today." },
            },
        },
    },

    // ── Memory & utility ──────────────────────────────────────────────────
    {
        name: "save_session_summary",
        description: "Save a summary or transcript of this conversation to Systems/Oraculum/Memory/. Use when the user asks to save the chat, remember something from this session, or wants a log of what was discussed.",
        parameters: {
            type: "OBJECT",
            properties: {
                title:   { type: "STRING", description: "Note title (defaults to 'Session YYYY-MM-DD')." },
                summary: { type: "STRING", description: "Summary or transcript text to save." },
            },
            required: ["summary"],
        },
    },
    {
        name: "add_to_inbox",
        description: "Add a quick capture item to Systems/Cogito/Inbox.md. Use for things the user wants to process later without creating a full note immediately.",
        parameters: {
            type: "OBJECT",
            properties: {
                text: { type: "STRING", description: "The item to add to the inbox." },
                tags: { type: "ARRAY",  items: { type: "STRING" }, description: "Optional tags to apply." },
            },
            required: ["text"],
        },
    },
    {
        name: "vault_health",
        description: "Scan the vault for quality issues: orphaned notes (no backlinks), missing frontmatter fields, incomplete notes. Great for 'find gaps in my vault', 'what needs attention', or a weekly review.",
        parameters: {
            type: "OBJECT",
            properties: {
                folder: { type: "STRING", description: "Limit scan to this folder path. Omit to scan entire vault." },
            },
        },
    },
    {
        name: "import_youtube_playlist",
        description: "Fetch all videos from a public YouTube playlist. Returns title, URL, author, and publish date for each video. Then use create_media_note to save any of them to the vault. Ask the user how many to import.",
        parameters: {
            type: "OBJECT",
            properties: {
                playlist_url: { type: "STRING", description: "Full YouTube playlist URL (must contain ?list=PL...)." },
                limit:        { type: "NUMBER", description: "Maximum number of videos to return (default 25)." },
            },
            required: ["playlist_url"],
        },
    },
    {
        name: "fetch_video_transcript",
        description: "Fetch the full spoken transcript of a video. Supports YouTube, TikTok, Instagram, Facebook, Twitter/X, and direct video file URLs. Requires a Supadata API key in Settings. Use this to summarize a video, extract key points, or answer questions about what was said. Offer to create a media note after fetching.",
        parameters: {
            type: "OBJECT",
            properties: {
                video_url:          { type: "STRING",  description: "Full URL of the video (YouTube, TikTok, Instagram, Twitter/X, Facebook, or a direct file URL)." },
                lang:               { type: "STRING",  description: "Preferred language code (ISO 639-1), e.g. 'en', 'fr', 'de'. Defaults to 'en'. Falls back to first available language." },
                include_timestamps: { type: "BOOLEAN", description: "If true, each segment is prefixed with [MM:SS]. Useful for timestamped notes or chapter summaries. Default false." },
            },
            required: ["video_url"],
        },
    },
    {
        name: "fetch_social_metadata",
        description: "Fetch rich engagement metadata from a social media video or post — view count, likes, comments, duration, tags, and thumbnail. Supports YouTube, TikTok, Instagram, Twitter/X, and Facebook. USES PAID Supadata API credits — only call this when the user explicitly asks for engagement stats or metrics (e.g. 'how many views does this have?', 'show me the video stats'). Do NOT call this just to get a title or author — use fetch_url_metadata for that instead.",
        parameters: {
            type: "OBJECT",
            properties: {
                url: { type: "STRING", description: "Full URL of the social media video or post." },
            },
            required: ["url"],
        },
    },

    // ── Vault management ──────────────────────────────────────────────────
    {
        name: "write_note_body",
        description: "Replace the full body of a note while preserving its frontmatter. Use after get_note to read the current content, then call this to save a rewritten or AI-improved version. Also use to save a generated summary or restructured note. IMPORTANT: For Cogito notes, the body MUST use the exact section headings required by the note's domain (see COGITO NOTE SCHEMAS in the system prompt). Never skip, rename, or add extra top-level sections. IMPORTANT: For presentation notes (path starts with Systems/Presentations/), you MUST call get_slide_patterns before this tool and choose patterns based on content type — see PRESENTATION WORKFLOW in the system prompt.",
        parameters: {
            type: "OBJECT",
            properties: {
                path: { type: "STRING", description: "Vault-relative path including .md extension." },
                body: { type: "STRING", description: "New body content (everything after the frontmatter block). Include markdown headings." },
            },
            required: ["path", "body"],
        },
    },
    {
        name: "get_recent_notes",
        description: "Find notes created or modified in the last N days. Uses both the 'created' frontmatter field and file modification time. Use for 'what did I add recently?', 'show me new notes this week', or before a weekly review.",
        parameters: {
            type: "OBJECT",
            properties: {
                days:   { type: "NUMBER", description: "Look-back window in days (default 7)." },
                folder: { type: "STRING", description: "Optional folder prefix to narrow scope." },
                limit:  { type: "NUMBER", description: "Max results (default 20)." },
            },
        },
    },
    {
        name: "move_note",
        description: "Move or rename a note to a new vault path. Use when the user asks to reorganize, rename, or refile a note. Creates intermediate folders as needed. Cannot be used to overwrite an existing note.",
        parameters: {
            type: "OBJECT",
            properties: {
                path:     { type: "STRING", description: "Current vault-relative path (including .md)." },
                new_path: { type: "STRING", description: "Target vault-relative path (including .md)." },
            },
            required: ["path", "new_path"],
        },
    },
    {
        name: "bulk_log_habits",
        description: "Log multiple habits at once for a given date. Use when the user mentions completing several habits in one message (e.g. 'I walked, read, and called my parents today'). Much faster than multiple log_habit calls. Fuzzy-matches habit names.",
        parameters: {
            type: "OBJECT",
            properties: {
                habits: { type: "ARRAY", items: { type: "STRING" }, description: "List of habit names to log." },
                date:   { type: "STRING", description: "YYYY-MM-DD; omit for today." },
            },
            required: ["habits"],
        },
    },

    // ── Discovery & analytics ─────────────────────────────────────────────
    {
        name: "get_week_summary",
        description: "Aggregate activity for a week: habits logged per day, notes created, issues closed, media finished. Defaults to the current week (Mon–Sun). Use for 'weekly review', 'how was my week?', or 'what did I accomplish this week?'",
        parameters: {
            type: "OBJECT",
            properties: {
                start_date: { type: "STRING", description: "YYYY-MM-DD of the Monday to start from. Omit for current week." },
            },
        },
    },
    {
        name: "get_habit_history",
        description: "Show the full day-by-day log for a single habit over the last N days. Use for 'how consistent have I been with X?', streak questions, or monthly habit reviews.",
        parameters: {
            type: "OBJECT",
            properties: {
                habit_name: { type: "STRING", description: "Habit name (fuzzy-matched)." },
                days:       { type: "NUMBER", description: "How many days of history to show (default 30)." },
            },
            required: ["habit_name"],
        },
    },

    // ── Writing & annotation ──────────────────────────────────────────────
    {
        name: "annotate_media",
        description: "Append a highlight, key takeaway, or quote to a media note. Inserts the entry into the first present section among ## Key Takeaways, ## Summary, ## Notable Details, or ## Related Notes. Creates a new ## Key Takeaways section at the end of the note if none of those exist. Use when the user shares an insight from something they're watching/reading, or asks to save a highlight from a media item.",
        parameters: {
            type: "OBJECT",
            properties: {
                path:       { type: "STRING", description: "Vault-relative path to the media note." },
                annotation: { type: "STRING", description: "The highlight or takeaway to append." },
            },
            required: ["path", "annotation"],
        },
    },
    {
        name: "create_moc",
        description: "Generate a Map of Content (MOC) note that collects all vault notes related to a topic, grouped by pillar. Use when the user wants to explore all their notes about a subject, create an index, or link scattered notes together.",
        parameters: {
            type: "OBJECT",
            properties: {
                title:  { type: "STRING", description: "Title for the MOC note." },
                topic:  { type: "STRING", description: "Topic to search for across note topics, tags, and filenames." },
                folder: { type: "STRING", description: "Folder to create the MOC in (default: Systems/Cogito/Notes)." },
            },
            required: ["title", "topic"],
        },
    },
    // ─── Deep Research (Gemini 2.5 Flash + Search grounding) ─────────────────
    {
        name: "queue_research_topic",
        description: "Add a topic to the persistent deep-research queue for later batch execution. CHEAP — does NOT call any API. Call this AGGRESSIVELY whenever the user mentions a technology, paper, person, library, or concept worth researching, expresses curiosity, or whenever a vault note has thin coverage of a topic. Topics persist across sessions.",
        parameters: {
            type: "OBJECT",
            properties: {
                topic:     { type: "STRING", description: "A SPECIFIC, researchable question — not a vague theme. E.g. 'Tokio vs smol vs glommio Rust async runtime tradeoffs in 2025', not just 'Rust async'." },
                rationale: { type: "STRING", description: "Why this is worth researching (1 sentence). E.g. 'user expressed unfamiliarity', 'thin vault coverage', 'mentioned in transcript'." },
                context:   { type: "STRING", description: "Optional conversational context that would help the research engine — what the user is currently exploring or building." },
            },
            required: ["topic", "rationale"],
        },
    },
    {
        name: "list_research_queue",
        description: "Show all topics currently waiting in the deep-research queue. Use this when the user asks 'what's queued?' or before proposing a batch.",
        parameters: { type: "OBJECT", properties: {} },
    },
    {
        name: "remove_research_topic",
        description: "Remove a topic from the research queue by its id (returned from list_research_queue or queue_research_topic).",
        parameters: {
            type: "OBJECT",
            properties: { id: { type: "STRING", description: "The queue entry id." } },
            required: ["id"],
        },
    },
    {
        name: "propose_research_batch",
        description: "Group up to N queued topics into a coherent batch and return them so you can present the proposal to the user for approval. Does NOT fire the research — you must wait for explicit user approval, then call run_deep_research.",
        parameters: {
            type: "OBJECT",
            properties: {
                size: { type: "NUMBER", description: "Maximum number of topics to include (default 12, max 15)." },
            },
        },
    },
    {
        name: "run_deep_research",
        description: "FIRE queued research topics against Gemini 2.5 Flash with Google Search grounding. Makes ONE API call PER TOPIC (quota: 20 requests/day). Each topic is researched independently for full depth. Already-cached topics are skipped automatically. NEVER call this without explicit user approval (e.g. 'fire it', 'go', 'run the research').",
        parameters: {
            type: "OBJECT",
            properties: {
                topic_ids: { type: "ARRAY", items: { type: "STRING" }, description: "Array of queue entry ids to research. Pass [\"all\"] to fire the entire queue. Use list_research_queue to see current ids." },
                depth:     { type: "STRING", description: "Research depth — 'shallow' (1-2 paragraphs), 'standard' (3-5 paragraphs, default), or 'deep' (mini whitepaper, exhaustive)." },
                force:     { type: "BOOLEAN", description: "If true, bypass cache and re-research even if results already exist. Use when user explicitly asks to redo research." },
            },
            required: ["topic_ids"],
        },
    },
    {
        name: "search_research_results",
        description: "Search prior deep-research findings stored on disk. FREE — no API call, no quota cost. Always check this BEFORE queueing a new topic to avoid duplicating work. Empty query returns ALL topics (compact index, no body). Keyword query searches topics, summaries, and findings text.",
        parameters: {
            type: "OBJECT",
            properties: {
                query: { type: "STRING", description: "Substring or keyword to match. Leave empty to list all researched topics." },
            },
            required: ["query"],
        },
    },
    {
        name: "save_research_to_memory",
        description: "Convert a completed deep-research result into a permanent Markdown note in Systems/Oraculum/Memory/. This joins the semantic index so the findings become discoverable in ALL future conversations — Oraculum's long-term knowledge. Call this after firing a research batch when the user wants to retain the findings. Pass the topic exactly as returned by run_deep_research.",
        parameters: {
            type: "OBJECT",
            properties: {
                topic: { type: "STRING", description: "The exact topic string as returned from run_deep_research (used to look up the result and name the file)." },
            },
            required: ["topic"],
        },
    },
    {
        name: "semantic_search",
        description: "Search vault notes by meaning rather than keywords — finds conceptually related notes even with zero lexical overlap. Requires the semantic index to be built first (Settings → Semantic Index → Update Index). Use for pattern-finding, idea exploration, cross-domain connections, and 'find anything related to X' queries where keyword search would miss results.",
        parameters: {
            type: "OBJECT",
            properties: {
                query:  { type: "STRING", description: "Natural-language query describing the concept, idea, or topic to find." },
                limit:  { type: "NUMBER", description: "Number of results to return (default 15, max 30)." },
                folder: { type: "STRING", description: "Optional vault folder prefix to restrict results, e.g. 'Systems/Projects', 'Systems/Cogito/Notes', 'Systems/Habits'. Use this when you want semantic search scoped to one system — without it, all indexed notes compete and niche types (projects, presentations) get buried under common note types." },
                domain: { type: "STRING", description: "Optional Cogito domain filter: Knowledge, Process, Idea, Reference." },
                topic:  { type: "STRING", description: "Optional topic filter to narrow results to a specific topic." },
            },
            required: ["query"],
        },
    },
    {
        name: "generate_image",
        description: `Generate an image with Pollinations.ai (free, no key) and save it directly to the vault under Attachments/Generated/. Returns the vault path and an Obsidian embed string (![[path]]) ready to paste into any note.

WHEN TO USE:
- Game concept art: environment references, character mood boards, scene compositions
- Project/game banners or logos
- Decorative illustrations for presentations (use insert_mermaid for actual diagrams)

PROMPT TIPS:
- Be specific: lighting, style, mood, colour palette, composition
- For game art: mention art style (e.g. "low-poly stylized", "painterly 2D", "dark fantasy isometric")
- Pollinations is generic-looking by default — heavy style direction helps a lot

MODELS:
- flux (default): best general quality
- flux-realism: photo-realistic
- flux-anime: anime/manga style
- flux-3d: 3D render look
- turbo: fastest, lower quality

QUOTA: Free, no key, no daily cap. Slow (~10-30s per image).`,
        parameters: {
            type: "OBJECT",
            properties: {
                prompt:   { type: "STRING", description: "Detailed image generation prompt. Be specific about subject, mood, lighting, composition, and colour palette." },
                model:    { type: "STRING", description: "Model: 'flux' (default), 'flux-realism', 'flux-anime', 'flux-3d', or 'turbo'." },
                style:    { type: "STRING", description: "Optional style modifier appended to the prompt, e.g. 'Synty Studios low-poly 3D', 'dark fantasy painterly', 'minimal flat vector'." },
                filename: { type: "STRING", description: "Optional filename (without extension), e.g. 'project-arx-banner'. Auto-generated from timestamp if omitted." },
                width:    { type: "NUMBER", description: "Width in pixels (64–2048). Default 1024." },
                height:   { type: "NUMBER", description: "Height in pixels (64–2048). Default 1024." },
                seed:     { type: "NUMBER", description: "Optional seed for reproducible generation." },
            },
            required: ["prompt"],
        },
    },
    {
        name: "github_search_repos",
        description: "Search public GitHub repositories. Returns name, description, stars, language, and URL. Useful when looking for example projects, libraries, or references.",
        parameters: {
            type: "OBJECT",
            properties: {
                query: { type: "STRING", description: "Search query. Supports GitHub qualifiers like 'language:csharp stars:>1000'." },
                sort:  { type: "STRING", description: "Sort: 'best-match' (default), 'stars', 'forks', 'updated'." },
                limit: { type: "NUMBER", description: "Max results (default 10, cap 30)." },
            },
            required: ["query"],
        },
    },
    {
        name: "github_get_repo",
        description: "Get metadata about a specific GitHub repository (description, stars, language, license, topics, default branch, last update).",
        parameters: {
            type: "OBJECT",
            properties: {
                owner: { type: "STRING", description: "Repo owner (user or org), e.g. 'dotnet'." },
                repo:  { type: "STRING", description: "Repo name, e.g. 'runtime'." },
            },
            required: ["owner", "repo"],
        },
    },
    {
        name: "github_get_file",
        description: "Get the contents of a file or directory from a GitHub repository. Returns decoded file text or directory listing. Useful for reading actual source code, READMEs, configs.",
        parameters: {
            type: "OBJECT",
            properties: {
                owner: { type: "STRING", description: "Repo owner." },
                repo:  { type: "STRING", description: "Repo name." },
                path:  { type: "STRING", description: "Path within the repo, e.g. 'src/main.cs' or 'docs/'." },
                ref:   { type: "STRING", description: "Optional branch/tag/commit SHA. Defaults to default branch." },
            },
            required: ["owner", "repo", "path"],
        },
    },
    {
        name: "github_search_code",
        description: "Search code across public GitHub repositories. REQUIRES a GitHub Personal Access Token configured in Settings. Returns matching files with paths and repos.",
        parameters: {
            type: "OBJECT",
            properties: {
                query: { type: "STRING", description: "Code search query. Supports qualifiers like 'language:csharp filename:Program.cs'." },
                limit: { type: "NUMBER", description: "Max results (default 10, cap 30)." },
            },
            required: ["query"],
        },
    },
    {
        name: "github_list_issues",
        description: "List issues for a GitHub repository (excludes PRs). Returns title, state, labels, comments, and URL.",
        parameters: {
            type: "OBJECT",
            properties: {
                owner: { type: "STRING", description: "Repo owner." },
                repo:  { type: "STRING", description: "Repo name." },
                state: { type: "STRING", description: "'open' (default), 'closed', or 'all'." },
                limit: { type: "NUMBER", description: "Max results (default 20, cap 50)." },
            },
            required: ["owner", "repo"],
        },
    },
    {
        name: "open_library_search",
        description: "Search books via Open Library (Internet Archive). Returns title, authors, first publish year, edition count, subjects, ISBN, borrow/scan availability, cover image URL, and a link to the Open Library page. Fully free, no key. Use when looking up books for Cogito media notes, finding titles by author, or exploring subjects.",
        parameters: {
            type: "OBJECT",
            properties: {
                query:   { type: "STRING", description: "General search query (title keywords, author, topic)." },
                author:  { type: "STRING", description: "Filter by author name, e.g. 'tolkien'." },
                subject: { type: "STRING", description: "Filter by subject/genre, e.g. 'history', 'economics', 'theology'." },
                limit:   { type: "NUMBER", description: "Max results (default 10, cap 20)." },
            },
            required: [],
        },
    },
    {
        name: "google_books_search",
        description: "Search Google Books — comprehensive coverage of technical, fiction, history, theology books. Returns title, authors, ISBN, description, cover image URL, page count. Use when looking up book metadata for Cogito media notes or finding references.",
        parameters: {
            type: "OBJECT",
            properties: {
                query:   { type: "STRING", description: "Search query. Use 'intitle:', 'inauthor:', 'isbn:' qualifiers for precision." },
                subject: { type: "STRING", description: "Optional subject filter, e.g. 'computers', 'history', 'religion'." },
                limit:   { type: "NUMBER", description: "Max results (default 10, cap 40)." },
            },
            required: ["query"],
        },
    },
    {
        name: "stackoverflow_search",
        description: "Search Stack Overflow (or sister sites: gamedev, codereview, cstheory, etc.) for technical questions. Returns titles, scores, accepted-answer status, tags, and URLs. Use when troubleshooting or looking up existing solutions.",
        parameters: {
            type: "OBJECT",
            properties: {
                query:         { type: "STRING", description: "Search query (the actual question wording often works best)." },
                site:          { type: "STRING", description: "Stack Exchange site: 'stackoverflow' (default), 'gamedev', 'codereview', 'cstheory', 'softwareengineering'." },
                tagged:        { type: "STRING", description: "Filter by tag, e.g. 'c#', 'unity', 'algorithm'." },
                accepted_only: { type: "BOOLEAN", description: "Only show questions with an accepted answer (default true)." },
                limit:         { type: "NUMBER", description: "Max results (default 10, cap 30)." },
            },
            required: ["query"],
        },
    },
    {
        name: "stackoverflow_get_answer",
        description: "Fetch the top-voted answer for a Stack Overflow question by its ID. Returns the answer body, score, author, and direct link.",
        parameters: {
            type: "OBJECT",
            properties: {
                question_id: { type: "NUMBER", description: "Numeric question ID (from a stackoverflow_search result URL)." },
                site:        { type: "STRING", description: "Stack Exchange site (default 'stackoverflow')." },
            },
            required: ["question_id"],
        },
    },
    {
        name: "wikipedia_search",
        description: "Search Wikipedia for articles. Returns titles, snippets, and URLs. Free, no key. Use as a quick factual baseline for any topic — history, theology, economics, science, biographies.",
        parameters: {
            type: "OBJECT",
            properties: {
                query: { type: "STRING", description: "Search query." },
                lang:  { type: "STRING", description: "Wikipedia language code (default 'en')." },
                limit: { type: "NUMBER", description: "Max results (default 5, cap 20)." },
            },
            required: ["query"],
        },
    },
    {
        name: "wikipedia_get_summary",
        description: "Get the full summary (first paragraph + metadata + thumbnail) of a Wikipedia article by exact title. Use after wikipedia_search to dig into a specific result.",
        parameters: {
            type: "OBJECT",
            properties: {
                title: { type: "STRING", description: "Exact article title (as returned by wikipedia_search)." },
                lang:  { type: "STRING", description: "Wikipedia language code (default 'en')." },
            },
            required: ["title"],
        },
    },
    {
        name: "get_weather",
        description: "Get current weather and a short forecast for a location. Free, no key (Open-Meteo). Auto-geocodes city names. Use when the user asks about weather, or when building a daily briefing.",
        parameters: {
            type: "OBJECT",
            properties: {
                location: { type: "STRING", description: "City, region, or 'lat,lon' coordinates." },
                days:     { type: "NUMBER", description: "Forecast days (1-7, default 3)." },
            },
            required: ["location"],
        },
    },
    {
        name: "get_exchange_rate",
        description: "Convert between currencies using the European Central Bank reference rates (Frankfurter API, free, no key). Returns conversion rate and amount. Use for any currency conversion question or finance calculation.",
        parameters: {
            type: "OBJECT",
            properties: {
                from:   { type: "STRING", description: "ISO currency code to convert FROM (e.g. 'USD', 'EUR', 'GBP')." },
                to:     { type: "STRING", description: "ISO currency code to convert TO." },
                amount: { type: "NUMBER", description: "Amount to convert (default 1)." },
            },
            required: ["from", "to"],
        },
    },
    {
        name: "get_quote",
        description: "Get today's inspirational quote from ZenQuotes (no key required). Returns one quote per day — same quote across all calls on the same day. Use for daily-briefing flavour or motivation prompts.",
        parameters: {
            type: "OBJECT",
            properties: {},
        },
    },
    {
        name: "devto_search",
        description: "Search recent articles on DEV.to. Free, no key. Returns titles, authors, tags, URLs, reading time. Use when the user wants to find dev articles on a topic, or to seed a research note with current discourse.",
        parameters: {
            type: "OBJECT",
            properties: {
                tag:      { type: "STRING", description: "DEV.to tag (e.g. 'rust', 'gamedev', 'csharp', 'webdev'). If omitted, returns top recent articles." },
                limit:    { type: "NUMBER", description: "Max results (default 10, cap 30)." },
                top:      { type: "NUMBER", description: "If set (1=day, 7=week, 30=month, 365=year), filters to top articles in that window instead of newest." },
            },
        },
    },
];

// ─── Deep Research wrappers ───────────────────────────────────────────────
// Thin adapters from tool-call args → Research module API. Always return
// JSON-friendly objects (Gemini chokes on circular refs / class instances).

async function queue_research_topic({ topic, rationale, context }) {
    if (!topic) return { error: "topic is required" };
    if (!rationale) return { error: "rationale is required — give a 1-sentence justification" };
    try {
        const entry = await R.queueTopic({ topic, rationale, context });
        const queue = await R.getQueue();
        return entry.deduped
            ? { ok: true, deduped: true, id: entry.id, message: `Already queued as "${entry.topic}".`, queue_size: queue.length }
            : { ok: true, id: entry.id, queued_at: entry.queued_at, topic: entry.topic, queue_size: queue.length };
    } catch (e) {
        return { error: String(e?.message ?? e) };
    }
}

async function list_research_queue() {
    const queue = await R.getQueue();
    return {
        count: queue.length,
        queue: queue.map(q => ({
            id: q.id, topic: q.topic, rationale: q.rationale,
            context: q.context, queued_at: q.queued_at,
        })),
    };
}

async function remove_research_topic({ id }) {
    if (!id) return { error: "id is required" };
    const removed = await R.removeFromQueue(id);
    return { ok: removed > 0, removed };
}

async function propose_research_batch({ size = 12 } = {}) {
    const cap = Math.min(Math.max(1, size || 12), 15);
    const queue = await R.getQueue();
    const batch = queue.slice(0, cap);
    return {
        count: batch.length,
        total_queued: queue.length,
        batch: batch.map(q => ({
            id: q.id, topic: q.topic, rationale: q.rationale, context: q.context,
        })),
        instruction: "Present these to the user and ask 'fire batch?' BEFORE calling run_deep_research.",
    };
}

async function run_deep_research({ topic_ids, depth = "standard", force = false }) {
    if (!Array.isArray(topic_ids) || !topic_ids.length) {
        return { error: "topic_ids must be a non-empty array — call list_research_queue first" };
    }
    const queue = await R.getQueue();
    // Support "all" as a special value meaning fire everything in the queue
    const wanted = new Set(topic_ids.map(id => String(id)));
    const entries = wanted.has("all")
        ? queue
        : queue.filter(q => wanted.has(q.id));
    if (!entries.length) return { error: "None of the provided ids match queued topics. Call list_research_queue to get current ids." };

    try {
        const out = await R.runBatch(entries, { depth, force });
        const msg = out.skipped?.length
            ? `Researched ${out.results.length} topic(s) with ${out.totalCalls} Gemini call(s). ${out.skipped.length} skipped (cached).`
            : `Researched ${out.results.length} topic(s) with ${out.totalCalls} Gemini call(s).`;
        return {
            ok: true,
            researched: out.results.length,
            skipped: out.skipped || [],
            totalCalls: out.totalCalls,
            depth,
            results: out.results.map(r => ({
                topic: r.topic,
                summary: r.summary,
                findings: r.findings,
                open_questions: r.open_questions,
                vault_suggestions: r.vault_suggestions,
            })),
            note: msg + " Results persisted to Systems/Oraculum/Data/research_results.json. Summarize key findings and offer to save to Memory.",
        };
    } catch (e) {
        const msg = String(e?.message ?? e);
        if (msg === "__NO_KEY__") return { error: "No Gemini API key configured. Open Settings → Config to set one." };
        return { error: msg };
    }
}

async function search_research_results({ query }) {
    const matches = await R.searchResults(query);
    return {
        count: matches.length,
        results: matches.map(r => ({
            topic: r.topic, ran_at: r.ran_at, depth: r.depth,
            summary: r.summary,
            findings_count: (r.findings || []).length,
            citations_count: (r.citations || []).length,
        })),
    };
}

async function save_research_to_memory({ topic }) {
    if (!topic) return { error: "topic is required" };
    try {
        // Find the matching result by topic (case-insensitive)
        const all = await R.getResults();
        const lc = topic.trim().toLowerCase();
        const result = all.slice().reverse().find(r => r.topic?.trim().toLowerCase() === lc)
                    || all.slice().reverse().find(r => r.topic?.toLowerCase().includes(lc));
        if (!result) return { error: `No research result found for topic: "${topic}". Run the research first.` };
        const { ok, path } = await R.saveToMemory(result);
        return { ok, path, topic: result.topic, message: `Saved to ${path}` };
    } catch (e) {
        return { error: String(e?.message ?? e) };
    }
}

// ─── Image generation: generate_image (Pollinations.ai — free, no key) ───────
// Pollinations returns the image binary directly via GET. No auth.
// Models: flux (default, best), flux-realism, flux-anime, flux-3d, turbo

const POLLINATIONS_MODELS = ["flux", "flux-realism", "flux-anime", "flux-3d", "turbo"];
const IMAGE_OUTPUT_FOLDER = "Attachments/Generated";

async function generate_image({ prompt, model = "flux", style, filename, width = 1024, height = 1024, seed }) {
    if (!prompt?.trim()) return { error: "prompt is required." };
    const chosenModel = POLLINATIONS_MODELS.includes(model) ? model : "flux";
    const fullPrompt = style ? `${prompt.trim()}, ${style}` : prompt.trim();

    const encodedPrompt = encodeURIComponent(fullPrompt);
    const params = new URLSearchParams({
        model: chosenModel,
        width:  String(Math.max(64, Math.min(2048, width))),
        height: String(Math.max(64, Math.min(2048, height))),
        nologo: "true",
        ...(seed != null ? { seed: String(seed) } : {}),
    });
    const url = `https://image.pollinations.ai/prompt/${encodedPrompt}?${params.toString()}`;

    const r = await W.httpBinary(url);
    if (!r.ok) return { error: `Pollinations error: ${r.error}` };
    if (!r.bytes?.length) return { error: "Pollinations returned empty image data." };

    const ext = (r.mimeType?.includes("jpeg") || r.mimeType?.includes("jpg")) ? "jpg" : "png";
    const safeFilename = filename
        ? V.safeName(filename.replace(/\.(png|jpg|jpeg)$/i, "")) + `.${ext}`
        : `img-${Date.now()}.${ext}`;
    await V.ensureFolder(IMAGE_OUTPUT_FOLDER);
    const outputPath = `${IMAGE_OUTPUT_FOLDER}/${safeFilename}`;

    try {
        await dc.app.vault.adapter.writeBinary(outputPath, r.bytes.buffer);
    } catch (e) {
        return { error: `Failed to write image to vault: ${e.message}` };
    }

    return {
        ok:      true,
        path:    outputPath,
        embed:   `![[${outputPath}]]`,
        model:   chosenModel,
        prompt:  fullPrompt,
        message: `Image saved to ${outputPath}. Embed with: ![[${outputPath}]]`,
    };
}

// ─── GitHub integration ──────────────────────────────────────────────────────
// Uses optional Personal Access Token (raises 60→5000 req/h, allows private repos).
// Anonymous works for public repos at lower rate.

async function _githubRequest(path, params = {}) {
    const url = new URL(`https://api.github.com${path}`);
    for (const [k, v] of Object.entries(params)) {
        if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
    }
    const token = getGithubToken();
    const headers = {
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        ...(token ? { "Authorization": `Bearer ${token}` } : {}),
    };
    return W.httpJson(url.toString(), { headers });
}

async function github_search_repos({ query, sort = "best-match", limit = 10 }) {
    if (!query?.trim()) return { error: "query is required" };
    const r = await _githubRequest("/search/repositories", { q: query, sort, per_page: Math.min(limit, 30) });
    if (!r.ok) return { error: r.error };
    return {
        total: r.data?.total_count ?? 0,
        results: (r.data?.items ?? []).slice(0, limit).map(x => ({
            full_name:   x.full_name,
            description: x.description,
            url:         x.html_url,
            stars:       x.stargazers_count,
            forks:       x.forks_count,
            language:    x.language,
            updated:     x.updated_at?.slice(0, 10),
            topics:      x.topics ?? [],
        })),
    };
}

async function github_get_repo({ owner, repo }) {
    if (!owner || !repo) return { error: "owner and repo are required" };
    const r = await _githubRequest(`/repos/${owner}/${repo}`);
    if (!r.ok) return { error: r.error };
    const x = r.data;
    return {
        full_name:    x.full_name,
        description:  x.description,
        url:          x.html_url,
        stars:        x.stargazers_count,
        forks:        x.forks_count,
        open_issues:  x.open_issues_count,
        language:     x.language,
        license:      x.license?.spdx_id,
        default_branch: x.default_branch,
        topics:       x.topics ?? [],
        created:      x.created_at?.slice(0, 10),
        updated:      x.updated_at?.slice(0, 10),
        homepage:     x.homepage,
    };
}

async function github_get_file({ owner, repo, path, ref }) {
    if (!owner || !repo || !path) return { error: "owner, repo, path are required" };
    const params = ref ? { ref } : {};
    const r = await _githubRequest(`/repos/${owner}/${repo}/contents/${path}`, params);
    if (!r.ok) return { error: r.error };
    const x = r.data;
    if (Array.isArray(x)) {
        return { type: "directory", path, items: x.map(it => ({ name: it.name, type: it.type, size: it.size, path: it.path })) };
    }
    if (x.encoding === "base64" && x.content) {
        try {
            const decoded = atob(x.content.replace(/\n/g, ""));
            return { type: "file", path: x.path, size: x.size, sha: x.sha, content: decoded };
        } catch (e) {
            return { type: "file", path: x.path, size: x.size, sha: x.sha, error: "decode failed", download_url: x.download_url };
        }
    }
    return { type: "file", path: x.path, size: x.size, download_url: x.download_url };
}

async function github_search_code({ query, limit = 10 }) {
    if (!query?.trim()) return { error: "query is required" };
    if (!getGithubToken()) return { error: "GitHub code search requires a Personal Access Token. Add it in Settings → API Keys." };
    const r = await _githubRequest("/search/code", { q: query, per_page: Math.min(limit, 30) });
    if (!r.ok) return { error: r.error };
    return {
        total: r.data?.total_count ?? 0,
        results: (r.data?.items ?? []).slice(0, limit).map(x => ({
            path:       x.path,
            repo:       x.repository?.full_name,
            url:        x.html_url,
            score:      x.score,
        })),
    };
}

async function github_list_issues({ owner, repo, state = "open", limit = 20 }) {
    if (!owner || !repo) return { error: "owner and repo are required" };
    const r = await _githubRequest(`/repos/${owner}/${repo}/issues`, { state, per_page: Math.min(limit, 50) });
    if (!r.ok) return { error: r.error };
    return {
        count: r.data?.length ?? 0,
        issues: (r.data ?? []).filter(i => !i.pull_request).map(i => ({
            number: i.number,
            title:  i.title,
            state:  i.state,
            user:   i.user?.login,
            labels: i.labels?.map(l => l.name) ?? [],
            url:    i.html_url,
            created: i.created_at?.slice(0, 10),
            comments: i.comments,
        })),
    };
}

// ─── Open Library integration (no key required) ───────────────────────────────
// Rate limits: 1 req/s anonymous, 3 req/s with User-Agent + contact email.
// We throttle to stay within whichever tier is active.

let _openLibraryLastCall = 0;
async function _openLibraryThrottle() {
    const email    = getOpenLibraryEmail();
    const interval = email ? 340 : 1010; // ~3 req/s identified, ~1 req/s anonymous (+ 10ms buffer)
    const wait = interval - (Date.now() - _openLibraryLastCall);
    if (wait > 0) await new Promise(r => setTimeout(r, wait));
    _openLibraryLastCall = Date.now();
}

async function open_library_search({ query, author, subject, limit = 10 }) {
    if (!query?.trim() && !author?.trim() && !subject?.trim())
        return { error: "at least one of query, author, or subject is required" };
    const fields = "title,author_name,first_publish_year,isbn,subject,edition_count,key,cover_i,public_scan_b,ratings_average,language";
    const params = new URLSearchParams({ fields, limit: String(Math.min(limit, 20)) });
    if (query?.trim())   params.set("q",       query.trim());
    if (author?.trim())  params.set("author",  author.trim());
    if (subject?.trim()) params.set("subject", subject.trim());
    const email = getOpenLibraryEmail();
    const userAgent = email
        ? `Oraculum/1.0 (${email})`
        : "Oraculum/1.0 (spanko-tech-vault)";
    await _openLibraryThrottle();
    const r = await W.httpJson(`https://openlibrary.org/search.json?${params}`, {
        headers: { "User-Agent": userAgent },
    });
    if (!r.ok) return { error: r.error };
    return {
        total: r.data?.numFound ?? 0,
        results: (r.data?.docs ?? []).slice(0, limit).map(b => ({
            title:           b.title,
            authors:         (b.author_name ?? []).slice(0, 5),
            first_published: b.first_publish_year,
            editions:        b.edition_count,
            subjects:        (b.subject ?? []).slice(0, 5),
            isbn:            (b.isbn ?? [])[0] ?? null,
            languages:       (b.language ?? []).slice(0, 3),
            rating:          b.ratings_average ? Math.round(b.ratings_average * 10) / 10 : null,
            readable_free:   !!b.public_scan_b,
            cover:           b.cover_i ? `https://covers.openlibrary.org/b/id/${b.cover_i}-M.jpg` : null,
            url:             b.key ? `https://openlibrary.org${b.key}` : null,
        })),
    };
}

// ─── Google Books integration (no key required for ≤1000 req/day) ────────────

async function google_books_search({ query, limit = 10, subject }) {
    if (!query?.trim()) return { error: "query is required" };
    const q = subject ? `${query} subject:${subject}` : query.trim();
    const params = new URLSearchParams({
        q,
        maxResults: String(Math.min(limit, 40)),
    });
    const key = getGoogleBooksKey();
    if (key) params.set("key", key);
    const r = await W.httpJson(`https://www.googleapis.com/books/v1/volumes?${params}`);
    if (!r.ok) return { error: r.error };
    return {
        total: r.data?.totalItems ?? 0,
        results: (r.data?.items ?? []).slice(0, limit).map(b => {
            const v = b.volumeInfo ?? {};
            return {
                title:       v.title,
                subtitle:    v.subtitle,
                authors:     v.authors ?? [],
                publisher:   v.publisher,
                published:   v.publishedDate,
                pageCount:   v.pageCount,
                description: v.description?.slice(0, 500),
                categories:  v.categories ?? [],
                rating:      v.averageRating,
                isbn:        (v.industryIdentifiers ?? []).find(i => i.type === "ISBN_13")?.identifier
                          ?? (v.industryIdentifiers ?? []).find(i => i.type === "ISBN_10")?.identifier,
                cover:       v.imageLinks?.thumbnail?.replace(/^http:/, "https:"),
                preview_url: v.previewLink,
                info_url:    v.infoLink,
            };
        }),
    };
}

// ─── Stack Exchange integration (Stack Overflow + sister sites; no key needed) ─

async function stackoverflow_search({ query, site = "stackoverflow", limit = 10, tagged, accepted_only = true }) {
    if (!query?.trim()) return { error: "query is required" };
    const params = new URLSearchParams({
        order: "desc",
        sort:  "relevance",
        q:     query.trim(),
        site,
        pagesize: String(Math.min(limit, 30)),
        ...(tagged ? { tagged } : {}),
        ...(accepted_only ? { accepted: "True" } : {}),
        filter: "withbody",
    });
    const key = getStackExKey();
    if (key) params.set("key", key);
    const r = await W.httpJson(`https://api.stackexchange.com/2.3/search/advanced?${params}`);
    if (!r.ok) return { error: r.error };
    const stripHtml = (s) => String(s ?? "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
    return {
        total: r.data?.total ?? r.data?.items?.length ?? 0,
        quota_remaining: r.data?.quota_remaining,
        results: (r.data?.items ?? []).slice(0, limit).map(q => ({
            title:        q.title,
            score:        q.score,
            answer_count: q.answer_count,
            is_answered:  q.is_answered,
            tags:         q.tags ?? [],
            url:          q.link,
            excerpt:      stripHtml(q.body).slice(0, 300),
            asked:        q.creation_date ? new Date(q.creation_date * 1000).toISOString().slice(0, 10) : null,
        })),
    };
}

async function stackoverflow_get_answer({ question_id, site = "stackoverflow" }) {
    if (!question_id) return { error: "question_id is required" };
    const params = new URLSearchParams({ order: "desc", sort: "votes", site, filter: "withbody" });
    const key = getStackExKey();
    if (key) params.set("key", key);
    const r = await W.httpJson(`https://api.stackexchange.com/2.3/questions/${question_id}/answers?${params}`);
    if (!r.ok) return { error: r.error };
    const stripHtml = (s) => String(s ?? "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
    const top = (r.data?.items ?? [])[0];
    if (!top) return { error: "No answers found" };
    return {
        score:       top.score,
        is_accepted: top.is_accepted,
        author:      top.owner?.display_name,
        body:        stripHtml(top.body).slice(0, 2000),
        url:         `https://${site === "stackoverflow" ? "stackoverflow.com" : site + ".stackexchange.com"}/a/${top.answer_id}`,
    };
}

// ─── Wikipedia integration (no key required) ─────────────────────────────────

async function wikipedia_search({ query, limit = 5, lang = "en" }) {
    if (!query?.trim()) return { error: "query is required" };
    const url = `https://${lang}.wikipedia.org/w/api.php?` + new URLSearchParams({
        action: "query",
        list:   "search",
        srsearch: query.trim(),
        srlimit: String(Math.min(limit, 20)),
        format: "json",
        origin: "*",
    });
    const r = await W.httpJson(url);
    if (!r.ok) return { error: r.error };
    return {
        total: r.data?.query?.searchinfo?.totalhits ?? 0,
        results: (r.data?.query?.search ?? []).map(p => ({
            title:    p.title,
            snippet:  String(p.snippet ?? "").replace(/<[^>]+>/g, ""),
            url:      `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(p.title.replace(/ /g, "_"))}`,
            wordcount: p.wordcount,
        })),
    };
}

async function wikipedia_get_summary({ title, lang = "en" }) {
    if (!title?.trim()) return { error: "title is required" };
    const url = `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.trim().replace(/ /g, "_"))}`;
    const r = await W.httpJson(url);
    if (!r.ok) return { error: r.error };
    const x = r.data;
    return {
        title:        x.title,
        description:  x.description,
        extract:      x.extract,
        thumbnail:    x.thumbnail?.source,
        url:          x.content_urls?.desktop?.page,
        type:         x.type,
        coordinates:  x.coordinates,
    };
}

// ─── Open-Meteo: weather + geocoding (no key required) ────────────────────────

async function get_weather({ location, days = 3 }) {
    if (!location?.trim()) return { error: "location is required" };
    const loc = location.trim();
    let lat, lon, name = loc, country;

    // Accept "lat,lon" coordinates directly; else geocode via Open-Meteo.
    const coordMatch = loc.match(/^(-?\d+(?:\.\d+)?)[,\s]+(-?\d+(?:\.\d+)?)$/);
    if (coordMatch) {
        lat = parseFloat(coordMatch[1]);
        lon = parseFloat(coordMatch[2]);
    } else {
        const gUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(loc)}&count=1&language=en&format=json`;
        const g = await W.httpJson(gUrl);
        if (!g.ok)               return { error: `Geocoding failed: ${g.error}` };
        const hit = g.data?.results?.[0];
        if (!hit)                return { error: `No location found for "${loc}".` };
        lat     = hit.latitude;
        lon     = hit.longitude;
        name    = hit.name;
        country = hit.country;
    }

    const d = Math.min(Math.max(parseInt(days) || 3, 1), 7);
    const wUrl = `https://api.open-meteo.com/v1/forecast?` + new URLSearchParams({
        latitude:  String(lat),
        longitude: String(lon),
        current:   "temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m",
        daily:     "weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum",
        forecast_days: String(d),
        timezone:  "auto",
    });
    const w = await W.httpJson(wUrl);
    if (!w.ok) return { error: w.error };

    const codeMap = {
        0:"Clear", 1:"Mostly clear", 2:"Partly cloudy", 3:"Overcast",
        45:"Fog", 48:"Rime fog",
        51:"Light drizzle", 53:"Drizzle", 55:"Heavy drizzle",
        61:"Light rain", 63:"Rain", 65:"Heavy rain",
        71:"Light snow", 73:"Snow", 75:"Heavy snow",
        77:"Snow grains", 80:"Rain showers", 81:"Heavy rain showers",
        82:"Violent rain showers", 85:"Snow showers", 86:"Heavy snow showers",
        95:"Thunderstorm", 96:"Thunderstorm with hail", 99:"Severe thunderstorm",
    };
    const cur = w.data.current ?? {};
    const daily = w.data.daily ?? {};
    return {
        location:    country ? `${name}, ${country}` : name,
        coordinates: { lat, lon },
        current: {
            temperature_c: cur.temperature_2m,
            humidity_pct:  cur.relative_humidity_2m,
            wind_kmh:      cur.wind_speed_10m,
            condition:     codeMap[cur.weather_code] ?? `Code ${cur.weather_code}`,
        },
        forecast: (daily.time ?? []).map((date, i) => ({
            date,
            condition:        codeMap[daily.weather_code?.[i]] ?? `Code ${daily.weather_code?.[i]}`,
            temp_max_c:       daily.temperature_2m_max?.[i],
            temp_min_c:       daily.temperature_2m_min?.[i],
            precipitation_mm: daily.precipitation_sum?.[i],
        })),
    };
}

// ─── Frankfurter: ECB currency conversion (no key required) ───────────────────

async function get_exchange_rate({ from, to, amount = 1 }) {
    if (!from?.trim() || !to?.trim()) return { error: "from and to are required (ISO currency codes)" };
    const f = from.trim().toUpperCase();
    const t = to.trim().toUpperCase();
    const a = parseFloat(amount) || 1;
    const url = `https://api.frankfurter.dev/v1/latest?base=${encodeURIComponent(f)}&symbols=${encodeURIComponent(t)}`;
    const r = await W.httpJson(url);
    if (!r.ok) return { error: r.error };
    const rate = r.data?.rates?.[t];
    if (rate == null) return { error: `No rate available for ${f} → ${t}` };
    return {
        from: f, to: t,
        rate,
        amount: a,
        converted: a * rate,
        date:  r.data.date,
        source: "Frankfurter / European Central Bank",
    };
}

// ─── ZenQuotes: daily inspirational quote (no key) ─────────────────────────

async function get_quote({} = {}) {
    const r = await W.httpJson("https://zenquotes.io/api/today");
    if (!r.ok) return { error: r.error };
    const item = r.data?.[0];
    if (!item) return { error: "No quote returned" };
    return {
        content: item.q,
        author:  item.a,
    };
}

// ─── DEV.to: search articles by tag (no key) ──────────────────────────────────

async function devto_search({ tag, limit = 10, top } = {}) {
    const params = new URLSearchParams();
    if (tag?.trim()) params.set("tag", tag.trim().toLowerCase());
    params.set("per_page", String(Math.min(parseInt(limit) || 10, 30)));
    if (top) params.set("top", String(parseInt(top) || 7));
    const url = `https://dev.to/api/articles?${params}`;
    const r = await W.httpJson(url);
    if (!r.ok) return { error: r.error };
    const items = Array.isArray(r.data) ? r.data : [];
    return {
        results: items.map(a => ({
            title:           a.title,
            description:     a.description,
            url:             a.url,
            cover_image:     a.cover_image,
            tags:            a.tag_list ?? [],
            author:          a.user?.name,
            author_username: a.user?.username,
            published_at:    a.published_at,
            reading_minutes: a.reading_time_minutes,
            positive_reactions: a.positive_reactions_count,
            comments:        a.comments_count,
        })),
    };
}


// ─── Dispatcher ───────────────────────────────────────────────────────────────

const _TOOLS = {
    search_notes,
    get_note,
    get_frontmatter,
    update_frontmatter,
    append_to_note,
    list_folder,
    list_field_values,
    find_by_field,
    find_by_tag,
    list_notes_in,
    list_habits,
    log_habit,
    create_habit,
    list_job_applications,
    create_job_application,
    update_job_status,
    create_note,
    create_media_note,
    update_media_status,
    list_projects,
    create_project,
    list_presentations,
    create_presentation,
    get_slide_patterns,
    list_issues,
    create_issue,
    update_issue_status,
    create_release,
    create_resource,
    create_skill,
    create_brag,
    create_adr,
    create_review,
    create_postmortem,
    fetch_url_metadata,
    scrape_webpage,
    get_habit_insights,
    get_vault_overview,
    find_related_notes,
    generate_daily_digest,
    save_session_summary,
    add_to_inbox,
    vault_health,
    import_youtube_playlist,
    fetch_video_transcript,
    fetch_social_metadata,
    // new
    write_note_body,
    get_recent_notes,
    move_note,
    bulk_log_habits,
    get_week_summary,
    get_habit_history,
    annotate_media,
    create_moc,
    semantic_search,
    insert_mermaid,
    // Deep Research (Gemini 2.5 Flash + Search grounding)
    queue_research_topic,
    list_research_queue,
    remove_research_topic,
    propose_research_batch,
    run_deep_research,
    search_research_results,
    save_research_to_memory,
    // Image generation (Pollinations)
    generate_image,
    // GitHub
    github_search_repos,
    github_get_repo,
    github_get_file,
    github_search_code,
    github_list_issues,
    // Research integrations
    open_library_search,
    google_books_search,
    stackoverflow_search,
    stackoverflow_get_answer,
    wikipedia_search,
    wikipedia_get_summary,
    get_weather,
    get_exchange_rate,
    get_quote,
    devto_search,
};

async function executeTool(name, args) {
    const fn = _TOOLS[name];
    if (!fn) return { error: `Unknown tool: "${name}"` };
    try {
        return await fn(args ?? {});
    } catch (e) {
        return { error: `Tool "${name}" threw: ${String(e?.message ?? e)}` };
    }
}

// ─── Tool metadata (for Settings UI filtering — NOT sent to the API) ──────────
// system: which vault pillar/area the tool targets
//   "any"      → works on any note in any folder
//   "Anima"    → Habits, Job Search, personal life
//   "Cogito"   → Notes, Media
//   "Fabrica"  → Projects, Issues, Releases, Resources, Growth
//   "Vault"    → Cross-vault analytics and intelligence
//   "Web"      → External web / internet
//   "Oraculum" → Session-level AI utilities
//
// category: what the tool does (purpose)
//   "search"  → reads/lists/finds notes or data
//   "create"  → creates new notes
//   "update"  → modifies existing notes or frontmatter
//   "analyze" → computes insights, trends, or health metrics
//   "web"     → fetches content from the internet
const TOOL_METADATA = {
    search_notes:            { system: "any",      category: "search"  },
    get_note:                { system: "any",      category: "search"  },
    get_frontmatter:         { system: "any",      category: "search"  },
    update_frontmatter:      { system: "any",      category: "update"  },
    append_to_note:          { system: "any",      category: "update"  },
    list_folder:             { system: "any",      category: "search"  },
    list_field_values:       { system: "any",      category: "search"  },
    find_by_field:           { system: "any",      category: "search"  },
    find_by_tag:             { system: "any",      category: "search"  },
    list_notes_in:           { system: "any",      category: "search"  },
    list_habits:             { system: "Anima",    category: "search"  },
    get_habit_insights:      { system: "Anima",    category: "analyze" },
    log_habit:               { system: "Anima",    category: "update"  },
    create_habit:            { system: "Anima",    category: "create"  },
    bulk_log_habits:         { system: "Anima",    category: "update"  },
    get_habit_history:       { system: "Anima",    category: "analyze" },
    list_job_applications:   { system: "Anima",    category: "search"  },
    create_job_application:  { system: "Anima",    category: "create"  },
    update_job_status:       { system: "Anima",    category: "update"  },
    create_note:             { system: "Cogito",   category: "create"  },
    create_media_note:       { system: "Cogito",   category: "create"  },
    update_media_status:     { system: "Cogito",   category: "update"  },
    annotate_media:          { system: "Cogito",   category: "update"  },
    create_moc:              { system: "Cogito",   category: "create"  },
    insert_mermaid:          { system: "any",      category: "update"  },
    list_projects:           { system: "Fabrica",  category: "search"  },
    create_project:          { system: "Fabrica",  category: "create"  },
    list_presentations:      { system: "Fabrica",  category: "search"  },
    create_presentation:     { system: "Fabrica",  category: "create"  },
    get_slide_patterns:      { system: "Fabrica",  category: "search"  },
    list_issues:             { system: "Fabrica",  category: "search"  },
    create_issue:            { system: "Fabrica",  category: "create"  },
    update_issue_status:     { system: "Fabrica",  category: "update"  },
    create_release:          { system: "Fabrica",  category: "create"  },
    create_resource:         { system: "Fabrica",  category: "create"  },
    create_skill:            { system: "Fabrica",  category: "create"  },
    create_brag:             { system: "Fabrica",  category: "create"  },
    create_adr:              { system: "Fabrica",  category: "create"  },
    create_review:           { system: "Fabrica",  category: "create"  },
    create_postmortem:       { system: "Fabrica",  category: "create"  },
    scrape_webpage:            { system: "Web",      category: "web"     },
    fetch_url_metadata:        { system: "Web",      category: "web"     },
    import_youtube_playlist:   { system: "Web",      category: "web"     },
    fetch_video_transcript:    { system: "Web",      category: "web"     },
    fetch_social_metadata:     { system: "Web",      category: "web"     },
    semantic_search:         { system: "Vault",    category: "search"  },
    get_vault_overview:      { system: "Vault",    category: "analyze" },
    find_related_notes:      { system: "Vault",    category: "analyze" },
    generate_daily_digest:   { system: "Vault",    category: "analyze" },
    vault_health:            { system: "Vault",    category: "analyze" },
    get_recent_notes:        { system: "Vault",    category: "search"  },
    get_week_summary:        { system: "Vault",    category: "analyze" },
    write_note_body:         { system: "any",      category: "update"  },
    move_note:               { system: "any",      category: "update"  },
    add_to_inbox:            { system: "any",      category: "create"  },
    save_session_summary:    { system: "Oraculum", category: "create"  },
    queue_research_topic:    { system: "Oraculum", category: "research" },
    list_research_queue:     { system: "Oraculum", category: "research" },
    remove_research_topic:   { system: "Oraculum", category: "research" },
    propose_research_batch:  { system: "Oraculum", category: "research" },
    run_deep_research:       { system: "Web",      category: "research" },
    search_research_results: { system: "Oraculum", category: "research" },
    save_research_to_memory:  { system: "Oraculum", category: "research" },
    generate_image:           { system: "any",      category: "create"  },
    github_search_repos:      { system: "Web",      category: "search"  },
    github_get_repo:          { system: "Web",      category: "search"  },
    github_get_file:          { system: "Web",      category: "search"  },
    github_search_code:       { system: "Web",      category: "search"  },
    github_list_issues:       { system: "Web",      category: "search"  },
    open_library_search:      { system: "Web",      category: "search"   },
    google_books_search:      { system: "Web",      category: "search"  },
    stackoverflow_search:     { system: "Web",      category: "search"  },
    stackoverflow_get_answer: { system: "Web",      category: "search"  },
    wikipedia_search:         { system: "Web",      category: "search"  },
    wikipedia_get_summary:    { system: "Web",      category: "search"  },
    get_weather:              { system: "Web",      category: "search"  },
    get_exchange_rate:        { system: "Web",      category: "search"  },
    get_quote:                { system: "Web",      category: "search"  },
    devto_search:             { system: "Web",      category: "search"  },
};

// ─── Per-tool enable/disable (Settings → Tools registry) ──────────────────────
// State persisted globally as a JSON array of disabled tool names.
const LS_DISABLED_TOOLS = "oraculum:tools-disabled";

function getDisabledTools() {
    try { return JSON.parse(localStorage.getItem(LS_DISABLED_TOOLS) ?? "[]"); }
    catch { return []; }
}
function setDisabledTools(arr) {
    try { localStorage.setItem(LS_DISABLED_TOOLS, JSON.stringify(arr ?? [])); }
    catch {}
}
function isToolEnabled(name) { return !getDisabledTools().includes(name); }

/**
 * Returns the subset of TOOL_DECLARATIONS the user has not disabled.
 * Use this — not raw TOOL_DECLARATIONS — at the Gemini call site so
 * disabled tools never even appear to the model.
 */
function getEnabledDeclarations() {
    const disabled = new Set(getDisabledTools());
    return TOOL_DECLARATIONS.filter(t => !disabled.has(t.name));
}

// ─── Integrations registry (Settings → Integrations card view) ────────────────
// Each entry: id, label, icon, summary, docs URL, key getter (or null), tool list.
const INTEGRATIONS = [
    {
        id: "gemini", label: "Gemini", icon: "✨",
        summary: "Google's Gemini API powers chat, deep research, and image generation.",
        docs: "https://ai.google.dev/", required: true,
        keyName: "Gemini API key", keyId: "gemini",
        tools: ["run_deep_research", "generate_image"],
    },
    {
        id: "supadata", label: "Supadata", icon: "📺",
        summary: "Video transcript service used to fetch YouTube/Vimeo transcripts when scraping fails.",
        docs: "https://supadata.ai/", required: false,
        keyName: "Supadata API key", keyId: "supadata",
        tools: ["fetch_video_transcript", "import_youtube_playlist"],
    },
    {
        id: "github", label: "GitHub", icon: "🐙",
        summary: "Search repositories, read files, browse issues. Optional PAT significantly raises the rate limit.",
        docs: "https://github.com/settings/tokens", required: false,
        keyName: "GitHub PAT", keyId: "github",
        tools: ["github_search_repos", "github_get_repo", "github_get_file", "github_search_code", "github_list_issues"],
    },
    {
        id: "stackex", label: "Stack Overflow", icon: "🥞",
        summary: "Search questions and fetch top answers from the Stack Exchange network.",
        docs: "https://api.stackexchange.com/", required: false,
        keyName: "Stack Exchange key", keyId: "stackex",
        tools: ["stackoverflow_search", "stackoverflow_get_answer"],
    },
    {
        id: "googlebooks", label: "Google Books", icon: "📚",
        summary: "Search the Google Books catalog. Optional API key raises the daily quota significantly.",
        docs: "https://developers.google.com/books", required: false,
        keyName: "Google Books API key", keyId: "googlebooks",
        tools: ["google_books_search"],
    },
    {
        id: "openlibrary", label: "Open Library", icon: "📖",
        summary: "Free book search via Open Library (Internet Archive). Returns metadata, ISBNs, subjects, edition counts, borrow/scan availability, and cover images. No key required. Optional contact email raises the rate limit.",
        docs: "https://openlibrary.org/developers/api", required: false,
        keyName: "Contact email (User-Agent)", keyId: "openlibrary",
        tools: ["open_library_search"],
    },
    {
        id: "wikipedia", label: "Wikipedia", icon: "📖",
        summary: "Search and summarise Wikipedia articles via the public REST API (no key).",
        docs: "https://en.wikipedia.org/api/rest_v1/", required: false,
        keyName: null, keyId: null,
        tools: ["wikipedia_search", "wikipedia_get_summary"],
    },
    {
        id: "pollinations", label: "Pollinations", icon: "🌸",
        summary: "Free image generation alternative to Imagen (no key, slower, generic style).",
        docs: "https://pollinations.ai/", required: false,
        keyName: null, keyId: null,
        tools: ["generate_image"],
    },
    {
        id: "openmeteo", label: "Open-Meteo", icon: "🌤️",
        summary: "Free weather forecast + geocoding API. No key required, no rate limit for personal use.",
        docs: "https://open-meteo.com/", required: false,
        keyName: null, keyId: null,
        tools: ["get_weather"],
    },
    {
        id: "frankfurter", label: "Frankfurter", icon: "💱",
        summary: "European Central Bank reference exchange rates. No key, free, daily updates.",
        docs: "https://frankfurter.dev/", required: false,
        keyName: null, keyId: null,
        tools: ["get_exchange_rate"],
    },
    {
        id: "zenquotes", label: "ZenQuotes", icon: "💬",
        summary: "Daily inspirational quote via ZenQuotes API. Free, no key required — returns one consistent quote per day.",
        docs: "https://docs.zenquotes.io/zenquotes-documentation/", required: false,
        keyName: null, keyId: null,
        tools: ["get_quote"],
    },
    {
        id: "devto", label: "DEV.to", icon: "👩‍💻",
        summary: "Search recent dev articles by tag. Used by the Home dashboard feed and by chat queries about current dev discourse.",
        docs: "https://developers.forem.com/api", required: false,
        keyName: null, keyId: null,
        tools: ["devto_search"],
    },
];

return {
    TOOL_DECLARATIONS, TOOL_METADATA, INTEGRATIONS, executeTool,
    getEnabledDeclarations, getDisabledTools, setDisabledTools, isToolEnabled,
    getSupadataKey,    saveSupadataKey,    clearSupadataKey,
    getGithubToken,    saveGithubToken,    clearGithubToken,
    getStackExKey,     saveStackExKey,     clearStackExKey,
    getGoogleBooksKey, saveGoogleBooksKey, clearGoogleBooksKey,
    getOpenLibraryEmail, saveOpenLibraryEmail, clearOpenLibraryEmail,
};
