// Shared low-level helpers for Datacore dashboards.
// Loaded with: const V = await dc.require("Toolkit/Datacore/Vault.js");
//
// All functions here are pure JS (no React). For UI components see UI.jsx.

// =====================================================================
// Frontmatter writes
// =====================================================================

/**
 * Set a single frontmatter field on the file backing a Datacore item.
 * @param {{$path:string}} item  Datacore page object
 * @param {string} key
 * @param {any} val
 */
async function setField(item, key, val) {
    const file = dc.app.vault.getFileByPath?.(item.$path) ?? dc.app.vault.getAbstractFileByPath(item.$path);
    if (!file) return;
    await dc.app.fileManager.processFrontMatter(file, fm => { fm[key] = val; });
}

/**
 * Set multiple frontmatter fields in one write.
 * @param {{$path:string}} item
 * @param {Record<string,any>} obj
 */
async function setFields(item, obj) {
    const file = dc.app.vault.getFileByPath?.(item.$path) ?? dc.app.vault.getAbstractFileByPath(item.$path);
    if (!file) return;
    await dc.app.fileManager.processFrontMatter(file, fm => { for (const k of Object.keys(obj)) fm[k] = obj[k]; });
}

// =====================================================================
// User feedback
// =====================================================================

/** Show an Obsidian toast. Falls back to console if Notice unavailable. */
function notify(msg) {
    try { new Notice(String(msg)); }
    catch {
        try { new window.Notice(String(msg)); }
        catch { console.warn(msg); }
    }
}

// =====================================================================
// Files & folders
// =====================================================================

/** Create folder if missing. No-op if it already exists. */
async function ensureFolder(path) {
    if (!path) return;
    if (dc.app.vault.getAbstractFileByPath(path)) return;
    try { await dc.app.vault.createFolder(path); } catch (_) { /* race or exists */ }
}

/** Move file to OS trash (default) or vault trash. */
async function trashFile(file, system = true) {
    if (!file) return;
    await dc.app.vault.trash(file, system);
}

/**
 * Confirm-then-trash. Accepts either a TFile or a Datacore item.
 * @returns {boolean} true if trashed.
 */
async function confirmTrash(fileOrItem, msg) {
    const file = fileOrItem?.$path
        ? (dc.app.vault.getFileByPath?.(fileOrItem.$path) ?? dc.app.vault.getAbstractFileByPath(fileOrItem.$path))
        : fileOrItem;
    if (!file) return false;
    if (!window.confirm(msg ?? `Move "${file.basename ?? file.name}" to trash?`)) return false;
    await dc.app.vault.trash(file, true);
    return true;
}

/** Strip filename-illegal characters. */
function safeName(s) {
    return String(s ?? "").replace(/[<>:"/\\|?*]/g, "-").trim();
}

/**
 * Extract a clean basename from anything that smells like a wikilink.
 * Accepts: `[[Foo/Bar|Bar]]`, `Foo/Bar.md`, `{path:"Foo/Bar.md"}`, etc.
 */
function linkBasename(link) {
    if (link == null) return "";
    if (typeof link === "object") {
        if (link.path) return String(link.path).split("/").pop().replace(/\.md$/, "");
        if (link.name) return String(link.name);
        if (link.display || link.subpath) return String(link.display ?? link.subpath).split("/").pop().replace(/\.md$/, "");
    }
    return String(link).replace(/^\[\[|\]\]$/g, "").split("|")[0].split("/").pop().replace(/\.md$/, "");
}

// =====================================================================
// Dates
// =====================================================================

/** Format any date-like value to `YYYY-MM-DD`. Strips `d_` prefix used in some fields. */
function fmtDate(v) {
    if (!v) return "";
    let s = String(v);
    if (s.startsWith("d_")) s = s.slice(2);
    const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
    if (m) return m[1];
    const d = new Date(s);
    if (isNaN(d.getTime())) return s;
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

/** Today as `YYYY-MM-DD`. */
function today() {
    return new Date().toISOString().slice(0, 10);
}

/** Whole days between `v` and now, or `null` if unparseable. */
function daysSince(v) {
    if (!v) return null;
    let s = String(v);
    if (s.startsWith("d_")) s = s.slice(2);
    const d = new Date(s);
    if (isNaN(d.getTime())) return null;
    return Math.floor((Date.now() - d.getTime()) / 86400000);
}

/** True if `value` is at least `days` days old. */
function isStaleSince(value, days) {
    const d = daysSince(value);
    return d != null && d >= days;
}

// =====================================================================
// Datacore queries
// =====================================================================

/**
 * Build a Datacore query string for "pages tagged X under folder Y".
 * @param {string} tag      tag without leading `#`
 * @param {string} folder   vault folder path
 * @example V.q("project", "Systems/Projects")
 */
function q(tag, folder) {
    return `@page and #${tag} and path("${folder}")`;
}

/** Sort a copy of `items` descending by string field (default `"date"`). */
function sortByDateDesc(items, field = "date") {
    return [...items].sort((a, b) => String(b.value(field) ?? "").localeCompare(String(a.value(field) ?? "")));
}

/**
 * Generic sort.
 * @param {any[]} items
 * @param {(item:any)=>any} fn   key extractor
 * @param {"asc"|"desc"} dir
 */
function sortBy(items, fn, dir = "asc") {
    const s = [...items].sort((a, b) => {
        const av = fn(a), bv = fn(b);
        if (av < bv) return -1;
        if (av > bv) return 1;
        return 0;
    });
    return dir === "desc" ? s.reverse() : s;
}

/**
 * Group items by a frontmatter field. All `statuses` are present in the result, even if empty.
 * @param {any[]} items
 * @param {string[]} statuses   keys to bucket into
 * @param {{field?:string, defaultStatus?:string}} [opts]
 *   `field` defaults to "status". Items with a missing/unknown value go to `defaultStatus` (or `statuses[0]`).
 * @returns {Record<string, any[]>}
 */
function groupByStatus(items, statuses, { field = "status", defaultStatus } = {}) {
    const m = {}; for (const s of statuses) m[s] = [];
    const fb = defaultStatus ?? statuses[0];
    for (const i of items) {
        const s = i.value(field) ?? fb;
        (m[s] ?? m[fb]).push(i);
    }
    return m;
}

/** Like `groupByStatus` but returns `{[status]: count}`. */
function countByStatus(items, statuses, opts) {
    const g = groupByStatus(items, statuses, opts);
    const c = {}; for (const s of statuses) c[s] = g[s].length;
    return c;
}

// =====================================================================
// Note bodies & navigation
// =====================================================================

/**
 * Build a markdown body from a list of `## Heading` strings.
 * @param {string[]} headings
 * @returns {string}
 * @example V.bodyTemplate(["Notes", "Refs", "Outcome"])
 */
function bodyTemplate(headings) {
    return "\n" + headings.map(h => `## ${h}\n`).join("\n");
}

/** Open a note by vault path (no-op if path is falsy). */
function openNote(path) {
    if (path) dc.app.workspace.openLinkText(path, "");
}

// =====================================================================
// Templater bridge
// =====================================================================

/**
 * Run a Templater template into `folderPath`. Requires templater-obsidian plugin.
 * @returns {boolean} true if the template ran.
 */
async function runTemplater(templatePath, folderPath) {
    const tp = dc.app.plugins.plugins["templater-obsidian"]?.templater;
    if (!tp) { notify("Templater plugin not enabled"); return false; }
    const tpl = dc.app.vault.getAbstractFileByPath(templatePath);
    if (!tpl) { notify(`Template not found: ${templatePath}`); return false; }
    const folder = folderPath ? dc.app.vault.getAbstractFileByPath(folderPath) : undefined;
    await tp.create_new_note_from_template(tpl, folder, undefined, true);
    return true;
}

return {
    setField, setFields,
    notify,
    ensureFolder,
    trashFile, confirmTrash,
    safeName, linkBasename,
    fmtDate, today, daysSince, isStaleSince,
    q, sortByDateDesc, sortBy, groupByStatus, countByStatus,
    bodyTemplate, openNote,
    runTemplater,
};
