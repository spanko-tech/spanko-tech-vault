// Systems/Oraculum/Modules/Skills.js
// Composable, editable system-prompt fragments stored as .md files in Systems/Oraculum/Skills/.
// The user can toggle individual skills on/off and reorder them by `priority`
// (lower number = appears earlier in the assembled prompt = stronger emphasis).
//
// Each skill file looks like:
//
//   ---
//   title: Read / Research Mode
//   priority: 20
//   enabled: true
//   locked: false              # if true, cannot be disabled (only re-prioritized)
//   description: Multi-step exploration before answering research questions.
//   ---
//   <markdown body that becomes part of the SYSTEM prompt>
//
// Frontmatter is stripped before composition. The body is inserted verbatim,
// separated by blank lines. The user-edited values are persisted by writing
// back to the .md file via Obsidian's metadata API — see updateSkillMeta().
//
// Loaded with: const Sk = await dc.require("Systems/Oraculum/Modules/Skills.js");

const SKILLS_FOLDER = "Systems/Oraculum/Skills";

// Skills that ship with Oraculum and should never be permanently deleted.
// (The user can disable non-locked ones; locked ones must always run.)
const DEFAULT_LOCKED = new Set(["00 Identity.md", "10 Always Enforced.md"]);

let _cache = null;
let _cacheAt = 0;
const CACHE_MS = 5_000; // brief cache so render passes don't re-read on every keystroke

function _parseFrontmatter(raw) {
    const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
    if (!m) return { meta: {}, body: raw };
    const meta = {};
    for (const line of m[1].split(/\r?\n/)) {
        const mm = line.match(/^([A-Za-z_][\w-]*)\s*:\s*(.*)$/);
        if (!mm) continue;
        let v = mm[2].trim();
        if (v === "true") v = true;
        else if (v === "false") v = false;
        else if (v !== "" && !isNaN(Number(v))) v = Number(v);
        else if (/^["'].*["']$/.test(v)) v = v.slice(1, -1);
        meta[mm[1]] = v;
    }
    return { meta, body: m[2] };
}

function _serializeFrontmatter(meta) {
    const order = ["title", "description", "priority", "enabled", "locked"];
    const keys = order.filter(k => k in meta).concat(Object.keys(meta).filter(k => !order.includes(k)));
    const lines = keys.map(k => {
        const v = meta[k];
        if (typeof v === "boolean") return `${k}: ${v}`;
        if (typeof v === "number") return `${k}: ${v}`;
        return `${k}: ${String(v)}`;
    });
    return `---\n${lines.join("\n")}\n---\n`;
}

async function _readAll() {
    if (_cache && Date.now() - _cacheAt < CACHE_MS) return _cache;
    const folder = dc.app.vault.getAbstractFileByPath(SKILLS_FOLDER);
    if (!folder || !folder.children) {
        _cache = [];
        _cacheAt = Date.now();
        return _cache;
    }
    const files = folder.children.filter(f => f.extension === "md");
    const skills = [];
    for (const f of files) {
        try {
            const raw = await dc.app.vault.read(f);
            const { meta, body } = _parseFrontmatter(raw);
            const lockedFromName = DEFAULT_LOCKED.has(f.name);
            skills.push({
                name: f.name,
                path: f.path,
                title: meta.title || f.basename.replace(/^\d+\s+/, ""),
                description: meta.description || "",
                priority: typeof meta.priority === "number" ? meta.priority : 100,
                enabled: meta.enabled !== false, // default true
                locked: lockedFromName || meta.locked === true,
                body: body.trim(),
            });
        } catch (e) {
            console.warn("Failed to read skill", f.path, e);
        }
    }
    skills.sort((a, b) => a.priority - b.priority || a.name.localeCompare(b.name));
    _cache = skills;
    _cacheAt = Date.now();
    return _cache;
}

function _invalidate() { _cache = null; }

async function listSkills() {
    return await _readAll();
}

/**
 * Build the assembled SYSTEM prompt from all enabled skills, sorted by priority.
 * `vars` is a map of substitution tokens (e.g. {today, vaultName}) inserted via {{var}}.
 */
async function assemble(vars = {}) {
    const skills = await _readAll();
    const enabled = skills.filter(s => s.enabled || s.locked);
    const replace = (text) => text.replace(/\{\{(\w+)\}\}/g, (_, k) => (vars[k] != null ? String(vars[k]) : `{{${k}}}`));
    return enabled.map(s => replace(s.body)).join("\n\n");
}

/**
 * Patch a skill's frontmatter (e.g., toggle enabled, change priority).
 * Body is preserved exactly. Locked skills cannot be disabled.
 */
async function updateSkillMeta(name, patch) {
    const file = dc.app.vault.getAbstractFileByPath(`${SKILLS_FOLDER}/${name}`);
    if (!file) throw new Error(`Skill not found: ${name}`);
    const raw = await dc.app.vault.read(file);
    const { meta, body } = _parseFrontmatter(raw);
    const merged = { ...meta, ...patch };
    if (DEFAULT_LOCKED.has(name)) merged.locked = true;
    if (merged.locked && patch.enabled === false) merged.enabled = true; // safety
    const out = _serializeFrontmatter(merged) + body;
    await dc.app.vault.modify(file, out);
    _invalidate();
}

/** Open the skill .md file in Obsidian for full editing. */
function openSkill(name) {
    const path = `${SKILLS_FOLDER}/${name}`;
    const file = dc.app.vault.getAbstractFileByPath(path);
    if (!file) return false;
    dc.app.workspace.getLeaf(false).openFile(file);
    return true;
}

/**
 * Create a new skill file in Systems/Oraculum/Skills/ with the given metadata.
 * The filename is auto-generated from the priority + title.
 */
async function createSkill({ title, description = "", priority = 50, enabled = true, body = "" }) {
    if (!title?.trim()) throw new Error("title is required");
    const pad  = String(Math.round(priority)).padStart(2, "0");
    const slug = title.trim().replace(/[<>:"/\\|?*#\[\]^]/g, "").replace(/\s+/g, " ").trim();
    const fileName = `${pad} ${slug}.md`;
    const path = `${SKILLS_FOLDER}/${fileName}`;
    if (dc.app.vault.getAbstractFileByPath(path)) throw new Error(`File already exists: ${path}`);
    const fm = _serializeFrontmatter({ title: title.trim(), description, priority: Number(priority), enabled, locked: false });
    await dc.app.vault.create(path, fm + "\n" + (body || ""));
    _invalidate();
    return { path, fileName };
}

return { listSkills, assemble, updateSkillMeta, openSkill, createSkill, SKILLS_FOLDER };
