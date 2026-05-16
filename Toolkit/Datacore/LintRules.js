// Shared lint rules for all dashboards and vault_health.
// One source of truth: change thresholds and field checks here,
// and both the UI panels and the Oraculum vault_health tool stay in sync.
//
// Usage — dashboards:
//   const { lintProject, PROJ_ISSUE_CODES, PROJ_ISSUE_LABELS } =
//       await dc.require("Toolkit/Datacore/LintRules.js");
//
// Usage — vault_health (raw frontmatter):
//   const { lintFm } = await dc.require("Toolkit/Datacore/LintRules.js");
//   const fileIssues = lintFm(fm, file); // returns [{ issue, severity }]
//
// NOT covered here:
//   Infrastructure.md — cross-entity rules (servers ↔ networks ↔ services)
//   are too relational to generalize; they remain inline in Infrastructure.md.

// ─── Thresholds ────────────────────────────────────────────────────────────
// Change these to adjust staleness / quality gates vault-wide.

const MS_PER_DAY              = 86_400_000; // milliseconds in one day
const STUB_AGE_DAYS           = 30;   // Cogito stub → rotting after N days
const MIN_BACKLINKS_EVERGREEN = 3;    // Cogito Evergreen notes need ≥N backlinks
const STALE_BACKLOG_DAYS      = 180;  // Media backlog stale after N days
const MEDIA_ACTIVE_DAYS       = 90;   // Media in Active with no progress after N days
const ISSUE_IN_PROGRESS_DAYS  = 14;   // Fabrica issue stuck In Progress after N days
const RELEASE_IN_PROGRESS_DAYS = 30;  // Release In Progress too long after N days
const JOB_STALE_DAYS          = 21;   // Job application Applied with no update after N days
const INBOX_STALE_DAYS        = 14;   // Inbox item sitting untouched after N days
const PRES_STUCK_DRAFT_DAYS   = 21;   // Presentation stuck in Drafting after N days
const PRES_IDEA_ROT_DAYS      = 60;   // Presentation Idea going stale after N days

// ─── Cogito schemas ─────────────────────────────────────────────────────────
// Domain list + required sections per domain.

const DOMAINS = ["Knowledge", "Process", "Idea", "Reference"];

const DOMAIN_SCHEMAS = {
    Knowledge: ["Summary", "How it works", "Why it matters", "References"],
    Process:   ["When to use", "Steps", "Watch out for", "References"],
    Idea:      ["Pitch", "Why", "Open questions"],
    Reference: ["Overview", "Notes"],
};

const DEFAULT_SCHEMA = ["Summary", "References"];

function schemaFor(domain) { return DOMAIN_SCHEMAS[domain] ?? DEFAULT_SCHEMA; }

// ─── Issue codes & labels ────────────────────────────────────────────────────

const PROJ_ISSUE_CODES  = ["no-category", "empty-goals", "notes-empty"];
const PROJ_ISSUE_LABELS = { "no-category": "no category", "empty-goals": "Goals empty", "notes-empty": "Notes empty" };

const REL_ISSUE_CODES  = ["no-highlights", "no-changes", "breaking-empty"];
const REL_ISSUE_LABELS = {
    "no-highlights":  "no highlights",
    "no-changes":     "no changes",
    "breaking-empty": "breaking empty"
};

const RES_ISSUE_CODES  = ["no-use-cases", "notes-empty"];
const RES_ISSUE_LABELS = { "no-use-cases": "no use cases", "notes-empty": "Notes empty" };

const LEETCODE_ISSUE_CODES  = ["no-approach"];
const LEETCODE_ISSUE_LABELS = { "no-approach": "no approach" };

const PRES_ISSUE_CODES  = ["no-category", "empty-deck", "stuck-draft", "idea-rot"];
const PRES_ISSUE_LABELS = {
    "no-category": "no category",
    "empty-deck":  "empty deck",
    "stuck-draft": "stuck in draft",
    "idea-rot":    "idea rotting",
};

const GROWTH_ISSUE_CODES  = ["incomplete-brag", "incomplete-adr", "incomplete-review", "incomplete-postmortem"];
const GROWTH_ISSUE_LABELS = {
    "incomplete-brag":       "incomplete brag",
    "incomplete-adr":        "incomplete ADR",
    "incomplete-review":     "incomplete review",
    "incomplete-postmortem": "incomplete postmortem",
};

const NOTE_ISSUE_CODES  = ["no-domain", "no-topic", "missing-sections", "orphan", "needs-backlinks", "rotting"];
const NOTE_ISSUE_LABEL  = {
    "no-domain":        "no domain",
    "no-topic":         "no topic",
    "missing-sections": "missing sections",
    "orphan":           "orphan",
    "needs-backlinks":  "needs backlinks",
    "rotting":          "rotting"
};

const MEDIA_ISSUE_CODES = ["no-topic", "no-output", "no-source", "stale-backlog"];
const MEDIA_ISSUE_LABEL = {
    "no-topic":      "no topic",
    "no-output":     "no output",
    "no-source":     "no source",
    "stale-backlog": "stale backlog"
};

// Sections that count as "output" for Done media — BOTH must have content.
// Matches the AI-generated structure: ## Summary + ## Key Takeaways.
// ## Notable Details and ## Related Notes are optional and not linted.
const OUTPUT_SECTIONS = ["summary", "key takeaways"];

// ─── Shared helpers ──────────────────────────────────────────────────────────

/** Extract content of a named ## section from a body string. Returns null if absent. */
function sectionContent(body, name) {
    const esc = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`##\\s+${esc}\\s*\\n([\\s\\S]*?)(?=\\n##\\s|$)`, "i");
    const m = body.match(re);
    return m ? m[1].trim() : null;
}

/** True when a named ## section is missing or empty. */
function sectionIsEmpty(body, name) { return !sectionContent(body, name); }

/**
 * Build a per-section character-count map from a note body.
 * Only `## h2` headings open a new section. `# h1` is treated as the note title and
 * does NOT delimit sections (any preceding/following text before the first h2 is
 * counted only via __total__). `### h3` and deeper accumulate into the current h2.
 *
 * @param {string} text Raw file text (frontmatter included; will be stripped).
 * @returns {{ __total__: number, [section: string]: number }}
 *          `section` keys are lowercased h2 heading names; values are
 *          whitespace-stripped character counts.
 */
function sectionStats(text) {
    const body = String(text || "").replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "");
    const result = { __total__: body.replace(/\s+/g, "").length };
    const lines = body.split(/\r?\n/);
    let current = null;
    let buf = [];
    const flush = () => {
        if (current != null) {
            result[current] = (result[current] || 0) + buf.join("\n").replace(/\s+/g, "").length;
        }
        buf = [];
    };
    for (const line of lines) {
        const h2 = line.match(/^##\s+(.+?)\s*$/);
        if (h2) {
            flush();
            current = h2[1].trim().toLowerCase();
        } else if (current != null) {
            buf.push(line);
        }
    }
    flush();
    return result;
}

/** Parse a date string (including d_YYYY-MM-DD prefix format) into a Date, or null. */
function parseDateStr(v) {
    if (!v) return null;
    const s = String(v).replace(/^d_/, "");
    const t = Date.parse(s);
    return Number.isFinite(t) ? new Date(t) : null;
}

/** Days since a date string (raw frontmatter value). Returns null if unparseable. */
function daysSinceStr(dateStr) {
    const d = parseDateStr(dateStr);
    if (!d) return null;
    return Math.floor((Date.now() - d.getTime()) / MS_PER_DAY);
}

/** Days since a Datacore page's last modification ($mtime). */
function ageDays(page) {
    const ms = page.$mtime?.toMillis?.() ?? 0;
    if (!ms) return 0;
    return Math.floor((Date.now() - ms) / MS_PER_DAY);
}

/** Days since a Datacore note's `created` frontmatter field (falls back to $mtime). */
function createdAgeDays(n) {
    const c = n.value("created");
    if (c) {
        const t = Date.parse(String(c).replace(/^d_/, ""));
        if (Number.isFinite(t)) return Math.floor((Date.now() - t) / 86400000);
    }
    return ageDays(n);
}

/** Count backlinks pointing to a given vault path. */
function backlinkCountFor(path) {
    try {
        const file = dc.app.vault.getAbstractFileByPath(path);
        if (!file) return 0;
        const bl = dc.app.metadataCache.getBacklinksForFile?.(file);
        if (!bl) return 0;
        if (bl.data?.size != null) return bl.data.size;
        return Object.keys(bl.data ?? {}).length;
    } catch (e) { return 0; }
}

/** Lowercase heading set for a given vault path (for schema section checks). */
function headingSetFor(path) {
    try {
        const file = dc.app.vault.getAbstractFileByPath(path);
        const cache = file && dc.app.metadataCache.getFileCache(file);
        const hs = cache?.headings ?? [];
        return new Set(hs.map(h => (h.heading || "").trim().toLowerCase()));
    } catch (e) { return new Set(); }
}

/** Count spawned notes linked in the `notes` frontmatter field of a media item. */
function spawnedCount(m) {
    const v = m.value("notes");
    if (!v) return 0;
    if (Array.isArray(v)) return v.length;
    return 1;
}

/** True when any output section (takeaways, review, quotes) has content. */
function hasOutputContent(stats) {
    if (!stats) return false;
    return OUTPUT_SECTIONS.every(s => (stats[s] || 0) > 0);
}

// ─── Dashboard lint functions ────────────────────────────────────────────────
// Accept Datacore page objects (item.value(field)).

/** Lint a Project page. Returns issue[] for computeLintMap. */
function lintProject(project, body) {
    const issues = [];
    const status = String(project.value("status") ?? "").trim();
    if (!String(project.value("category") ?? "").trim())
        issues.push({ code: "no-category", severity: "warn", message: "no category" });
    if (sectionIsEmpty(body, "Goals"))
        issues.push({ code: "empty-goals", severity: "warn", message: "Goals section empty" });
    // Only flag Notes for active/shipped projects — idea/paused/archived haven't been worked on yet
    if ((status === "Active" || status === "Shipped") && sectionIsEmpty(body, "Notes"))
        issues.push({ code: "notes-empty", severity: "warn", message: "Notes section empty" });
    return issues;
}

/** Lint a Release page. Returns issue[] for computeLintMap. */
function lintRelease(r, body) {
    const issues = [];
    const status  = r.value("status") ?? "Planned";
    const breaking = r.value("breaking") === "Yes";
    if (status !== "Planned") {
        if (!sectionContent(body, "Highlights"))
            issues.push({ code: "no-highlights", severity: "warn", message: "Highlights empty" });
        if (!sectionContent(body, "Added") && !sectionContent(body, "Changed") && !sectionContent(body, "Fixed"))
            issues.push({ code: "no-changes", severity: "warn", message: "Added/Changed/Fixed all empty" });
    }
    if (breaking && !sectionContent(body, "Breaking"))
        issues.push({ code: "breaking-empty", severity: "error", message: "Breaking section empty" });
    return issues;
}

/** Lint a Resource page. Returns issue[] for computeLintMap. */
function lintResource(resource, body) {
    const issues = [];
    const m = body.match(/##\s+Use cases\s*\n([\s\S]*?)(?=\n##\s|$)/i);
    if (!m || !m[1].trim())
        issues.push({ code: "no-use-cases", severity: "warn", message: "Use cases empty" });
    if (sectionIsEmpty(body, "Notes"))
        issues.push({ code: "notes-empty", severity: "warn", message: "Notes section empty" });
    return issues;
}

/** Lint a Leetcode problem page. Returns issue[] for computeLintMap. */
function lintLeetcode(problem, body) {
    const issues = [];
    const status = String(problem.value("status") ?? "To Do");
    if ((status === "Completed" || status === "In Progress") && sectionIsEmpty(body, "My approach"))
        issues.push({ code: "no-approach", severity: "warn", message: "My approach section empty" });
    return issues;
}

/** Lint a Growth brag. Returns issue[] for computeLintMap. */
function lintBrag(item, body) {
    const issues = [];
    if (sectionIsEmpty(body, "What") || sectionIsEmpty(body, "Impact"))
        issues.push({ code: "incomplete-brag", severity: "warn", message: "What or Impact section empty" });
    return issues;
}

/** Lint a Growth ADR. Returns issue[] for computeLintMap. */
function lintAdr(item, body) {
    const issues = [];
    if (sectionIsEmpty(body, "Context") || sectionIsEmpty(body, "Decision"))
        issues.push({ code: "incomplete-adr", severity: "warn", message: "Context or Decision section empty" });
    return issues;
}

/** Lint a Growth review. Returns issue[] for computeLintMap. */
function lintReview(item, body) {
    const issues = [];
    if (sectionIsEmpty(body, "Went well"))
        issues.push({ code: "incomplete-review", severity: "warn", message: "Went well section empty" });
    return issues;
}

/** Lint a Growth postmortem. Returns issue[] for computeLintMap. */
function lintPostmortem(item, body) {
    const issues = [];
    if (sectionIsEmpty(body, "Summary") || sectionIsEmpty(body, "Root cause"))
        issues.push({ code: "incomplete-postmortem", severity: "warn", message: "Summary or Root cause section empty" });
    return issues;
}

// ─── Presentations lint ──────────────────────────────────────────────────────

/** Lint a Fabrica presentation note. Needs the full file body text (incl. frontmatter). */
function lintPresentation(item, body) {
    const issues = [];
    const status = String(item.value("status") ?? "Idea").trim();

    if (!String(item.value("category") ?? "").trim())
        issues.push({ code: "no-category", severity: "warn", message: "no category" });

    // Detect empty deck: strip the YAML frontmatter block, then check for slide separators.
    // Any real Advanced Slides deck has at least one `\n---\n` after the frontmatter.
    if (status !== "Idea") {
        const bodyOnly = body.replace(/^---[\s\S]*?---\n/, "");
        const separators = (bodyOnly.match(/\n---\n/g) ?? []).length;
        if (separators < 1 && bodyOnly.trim().length < 100)
            issues.push({ code: "empty-deck", severity: "warn", message: "no slide content" });
    }

    const age = createdAgeDays(item);
    if (status === "Drafting" && age >= PRES_STUCK_DRAFT_DAYS)
        issues.push({ code: "stuck-draft", severity: "warn", message: `drafting ${age}d` });
    if (status === "Idea" && age >= PRES_IDEA_ROT_DAYS)
        issues.push({ code: "idea-rot", severity: "warn", message: `idea ${age}d old` });

    return issues;
}

// ─── Index quality estimate ──────────────────────────────────────────────────
// Used to rate how embedding-rich a note is based on stripped content length.

const INDEX_QUALITY_SPARSE_CHARS = 500;
const INDEX_QUALITY_THIN_CHARS   = 2000;

/**
 * Estimate embedding richness from body text.
 * Returns { quality: "sparse"|"thin"|"good", chars }.
 * "chars" is the stripped meaningful character count (headings, markdown stripped).
 */
function lintIndexQuality(body) {
    if (!body) return { quality: "sparse", chars: 0 };
    const stripped = body
        .replace(/^#+\s.*$/gm, "")               // headings
        .replace(/^>\s.*$/gm, "")                // blockquotes
        .replace(/!\[.*?\]\(.*?\)/g, "")         // images
        .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1") // links → link text
        .replace(/[*_`~]+/g, "")                 // emphasis/code markers
        .replace(/^\s*[-*+]\s+/gm, "")           // list bullets
        .replace(/^\s*\d+\.\s+/gm, "")           // ordered lists
        .replace(/\s+/g, " ")                    // collapse whitespace
        .trim();
    const chars = stripped.length;
    const quality = chars < INDEX_QUALITY_SPARSE_CHARS ? "sparse"
                  : chars < INDEX_QUALITY_THIN_CHARS   ? "thin"
                  :                                      "good";
    return { quality, chars };
}

// ─── Cogito lint functions ───────────────────────────────────────────────────
// These need dc.app (backlinks, headings) and body stats computed by the caller.

/**
 * Lint a Cogito note page.
 * @param {object} n          Datacore page object
 * @param {Map}    bodyStats  path → { sectionName: charCount, __total__: charCount }
 * @returns {{ status, domain, topic, missing, isEmpty, bodyEmpty, backlinks, age, rotting, issues: string[], codes: Set }}
 */
function lintNote(n, bodyStats) {
    const status   = n.value("status") ?? "Stub";
    const domain   = n.value("domain") ?? "";
    const topic    = n.value("topic") ?? "";
    const required = schemaFor(domain);
    const stats    = bodyStats?.get(n.$path) ?? null;
    const headings = headingSetFor(n.$path);
    const missing  = required.filter(s => {
        const key = s.toLowerCase();
        if (!headings.has(key)) return true;
        if (stats && (stats[key] || 0) === 0) return true;
        return false;
    });
    const bodyEmpty = stats != null && (stats.__total__ || 0) === 0;
    const isEmpty   = false; // handled by missing-sections lint on required schema headings
    const backlinks = backlinkCountFor(n.$path);
    const age       = createdAgeDays(n);
    const rotting   = status === "Stub" && age >= STUB_AGE_DAYS;

    const issues = [];
    const codes  = new Set();
    if (!domain)                                                           { issues.push("no domain");                          codes.add("no-domain"); }
    if (!topic)                                                            { issues.push("no topic");                           codes.add("no-topic"); }
    if (missing.length > 0)                                                { issues.push(`missing: ${missing.join(", ")}`);     codes.add("missing-sections"); }
    if (isEmpty)                                                           { issues.push("empty");                              codes.add("missing-sections"); }
    if (backlinks === 0)                                                   { issues.push("orphan");                             codes.add("orphan"); }
    if (status === "Evergreen" && backlinks < MIN_BACKLINKS_EVERGREEN)    { issues.push(`needs ≥${MIN_BACKLINKS_EVERGREEN} backlinks`); codes.add("needs-backlinks"); }
    if (rotting)                                                           { issues.push(`stub ${age}d`);                       codes.add("rotting"); }

    return { status, domain, topic, missing, isEmpty, bodyEmpty, backlinks, age, rotting, issues, codes };
}

/**
 * Lint a Cogito media page.
 * @param {object} m          Datacore page object
 * @param {Map}    bodyStats  path → sectionStats map
 * @returns {{ status, source, spawned, hasOutput, issues: string[], codes: Set }}
 */
function lintMedia(m, bodyStats) {
    const status    = m.value("status") ?? "Backlog";
    const source    = m.value("source");
    const topic     = m.value("topic");
    const spawned   = spawnedCount(m);
    const stats     = bodyStats?.get(m.$path);
    const hasOutput = hasOutputContent(stats);
    const noteAge   = ageDays(m);

    const issues = [];
    const codes  = new Set();
    if (!topic || String(topic).trim() === "")                    { issues.push("no topic");                         codes.add("no-topic"); }
    if (status === "Done" && spawned === 0 && !hasOutput)         { issues.push("no output");                        codes.add("no-output"); }
    if (status !== "Dropped" && !source)                          { issues.push("no source");                        codes.add("no-source"); }
    if (status === "Backlog" && noteAge >= STALE_BACKLOG_DAYS)    { issues.push(`stale backlog ${noteAge}d`);        codes.add("stale-backlog"); }

    return { status, source, spawned, hasOutput, issues, codes };
}

// ─── vault_health lint (raw frontmatter) ─────────────────────────────────────
// Accepts a plain frontmatter object (no .value() calls).
// Returns [{ issue: string, severity: "high"|"medium"|"low" }].
// Body content is not read here for performance; domain-aware but lighter than dashboard lint.

function lintFm(fm) {
    const result = [];
    const push   = (issue, severity) => result.push({ issue, severity });
    const tags   = Array.isArray(fm.tags) ? fm.tags : [fm.tags ?? ""];
    const hasTag = (...frags) => frags.some(f => tags.some(t => String(t).includes(f)));

    if (hasTag("system/issues/issue")) {
        if (!fm.project)  push("No project assigned", "high");
        if (!fm.priority) push("No priority set", "low");
        const age = daysSinceStr(fm.created);
        if (fm.status === "In Progress" && age !== null && age > ISSUE_IN_PROGRESS_DAYS)
            push(`In Progress for ${age} days`, "medium");
        return result;
    }

    if (hasTag("system/releases/release")) {
        if (!fm.version) push("Missing version field", "high");
        const age = daysSinceStr(fm.created);
        if (fm.status === "In Progress" && age !== null && age > RELEASE_IN_PROGRESS_DAYS)
            push(`Release In Progress for ${age} days`, "low");
        return result;
    }

    if (hasTag("system/cogito/media")) {
        if (!fm.topic)  push("Missing topic", "medium");
        if (!fm.source) push("Missing source", "low");
        const age = daysSinceStr(fm.created);
        if (fm.status === "Backlog" && age !== null && age > STALE_BACKLOG_DAYS)
            push(`Backlog for ${age} days — stale`, "low");
        if (fm.status === "Active" && age !== null && age > MEDIA_ACTIVE_DAYS)
            push(`Active for ${age} days — still consuming?`, "low");
        return result;
    }

    if (hasTag("system/cogito/note")) {
        if (!fm.domain) push("Missing domain", "medium");
        if (!fm.topic)  push("Missing topic", "low");
        const age = daysSinceStr(fm.created);
        if (fm.status === "Stub" && age !== null && age > STUB_AGE_DAYS)
            push(`Stub note ${age} days old — flesh out or delete`, "medium");
        return result;
    }

    if (hasTag("system/resources/resource")) {
        if (!fm.url)      push("Missing URL", "medium");
        if (!fm.category) push("Missing category", "low");
        return result;
    }

    if (hasTag("system/jobs/application")) {
        if (fm.status === "Applied") {
            const staleDays = daysSinceStr(fm.applied);
            if (staleDays !== null && staleDays > JOB_STALE_DAYS)
                push(`Application stale for ${staleDays} days with no update`, "medium");
        }
        return result;
    }

    if (hasTag("system/leetcode/problem")) return result; // skip — managed by Leetcode dashboard

    if (hasTag("system/presentations/presentation")) {
        if (!fm.category) push("No category set", "medium");
        const age = daysSinceStr(fm.created);
        if (fm.status === "Drafting" && age !== null && age > PRES_STUCK_DRAFT_DAYS)
            push(`Drafting for ${age} days`, "low");
        if (fm.status === "Idea" && age !== null && age > PRES_IDEA_ROT_DAYS)
            push(`Idea stale for ${age} days`, "low");
        return result;
    }

    if (hasTag("system/growth", "system/habits/habit")) return result; // skip — structurally managed

    // Generic (unrecognised note type)
    if (!fm.created) push("Missing 'created' date", "low");
    return result;
}

// ─── Exports ─────────────────────────────────────────────────────────────────

return {
    // Thresholds
    STUB_AGE_DAYS, MIN_BACKLINKS_EVERGREEN, STALE_BACKLOG_DAYS,
    MEDIA_ACTIVE_DAYS, ISSUE_IN_PROGRESS_DAYS, RELEASE_IN_PROGRESS_DAYS, JOB_STALE_DAYS,
    INBOX_STALE_DAYS, PRES_STUCK_DRAFT_DAYS, PRES_IDEA_ROT_DAYS,

    // Cogito schemas
    DOMAINS, DOMAIN_SCHEMAS, DEFAULT_SCHEMA, schemaFor,

    // Issue codes & labels
    PROJ_ISSUE_CODES, PROJ_ISSUE_LABELS,
    REL_ISSUE_CODES, REL_ISSUE_LABELS,
    RES_ISSUE_CODES, RES_ISSUE_LABELS,
    LEETCODE_ISSUE_CODES, LEETCODE_ISSUE_LABELS,
    GROWTH_ISSUE_CODES, GROWTH_ISSUE_LABELS,
    NOTE_ISSUE_CODES, NOTE_ISSUE_LABEL,
    MEDIA_ISSUE_CODES, MEDIA_ISSUE_LABEL, OUTPUT_SECTIONS,
    PRES_ISSUE_CODES, PRES_ISSUE_LABELS,

    // Helpers (exported for callers that need them directly)
    sectionContent, sectionIsEmpty, sectionStats, daysSinceStr, parseDateStr,
    ageDays, createdAgeDays, backlinkCountFor, headingSetFor,
    spawnedCount, hasOutputContent,

    // Dashboard lint functions
    lintProject, lintRelease, lintResource,
    lintLeetcode,
    lintBrag, lintAdr, lintReview, lintPostmortem,
    lintPresentation,

    // Index quality
    INDEX_QUALITY_SPARSE_CHARS, INDEX_QUALITY_THIN_CHARS, lintIndexQuality,

    // Cogito lint functions (backlink + body-stats aware)
    lintNote, lintMedia,

    // vault_health lint (raw frontmatter, no body read)
    lintFm,
};
