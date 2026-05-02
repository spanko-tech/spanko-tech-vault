---
aliases: []
tags:
  - cogito/system
  - cogito/index
  - datacore/dashboard
---

# Cogito

*Knowledge management system for notes, media consumption, and learning.*

- **Notes** → `Systems/Cogito/Notes/`, tag `#cogito/note` — promote Stub → Draft → Solid → Reference
- **Inbox** → `Systems/Cogito/Inbox/`, tag `#cogito/inbox` — capture without guilt; weekly skim
- **Drawings** → `Systems/Cogito/Drawings/` — Excalidraw lives here
- **MOCs** → `Systems/Cogito/MOCs/`, tag `#cogito/moc` — maps of content (curated topic indexes)
- **Media** → `Systems/Cogito/Media/`, tag `#cogito/media` — consumption + reviews; spawns Knowledge notes

| Domain | Voice | Schema |
|---|---|---|
| **Knowledge** | Descriptive — what X is, how it works | Summary · Why it matters · Example · References |
| **Engineering** | Decisive — what I decided for X I'm building | Context · Approach · Consequences · References |
| **Process** | Imperative — repeatable steps | When to use · Steps · Watch out for · References |
| **Idea** | Speculative — wouldn't it be cool if… | Pitch · Why · Open questions |
| **Basic** | Free-form — game notes, scratch thoughts, anything that doesn't need a schema | Notes |

```datacorejsx
const V = await dc.require("Toolkit/Datacore/Vault.js");
const { NewForm, SearchableSelect, useSortBy, SortBar } = await dc.require("Toolkit/Datacore/UI.jsx");
const { setField, fmtDate, daysSince } = V;

// ───────────────────────────────────────────────────────────────────
// Notes / promotion
// ───────────────────────────────────────────────────────────────────
const STATUSES = ["Stub", "Draft", "Solid", "Reference"];
const STATUS_COLOR = { Stub: "var(--color-orange)", Draft: "var(--color-yellow)", Solid: "var(--color-blue)", Reference: "var(--color-green)" };
const STUB_AGE_DAYS = 30;
const MIN_BACKLINKS_REFERENCE = 3;

const DOMAINS = ["Knowledge", "Engineering", "Process", "Idea", "Basic"];
const DOMAIN_COLOR = {
    Knowledge:   "var(--color-blue)",
    Engineering: "var(--color-purple)",
    Process:     "var(--color-cyan)",
    Idea:        "var(--color-orange)",
    Basic:       "var(--text-muted)"
};
const DOMAIN_DESC = {
    Knowledge:   "Descriptive — how X works / what X is. True regardless of context.",
    Engineering: "Decisive — what I decided for a thing I'm building, and why.",
    Process:     "Imperative — repeatable steps I take when X happens.",
    Idea:        "Speculative — wouldn't it be cool if…",
    Basic:       "Free-form — game notes, scratch thoughts, anything that doesn't need a schema."
};
const DOMAIN_SCHEMAS = {
    Knowledge:   ["Summary", "Why it matters", "Example", "References"],
    Engineering: ["Context", "Approach", "Consequences", "References"],
    Process:     ["When to use", "Steps", "Watch out for", "References"],
    Idea:        ["Pitch", "Why", "Open questions"],
    Basic:       ["Notes"]
};
const DEFAULT_SCHEMA = ["Summary", "References"];

const NOTE_ISSUE_CODES = ["no-domain", "no-topic", "missing-sections", "orphan", "needs-backlinks", "rotting"];
const NOTE_ISSUE_LABEL = {
    "no-domain":        "no domain",
    "no-topic":         "no topic",
    "missing-sections": "missing sections",
    "orphan":           "orphan",
    "needs-backlinks":  "needs backlinks",
    "rotting":          "rotting"
};
const NOTE_ISSUE_EMOJI = {
    "no-domain":        "🏷",
    "no-topic":         "🧭",
    "missing-sections": "📑",
    "orphan":           "🔗",
    "needs-backlinks":  "🔗",
    "rotting":          "🍂"
};

// ───────────────────────────────────────────────────────────────────
// Media
// ───────────────────────────────────────────────────────────────────
const MEDIA_TYPES = ["Book", "Article", "Video", "Podcast", "Talk", "Game", "Paper", "Course"];
const MEDIA_TYPE_COLOR = {
    Book:    "var(--color-purple)",
    Article: "var(--color-blue)",
    Video:   "var(--color-red)",
    Podcast: "var(--color-orange)",
    Talk:    "var(--color-yellow)",
    Game:    "var(--color-cyan)",
    Paper:   "var(--color-pink)",
    Course:  "var(--color-green)"
};
const MEDIA_STATUSES = ["Backlog", "Active", "Done", "Dropped"];
const MEDIA_STATUS_COLOR = {
    Backlog: "var(--background-modifier-border)",
    Active:  "var(--color-blue)",
    Done:    "var(--color-green)",
    Dropped: "var(--text-muted)"
};
const STALE_BACKLOG_DAYS = 180;

const MEDIA_ISSUE_CODES = ["no-topic", "no-output", "no-source", "stale-backlog"];
const MEDIA_ISSUE_LABEL = {
    "no-topic":      "no topic",
    "no-output":     "no output",
    "no-source":     "no source",
    "stale-backlog": "stale backlog"
};
const MEDIA_ISSUE_EMOJI = {
    "no-topic":      "🏷️",
    "no-output":     "📭",
    "no-source":     "🔗",
    "stale-backlog": "🍂"
};
const OUTPUT_SECTIONS = ["takeaways", "review", "quotes"];

// ───────────────────────────────────────────────────────────────────
// Shared helpers
// ───────────────────────────────────────────────────────────────────
function schemaFor(domain) { return DOMAIN_SCHEMAS[domain] ?? DEFAULT_SCHEMA; }
function templateBodyFor(domain) {
    return "\n" + schemaFor(domain).map(s => `## ${s}\n\n`).join("");
}

function ageDays(page) {
    const ms = page.$mtime?.toMillis?.() ?? 0;
    if (!ms) return 0;
    return Math.floor((Date.now() - ms) / 86400000);
}

function parseDPrefixed(v) {
    if (!v) return null;
    const s = String(v).replace(/^d_/, "");
    const t = Date.parse(s);
    return Number.isFinite(t) ? new Date(t) : null;
}



function createdAgeDays(n) {
    const c = n.value("created");
    if (c) {
        const t = Date.parse(String(c).replace(/^d_/, ""));
        if (Number.isFinite(t)) return Math.floor((Date.now() - t) / 86400000);
    }
    return ageDays(n);
}

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

function headingSetFor(path) {
    try {
        const file = dc.app.vault.getAbstractFileByPath(path);
        const cache = file && dc.app.metadataCache.getFileCache(file);
        const hs = cache?.headings ?? [];
        return new Set(hs.map(h => (h.heading || "").trim().toLowerCase()));
    } catch (e) { return new Set(); }
}

function sectionStats(text) {
    const body = text.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "");
    const result = { __total__: body.replace(/\s+/g, "").length };
    const lines = body.split(/\r?\n/);
    let current = null;
    let buf = [];
    const flush = () => {
        if (current != null) result[current] = (result[current] || 0) + buf.join("\n").replace(/\s+/g, "").length;
        buf = [];
    };
    for (const line of lines) {
        const h = line.match(/^#{1,6}\s+(.+?)\s*$/);
        if (h) { flush(); current = h[1].trim().toLowerCase(); }
        else if (current != null) { buf.push(line); }
    }
    flush();
    return result;
}

function spawnedCount(m) {
    const v = m.value("notes");
    if (!v) return 0;
    if (Array.isArray(v)) return v.length;
    return 1;
}

function hasOutputContent(stats) {
    if (!stats) return false;
    return OUTPUT_SECTIONS.some(s => (stats[s] || 0) > 0);
}

// setField imported from Vault.md

// ───────────────────────────────────────────────────────────────────
// Lint
// ───────────────────────────────────────────────────────────────────
function lintNote(n, bodyStats) {
    const status   = n.value("status") ?? "Stub";
    const domain   = n.value("domain") ?? "";
    const topic    = n.value("topic") ?? "";
    const required = domain === "Basic" ? [] : schemaFor(domain);
    const stats    = bodyStats?.get(n.$path) ?? null;
    const headings = headingSetFor(n.$path);
    const missing = required.filter(s => {
        const key = s.toLowerCase();
        if (!headings.has(key)) return true;
        if (stats && (stats[key] || 0) === 0) return true;
        return false;
    });
    const bodyEmpty = stats != null && (stats.__total__ || 0) === 0;
    const isEmpty = domain === "Basic" && bodyEmpty;
    const backlinks = backlinkCountFor(n.$path);
    const age = createdAgeDays(n);
    const rotting = status === "Stub" && age >= STUB_AGE_DAYS;

    const issues = [];
    const codes = new Set();
    if (!domain)                                                     { issues.push("no domain");          codes.add("no-domain"); }
    if (!topic)                                                      { issues.push("no topic");           codes.add("no-topic"); }
    if (missing.length > 0)                                          { issues.push(`missing: ${missing.join(", ")}`); codes.add("missing-sections"); }
    if (isEmpty)                                                     { issues.push("empty");              codes.add("missing-sections"); }
    if (backlinks === 0)                                             { issues.push("orphan");             codes.add("orphan"); }
    if (status === "Reference" && backlinks < MIN_BACKLINKS_REFERENCE) { issues.push(`needs ≥${MIN_BACKLINKS_REFERENCE} backlinks`); codes.add("needs-backlinks"); }
    if (rotting)                                                     { issues.push(`stub ${age}d`);       codes.add("rotting"); }

    return { status, domain, topic, missing, isEmpty, bodyEmpty, backlinks, age, rotting, issues, codes };
}

function lintMedia(m, bodyStats) {
    const status   = m.value("status") ?? "Backlog";
    const source   = m.value("source");
    const topic    = m.value("topic");
    const spawned  = spawnedCount(m);
    const stats    = bodyStats?.get(m.$path);
    const hasOutput = hasOutputContent(stats);

    const issues = [];
    const codes = new Set();
    const noteAge    = ageDays(m);

    if (!topic || String(topic).trim() === "") {
        issues.push("no topic"); codes.add("no-topic");
    }
    if (status === "Done" && spawned === 0 && !hasOutput) {
        issues.push("no output"); codes.add("no-output");
    }
    if (status !== "Dropped" && !source) {
        issues.push("no source"); codes.add("no-source");
    }
    if (status === "Backlog" && noteAge >= STALE_BACKLOG_DAYS) {
        issues.push(`stale backlog ${noteAge}d`); codes.add("stale-backlog");
    }

    return { status, source, spawned, hasOutput, issues, codes };
}

function nextStatus(status) {
    return { Stub: "Draft", Draft: "Solid", Solid: "Reference", Reference: null }[status] ?? null;
}

function canPromote(lint) {
    const next = nextStatus(lint.status);
    if (!next) return { next: null, blocked: true, reason: "Top maturity" };
    if (next === "Draft"     && lint.bodyEmpty) return { next, blocked: true, reason: "Add some content first" };
    if (next === "Solid"     && (lint.bodyEmpty || lint.backlinks < 1 || lint.missing.length > 0 || lint.isEmpty)) return { next, blocked: true, reason: "Needs content, ≥1 backlink, all sections filled" };
    if (next === "Reference" && (lint.backlinks < MIN_BACKLINKS_REFERENCE || lint.missing.length > 0 || lint.isEmpty)) return { next, blocked: true, reason: `Needs ≥${MIN_BACKLINKS_REFERENCE} backlinks + content` };
    return { next, blocked: false, reason: "" };
}

// ───────────────────────────────────────────────────────────────────
// UI components
// ───────────────────────────────────────────────────────────────────
// NewForm imported from UI.md

function StatusPill({ status }) {
    return <span style={{ padding: "1px 8px", borderRadius: "10px", background: STATUS_COLOR[status] ?? "var(--background-modifier-border)", color: "white", fontSize: "0.75em" }}>{status}</span>;
}

function DomainPill({ domain }) {
    if (!domain) return <span style={{ opacity: 0.5 }}>—</span>;
    return <span style={{ padding: "1px 8px", borderRadius: "10px", background: DOMAIN_COLOR[domain] ?? "var(--background-modifier-border)", color: "white", fontSize: "0.75em" }}>{domain}</span>;
}

function TypePill({ type }) {
    if (!type) return <span style={{ opacity: 0.5 }}>—</span>;
    return <span style={{ padding: "1px 8px", borderRadius: "10px", background: MEDIA_TYPE_COLOR[type] ?? "var(--background-modifier-border)", color: "white", fontSize: "0.75em" }}>{type}</span>;
}

function MediaStatusPill({ status }) {
    return <span style={{ padding: "1px 8px", borderRadius: "10px", background: MEDIA_STATUS_COLOR[status] ?? "var(--background-modifier-border)", color: "white", fontSize: "0.75em" }}>{status}</span>;
}

function TopicCell({ note, topic, topics }) {
    const [val, setVal] = dc.useState(topic ?? "");
    const lastSyncedRef = dc.useRef(topic ?? "");
    const listId = dc.useMemo(() => `topics-${Math.random().toString(36).slice(2, 9)}`, []);
    dc.useEffect(() => {
        if ((topic ?? "") !== lastSyncedRef.current) {
            setVal(topic ?? "");
            lastSyncedRef.current = topic ?? "";
        }
    }, [topic]);
    const commit = async () => {
        if (val === (topic ?? "")) return;
        lastSyncedRef.current = val;
        await setField(note, "topic", val || null);
    };
    return (
        <span>
            <input type="text" value={val} list={listId}
                onInput={e => setVal(e.currentTarget.value)}
                onBlur={commit}
                onKeyDown={e => { if (e.key === "Enter") e.currentTarget.blur(); }}
                placeholder="topic…"
                style={{ width: "140px", fontSize: "0.85em" }} />
            <datalist id={listId}>
                {(topics ?? []).map(t => <option key={t} value={t} />)}
            </datalist>
        </span>
    );
}

function DomainCell({ note, domain }) {
    const [editing, setEditing] = dc.useState(false);
    if (editing || !domain) {
        return (
            <dc.VanillaSelect
                value={domain || ""}
                options={[{ value: "", label: "—" }, ...DOMAINS.map(d => ({ value: d, label: d }))]}
                onValueChange={async v => {
                    await setField(note, "domain", v || null);
                    setEditing(false);
                }}
            />
        );
    }
    return (
        <span onClick={() => setEditing(true)} style={{ cursor: "pointer" }} title="Click to change domain">
            <DomainPill domain={domain} />
        </span>
    );
}

function StatusCell({ note, status }) {
    return (
        <dc.VanillaSelect
            value={status || "Stub"}
            options={STATUSES.map(s => ({ value: s, label: s }))}
            onValueChange={async v => { await setField(note, "status", v); }}
        />
    );
}

function MediaStatusCell({ media, status }) {
    return (
        <dc.VanillaSelect
            value={status || "Backlog"}
            options={MEDIA_STATUSES.map(s => ({ value: s, label: s }))}
            onValueChange={async v => {
                await setField(media, "status", v);
            }}
        />
    );
}

function SourceCell({ media, source }) {
    const [val, setVal] = dc.useState(source ?? "");
    const lastSyncedRef = dc.useRef(source ?? "");
    dc.useEffect(() => {
        if ((source ?? "") !== lastSyncedRef.current) {
            setVal(source ?? "");
            lastSyncedRef.current = source ?? "";
        }
    }, [source]);
    const commit = async () => {
        if (val === (source ?? "")) return;
        lastSyncedRef.current = val;
        await setField(media, "source", val || null);
    };
    return (
        <input type="text" value={val}
            onInput={e => setVal(e.currentTarget.value)}
            onBlur={commit}
            onKeyDown={e => { if (e.key === "Enter") e.currentTarget.blur(); }}
            placeholder="https://…"
            style={{ width: "180px", fontSize: "0.85em" }} />
    );
}

function IssueChips({ codes, labels, emojis, onPick }) {
    if (!codes || codes.size === 0) return <span style={{ color: "var(--color-green)" }}>✓</span>;
    return (
        <span style={{ display: "inline-flex", gap: "4px", flexWrap: "wrap" }}>
            {Array.from(codes).map(c => (
                <span key={c} onClick={onPick ? () => onPick(c) : undefined}
                    title={labels[c]}
                    style={{ cursor: onPick ? "pointer" : "default", padding: "1px 6px", borderRadius: "8px", background: "var(--background-modifier-border)", fontSize: "0.72em" }}>
                    {emojis[c]} {labels[c]}
                </span>
            ))}
        </span>
    );
}

function NewDrawingButton({ topics }) {
    const [topic, setTopic] = dc.useState("");
    const listId = dc.useMemo(() => `dr-topics-${Math.random().toString(36).slice(2, 7)}`, []);
    const TEMPLATE_PATH = "Toolkit/Templates/Excalidraw Template.md";
    const FOLDER = "Systems/Cogito/Drawings";
    const create = async () => {
        const tmpl = dc.app.vault.getAbstractFileByPath(TEMPLATE_PATH);
        if (!tmpl) { new window.Notice(`Template not found: ${TEMPLATE_PATH}`); return; }
        const content = await dc.app.vault.read(tmpl);
        const now = new Date();
        const pad = (n) => String(n).padStart(2, "0");
        const stamp = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())} ${pad(now.getHours())}.${pad(now.getMinutes())}.${pad(now.getSeconds())}`;
        const path = `${FOLDER}/Drawing ${stamp}.excalidraw.md`;
        if (!dc.app.vault.getAbstractFileByPath(FOLDER)) {
            try { await dc.app.vault.createFolder(FOLDER); } catch (_) {}
        }
        try {
            const file = await dc.app.vault.create(path, content);
            await dc.app.fileManager.processFrontMatter(file, fm => {
                fm.created = new Date().toISOString().slice(0,10);
                if (topic) fm.topic = topic;
            });
            new window.Notice(`Created drawing`);
            setTopic("");
            await dc.app.workspace.openLinkText(path, "");
        } catch (e) { new window.Notice(`Failed: ${e.message}`); }
    };
    return (
        <div style={{ display: "flex", gap: "8px", alignItems: "center", marginBottom: "8px" }}>
            <button className="mod-cta" onClick={create}>+ New Drawing</button>
            <input type="text" list={listId} placeholder="Topic (optional)" value={topic} onChange={e => setTopic(e.target.value)} style={{ width: "200px" }} />
            <datalist id={listId}>{(topics ?? []).map(t => <option key={t} value={t} />)}</datalist>
        </div>
    );
}

// ───────────────────────────────────────────────────────────────────
// Main view
// ───────────────────────────────────────────────────────────────────
return function View() {
    const notes    = dc.useQuery('@page and #cogito/note  and path("Systems/Cogito/Notes")');
    const inbox    = dc.useQuery('@page and #cogito/inbox and path("Systems/Cogito/Inbox")');
    const drawings = dc.useQuery('@page and path("Systems/Cogito/Drawings")');
    const mocs     = dc.useQuery('@page and #cogito/moc   and path("Systems/Cogito/MOCs")');
    const media    = dc.useQuery('@page and #cogito/media and path("Systems/Cogito/Media")');

    const [tab, setTab] = dc.useState("Notes");

    // ── Notes filters ──
    const [statusFilter, setStatusFilter] = dc.useState("All");
    const [domainFilter, setDomainFilter] = dc.useState("All");
    const [topicFilter, setTopicFilter] = dc.useState("All");
    const [issueFilter, setIssueFilter] = dc.useState("All");
    const [searchInput, setSearchInput] = dc.useState("");
    const [search, setSearch] = dc.useState("");
    dc.useEffect(() => {
        const t = setTimeout(() => setSearch(searchInput), 200);
        return () => clearTimeout(t);
    }, [searchInput]);
    const resetFilters = () => {
        setStatusFilter("All"); setDomainFilter("All"); setTopicFilter("All"); setIssueFilter("All"); setSearchInput(""); setSearch("");
    };
    const filtersActive = statusFilter !== "All" || domainFilter !== "All" || topicFilter !== "All" || issueFilter !== "All" || search !== "";

    // ── Media filters ──
    const [mTypeFilter, setMTypeFilter]     = dc.useState("All");
    const [mStatusFilter, setMStatusFilter] = dc.useState("All");
    const [mTopicFilter, setMTopicFilter]   = dc.useState("All");
    const [mIssueFilter, setMIssueFilter]   = dc.useState("All");
    const [mSearchInput, setMSearchInput]   = dc.useState("");
    const [mSearch, setMSearch]             = dc.useState("");
    dc.useEffect(() => {
        const t = setTimeout(() => setMSearch(mSearchInput), 200);
        return () => clearTimeout(t);
    }, [mSearchInput]);
    const resetMFilters = () => {
        setMTypeFilter("All"); setMStatusFilter("All"); setMTopicFilter("All"); setMIssueFilter("All"); setMSearchInput(""); setMSearch("");
    };
    const mFiltersActive = mTypeFilter !== "All" || mStatusFilter !== "All" || mTopicFilter !== "All" || mIssueFilter !== "All" || mSearch !== "";

    // ── Body stats (notes) ──
    const [bodyStats, setBodyStats] = dc.useState(new Map());
    const pathsKey = notes.map(n => n.$path).join("|");
    dc.useEffect(() => {
        let cancelled = false;
        (async () => {
            const m = new Map();
            for (const n of notes) {
                try {
                    const file = dc.app.vault.getAbstractFileByPath(n.$path);
                    if (!file) continue;
                    const text = await dc.app.vault.cachedRead(file);
                    m.set(n.$path, sectionStats(text));
                } catch (e) { /* ignore */ }
            }
            if (!cancelled) setBodyStats(m);
        })();
        return () => { cancelled = true; };
    }, [pathsKey]);

    // ── Body stats (media) ──
    const [mBodyStats, setMBodyStats] = dc.useState(new Map());
    const mPathsKey = media.map(x => x.$path).join("|");
    dc.useEffect(() => {
        let cancelled = false;
        (async () => {
            const m = new Map();
            for (const x of media) {
                try {
                    const file = dc.app.vault.getAbstractFileByPath(x.$path);
                    if (!file) continue;
                    const text = await dc.app.vault.cachedRead(file);
                    m.set(x.$path, sectionStats(text));
                } catch (e) { /* ignore */ }
            }
            if (!cancelled) setMBodyStats(m);
        })();
        return () => { cancelled = true; };
    }, [mPathsKey]);

    const lints = dc.useMemo(() => {
        const m = new Map();
        for (const n of notes) m.set(n.$path, lintNote(n, bodyStats));
        return m;
    }, [notes, bodyStats]);

    const mLints = dc.useMemo(() => {
        const m = new Map();
        for (const x of media) m.set(x.$path, lintMedia(x, mBodyStats));
        return m;
    }, [media, mBodyStats]);

    // ── Shared topic pool: notes + drawings + media ──
    const allTopics = dc.useMemo(() => {
        const s = new Set();
        for (const n of notes)    { const t = n.value("topic"); if (t) s.add(String(t)); }
        for (const d of drawings) { const t = d.value("topic"); if (t) s.add(String(t)); }
        for (const x of media)    { const t = x.value("topic"); if (t) s.add(String(t)); }
        return Array.from(s).sort();
    }, [notes, drawings, media]);

    const topics = dc.useMemo(() => ["All", ...allTopics], [allTopics]);

    const filteredNotes = notes.filter(n => {
        const l = lints.get(n.$path);
        if (statusFilter !== "All" && l.status !== statusFilter) return false;
        if (domainFilter !== "All" && l.domain !== domainFilter) return false;
        if (topicFilter !== "All" && l.topic !== topicFilter) return false;
        if (issueFilter === "Any" && l.issues.length === 0) return false;
        if (issueFilter !== "All" && issueFilter !== "Any" && !l.codes.has(issueFilter)) return false;
        if (search && !String(n.$name).toLowerCase().includes(search.toLowerCase())) return false;
        return true;
    });

    const NOTE_SORT_FIELDS = [
        { value: "$name",   label: "Name" },
        { value: "status",  label: "Status" },
        { value: "domain",  label: "Domain" },
        { value: "topic",   label: "Topic" },
    ];
    const { sorted: sortedNotes, sortField: noteSortField, setSortField: setNoteSortField, sortDir: noteSortDir, setSortDir: setNoteSortDir } = useSortBy(filteredNotes, NOTE_SORT_FIELDS);

    const mTopics = dc.useMemo(
        () => ["All", ...Array.from(new Set(media.map(m => String(m.value("topic") ?? "")).filter(Boolean))).sort()],
        [media]
    );

    const filteredMedia = media.filter(m => {
        const l = mLints.get(m.$path);
        const type = m.value("type") ?? "";
        const topic = m.value("topic") ?? "";
        if (mTypeFilter !== "All"   && type !== mTypeFilter) return false;
        if (mStatusFilter !== "All" && l.status !== mStatusFilter) return false;
        if (mTopicFilter !== "All"  && topic !== mTopicFilter) return false;
        if (mIssueFilter === "Any" && l.issues.length === 0) return false;
        if (mIssueFilter !== "All" && mIssueFilter !== "Any" && !l.codes.has(mIssueFilter)) return false;
        if (mSearch && !String(m.$name).toLowerCase().includes(mSearch.toLowerCase())) return false;
        return true;
    });

    const MEDIA_SORT_FIELDS = [
        { value: "$name",   label: "Name" },
        { value: "status",  label: "Status" },
        { value: "type",    label: "Type" },
        { value: "topic",   label: "Topic" },
        { value: "author",  label: "Author" },
    ];
    const { sorted: sortedMedia, sortField: mediaSortField, setSortField: setMediaSortField, sortDir: mediaSortDir, setSortDir: setMediaSortDir } = useSortBy(filteredMedia, MEDIA_SORT_FIELDS);

    // ── Issue counts ──
    const { issueCounts, notesWithIssues, totalIssues } = dc.useMemo(() => {
        const counts = {};
        for (const code of NOTE_ISSUE_CODES) counts[code] = 0;
        let withIssues = 0, total = 0;
        for (const n of notes) {
            const l = lints.get(n.$path); if (!l) continue;
            if (l.issues.length > 0) withIssues++;
            total += l.issues.length;
            for (const code of l.codes) counts[code]++;
        }
        return { issueCounts: counts, notesWithIssues: withIssues, totalIssues: total };
    }, [notes, lints]);

    const { mIssueCounts, mediaWithIssues, mTotalIssues } = dc.useMemo(() => {
        const counts = {};
        for (const code of MEDIA_ISSUE_CODES) counts[code] = 0;
        let withIssues = 0, total = 0;
        for (const m of media) {
            const l = mLints.get(m.$path); if (!l) continue;
            if (l.issues.length > 0) withIssues++;
            total += l.issues.length;
            for (const code of l.codes) counts[code]++;
        }
        return { mIssueCounts: counts, mediaWithIssues: withIssues, mTotalIssues: total };
    }, [media, mLints]);

    const counts = {
        total: notes.length,
        stub: notes.filter(n => (lints.get(n.$path)?.status ?? "Stub") === "Stub").length,
        draft: notes.filter(n => lints.get(n.$path)?.status === "Draft").length,
        solid: notes.filter(n => lints.get(n.$path)?.status === "Solid").length,
        ref: notes.filter(n => lints.get(n.$path)?.status === "Reference").length,
    };

    const mCounts = {
        total:   media.length,
        backlog: media.filter(m => (mLints.get(m.$path)?.status ?? "Backlog") === "Backlog").length,
        active:  media.filter(m => mLints.get(m.$path)?.status === "Active").length,
        done:    media.filter(m => mLints.get(m.$path)?.status === "Done").length,
        dropped: media.filter(m => mLints.get(m.$path)?.status === "Dropped").length,
    };

    const stubs = notes.filter(n => (lints.get(n.$path)?.status ?? "Stub") === "Stub");
    const stubOfDay = stubs.length > 0 ? stubs[Math.floor(Date.now() / 86400000) % stubs.length] : null;

    const MOC_SUGGEST_THRESHOLD = 5;
    const topicAllCounts = dc.useMemo(() => {
        const m = {};
        const bump = (t) => { if (t) m[t] = (m[t] || 0) + 1; };
        for (const n of notes)    bump(n.value("topic"));
        for (const d of drawings) bump(d.value("topic"));
        for (const x of media)    bump(x.value("topic"));
        return m;
    }, [notes, drawings, media]);
    const mocNamesLC = dc.useMemo(() => new Set(mocs.map(m => String(m.$name).toLowerCase())), [mocs]);
    const suggestedMOCs = dc.useMemo(
        () => Object.entries(topicAllCounts)
            .filter(([t, c]) => c >= MOC_SUGGEST_THRESHOLD && !mocNamesLC.has(t.toLowerCase()))
            .sort((a, b) => b[1] - a[1]),
        [topicAllCounts, mocNamesLC]
    );

    const tabCounts = { Notes: notes.length, Media: media.length, Drawings: drawings.length, MOCs: mocs.length };

    const KpiCard = ({ label, value, color, onClick, active }) => (
        <div onClick={onClick}
            style={{
                flex: 1, minWidth: "100px", padding: "10px", borderRadius: "6px", textAlign: "center",
                background: active ? "var(--background-modifier-hover)" : "var(--background-secondary)",
                border: active ? "1px solid var(--interactive-accent)" : "1px solid transparent",
                cursor: onClick ? "pointer" : "default"
            }}>
            <div style={{ fontSize: "1.4em", fontWeight: "bold", color: color || undefined }}>{value}</div>
            <div style={{ fontSize: "0.78em", opacity: 0.7 }}>{label}</div>
        </div>
    );

    const focusStatus = (s) => { setIssueFilter("All"); setStatusFilter(s); setTab("Notes"); };
    const focusIssue  = (c) => { setStatusFilter("All"); setIssueFilter(c); setTab("Notes"); };
    const focusMStatus = (s) => { setMIssueFilter("All"); setMStatusFilter(s); setTab("Media"); };
    const focusMIssue  = (c) => { setMStatusFilter("All"); setMIssueFilter(c); setTab("Media"); };

    return (
        <div>
            {/* KPI strip — Notes */}
            <div style={{ display: "flex", gap: "8px", marginBottom: "8px", flexWrap: "wrap" }}>
                <KpiCard label="Notes"     value={counts.total} onClick={() => { resetFilters(); setTab("Notes"); }} />
                <KpiCard label="Stub"      value={counts.stub}  color={STATUS_COLOR.Stub}      onClick={() => focusStatus("Stub")}      active={tab === "Notes" && statusFilter === "Stub"} />
                <KpiCard label="Draft"     value={counts.draft} color={STATUS_COLOR.Draft}     onClick={() => focusStatus("Draft")}     active={tab === "Notes" && statusFilter === "Draft"} />
                <KpiCard label="Solid"     value={counts.solid} color={STATUS_COLOR.Solid}     onClick={() => focusStatus("Solid")}     active={tab === "Notes" && statusFilter === "Solid"} />
                <KpiCard label="Reference" value={counts.ref}   color={STATUS_COLOR.Reference} onClick={() => focusStatus("Reference")} active={tab === "Notes" && statusFilter === "Reference"} />
            </div>

            {/* KPI strip — Media */}
            <div style={{ display: "flex", gap: "8px", marginBottom: "12px", flexWrap: "wrap" }}>
                <KpiCard label="Media"      value={mCounts.total}   onClick={() => { resetMFilters(); setTab("Media"); }} active={tab === "Media" && !mFiltersActive} />
                <KpiCard label="Backlog"    value={mCounts.backlog} onClick={() => focusMStatus("Backlog")} active={tab === "Media" && mStatusFilter === "Backlog"} />
                <KpiCard label="Active"     value={mCounts.active}  color={MEDIA_STATUS_COLOR.Active}  onClick={() => focusMStatus("Active")}  active={tab === "Media" && mStatusFilter === "Active"} />
                <KpiCard label="Done"       value={mCounts.done}    color={MEDIA_STATUS_COLOR.Done}    onClick={() => focusMStatus("Done")}    active={tab === "Media" && mStatusFilter === "Done"} />
                <KpiCard label="Dropped"    value={mCounts.dropped} color={MEDIA_STATUS_COLOR.Dropped} onClick={() => focusMStatus("Dropped")} active={tab === "Media" && mStatusFilter === "Dropped"} />
            </div>

            {/* Health row — Notes */}
            {notesWithIssues > 0 ? (
                <div style={{ padding: "8px 12px", background: "var(--background-secondary)", borderRadius: "6px", marginBottom: "10px", fontSize: "0.88em", display: "flex", flexWrap: "wrap", alignItems: "center", gap: "6px" }}>
                    <span>📝 <strong>{totalIssues}</strong> note issue{totalIssues !== 1 ? "s" : ""} across <strong>{notesWithIssues}</strong> note{notesWithIssues !== 1 ? "s" : ""}</span>
                    <span style={{ opacity: 0.5 }}>·</span>
                    {NOTE_ISSUE_CODES.filter(c => issueCounts[c] > 0).map(c => (
                        <span key={c} onClick={() => focusIssue(c)}
                            title={`Filter notes to: ${NOTE_ISSUE_LABEL[c]}`}
                            style={{
                                cursor: "pointer", padding: "2px 8px", borderRadius: "10px",
                                background: issueFilter === c ? "var(--interactive-accent)" : "var(--background-modifier-border)",
                                color: issueFilter === c ? "var(--text-on-accent)" : undefined,
                                fontSize: "0.85em"
                            }}>
                            {NOTE_ISSUE_EMOJI[c]} {issueCounts[c]} {NOTE_ISSUE_LABEL[c]}
                        </span>
                    ))}
                    {issueFilter !== "All" ? (
                        <a onClick={() => setIssueFilter("All")} style={{ marginLeft: "6px", cursor: "pointer", fontSize: "0.85em", opacity: 0.7 }}>clear issue filter</a>
                    ) : null}
                </div>
            ) : null}

            {/* Health row — Media */}
            {mediaWithIssues > 0 ? (
                <div style={{ padding: "8px 12px", background: "var(--background-secondary)", borderRadius: "6px", marginBottom: "10px", fontSize: "0.88em", display: "flex", flexWrap: "wrap", alignItems: "center", gap: "6px" }}>
                    <span>📺 <strong>{mTotalIssues}</strong> media issue{mTotalIssues !== 1 ? "s" : ""} across <strong>{mediaWithIssues}</strong> entr{mediaWithIssues !== 1 ? "ies" : "y"}</span>
                    <span style={{ opacity: 0.5 }}>·</span>
                    {MEDIA_ISSUE_CODES.filter(c => mIssueCounts[c] > 0).map(c => (
                        <span key={c} onClick={() => focusMIssue(c)}
                            title={`Filter media to: ${MEDIA_ISSUE_LABEL[c]}`}
                            style={{
                                cursor: "pointer", padding: "2px 8px", borderRadius: "10px",
                                background: mIssueFilter === c ? "var(--interactive-accent)" : "var(--background-modifier-border)",
                                color: mIssueFilter === c ? "var(--text-on-accent)" : undefined,
                                fontSize: "0.85em"
                            }}>
                            {MEDIA_ISSUE_EMOJI[c]} {mIssueCounts[c]} {MEDIA_ISSUE_LABEL[c]}
                        </span>
                    ))}
                    {mIssueFilter !== "All" ? (
                        <a onClick={() => setMIssueFilter("All")} style={{ marginLeft: "6px", cursor: "pointer", fontSize: "0.85em", opacity: 0.7 }}>clear issue filter</a>
                    ) : null}
                </div>
            ) : null}

            {/* Stub of day */}
            {stubOfDay ? (
                <div style={{ padding: "10px 12px", background: "var(--background-modifier-hover)", borderRadius: "6px", marginBottom: "12px", borderLeft: "3px solid var(--color-orange)" }}>
                    <div style={{ fontSize: "0.78em", opacity: 0.7, marginBottom: "2px" }}>🌱 Stub of the day — promote one</div>
                    <div>{stubOfDay.$link}</div>
                </div>
            ) : null}

            {/* Inbox — always accessible, collapsible */}
            <details open={inbox.length === 0} style={{ margin: "0 0 12px 0", padding: "8px 12px", background: "var(--background-secondary)", borderRadius: "6px" }}>
                <summary style={{ cursor: "pointer", fontSize: "0.95em", fontWeight: 500 }}>
                    📥 Inbox <span style={{ opacity: 0.6, fontSize: "0.85em", fontWeight: 400 }}>({inbox.length})</span>
                </summary>
                <div style={{ marginTop: "8px" }}>
                    <NewForm
                        label="+ Quick Capture"
                        folder='Systems/Cogito/Inbox'
                        tag={["cogito/inbox"]}
                        body=""
                        fields={[
                            { name: "name", placeholder: "Quick capture title…", width: "320px" }
                        ]}
                    />
                    <div style={{ padding: "6px 10px", background: "var(--background-modifier-hover)", borderRadius: "5px", margin: "8px 0", fontSize: "0.82em", opacity: 0.8 }}>
                        Inbox accepts anything. Skim weekly. Promote what matters; delete the rest. No guilt.
                    </div>
                    {inbox.length > 0 ? (
                        <dc.Table paging={10} rows={[...inbox].sort((a,b) => a.$name.localeCompare(b.$name))}
                            columns={[
                                { id: "Capture", value: i => i.$link },
                                { id: "Age", value: i => ageDays(i), render: (v) => `${v}d` },
                                {
                                    id: "Actions", value: () => "",
                                    render: (_, i) => (
                                        <div style={{ display: "flex", gap: "6px" }}>
                                            <button onClick={async () => {
                                                try {
                                                    const file = dc.app.vault.getAbstractFileByPath(i.$path);
                                                    if (!file) return;
                                                    await dc.app.fileManager.processFrontMatter(file, fm => {
                                                        fm.tags = ["cogito/note"]; fm.status = "Stub";
                                                        if (!fm.domain) fm.domain = "Basic";
                                                        if (!fm.topic) fm.topic = "";
                                                    });
                                                    await dc.app.fileManager.renameFile(file, `Systems/Cogito/Notes/${i.$name}.md`);
                                                    new window.Notice("Promoted to Notes");
                                                } catch (e) { console.error(e); new window.Notice(`Promote failed: ${e.message}`); }
                                            }} style={{ fontSize: "0.78em", padding: "2px 8px", cursor: "pointer" }}>→ Notes</button>
                                            <button onClick={async () => {
                                                if (!window.confirm(`Delete "${i.$name}"? This cannot be undone.`)) return;
                                                try {
                                                    const file = dc.app.vault.getAbstractFileByPath(i.$path);
                                                    if (!file) return;
                                                    await dc.app.vault.trash(file, true);
                                                    new window.Notice("Deleted from Inbox");
                                                } catch (e) { console.error(e); new window.Notice(`Delete failed: ${e.message}`); }
                                            }} style={{ fontSize: "0.78em", padding: "2px 8px", cursor: "pointer", color: "var(--text-error)" }}>🗑 Delete</button>
                                        </div>
                                    )
                                }
                            ]} />
                    ) : null}
                </div>
            </details>

            {/* Tabs */}
            <div style={{ display: "flex", gap: "6px", marginBottom: "12px", borderBottom: "1px solid var(--background-modifier-border)" }}>
                {["Notes", "Media", "Drawings", "MOCs"].map(t => (
                    <button key={t} onClick={() => setTab(t)}
                        className={tab === t ? "mod-cta" : ""}
                        style={{ cursor: "pointer", padding: "8px 16px", borderRadius: "6px 6px 0 0", border: "none", background: tab === t ? undefined : "transparent" }}>
                        {t} <span style={{ opacity: 0.6, fontSize: "0.85em" }}>({tabCounts[t]})</span>
                        {t === "MOCs" && suggestedMOCs.length > 0 ? (
                            <span title={`${suggestedMOCs.length} suggested MOC${suggestedMOCs.length === 1 ? "" : "s"}`}
                                style={{ marginLeft: "4px", padding: "1px 6px", background: "var(--color-orange)", color: "var(--text-on-accent)", borderRadius: "8px", fontSize: "0.7em", fontWeight: 600 }}>
                                ⚠ {suggestedMOCs.length}
                            </span>
                        ) : null}
                    </button>
                ))}
            </div>

            {tab === "Notes" ? (
                <div>
                    <NewForm
                        label="+ New Note"
                        folder='Systems/Cogito/Notes'
                        tag={["cogito/note"]}
                        defaults={{ status: "Stub" }}
                        initialValues={{
                            domain: domainFilter !== "All" ? domainFilter : undefined,
                            topic:  topicFilter  !== "All" ? topicFilter  : undefined
                        }}
                        body={(vals) => templateBodyFor(vals.domain)}
                        fields={[
                            { name: "name", label: "Title", width: "260px" },
                            { name: "domain", label: "Domain", type: "select", options: DOMAINS, default: "Knowledge" },
                            { name: "topic", label: "Topic", placeholder: "e.g. Rust, Theology, Game design", width: "200px", suggestions: allTopics }
                        ]}
                    />

                    <details style={{ margin: "6px 0 12px 0", fontSize: "0.85em", opacity: 0.85 }}>
                        <summary style={{ cursor: "pointer" }}>What goes where? (Domain cheat-sheet)</summary>
                        <div style={{ padding: "8px 12px", background: "var(--background-secondary)", borderRadius: "5px", marginTop: "6px" }}>
                            {DOMAINS.map(d => (
                                <div key={d} style={{ marginBottom: "4px" }}>
                                    <DomainPill domain={d} /> <span style={{ marginLeft: "6px" }}>{DOMAIN_DESC[d]}</span>
                                    <div style={{ marginLeft: "12px", fontSize: "0.85em", opacity: 0.6 }}>schema: {schemaFor(d).join(" · ")}</div>
                                </div>
                            ))}
                        </div>
                    </details>

                    <details style={{ margin: "6px 0 12px 0", fontSize: "0.85em", opacity: 0.85 }}>
                        <summary style={{ cursor: "pointer" }}>What does each issue mean? (Lint cheat-sheet)</summary>
                        <div style={{ padding: "8px 12px", background: "var(--background-secondary)", borderRadius: "5px", marginTop: "6px" }}>
                            <div style={{ marginBottom: "6px" }}>
                                <strong>no domain</strong> — note isn't tagged Knowledge / Engineering / Process / Idea.
                                <div style={{ marginLeft: "12px", opacity: 0.7 }}>Fix: pick a domain from the dropdown in the Domain column.</div>
                            </div>
                            <div style={{ marginBottom: "6px" }}>
                                <strong>no topic</strong> — free-form topic field is empty (e.g. <em>Rust</em>, <em>Theology</em>, <em>Game design</em>).
                                <div style={{ marginLeft: "12px", opacity: 0.7 }}>Fix: type one in the Topic column. Reuse existing topics where possible — they auto-populate the Topic filter.</div>
                            </div>
                            <div style={{ marginBottom: "6px" }}>
                                <strong>missing: …</strong> — required schema sections (e.g. <em>Summary</em>, <em>Why it matters</em>) are absent OR present as empty <code>## headings</code> with no content underneath.
                                <div style={{ marginLeft: "12px", opacity: 0.7 }}>Fix: open the note and add the missing <code>## Section</code> headings, or write actual content under empty ones. Schema is per-domain — see cheat-sheet above.</div>
                            </div>
                            <div style={{ marginBottom: "6px" }}>
                                <strong>orphan</strong> — zero backlinks. Nothing else in the vault links here.
                                <div style={{ marginLeft: "12px", opacity: 0.7 }}>Fix: link to it from a related note, a MOC, or a project. If nothing wants to point at it, demote or delete.</div>
                            </div>
                            <div style={{ marginBottom: "6px" }}>
                                <strong>needs ≥{MIN_BACKLINKS_REFERENCE} backlinks</strong> — note is marked <em>Reference</em> but isn't pulling its weight.
                                <div style={{ marginLeft: "12px", opacity: 0.7 }}>Fix: link to it from more notes, or demote its status back to <em>Solid</em>.</div>
                            </div>
                            <div style={{ marginBottom: "6px" }}>
                                <strong>stub Nd</strong> — note has been a Stub for ≥{STUB_AGE_DAYS} days (measured from <code>created</code>, not last-edit). It's rotting.
                                <div style={{ marginLeft: "12px", opacity: 0.7 }}>Fix: flesh it out and promote to Draft, or delete it. Stubs that never grow are clutter.</div>
                            </div>
                        </div>
                    </details>

                    <div style={{ display: "flex", gap: "10px", margin: "10px 0", flexWrap: "wrap", alignItems: "center" }}>
                        <label style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "0.85em" }}>
                            <span style={{ opacity: 0.7 }}>Status</span>
                            <SearchableSelect value={statusFilter} options={["All", ...STATUSES]} onValueChange={setStatusFilter} />
                        </label>
                        <label style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "0.85em" }}>
                            <span style={{ opacity: 0.7 }}>Domain</span>
                            <SearchableSelect value={domainFilter} options={["All", ...DOMAINS]} onValueChange={setDomainFilter} />
                        </label>
                        <label style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "0.85em" }}>
                            <span style={{ opacity: 0.7 }}>Topic</span>
                            <SearchableSelect value={topicFilter} options={topics} onValueChange={setTopicFilter} />
                        </label>
                        <label style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "0.85em" }}>
                            <span style={{ opacity: 0.7 }}>Issue</span>
                            <SearchableSelect value={issueFilter}
                                options={[
                                    { value: "All", label: "All" },
                                    { value: "Any", label: "Any issue" },
                                    ...NOTE_ISSUE_CODES.map(c => ({ value: c, label: `${NOTE_ISSUE_EMOJI[c]} ${NOTE_ISSUE_LABEL[c]} (${issueCounts[c] || 0})` }))
                                ]}
                                onValueChange={setIssueFilter} />
                        </label>
                        <label style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "0.85em" }}>
                            <span style={{ opacity: 0.7 }}>Search</span>
                            <dc.Textbox value={searchInput} placeholder="filter by title…" onInput={e => setSearchInput(e.currentTarget.value)} style={{ width: "200px" }} />
                        </label>
                        {filtersActive ? (
                            <a onClick={resetFilters} style={{ cursor: "pointer", fontSize: "0.85em", opacity: 0.75 }}>↺ Reset filters</a>
                        ) : null}
                        <SortBar fields={NOTE_SORT_FIELDS} field={noteSortField} setField={setNoteSortField} dir={noteSortDir} setDir={setNoteSortDir} />
                        <span style={{ marginLeft: "auto", fontSize: "0.78em", opacity: 0.6 }}>{filteredNotes.length} / {notes.length}</span>
                    </div>

                    <dc.Table paging={20} rows={sortedNotes}
                        columns={[
                            { id: "Note", value: n => n.$link },
                            {
                                id: "Domain", value: n => String(lints.get(n.$path)?.domain ?? ""),
                                render: (_, n) => <DomainCell note={n} domain={lints.get(n.$path)?.domain ?? ""} />
                            },
                            {
                                id: "Topic", value: n => String(lints.get(n.$path)?.topic ?? ""),
                                render: (_, n) => <TopicCell note={n} topic={lints.get(n.$path)?.topic ?? ""} topics={allTopics} />
                            },
                            {
                                id: "Status", value: n => lints.get(n.$path)?.status ?? "Stub",
                                render: (_, n) => <StatusCell note={n} status={lints.get(n.$path)?.status ?? "Stub"} />
                            },
                            { id: "Links", value: n => lints.get(n.$path)?.backlinks ?? 0 },
                            {
                                id: "Issues", value: n => (lints.get(n.$path)?.issues ?? []).length,
                                render: (_, n) => <IssueChips codes={lints.get(n.$path)?.codes} labels={NOTE_ISSUE_LABEL} emojis={NOTE_ISSUE_EMOJI} onPick={focusIssue} />
                            },
                            {
                                id: "Promote", value: n => (canPromote(lints.get(n.$path) ?? lintNote(n)).next ?? "—"),
                                render: (_, n) => {
                                    const l = lints.get(n.$path); if (!l) return "";
                                    const p = canPromote(l);
                                    if (!p.next) return <span style={{ opacity: 0.5 }}>—</span>;
                                    return <button disabled={p.blocked} title={p.blocked ? p.reason : `Promote to ${p.next}`}
                                        onClick={() => setField(n, "status", p.next)}
                                        style={{ fontSize: "0.78em", padding: "2px 8px", cursor: p.blocked ? "not-allowed" : "pointer" }}>
                                        → {p.next}
                                    </button>;
                                }
                            }
                        ]} />
                </div>
            ) : null}

            {tab === "Drawings" ? (
                <div>
                    <NewDrawingButton topics={allTopics} />
                    <div style={{ padding: "6px 10px", background: "var(--background-secondary)", borderRadius: "5px", margin: "8px 0", fontSize: "0.78em", opacity: 0.7 }}>
                        Drawings save to <code>Systems/Cogito/Drawings/</code>. Topic is stored in the drawing's frontmatter (same field as Notes).
                    </div>
                    <dc.Table paging={20} rows={[...drawings].sort((a,b) => a.$name.localeCompare(b.$name))}
                        columns={[
                            { id: "Drawing", value: d => d.$link },
                            { id: "Topic", value: d => String(d.value("topic") ?? ""),
                              render: (_, d) => <TopicCell note={d} topic={d.value("topic") ?? ""} topics={allTopics} /> },
                            { id: "Age", value: d => ageDays(d), render: (v) => `${v}d` }
                        ]} />
                </div>
            ) : null}

            {tab === "MOCs" ? (
                <div>
                    <NewForm
                        label="+ New MOC"
                        folder='Systems/Cogito/MOCs'
                        tag={["cogito/moc"]}
                        fields={[
                            { name: "name", label: "MOC title", width: "260px" }
                        ]}
                    />
                    <div style={{ padding: "8px 10px", background: "var(--background-secondary)", borderRadius: "5px", margin: "8px 0", fontSize: "0.85em", opacity: 0.8 }}>
                        A MOC (Map of Content) is a curated index of related items. Create one when a topic has ≥{MOC_SUGGEST_THRESHOLD} items across notes, drawings, and media.
                    </div>
                    {suggestedMOCs.length > 0 ? (
                        <div style={{ padding: "10px 12px", background: "var(--background-modifier-error-hover)", borderRadius: "5px", margin: "8px 0", borderLeft: "3px solid var(--color-orange)" }}>
                            <div style={{ fontWeight: 500, marginBottom: "6px" }}>⚠ Suggested MOCs ({suggestedMOCs.length})</div>
                            <div style={{ fontSize: "0.82em", opacity: 0.8, marginBottom: "6px" }}>
                                These topics span ≥{MOC_SUGGEST_THRESHOLD} items but no matching MOC. Consider creating one (use the topic name as the MOC title).
                            </div>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                                {suggestedMOCs.map(([t, c]) => (
                                    <span key={t} style={{ padding: "3px 8px", background: "var(--background-secondary)", borderRadius: "3px", fontSize: "0.82em" }}>
                                        <strong>{t}</strong> · {c} items
                                    </span>
                                ))}
                            </div>
                        </div>
                    ) : null}
                    <dc.Table paging={20} rows={[...mocs].sort((a,b) => a.$name.localeCompare(b.$name))}
                        columns={[
                            { id: "MOC", value: m => m.$link },
                            { id: "Backlinks", value: m => backlinkCountFor(m.$path) }
                        ]} />
                </div>
            ) : null}

            {tab === "Media" ? (
                <div>
                    <NewForm
                        label="+ New Media"
                        folder='Systems/Cogito/Media'
                        tag={["cogito/media"]}
                        defaults={{ status: "Backlog" }}
                        body={() => "\n## Takeaways\n\n## Quotes\n\n## Review\n"}
                        fields={[
                            { name: "name",   label: "Title", width: "260px" },
                            { name: "type",   label: "Type", type: "select", options: MEDIA_TYPES, default: "Book" },
                            { name: "author", label: "Author", placeholder: "Creator", width: "180px" },
                            { name: "topic",  label: "Topic", placeholder: "e.g. Rust, Theology", width: "180px", suggestions: allTopics },
                            { name: "source", label: "Source URL", placeholder: "https://…", width: "220px" },
                            { name: "status", label: "Status", type: "select", options: MEDIA_STATUSES, default: "Backlog" }
                        ]}
                    />

                    <details style={{ margin: "6px 0 12px 0", fontSize: "0.85em", opacity: 0.85 }}>
                        <summary style={{ cursor: "pointer" }}>What does each media issue mean? (Lint cheat-sheet)</summary>
                        <div style={{ padding: "8px 12px", background: "var(--background-secondary)", borderRadius: "5px", marginTop: "6px" }}>
                            <div style={{ marginBottom: "6px" }}>
                                <strong>no topic</strong> — entry has no <code>topic:</code>. Required so you can group/filter by subject (shared with Notes).
                                <div style={{ marginLeft: "12px", opacity: 0.7 }}>Fix: type a topic inline in the Topic column.</div>
                            </div>
                            <div style={{ marginBottom: "6px" }}>
                                <strong>no output</strong> — Done but no spawned Knowledge notes AND no content under <code>## Takeaways / Review / Quotes</code>.
                                <div style={{ marginLeft: "12px", opacity: 0.7 }}>Honest signal: did this teach you anything?</div>
                            </div>
                            <div style={{ marginBottom: "6px" }}>
                                <strong>no source</strong> — no <code>source:</code> URL. Required at every stage except Dropped.
                                <div style={{ marginLeft: "12px", opacity: 0.7 }}>Fix: paste the URL inline in the Source column.</div>
                            </div>
                            <div style={{ marginBottom: "6px" }}>
                                <strong>stale backlog Nd</strong> — Backlog for ≥{STALE_BACKLOG_DAYS} days untouched.
                                <div style={{ marginLeft: "12px", opacity: 0.7 }}>Fix: probably never reading it. Drop it or actually start.</div>
                            </div>
                        </div>
                    </details>

                    <div style={{ display: "flex", gap: "10px", margin: "10px 0", flexWrap: "wrap", alignItems: "center" }}>
                        <label style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "0.85em" }}>
                            <span style={{ opacity: 0.7 }}>Type</span>
                            <SearchableSelect value={mTypeFilter} options={["All", ...MEDIA_TYPES]} onValueChange={setMTypeFilter} />
                        </label>
                        <label style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "0.85em" }}>
                            <span style={{ opacity: 0.7 }}>Status</span>
                            <SearchableSelect value={mStatusFilter} options={["All", ...MEDIA_STATUSES]} onValueChange={setMStatusFilter} />
                        </label>
                        <label style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "0.85em" }}>
                            <span style={{ opacity: 0.7 }}>Topic</span>
                            <SearchableSelect value={mTopicFilter} options={topics} onValueChange={setMTopicFilter} />
                        </label>
                        <label style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "0.85em" }}>
                            <span style={{ opacity: 0.7 }}>Issue</span>
                            <SearchableSelect value={mIssueFilter}
                                options={[
                                    { value: "All", label: "All" },
                                    { value: "Any", label: "Any issue" },
                                    ...MEDIA_ISSUE_CODES.map(c => ({ value: c, label: `${MEDIA_ISSUE_EMOJI[c]} ${MEDIA_ISSUE_LABEL[c]} (${mIssueCounts[c] || 0})` }))
                                ]}
                                onValueChange={setMIssueFilter} />
                        </label>
                        <label style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "0.85em" }}>
                            <span style={{ opacity: 0.7 }}>Search</span>
                            <dc.Textbox value={mSearchInput} placeholder="filter by title…" onInput={e => setMSearchInput(e.currentTarget.value)} style={{ width: "200px" }} />
                        </label>
                        {mFiltersActive ? (
                            <a onClick={resetMFilters} style={{ cursor: "pointer", fontSize: "0.85em", opacity: 0.75 }}>↺ Reset filters</a>
                        ) : null}
                        <SortBar fields={MEDIA_SORT_FIELDS} field={mediaSortField} setField={setMediaSortField} dir={mediaSortDir} setDir={setMediaSortDir} />
                        <span style={{ marginLeft: "auto", fontSize: "0.78em", opacity: 0.6 }}>{filteredMedia.length} / {media.length}</span>
                    </div>

                    <dc.Table paging={20} rows={sortedMedia}
                        columns={[
                            { id: "Title",  value: m => m.$link },
                            { id: "Type",   value: m => String(m.value("type") ?? ""),
                              render: (_, m) => (
                                <dc.VanillaSelect
                                    value={m.value("type") ?? ""}
                                    options={MEDIA_TYPES.map(t => ({ value: t, label: t }))}
                                    onValueChange={v => setField(m, "type", v || null)}
                                />
                              )
                            },
                            { id: "Status", value: m => mLints.get(m.$path)?.status ?? "Backlog", render: (_, m) => <MediaStatusCell media={m} status={mLints.get(m.$path)?.status ?? "Backlog"} /> },
                            { id: "Topic",  value: m => String(m.value("topic") ?? ""), render: (_, m) => <TopicCell note={m} topic={m.value("topic")} topics={allTopics} /> },
                            { id: "Source", value: m => String(m.value("source") ?? ""), render: (_, m) => <SourceCell media={m} source={m.value("source")} /> },
                            { id: "Spawned",  value: m => spawnedCount(m) },
                            {
                                id: "Issues", value: m => (mLints.get(m.$path)?.issues ?? []).length,
                                render: (_, m) => <IssueChips codes={mLints.get(m.$path)?.codes} labels={MEDIA_ISSUE_LABEL} emojis={MEDIA_ISSUE_EMOJI} onPick={focusMIssue} />
                            }
                        ]} />
                </div>
            ) : null}
        </div>
    );
};
```

