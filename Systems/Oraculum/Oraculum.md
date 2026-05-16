---
dashboard: true
aliases: []
tags:
  - system/oraculum/system
  - datacore/dashboard
---
```datacorejsx
const G  = await dc.require("Systems/Oraculum/Modules/GeminiClient.js");
const T  = await dc.require("Systems/Oraculum/Modules/Tools.js");
const E  = await dc.require("Systems/Oraculum/Modules/Embeddings.js");
const S  = await dc.require("Systems/Oraculum/Modules/Settings.js");
const Sk = await dc.require("Systems/Oraculum/Modules/Skills.js");
const R  = await dc.require("Systems/Oraculum/Modules/Research.js");
const C  = await dc.require("Toolkit/Datacore/Cache.js");

const today = new Date().toLocaleDateString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric"
});

// Fallback SYSTEM used only if Systems/Oraculum/Skills/ is empty or unreadable.
// All real instructions live as composable .md files in Systems/Oraculum/Skills/
// and are assembled at runtime via Sk.assemble({ today }).
const SYSTEM_FALLBACK = `You are Oraculum, an AI assistant embedded in a personal Obsidian vault called Codex Vitae.

Today is ${today}.

⚠ The Systems/Oraculum/Skills/ folder is empty or unreadable — running with a minimal fallback prompt.
Open Settings → Skills to restore the full instruction set.`;

// ── Styles ─────────────────────────────────────────────────────────────────

const css = await dc.require("Systems/Oraculum/Modules/Styles.js");


// Inject CSS — versioned so stale styles are always replaced on update
const CSS_VER = "oraculum-v16";
document.querySelectorAll('[id^="oraculum-v"]').forEach(el => {
    if (el.id !== CSS_VER) el.remove();
});
if (!document.getElementById(CSS_VER)) {
    const el = document.createElement("style");
    el.id = CSS_VER;
    el.textContent = css;
    document.head.appendChild(el);
}

// ── Markdown renderer ─────────────────────────────────────────────────────────
// Converts model output to safe HTML. Supports: headings, bold, italic,
// strikethrough, inline code, fenced code blocks, ordered + unordered lists,
// blockquotes, tables, horizontal rules, [[wikilinks]], and [text](url) links.

function markdownToHtml(text) {
    function esc(s) {
        return String(s)
            .replace(/&/g, "&amp;").replace(/</g, "&lt;")
            .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    }

    function inline(raw) {
        let s = esc(raw);
        s = s.replace(/~~(.+?)~~/g, "<del>$1</del>");
        s = s.replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>");
        s = s.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
        s = s.replace(/\*([^*\n]+?)\*/g, "<em>$1</em>");
        s = s.replace(/`([^`\n]+)`/g, "<code>$1</code>");
        // Image embeds: ![[path]] — resolve via vault adapter and render as <img>
        s = s.replace(/!\[\[([^\]]+)\]\]/g, (_, p) => {
            const file = dc.app.vault.getAbstractFileByPath(p);
            if (file) {
                const src = dc.app.vault.getResourcePath(file);
                return `<img src="${esc(src)}" alt="${esc(p.split("/").pop())}" style="max-width:100%;border-radius:8px;margin:6px 0;" />`;
            }
            return `<span class="oraculum-wikilink" title="${esc(p)}">📎 ${esc(p.split("/").pop())}</span>`;
        });
        // Wikilinks: [[note]]
        s = s.replace(/\[\[([^\]]+)\]\]/g,
            (_, n) => `<a class="oraculum-wikilink" data-note="${esc(n)}">${esc(n)}</a>`);
        s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g,
            (_, t, u) => `<a href="${esc(u)}" target="_blank" rel="noopener">${t}</a>`);
        return s;
    }

    const lines = text.split("\n");
    const out   = [];
    let i = 0;

    while (i < lines.length) {
        const line = lines[i];

        // ── Fenced code block (```` ```lang ```` or ~~~lang) ───────────────
        const fenceMatch = line.match(/^(`{3,}|~{3,})([\w.-]*)\s*$/);
        if (fenceMatch) {
            const fChar = fenceMatch[1][0];
            const fLen  = fenceMatch[1].length;
            const lang  = fenceMatch[2] || "";
            // closing fence: same char, at least fLen of them, nothing else
            const isClose = (l) => {
                let cnt = 0;
                while (cnt < l.length && l[cnt] === fChar) cnt++;
                return cnt >= fLen && l.slice(cnt).trim() === "";
            };
            i++;
            const codeLines = [];
            while (i < lines.length && !isClose(lines[i])) {
                codeLines.push(lines[i]);
                i++;
            }
            i++; // skip closing fence
            const langAttr = lang ? ` class="language-${esc(lang)}"` : "";
            out.push(`<pre><code${langAttr}>${esc(codeLines.join("\n"))}</code></pre>`);
            continue;
        }

        // ── Image embed: ![[path]] on its own line ─────────────────────────
        if (/^!\[\[.+\]\]$/.test(line.trim())) { out.push(`<p>${inline(line.trim())}</p>`); i++; continue; }

        // ── Blockquote ─────────────────────────────────────────────────────
        if (/^> /.test(line) || line === ">") {
            const qLines = [];
            while (i < lines.length && (/^> /.test(lines[i]) || lines[i] === ">")) {
                qLines.push(lines[i].replace(/^> ?/, ""));
                i++;
            }
            out.push(`<blockquote>${markdownToHtml(qLines.join("\n"))}</blockquote>`);
            continue;
        }

        // ── Table (header row followed by separator row) ───────────────────
        if (line.includes("|") && i + 1 < lines.length && /^\|?[\s:|-]+\|/.test(lines[i + 1])) {
            const parseCells = (l) => l.split("|").slice(1, -1).map(c => c.trim());
            const headers = parseCells(line).map(c => `<th>${inline(c)}</th>`).join("");
            i += 2; // skip header + separator
            const rows = [];
            while (i < lines.length && lines[i].includes("|") && lines[i].trim() !== "") {
                const cells = parseCells(lines[i]).map(c => `<td>${inline(c)}</td>`).join("");
                rows.push(`<tr>${cells}</tr>`);
                i++;
            }
            out.push(`<table><thead><tr>${headers}</tr></thead><tbody>${rows.join("")}</tbody></table>`);
            continue;
        }

        // ── Unordered list ─────────────────────────────────────────────────
        if (/^\s{0,3}[-*+] /.test(line)) {
            const items = [];
            while (i < lines.length && /^\s{0,3}[-*+] /.test(lines[i])) {
                items.push(`<li>${inline(lines[i].replace(/^\s{0,3}[-*+] /, ""))}</li>`);
                i++;
            }
            out.push(`<ul>${items.join("")}</ul>`);
            continue;
        }

        // ── Ordered list ───────────────────────────────────────────────────
        if (/^\d+\. /.test(line)) {
            const items = [];
            while (i < lines.length && /^\d+\. /.test(lines[i])) {
                items.push(`<li>${inline(lines[i].replace(/^\d+\. /, ""))}</li>`);
                i++;
            }
            out.push(`<ol>${items.join("")}</ol>`);
            continue;
        }

        // ── Headings ───────────────────────────────────────────────────────
        const headMatch = line.match(/^(#{1,6}) (.+)/);
        if (headMatch) {
            const level = headMatch[1].length;
            out.push(`<h${level}>${inline(headMatch[2])}</h${level}>`);
            i++;
            continue;
        }

        // ── Horizontal rule ────────────────────────────────────────────────
        if (/^[-*_]{3,}\s*$/.test(line)) { out.push("<hr/>"); i++; continue; }

        // ── Blank line ─────────────────────────────────────────────────────
        if (line.trim() === "") { out.push("<br/>"); i++; continue; }

        // ── Paragraph ──────────────────────────────────────────────────────
        out.push(`<p>${inline(line)}</p>`);
        i++;
    }
    return out.join("");
}



// ── Native Obsidian markdown renderer ─────────────────────────────────────────
// Uses Obsidian's MarkdownRenderer for proper Mermaid, math, callouts,
// syntax highlighting, transclusions, embedded files, and footnote support.
// Falls back to the legacy markdownToHtml() if the obsidian module isn't
// reachable from this context (shouldn't happen in normal Obsidian usage).
function MarkdownContent({ source, sourcePath = "Oraculum/Oraculum.md", className = "" }) {
    const ref = dc.useRef(null);
    dc.useEffect(() => {
        const el = ref.current;
        if (!el) return;
        if (el.empty) el.empty(); else el.innerHTML = "";
        let comp = null;
        try {
            const obs = (typeof window !== "undefined" ? window.require : null)?.("obsidian");
            if (obs?.MarkdownRenderer && obs?.Component && dc.app) {
                comp = new obs.Component();
                comp.load();
                obs.MarkdownRenderer.render(dc.app, source ?? "", el, sourcePath, comp);
            } else {
                el.innerHTML = markdownToHtml(source ?? "");
            }
        } catch (e) {
            try { el.innerHTML = markdownToHtml(source ?? ""); } catch {}
        }
        return () => { try { comp?.unload?.(); } catch {} };
    }, [source, sourcePath]);
    return <div ref={ref} className={`oraculum-md ${className}`.trim()} />;
}

// ── Compact a value for localStorage so big scrape/research results
// don't bloat the persisted display history.
function compactForStorage(v, maxChars = 1500) {
    if (v == null) return v;
    try {
        const s = JSON.stringify(v);
        if (!s) return v;
        if (s.length <= maxChars) return v;
        return { _truncated: true, _size: s.length, _preview: s.slice(0, maxChars) + "…" };
    } catch { return null; }
}

// Pretty-print a tool argument or result for the collapsible card body.
function prettyJson(v, maxChars = 4000) {
    if (v == null) return "(none)";
    try {
        const s = JSON.stringify(v, null, 2);
        if (s.length <= maxChars) return s;
        return s.slice(0, maxChars) + `\n\n… (${(s.length - maxChars).toLocaleString()} more chars)`;
    } catch { return String(v); }
}

// Pretty tool name → human-readable label, e.g. "github_get_repo" → "GitHub get repo"
function prettyToolName(name) {
    if (!name) return "";
    return name.replace(/_/g, " ").replace(/^\w/, c => c.toUpperCase());
}

// ── Collapsible card for a single tool call ───────────────────────────────────
// Header always visible (icon + name + summary). Body (args + result) reveals
// on click. Falls back to plain text for legacy entries that lack name/args.
function ToolCallCard({ notice }) {
    const [open, setOpen] = dc.useState(false);
    const text = notice?.text ?? "";
    const name = notice?.name;
    const hasDetails = !!(name || notice?.args || notice?.result);

    if (!hasDetails) {
        // Legacy entries (pre-v13) only have text — render as plain notice line.
        return <div className="oraculum-bubble tool-notice">{text}</div>;
    }

    const iconMatch = String(text).match(/^(\p{Extended_Pictographic}+)/u);
    const icon      = iconMatch ? iconMatch[1] : "🔧";
    const summary   = String(text).replace(/^(\p{Extended_Pictographic}+\s*)/u, "");
    const result    = notice.result;
    const isError   = result && typeof result === "object" && result.error;

    return (
        <div className={`oraculum-tool-card${isError ? " err" : ""}`}>
            <div className="oraculum-tool-card-header" onClick={() => setOpen(o => !o)}>
                <span className="oraculum-tool-card-ico">{icon}</span>
                <span className="oraculum-tool-card-name">{prettyToolName(name)}</span>
                <span className="oraculum-tool-card-summary">{summary}</span>
                <span className="oraculum-tool-card-chev">{open ? "▾" : "▸"}</span>
            </div>
            {open && (
                <div className="oraculum-tool-card-body">
                    <div className="oraculum-tool-card-section">
                        <div className="oraculum-tool-card-label">Arguments</div>
                        <pre className="oraculum-tool-card-pre">{prettyJson(notice.args, 1500)}</pre>
                    </div>
                    <div className="oraculum-tool-card-section">
                        <div className="oraculum-tool-card-label">{isError ? "Error" : "Result"}</div>
                        <pre className={`oraculum-tool-card-pre${isError ? " err" : ""}`}>{prettyJson(result, 3000)}</pre>
                    </div>
                </div>
            )}
        </div>
    );
}

// ── Collapsible group of consecutive tool calls ───────────────────────────────
function ToolGroup({ notices, open, onToggle }) {
    const names = Array.from(new Set(notices.map(n => n.notice.name).filter(Boolean))).slice(0, 4).join(" · ");
    return (
        <div className={`oraculum-tool-group${open ? " open" : ""}`} data-open={String(open)}>
            <div
                className="oraculum-tool-group-summary"
                role="button"
                tabIndex={0}
                onClick={onToggle}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onToggle(); } }}
            >
                <span className="oraculum-tool-group-chev">{open ? "▾" : "▸"}</span>
                <span className="oraculum-tool-group-icon">🔧</span>
                <span>{notices.length} tool call{notices.length !== 1 ? "s" : ""}</span>
                <span className="oraculum-tool-group-meta">{names}</span>
            </div>
            <div className="oraculum-tool-group-body">
                {notices.map(({ notice, origIdx }) => (
                    <ToolCallCard key={origIdx} notice={notice} />
                ))}
            </div>
        </div>
    );
}

function formatTime(ts) {
    if (!ts) return "";
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

// ── API Key Setup sub-component ──────────────────────────────────────────
function KeySetup({ onSaved }) {
    const [keyInput, setKeyInput] = dc.useState("");
    const [testing,  setTesting]  = dc.useState(false);
    const [err, setErr]           = dc.useState(null);

    async function handleSave() {
        const k = keyInput.trim();
        if (!k) { setErr("Please paste your Gemini API key."); return; }
        G.saveApiKey(k);
        setTesting(true);
        setErr(null);
        try {
            await G.generateContent(
                [{ role: "user", parts: [{ text: "hi" }] }],
                null,
                "Reply with one word."
            );
            onSaved();
        } catch (e) {
            G.clearApiKey();
            setErr(`Key rejected by Gemini: ${e.message}`);
        } finally {
            setTesting(false);
        }
    }

    return (
        <div className="oraculum-key-outer">
            <div className="oraculum-key-card">
                <div className="oraculum-key-icon">🔮</div>
                <div className="oraculum-key-title">Welcome to Oraculum</div>
                <div className="oraculum-key-subtitle">
                    Your AI assistant, embedded directly in your vault.<br/>
                    Connect with a free Gemini API key to get started.
                </div>
                <div className="oraculum-key-field">
                    <span className="oraculum-key-label">Gemini API Key</span>
                    <input
                        type="password"
                        className="oraculum-key-input"
                        placeholder="AIzaSy…"
                        value={keyInput}
                        onInput={e => setKeyInput(e.target.value)}
                        onKeyDown={e => e.key === "Enter" && handleSave()}
                        autoFocus
                    />
                </div>
                {err && <div className="oraculum-error">{err}</div>}
                <button
                    className="oraculum-key-submit"
                    onClick={handleSave}
                    disabled={!keyInput.trim() || testing}
                >
                    {testing ? "Checking key…" : "Connect to Gemini"}
                </button>
                <div className="oraculum-key-hint">
                    Get your key free at <strong>aistudio.google.com</strong> → Get API key<br/>
                    Stored in browser localStorage — never written to your vault.
                </div>
            </div>
        </div>
    );
}

// Module-level constant — must live here (not inside the component) to avoid
// the TDZ error that occurs when a stale setTimeout fires during Datacore hot-reload
// before the component's const declarations have been initialized.
const MAX_CONTEXT_TURNS   = 10;
const AUTO_SUMMARIZE_AT   = 8;   // trigger summarization when user turns exceed this
const SUMMARIZE_KEEP_LAST = 4;   // keep the most recent N user turns verbatim
const SESSIONS_DIR        = "Systems/Oraculum/Sessions";

return function Oraculum() {
    const [hasKey, setHasKey]         = dc.useState(() => !!G.getApiKey());
    const [messages, setMessages]     = dc.useState(() => {
        try { return JSON.parse(localStorage.getItem("oraculum:messages") ?? "[]"); } catch { return []; }
    });
    const [display, setDisplay]       = dc.useState(() => {
        try { return JSON.parse(localStorage.getItem("oraculum:display") ?? "[]"); } catch { return []; }
    });
    const [input, setInput]           = dc.useState("");
    const [loading, setLoading]       = dc.useState(false);
    const [error, setError]           = dc.useState(null);
    const [model, setModelState]      = dc.useState(() => G.getModel());
    const [attachNote, setAttachNote] = dc.useState("");
    const [showAttach, setShowAttach] = dc.useState(false);
    const [copied, setCopied]         = dc.useState(null);
    const [changelog, setChangelog]   = dc.useState(() => {
        try { return JSON.parse(localStorage.getItem("oraculum:changelog") ?? "[]"); } catch { return []; }
    });
    const [changelogFilter, setChangelogFilter] = dc.useState("all");
    const [liveToolLabel,   setLiveToolLabel]   = dc.useState("");
    const [summarizing,     setSummarizing]     = dc.useState(false);

    // ── Research extra state ──────────────────────────────────────────────────
    const [researchDepth,        setResearchDepth]        = dc.useState("standard");
    const [researchAddTopic,     setResearchAddTopic]     = dc.useState("");
    const [researchAddRationale, setResearchAddRationale] = dc.useState("");
    const [researchMemorySaving, setResearchMemorySaving] = dc.useState(null); // id being saved
    const [researchDeleting,     setResearchDeleting]     = dc.useState(null); // id being deleted

    // ── Skills extra state ────────────────────────────────────────────────────
    const [showSkillForm,   setShowSkillForm]   = dc.useState(false);
    const [skillNewTitle,   setSkillNewTitle]   = dc.useState("");
    const [skillNewDesc,    setSkillNewDesc]    = dc.useState("");
    const [skillNewPriority,setSkillNewPriority]= dc.useState(50);
    const [skillNewBody,    setSkillNewBody]    = dc.useState("");
    const [promptPreview,   setPromptPreview]   = dc.useState(false);
    const [promptPreviewText, setPromptPreviewText] = dc.useState("");

    // ── Settings state ────────────────────────────────────────────────────────
    const [view,          setView]          = dc.useState("chat");
    const [settingsTab,   setSettingsTab]   = dc.useState("skills");
    const [skills,        setSkills]        = dc.useState([]);
    const [skillsBusy,    setSkillsBusy]    = dc.useState(false);
    const [researchQueue, setResearchQueue] = dc.useState([]);
    const [researchResults, setResearchResults] = dc.useState([]);
    const [researchStats,   setResearchStats]   = dc.useState({ queued:0, researched:0, cache_entries:0, cache_bytes:0 });
    const [researchBusy,    setResearchBusy]    = dc.useState(false);
    const [researchSearch,  setResearchSearch]  = dc.useState("");
    const [researchExpanded, setResearchExpanded] = dc.useState({}); // { [id]: true }
    // Tool-group open state, lifted here so it survives ToolGroup remounts during streaming.
    // Keys are timestamp-based ("tg-<timestamp>") so they never collide across sessions
    // or across chat clears. Persisted to localStorage so collapsed state survives page reloads.
    const [toolGroupOpen, setToolGroupOpen] = dc.useState(() => {
        try {
            const saved = JSON.parse(localStorage.getItem("oraculum:tg-open") ?? "{}");
            // Drop any old position-based keys (digits only after "tg-") — they caused collisions.
            // Timestamp-based keys are 13+ digits; position-based were ≤4 digits.
            const clean = Object.fromEntries(Object.entries(saved).filter(([k]) => /^tg-\d{10,}$/.test(k)));
            return clean;
        } catch { return {}; }
    });
    const toggleToolGroup = (key) => setToolGroupOpen(prev => {
        const next = { ...prev, [key]: !(prev[key] ?? true) };
        try { localStorage.setItem("oraculum:tg-open", JSON.stringify(next)); } catch {}
        return next;
    });
    const [scraperDraft,  setScraperDraft]  = dc.useState(() => parseInt(localStorage.getItem("oraculum:scraper-limit")) || 12000);
    const [searchLimitDraft, setSearchLimitDraft] = dc.useState(() => parseInt(localStorage.getItem("oraculum:search-limit")) || 15);
    const [supadataKeyInput, setSupadataKeyInput] = dc.useState(() => T.getSupadataKey() ? "••••••••••••••••" : "");
    const [supadataSaving,   setSupadataSaving]   = dc.useState(false);
    const [geminiKeyInput,   setGeminiKeyInput]   = dc.useState(() => G.getApiKey() ? "••••••••••••••••" : "");
    const [geminiSaving,     setGeminiSaving]     = dc.useState(false);
    const [githubKeyInput,    setGithubKeyInput]    = dc.useState(() => T.getGithubToken()            ? "••••••••••••••••" : "");
    const [stackExKeyInput,   setStackExKeyInput]   = dc.useState(() => T.getStackExKey()              ? "••••••••••••••••" : "");
    const [googleBooksKeyInput, setGoogleBooksKeyInput] = dc.useState(() => T.getGoogleBooksKey()      ? "••••••••••••••••" : "");
    const [openLibraryEmailInput, setOpenLibraryEmailInput] = dc.useState(() => T.getOpenLibraryEmail() ? "••••••••••••••••" : "");
    const [toolSearch,      setToolSearch]      = dc.useState("");
    const [expandedTool,    setExpandedTool]    = dc.useState(null);
    const [systemFilter,    setSystemFilter]    = dc.useState("all");
    const [categoryFilter,  setCategoryFilter]  = dc.useState("all");
    const [disabledTools,   setDisabledToolsState] = dc.useState(() => new Set(T.getDisabledTools()));
    const [memoryFiles,     setMemoryFiles]     = dc.useState([]);
    const [settingsSaved,   setSettingsSaved]   = dc.useState(null);

    // ── Profile state ─────────────────────────────────────────────────────────
    const [contextDates,  setContextDates]  = dc.useState({vault:null,cogito:null,anima:null,fabrica:null});

    // ── Semantic Index state ──────────────────────────────────────────────────
    const [indexStats,       setIndexStats]       = dc.useState(null);
    const [indexing,         setIndexing]         = dc.useState(false);
    const [indexProgress,    setIndexProgress]    = dc.useState(null);
    const [testQuery,        setTestQuery]        = dc.useState("");
    const [testResults,      setTestResults]      = dc.useState(null);
    const [testSearching,    setTestSearching]    = dc.useState(false);
    const [excludedFolders,  setExcludedFolders_] = dc.useState(() => E.getExcludedFolders().join("\n"));
    const [browseNotes,      setBrowseNotes]      = dc.useState(null);
    const [browseFilter,     setBrowseFilter]     = dc.useState("");

    // ── Session log state ─────────────────────────────────────────────────────
    const [sessions,        setSessions]        = dc.useState([]);
    const [sessionsLoading, setSessionsLoading] = dc.useState(false);

    const bottomRef  = dc.useRef(null);
    const historyRef = dc.useRef(null);
    const wrapRef    = dc.useRef(null);
    const abortRef   = dc.useRef(null);
    const retryRef   = dc.useRef(null);

    dc.useEffect(() => {
        const el = historyRef.current;
        if (el) el.scrollTop = el.scrollHeight;
    }, [display, loading]);

    // ── On mount: hydrate synced settings from vault file (Obsidian Sync) ────
    dc.useEffect(() => {
        (async () => {
            const saved = await S.loadSettings();
            if (saved.scraperLimit != null) {
                localStorage.setItem("oraculum:scraper-limit", String(saved.scraperLimit));
                setScraperDraft(saved.scraperLimit);
            }
            if (saved.searchLimit != null) {
                localStorage.setItem("oraculum:search-limit", String(saved.searchLimit));
                setSearchLimitDraft(saved.searchLimit);
            }
            if (Array.isArray(saved.excludedFolders)) {
                E.setExcludedFolders(saved.excludedFolders);
                setExcludedFolders_(saved.excludedFolders.join("\n"));
            }
        })();
    }, []);

    // ── Load Settings panel data when tab becomes visible ─────────────────
    dc.useEffect(() => {
        if (view !== "settings") return;
        if (settingsTab === "skills") {
            Sk.listSkills().then(setSkills).catch(e => console.warn("Skills load:", e));
        }
        if (settingsTab === "sessions") {
            loadSessions();
        }
        if (settingsTab === "research") {
            Promise.all([R.getQueue(), R.getResults(), R.getStats()])
                .then(([q, r, st]) => {
                    setResearchQueue(q);
                    setResearchResults(r.slice().reverse());
                    setResearchStats(st);
                }).catch(e => console.warn("Research load:", e));
        }
    }, [view, settingsTab]);

    // ── Fill the pane: measure available height and apply it to the wrap ──
    dc.useEffect(() => {
        const wrap = wrapRef.current;
        if (!wrap) return;

        function resize() {
            // Walk up the DOM to find the scrollable view-content pane
            const pane = wrap.closest(".view-content, .markdown-reading-view") ?? document.body;
            const available = pane.getBoundingClientRect().height;
            const offset    = wrap.getBoundingClientRect().top - pane.getBoundingClientRect().top;
            const target    = Math.max(500, available - offset - 16);
            wrap.style.height = target + "px";
        }

        resize();
        const ro = new ResizeObserver(resize);
        const pane = wrap.closest(".view-content, .markdown-reading-view") ?? document.body;
        ro.observe(pane);
        return () => ro.disconnect();
    }, [hasKey, view]);

    // ── Context turns counter ──────────────────────────────────────────────
    const ctxUserTurns = dc.useMemo(
        () => messages.filter(m => m.role === "user").length,
        [messages]
    );

    if (!hasKey) return <KeySetup onSaved={() => setHasKey(true)} />;

    // ── Inline Settings view ──────────────────────────────────────────────────
    if (view === "settings") {
        const allTools = (T.TOOL_DECLARATIONS ?? []).map(t => ({
            ...t,
            ...(T.TOOL_METADATA?.[t.name] ?? {}),
        }));
        const q = toolSearch.toLowerCase();
        const visibleTools = allTools.filter(t => {
            if (systemFilter   !== "all" && t.system   !== systemFilter)   return false;
            if (categoryFilter !== "all" && t.category !== categoryFilter) return false;
            if (q && !t.name.includes(q) && !t.description.toLowerCase().includes(q)) return false;
            return true;
        });

        const githubKey          = makeKeyHandlers(githubKeyInput,          setGithubKeyInput,          T.saveGithubToken,          T.clearGithubToken,          "GitHub PAT");
        const stackExKey         = makeKeyHandlers(stackExKeyInput,         setStackExKeyInput,         T.saveStackExKey,           T.clearStackExKey,           "Stack Exchange key");
        const googleBooksKey     = makeKeyHandlers(googleBooksKeyInput,     setGoogleBooksKeyInput,     T.saveGoogleBooksKey,       T.clearGoogleBooksKey,       "Google Books key");
        const openLibraryEmail   = makeKeyHandlers(openLibraryEmailInput,   setOpenLibraryEmailInput,   T.saveOpenLibraryEmail,     T.clearOpenLibraryEmail,     "Open Library email");

        return (
            <div className="oraculum-outer">
            <div className="oraculum-wrap" ref={wrapRef}>
                <div className="oraset-panel" style={{padding:"0 16px 24px"}}>
                    <div className="oraset-header" style={{padding:"14px 0 12px"}}>
                        <button className="oraculum-icon-btn" onClick={() => setView("chat")} title="Back to chat">← Back</button>
                        <span className="oraset-title">⚙️ Settings</span>
                        {settingsSaved && <span className="oraset-saved">✓ {settingsSaved}</span>}
                    </div>

                    <div className="oraset-nav">
                        {(() => {
                            const SETTINGS_NAV = [
                                { group: "chat",      label: "💬 Chat",      tabs: [
                                    { id: "skills",       label: "Skills" },
                                    { id: "sessions",     label: "Sessions" },
                                    { id: "profile",      label: "Profile" },
                                    { id: "config",       label: "Behavior" },
                                ]},
                                { group: "knowledge", label: "📚 Knowledge", tabs: [
                                    { id: "research",     label: "Research" },
                                    { id: "index",        label: "Semantic Index" },
                                    { id: "memory",       label: "Memory" },
                                ]},
                                { group: "system",    label: "⚙️ System",    tabs: [
                                    { id: "keys",         label: "API Keys" },
                                    { id: "tools",        label: `Tools (${visibleTools.length}/${allTools.length})` },
                                    { id: "integrations", label: "Integrations" },
                                    { id: "about",        label: "About" },
                                ]},
                            ];
                            const currentGroup = SETTINGS_NAV.find(g => g.tabs.some(t => t.id === settingsTab))?.group ?? "chat";
                            const groupDef     = SETTINGS_NAV.find(g => g.group === currentGroup);
                            return (
                                <>
                                    <div className="oraset-nav-top">
                                        {SETTINGS_NAV.map(g => (
                                            <button
                                                key={g.group}
                                                className={`oraset-nav-top-btn${currentGroup === g.group ? " active" : ""}`}
                                                onClick={() => {
                                                    // Switch to first tab of clicked group
                                                    if (currentGroup !== g.group) setSettingsTab(g.tabs[0].id);
                                                }}
                                            >{g.label}</button>
                                        ))}
                                    </div>
                                    <div className="oraset-tabs">
                                        {groupDef.tabs.map(t => (
                                            <button key={t.id} className={`oraset-tab${settingsTab===t.id?" active":""}`} onClick={async () => {
                                                setSettingsTab(t.id);
                                                if (t.id === "index") E.getIndexStats().then(setIndexStats).catch(() => setIndexStats({ total:0, stale:0, lastUpdated:null }));
                                                if (t.id === "skills") {
                                                    try { setSkills(await Sk.listSkills()); } catch (e) { console.warn(e); }
                                                }
                                                if (t.id === "sessions") {
                                                    loadSessions();
                                                }
                                                if (t.id === "research") {
                                                    try {
                                                        const [q, r, st] = await Promise.all([R.getQueue(), R.getResults(), R.getStats()]);
                                                        setResearchQueue(q);
                                                        setResearchResults(r.slice().reverse());
                                                        setResearchStats(st);
                                                    } catch (e) { console.warn(e); }
                                                }
                                                if (t.id === "memory") {
                                                    try {
                                                        const files = (dc.app.vault.getMarkdownFiles?.() ?? [])
                                                            .filter(f => f.path.startsWith("Systems/Oraculum/Memory/"))
                                                            .map(f => ({ path: f.path, name: f.basename, mtime: f.stat?.mtime ?? 0 }))
                                                            .sort((a, b) => b.mtime - a.mtime);
                                                        setMemoryFiles(files);
                                                    } catch (e) { console.warn(e); setMemoryFiles([]); }
                                                }
                                                if (t.id === "profile") {
                                                    const readDate = async (path) => {
                                                        try {
                                                            const f = dc.app.vault.getAbstractFileByPath(path);
                                                            if (!f) return null;
                                                            const raw = await dc.app.vault.read(f);
                                                            const m = raw.match(/^generated:\s*(.+)$/m);
                                                            return (m && m[1].trim() !== "~") ? m[1].trim() : null;
                                                        } catch { return null; }
                                                    };
                                                    const [vault, cogito, anima, fabrica] = await Promise.all([
                                                        readDate("Systems/Oraculum/Context/Vault Intelligence.md"),
                                                        readDate("Systems/Oraculum/Context/Cogito Intelligence.md"),
                                                        readDate("Systems/Oraculum/Context/Anima Intelligence.md"),
                                                        readDate("Systems/Oraculum/Context/Fabrica Intelligence.md"),
                                                    ]);
                                                    setContextDates({ vault, cogito, anima, fabrica });
                                                }
                                            }}>{t.label}</button>
                                        ))}
                                    </div>
                                </>
                            );
                        })()}
                    </div>

                    {settingsTab === "skills" && (
                        <div className="oraset-section" style={{display:"flex",flexDirection:"column",gap:"12px"}}>
                            <p className="oraset-desc" style={{fontSize:"0.82rem",color:"var(--text-muted)",margin:0,lineHeight:1.5}}>
                                Oraculum's behavior is composed from individual <b>Skills</b> stored as Markdown files in
                                <code style={{margin:"0 4px"}}>Systems/Oraculum/Skills/</code>. Lower priority numbers appear earlier
                                in the assembled prompt. Locked skills (🔒) cannot be disabled. Click <b>Edit</b> to open the
                                full skill file in Obsidian.
                            </p>
                            {skills.length === 0 && (
                                <div className="oraset-desc" style={{padding:"12px",background:"var(--background-secondary)",borderRadius:"8px"}}>No skills found in Systems/Oraculum/Skills/. The fallback prompt is in use.</div>
                            )}
                            <div style={{display:"flex",flexDirection:"column",gap:"8px"}}>
                                {skills.map(sk => (
                                    <div key={sk.name} style={{
                                        display:"grid",
                                        gridTemplateColumns:"auto 1fr auto auto auto",
                                        gap:"10px",
                                        alignItems:"center",
                                        padding:"10px 12px",
                                        background:"var(--background-secondary)",
                                        border:"1px solid var(--background-modifier-border)",
                                        borderRadius:"8px",
                                        opacity: (sk.enabled || sk.locked) ? 1 : 0.55,
                                    }}>
                                        <input
                                            type="checkbox"
                                            checked={sk.enabled || sk.locked}
                                            disabled={sk.locked || skillsBusy}
                                            onChange={async e => {
                                                setSkillsBusy(true);
                                                try {
                                                    await Sk.updateSkillMeta(sk.name, { enabled: e.target.checked });
                                                    setSkills(await Sk.listSkills());
                                                } finally { setSkillsBusy(false); }
                                            }}
                                        />
                                        <div style={{display:"flex",flexDirection:"column",minWidth:0}}>
                                            <div style={{fontWeight:600,fontSize:"0.88rem",display:"flex",gap:"6px",alignItems:"center"}}>
                                                {sk.locked && <span title="Locked — always enabled">🔒</span>}
                                                {sk.title}
                                            </div>
                                            {sk.description && (
                                                <div style={{fontSize:"0.78rem",color:"var(--text-muted)",lineHeight:1.4}}>{sk.description}</div>
                                            )}
                                            <div style={{fontSize:"0.72rem",color:"var(--text-faint)",fontFamily:"var(--font-monospace)"}}>{sk.name}</div>
                                        </div>
                                        <label style={{fontSize:"0.78rem",color:"var(--text-muted)"}}>priority</label>
                                        <input
                                            type="number"
                                            value={sk.priority}
                                            min={0}
                                            max={999}
                                            step={5}
                                            disabled={skillsBusy}
                                            style={{width:"66px",padding:"4px 6px",fontSize:"0.82rem",background:"var(--background-primary-alt)",border:"1px solid var(--background-modifier-border)",borderRadius:"6px",color:"var(--text-normal)"}}
                                            onChange={async e => {
                                                const v = Math.max(0, Math.min(999, Number(e.target.value) || 0));
                                                setSkillsBusy(true);
                                                try {
                                                    await Sk.updateSkillMeta(sk.name, { priority: v });
                                                    setSkills(await Sk.listSkills());
                                                } finally { setSkillsBusy(false); }
                                            }}
                                        />
                                        <button className="oraset-btn" onClick={() => Sk.openSkill(sk.name)}>Edit</button>
                                    </div>
                                ))}
                            </div>
                            <div className="oraset-row" style={{display:"flex",gap:"8px",alignItems:"center"}}>
                                <button className="oraset-btn" onClick={async () => setSkills(await Sk.listSkills())}>Refresh</button>
                                <button className="oraset-btn" onClick={() => setShowSkillForm(v => !v)}>
                                    {showSkillForm ? "↑ Cancel" : "+ New Skill"}
                                </button>
                                <button className="oraset-btn" onClick={async () => {
                                    const text = await Sk.assemble({ today });
                                    navigator.clipboard.writeText(text);
                                    flashSaved(`Copied assembled prompt (${text.length.toLocaleString()} chars)`);
                                }}>Copy assembled prompt</button>
                                <button className="oraset-btn" onClick={async () => {
                                    if (promptPreview) { setPromptPreview(false); return; }
                                    const text = await Sk.assemble({ today });
                                    setPromptPreviewText(text);
                                    setPromptPreview(true);
                                }}>{promptPreview ? "Hide preview" : "Preview prompt"}</button>
                                <span className="oraset-desc" style={{fontSize:"0.78rem",color:"var(--text-muted)"}}>
                                    {skills.filter(s => s.enabled || s.locked).length} of {skills.length} active
                                </span>
                            </div>
                            {promptPreview && (
                                <div>
                                    <div style={{fontSize:"0.75rem",color:"var(--text-muted)",marginBottom:"4px"}}>Assembled system prompt ({promptPreviewText.length.toLocaleString()} chars):</div>
                                    <pre className="oraset-prompt-preview">{promptPreviewText}</pre>
                                </div>
                            )}
                            {showSkillForm && (
                                <div style={{display:"flex",flexDirection:"column",gap:"8px",padding:"12px",background:"var(--background-primary-alt)",border:"1px solid var(--interactive-accent)",borderRadius:"8px"}}>
                                    <div style={{fontWeight:600,fontSize:"0.88rem"}}>New Skill</div>
                                    <div style={{display:"grid",gridTemplateColumns:"1fr auto",gap:"8px"}}>
                                        <input
                                            style={{background:"var(--background-primary-alt)",border:"1px solid var(--background-modifier-border)",borderRadius:"6px",padding:"5px 10px",fontSize:"0.85rem",color:"var(--text-normal)"}}
                                            placeholder="Title (e.g. Respond in French)"
                                            value={skillNewTitle}
                                            onInput={e => setSkillNewTitle(e.target.value)}
                                        />
                                        <input
                                            type="number"
                                            min={0} max={999} step={5}
                                            style={{width:"72px",background:"var(--background-primary-alt)",border:"1px solid var(--background-modifier-border)",borderRadius:"6px",padding:"5px 8px",fontSize:"0.82rem",color:"var(--text-normal)"}}
                                            placeholder="Priority"
                                            value={skillNewPriority}
                                            onInput={e => setSkillNewPriority(Number(e.target.value))}
                                        />
                                    </div>
                                    <input
                                        style={{background:"var(--background-primary-alt)",border:"1px solid var(--background-modifier-border)",borderRadius:"6px",padding:"5px 10px",fontSize:"0.82rem",color:"var(--text-muted)"}}
                                        placeholder="Description (shown in settings)"
                                        value={skillNewDesc}
                                        onInput={e => setSkillNewDesc(e.target.value)}
                                    />
                                    <textarea
                                        style={{background:"var(--background-primary-alt)",border:"1px solid var(--background-modifier-border)",borderRadius:"6px",padding:"8px 10px",fontSize:"0.82rem",color:"var(--text-normal)",fontFamily:"var(--font-monospace)",minHeight:"80px",resize:"vertical"}}
                                        placeholder="Skill body — instructions for the AI (Markdown)"
                                        value={skillNewBody}
                                        onInput={e => setSkillNewBody(e.target.value)}
                                    />
                                    <div style={{display:"flex",gap:"8px"}}>
                                        <button className="oraset-btn primary" disabled={!skillNewTitle.trim() || skillsBusy} onClick={async () => {
                                            setSkillsBusy(true);
                                            try {
                                                await Sk.createSkill({ title: skillNewTitle, description: skillNewDesc, priority: skillNewPriority, enabled: true, body: skillNewBody });
                                                setSkills(await Sk.listSkills());
                                                setShowSkillForm(false);
                                                setSkillNewTitle(""); setSkillNewDesc(""); setSkillNewPriority(50); setSkillNewBody("");
                                                flashSaved("Skill created");
                                            } catch (e) { flashSaved(`Error: ${e.message}`); }
                                            finally { setSkillsBusy(false); }
                                        }}>Create</button>
                                        <button className="oraset-btn" onClick={() => { setShowSkillForm(false); setSkillNewTitle(""); setSkillNewDesc(""); setSkillNewPriority(50); setSkillNewBody(""); }}>Cancel</button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {settingsTab === "research" && (
                        <div className="oraset-section oraset-research">
                            <p className="oraset-desc">
                                <strong>Deep Research</strong> uses Gemini 2.5 Flash with Google Search grounding. Topics are queued during conversation and fired as a single batch when you say "go". Results persist to <code>Systems/Oraculum/Data/research_results.json</code> and are cached for 30 days.
                            </p>

                            <div className="oraset-research-kpis">
                                {[
                                    ["Queued",     researchQueue.length],
                                    ["Researched", researchStats.researched ?? researchResults.length],
                                    ["Memory",     `${researchStats.memory_notes ?? 0} notes`],
                                    ["Cache",      `${researchStats.cache_entries} entries (${(researchStats.cache_bytes/1024).toFixed(0)}KB)`],
                                ].map(([k,v]) => (
                                    <div key={k} className="oraset-research-kpi">
                                        <div className="oraset-research-kpi-k">{k}</div>
                                        <div className="oraset-research-kpi-v">{v}</div>
                                    </div>
                                ))}
                            </div>

                            <div>
                                <div className="oraset-research-section-header">
                                    <h3 className="oraset-research-h3">Queue ({researchQueue.length})</h3>
                                    <div className="oraset-research-actions">
                                        <select
                                            value={researchDepth}
                                            onChange={e => setResearchDepth(e.target.value)}
                                            className="oraset-research-select"
                                            disabled={researchBusy}
                                        >
                                            <option value="shallow">Shallow</option>
                                            <option value="standard">Standard</option>
                                            <option value="deep">Deep</option>
                                        </select>
                                        <button className="oraset-btn" disabled={researchBusy || researchQueue.length === 0} onClick={async () => {
                                            if (!confirm(`Fire all ${researchQueue.length} queued topics? This uses 1 Gemini call (all topics batched).`)) return;
                                            setResearchBusy(true);
                                            try {
                                                const out = await R.runBatch(researchQueue, { depth: researchDepth });
                                                const [q, r, st] = await Promise.all([R.getQueue(), R.getResults(), R.getStats()]);
                                                setResearchQueue(q); setResearchResults(r.slice().reverse()); setResearchStats(st);
                                                flashSaved(out.skipped?.length ? `Researched ${out.results.length} topics (${out.skipped.length} cached)` : `Researched ${out.results.length} topics via Gemini`);
                                            } catch (e) { flashSaved(`Error: ${e.message}`); }
                                            finally { setResearchBusy(false); }
                                        }}>{researchBusy ? "Researching…" : `Fire all (${researchDepth})`}</button>
                                        <button className="oraset-btn" disabled={researchQueue.length === 0} onClick={async () => {
                                            if (!confirm(`Clear all ${researchQueue.length} queued topics?`)) return;
                                            await R.clearQueue();
                                            setResearchQueue([]);
                                            setResearchStats(await R.getStats());
                                        }}>Clear queue</button>
                                    </div>
                                </div>
                                {researchQueue.length === 0 && (
                                    <div className="oraset-desc oraset-research-empty">Queue is empty. Mention any technology, paper, or concept in chat and Oraculum will queue it.</div>
                                )}
                                <div className="oraset-research-list">
                                    {researchQueue.map(q => (
                                        <div key={q.id} className="oraset-research-queue-row">
                                            <div className="oraset-research-queue-body">
                                                <div className="oraset-research-queue-topic">{q.topic}</div>
                                                {q.rationale && <div className="oraset-research-queue-rat">{q.rationale}</div>}
                                                <div className="oraset-research-queue-time">{new Date(q.queued_at).toLocaleString()}</div>
                                            </div>
                                            <button className="oraset-icon-btn" title="Remove" onClick={async () => {
                                                await R.removeFromQueue(q.id);
                                                setResearchQueue(await R.getQueue());
                                                setResearchStats(await R.getStats());
                                            }}>✕</button>
                                        </div>
                                    ))}
                                </div>

                                {/* Manual add-topic form */}
                                <div className="oraset-research-add-form" style={{marginTop:"8px"}}>
                                    <div className="oraset-research-add-label">Add topic manually</div>
                                    <input
                                        className="oraset-research-input"
                                        placeholder="Topic (e.g. NativeAOT, Raft consensus)"
                                        value={researchAddTopic}
                                        onInput={e => setResearchAddTopic(e.target.value)}
                                    />
                                    <input
                                        className="oraset-research-input muted"
                                        placeholder="Rationale (optional)"
                                        value={researchAddRationale}
                                        onInput={e => setResearchAddRationale(e.target.value)}
                                    />
                                    <button className="oraset-btn" disabled={!researchAddTopic.trim()} onClick={async () => {
                                        if (!researchAddTopic.trim()) return;
                                        await R.queueTopic({ topic: researchAddTopic.trim(), rationale: researchAddRationale.trim() });
                                        setResearchAddTopic(""); setResearchAddRationale("");
                                        const [q2, st2] = await Promise.all([R.getQueue(), R.getStats()]);
                                        setResearchQueue(q2); setResearchStats(st2);
                                    }}>+ Add to queue</button>
                                </div>
                            </div>

                            <div style={{display:"flex",flexDirection:"column",gap:"8px"}}>
                                <div className="oraset-research-section-header">
                                    <h3 className="oraset-research-h3">Past results ({researchResults.length})</h3>
                                </div>
                                <input
                                    className="oraset-research-search"
                                    placeholder={`Search ${researchResults.length} results…`}
                                    value={researchSearch}
                                    onInput={e => setResearchSearch(e.target.value)}
                                />
                                <div className="oraset-research-list">
                                    {researchResults
                                        .filter(r => !researchSearch || r.topic.toLowerCase().includes(researchSearch.toLowerCase()) || r.summary?.toLowerCase().includes(researchSearch.toLowerCase()))
                                        .map(r => {
                                            const isOpen = !!researchExpanded[r.id];
                                            return (
                                            <div key={r.id} className="oraset-research-result">
                                                <div
                                                    className="oraset-research-result-head"
                                                    onClick={() => setResearchExpanded(s => ({ ...s, [r.id]: !s[r.id] }))}
                                                >
                                                    <span className="oraset-research-result-topic">{r.topic}</span>
                                                    <div className="oraset-research-result-meta">
                                                        <span className="oraset-research-result-depth">{r.depth}</span>
                                                        <span className="oraset-research-result-date">{new Date(r.ran_at).toLocaleDateString()}</span>
                                                        <span className="oraset-research-result-chev">{isOpen ? "▲" : "▼"}</span>
                                                    </div>
                                                </div>
                                                {isOpen && (
                                                <div className="oraset-research-result-body">
                                                    {r.summary && <p className="oraset-research-result-summary">{r.summary}</p>}
                                                    {(r.findings || []).map((f, i) => (
                                                        <div key={i} className="oraset-research-finding">
                                                            <div className="oraset-research-finding-h">{f.heading}</div>
                                                            <div className="oraset-research-finding-b">{f.body}</div>
                                                        </div>
                                                    ))}
                                                    {(r.citations || []).length > 0 && (
                                                        <div className="oraset-research-citations">
                                                            {r.citations.slice(0,5).map((c, i) => <a key={i} href={c.uri} target="_blank" rel="noopener">[{c.index}] {c.title || c.uri}</a>)}
                                                        </div>
                                                    )}
                                                    <div className="oraset-research-result-actions">
                                                        <button className="oraset-btn" disabled={researchMemorySaving === r.id} onClick={async () => {
                                                            setResearchMemorySaving(r.id);
                                                            try {
                                                                await R.saveToMemory(r);
                                                                flashSaved(`Saved to Oraculum/Memory`);
                                                                setResearchStats(await R.getStats());
                                                            } catch (e) { flashSaved(`Error: ${e.message}`); }
                                                            finally { setResearchMemorySaving(null); }
                                                        }}>{researchMemorySaving === r.id ? "Saving…" : "💾 Save to Memory"}</button>
                                                        <button className="oraset-btn danger" disabled={researchDeleting === r.id} onClick={async () => {
                                                            if (!confirm(`Delete result for "${r.topic}"?`)) return;
                                                            setResearchDeleting(r.id);
                                                            try {
                                                                await R.deleteResult(r.id);
                                                                const [r2, st2] = await Promise.all([R.getResults(), R.getStats()]);
                                                                setResearchResults(r2.slice().reverse());
                                                                setResearchStats(st2);
                                                            } catch (e) { flashSaved(`Error: ${e.message}`); }
                                                            finally { setResearchDeleting(null); }
                                                        }}>{researchDeleting === r.id ? "Deleting…" : "🗑 Delete"}</button>
                                                    </div>
                                                </div>
                                                )}
                                            </div>
                                        );})}
                                </div>
                            </div>
                        </div>
                    )}

                    {settingsTab === "tools" && (
                        <div className="oraset-section" style={{display:"flex",flexDirection:"column",gap:"12px"}}>
                            <p className="oraset-desc">Browse, filter, and selectively disable tools. Disabled tools are hidden from the model — they won't appear in its tool palette and can't be called this session.</p>
                            <div className="oraset-filters">
                                <div className="oraset-filter-row">
                                    <span className="oraset-filter-label">System</span>
                                    {["all","any","Anima","Cogito","Fabrica","Vault","Web","Oraculum"].map(s => (
                                        <button key={s} className={`oraset-filter-pill${systemFilter===s?" active":""}`} onClick={() => setSystemFilter(s)}>{s==="all"?"All":s}</button>
                                    ))}
                                </div>
                                <div className="oraset-filter-row">
                                    <span className="oraset-filter-label">Category</span>
                                    {["all","search","create","update","analyze","web","research"].map(c => (
                                        <button key={c} className={`oraset-filter-pill${categoryFilter===c?" active":""}`} onClick={() => setCategoryFilter(c)}>{c==="all"?"All":c}</button>
                                    ))}
                                </div>
                            </div>
                            <input
                                className="oraset-search"
                                placeholder={`Search ${allTools.length} tools…`}
                                value={toolSearch}
                                onInput={evt => setToolSearch(evt.target.value)}
                            />
                            <div className="oraset-toolbar-row">
                                <span className="oraset-meta">
                                    {visibleTools.length} of {allTools.length} shown · {disabledTools.size} disabled
                                </span>
                                <button className="oraset-btn" onClick={() => setAllToolsEnabled(true,  visibleTools.map(t => t.name))}>Enable all visible</button>
                                <button className="oraset-btn" onClick={() => setAllToolsEnabled(false, visibleTools.map(t => t.name))}>Disable all visible</button>
                            </div>
                            <div className="oraset-tools">
                                {visibleTools.map(tool => {
                                    const isDisabled = disabledTools.has(tool.name);
                                    return (
                                        <div key={tool.name} className={`oraset-tool-card${isDisabled ? " is-disabled" : ""}`}>
                                            <div className="oraset-tool-header" onClick={() => setExpandedTool(expandedTool === tool.name ? null : tool.name)}>
                                                <label className="oraset-tool-switch" onClick={e => e.stopPropagation()}>
                                                    <input type="checkbox" checked={!isDisabled} onChange={() => toggleTool(tool.name)} />
                                                    <span className="oraset-tool-switch-track" />
                                                </label>
                                                <span className="oraset-tool-name">{tool.name}</span>
                                                <div className="oraset-tool-badges">
                                                    {tool.system   && <span className={`oraset-tool-badge sys-${tool.system.toLowerCase()}`}>{tool.system}</span>}
                                                    {tool.category && <span className="oraset-tool-badge cat">{tool.category}</span>}
                                                    <span className="oraset-tool-toggle">{expandedTool === tool.name ? "▲" : "▼"}</span>
                                                </div>
                                            </div>
                                            <div className="oraset-tool-desc">{tool.description}</div>
                                            {expandedTool === tool.name && tool.parameters?.properties && (
                                                <div className="oraset-tool-params">
                                                    <div className="oraset-params-title">Parameters</div>
                                                    {Object.entries(tool.parameters.properties).map(([k, v]) => (
                                                        <div key={k} className="oraset-param-row">
                                                            <span className="oraset-param-name">{k}</span>
                                                            <span className="oraset-param-type">{v.type}</span>
                                                            {(tool.parameters.required ?? []).includes(k) && <span className="oraset-param-req">required</span>}
                                                            {v.description && <span className="oraset-param-desc">{v.description}</span>}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                                {visibleTools.length === 0 && (
                                    <p className="oraset-desc">No tools match the current filters.{" "}
                                        <button className="oraset-btn" style={{display:"inline",padding:"1px 8px"}} onClick={() => { setSystemFilter("all"); setCategoryFilter("all"); setToolSearch(""); }}>Clear filters</button>
                                    </p>
                                )}
                            </div>
                        </div>
                    )}

                    {settingsTab === "config" && (
                        <div className="oraset-section" style={{display:"flex",flexDirection:"column",gap:"12px"}}>
                            <p className="oraset-desc">Tune how Oraculum reads from the web and your vault. API keys live in their own tab now.</p>
                            <div className="oraset-config-row">
                                <span className="oraset-label">Scraper default char limit</span>
                                <p className="oraset-desc">How much text <code>scrape_webpage</code> fetches per page by default. Higher = richer context but uses more of the model's context window. Gemma 4 supports 100k+ tokens; ~4 chars ≈ 1 token.</p>
                                <div className="oraset-row">
                                    <input type="number" className="oraset-number" min={100} step={1000} value={scraperDraft} onInput={evt => setScraperDraft(Number(evt.target.value))} />
                                    <button className="oraset-btn primary" onClick={saveScraperLimit}>Save</button>
                                    <button className="oraset-btn" onClick={resetScraperLimit}>Reset</button>
                                </div>
                            </div>
                            <div className="oraset-config-row">
                                <span className="oraset-label">Semantic search default limit</span>
                                <p className="oraset-desc">How many notes <code>semantic_search</code> returns by default when the AI doesn't specify a count. Capped at 30. The AI receives metadata only (path, title, score) — not full note content.</p>
                                <div className="oraset-row">
                                    <input type="number" className="oraset-number" min={1} max={30} step={1} value={searchLimitDraft} onInput={evt => setSearchLimitDraft(Number(evt.target.value))} />
                                    <button className="oraset-btn primary" onClick={saveSearchLimit}>Save</button>
                                    <button className="oraset-btn" onClick={resetSearchLimit}>Reset</button>
                                </div>
                            </div>
                        </div>
                    )}

                    {settingsTab === "keys" && (() => {
                        const KEY_DEFS = [
                            {
                                id: "gemini", label: "Gemini", required: true,
                                docs: "https://aistudio.google.com/apikey",
                                hint: "Required to use Oraculum. Powers chat, deep research, and image generation. Free tier is generous.",
                                placeholder: "AIza…",
                                value: geminiKeyInput, set: setGeminiKeyInput,
                                save: saveGeminiKey, clear: clearGeminiKey, has: !!G.getApiKey(),
                                saving: geminiSaving,
                            },
                            {
                                id: "supadata", label: "Supadata", required: false,
                                docs: "https://dash.supadata.ai/",
                                hint: "Required for fetch_video_transcript and fetch_social_metadata. Free tier: 100 req/day.",
                                placeholder: "sup_…",
                                value: supadataKeyInput, set: setSupadataKeyInput,
                                save: saveSupadataKey, clear: clearSupadataKey, has: !!T.getSupadataKey(),
                                saving: supadataSaving,
                            },
                            {
                                id: "github", label: "GitHub PAT", required: false,
                                docs: "https://github.com/settings/tokens",
                                hint: "Optional. Significantly raises the GitHub API rate limit. Use a fine-grained token with read-only public_repo scope.",
                                placeholder: "ghp_… or github_pat_…",
                                value: githubKeyInput, set: setGithubKeyInput,
                                save: githubKey.save, clear: githubKey.clear, has: !!T.getGithubToken(),
                            },
                            {
                                id: "stackex", label: "Stack Exchange", required: false,
                                docs: "https://stackapps.com/apps/oauth/register",
                                hint: "Optional. Raises the Stack Exchange daily quota significantly. Just the 'key' string from a registered app.",
                                placeholder: "stack-app-key",
                                value: stackExKeyInput, set: setStackExKeyInput,
                                save: stackExKey.save, clear: stackExKey.clear, has: !!T.getStackExKey(),
                            },
                            {
                                id: "googlebooks", label: "Google Books", required: false,
                                docs: "https://console.cloud.google.com/apis/library/books.googleapis.com",
                                hint: "Optional. Significantly raises the Books API daily quota.",
                                placeholder: "AIza…",
                                value: googleBooksKeyInput, set: setGoogleBooksKeyInput,
                                save: googleBooksKey.save, clear: googleBooksKey.clear, has: !!T.getGoogleBooksKey(),
                            },
                            {
                                id: "openlibrary", label: "Open Library contact email", required: false,
                                docs: "https://openlibrary.org/developers/api#rate-limits",
                                hint: "Optional. Adding your contact email to the User-Agent header identifies requests and raises the rate limit.",
                                placeholder: "you@example.com",
                                value: openLibraryEmailInput, set: setOpenLibraryEmailInput,
                                save: openLibraryEmail.save, clear: openLibraryEmail.clear, has: !!T.getOpenLibraryEmail(),
                            },
                        ];
                        return (
                            <div className="oraset-section" style={{display:"flex",flexDirection:"column",gap:"10px"}}>
                                <p className="oraset-desc">All keys are stored in browser <code>localStorage</code> only — never written to disk or synced via the vault.</p>
                                {KEY_DEFS.map(k => (
                                    <div key={k.id} className="oraset-key-row">
                                        <div className="oraset-key-row-head">
                                            <span className="oraset-key-row-label">{k.label}</span>
                                            <span className={`oraset-key-status ${k.has ? "ok" : (k.required ? "missing" : "off")}`}>
                                                {k.has ? "● set" : (k.required ? "● required" : "○ optional")}
                                            </span>
                                            <a className="oraset-key-docs" href={k.docs} target="_blank" rel="noopener">Get key ↗</a>
                                        </div>
                                        <p className="oraset-key-hint-line">{k.hint}</p>
                                        <div className="oraset-row">
                                            <input
                                                type="password"
                                                className="oraset-number"
                                                style={{flex:1,fontFamily:"var(--font-monospace)",fontSize:"0.82rem"}}
                                                placeholder={k.placeholder}
                                                value={k.value}
                                                onFocus={() => { if (k.value.startsWith("•")) k.set(""); }}
                                                onInput={evt => k.set(evt.target.value)}
                                            />
                                            <button className="oraset-btn primary" onClick={k.save} disabled={k.saving}>Save</button>
                                            {k.has && <button className="oraset-btn danger" onClick={k.clear}>Clear</button>}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        );
                    })()}

                    {settingsTab === "integrations" && (
                        <div className="oraset-section" style={{display:"flex",flexDirection:"column",gap:"10px"}}>
                            <p className="oraset-desc">Cards below summarise every external service Oraculum can call, the tools they provide, and whether their API key is set.</p>
                            <div className="oraset-int-grid">
                                {(T.INTEGRATIONS ?? []).map(integ => {
                                    const keyResolvers = {
                                        gemini:          () => !!G.getApiKey(),
                                        supadata:        () => !!T.getSupadataKey(),
                                        github:          () => !!T.getGithubToken(),
                                        stackex:         () => !!T.getStackExKey(),
                                        googlebooks:     () => !!T.getGoogleBooksKey(),
                        openlibrary:     () => !!T.getOpenLibraryEmail(),
                                    };
                                    const hasKey = integ.keyId ? (keyResolvers[integ.keyId]?.() ?? false) : null;
                                    return (
                                        <div key={integ.id} className="oraset-int-card">
                                            <div className="oraset-int-head">
                                                <span className="oraset-int-icon">{integ.icon}</span>
                                                <span className="oraset-int-label">{integ.label}</span>
                                                {integ.keyName ? (
                                                    <span className={`oraset-key-status ${hasKey ? "ok" : (integ.required ? "missing" : "off")}`}>
                                                        {hasKey ? "● key set" : (integ.required ? "● key required" : "○ optional")}
                                                    </span>
                                                ) : (
                                                    <span className="oraset-key-status ok">● no key needed</span>
                                                )}
                                            </div>
                                            <p className="oraset-int-summary">{integ.summary}</p>
                                            <div className="oraset-int-tools">
                                                {integ.tools.map(t => {
                                                    const enabled = !disabledTools.has(t);
                                                    return (
                                                        <span key={t}
                                                              className={`oraset-int-tool-chip${enabled ? "" : " off"}`}
                                                              title={enabled ? "Enabled — click to disable" : "Disabled — click to enable"}
                                                              onClick={() => toggleTool(t)}
                                                        >{t}</span>
                                                    );
                                                })}
                                            </div>
                                            <div className="oraset-int-foot">
                                                <a href={integ.docs} target="_blank" rel="noopener" className="oraset-int-docs">Docs ↗</a>
                                                {integ.keyName && (
                                                    <button className="oraset-btn" onClick={() => setSettingsTab("keys")}>{hasKey ? "Manage key" : "Add key →"}</button>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {settingsTab === "memory" && (
                        <div className="oraset-section" style={{display:"flex",flexDirection:"column",gap:"10px"}}>
                            <p className="oraset-desc">Notes saved to <code>Systems/Oraculum/Memory/</code> by <code>save_research_to_memory</code>. These are AI-generated digests of past research topics; the full structured JSON lives in <code>Systems/Oraculum/Data/Research/</code>.</p>
                            {memoryFiles.length === 0 ? (
                                <p className="oraset-desc">No memory notes yet. Run a deep research topic and save it from the Research tab.</p>
                            ) : (
                                <div className="oraset-memory-list">
                                    {memoryFiles.map(f => (
                                        <div key={f.path} className="oraset-memory-item" onClick={() => openNote(f.path)} title={f.path}>
                                            <span className="oraset-memory-icon">🧠</span>
                                            <span className="oraset-memory-title">{f.name}</span>
                                            <span className="oraset-memory-time">{f.mtime ? new Date(f.mtime).toLocaleDateString() : ""}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {settingsTab === "about" && (
                        <div className="oraset-section" style={{display:"flex",flexDirection:"column",gap:"12px"}}>
                            <div className="oraset-about-hero">
                                <div className="oraset-about-icon">🔮</div>
                                <div>
                                    <div className="oraset-about-name">Oraculum</div>
                                    <div className="oraset-about-tag">{CSS_VER} · embedded in Codex Vitae</div>
                                </div>
                            </div>
                            <div className="oraset-about-stats">
                                <div className="oraset-about-stat"><span className="n">{(T.TOOL_DECLARATIONS?.length ?? 0)}</span><span className="l">Tools</span></div>
                                <div className="oraset-about-stat"><span className="n">{(T.INTEGRATIONS?.length ?? 0)}</span><span className="l">Integrations</span></div>
                                <div className="oraset-about-stat"><span className="n">{skills.length}</span><span className="l">Skills</span></div>
                                <div className="oraset-about-stat"><span className="n">{disabledTools.size}</span><span className="l">Disabled</span></div>
                            </div>
                            <p className="oraset-desc">Oraculum is a Datacore-rendered Gemini-powered chat assistant living inside the vault. It can read, write, and create notes; run deep research; embed and search semantically; and call external services (GitHub, Wikipedia, Stack Overflow, …).</p>
                            <div className="oraset-row" style={{flexWrap:"wrap",gap:"6px"}}>
                                <button className="oraset-btn" onClick={() => openNote("Systems/Oraculum/Documentation/Integrations.md")}>📚 Integrations docs</button>
                                <button className="oraset-btn" onClick={() => openNote("Toolkit/Documentation/Copilot Context.md")}>🧭 System reference</button>
                                <button className="oraset-btn danger" onClick={forgetKey}>Forget Gemini key & restart</button>
                            </div>
                        </div>
                    )}
                    {settingsTab === "index" && (() => {
                        const stats = indexStats;
                        const total = stats?.total ?? 0;
                        const stale = stats?.stale ?? 0;
                        const lastUpdated = stats?.lastUpdated;

                        function relativeTime(ts) {
                            if (!ts) return "never";
                            const mins = Math.round((Date.now() - ts) / 60000);
                            if (mins < 1) return "just now";
                            if (mins < 60) return `${mins}m ago`;
                            const hrs = Math.round(mins / 60);
                            if (hrs < 24) return `${hrs}h ago`;
                            return `${Math.round(hrs / 24)}d ago`;
                        }

                        const statusBadge = !stats ? null
                            : total === 0    ? { label: "Empty",  color: "var(--color-red)"    }
                            : stale > 0      ? { label: "Stale",  color: "var(--color-yellow, #e5a00d)" }
                            :                  { label: "Ready",  color: "var(--color-green)"  };

                        async function runIndex(wipe) {
                            if (indexing) return;
                            if (wipe) await E.clearIndex();
                            setIndexing(true);
                            setIndexProgress({ done: 0, total: 0, current: "", indexed: 0, skipped: 0, errors: 0 });
                            try {
                                await E.indexVault(G.getApiKey(), p => setIndexProgress({ ...p }));
                            } finally {
                                setIndexing(false);
                                setIndexProgress(null);
                                E.getIndexStats().then(setIndexStats).catch(() => {});
                            }
                        }

                        async function runTestSearch() {
                            if (!testQuery.trim() || testSearching) return;
                            setTestSearching(true);
                            setTestResults(null);
                            try {
                                const res = await E.semanticSearch(testQuery.trim(), G.getApiKey(), { limit: 5 });
                                setTestResults(res);
                            } catch (e) {
                                setTestResults({ error: e.message, results: [] });
                            } finally {
                                setTestSearching(false);
                            }
                        }

                        return (
                            <div className="oraset-section" style={{display:"flex",flexDirection:"column",gap:"14px"}}>
                                {/* Stats card */}
                                <div className="oraset-config-row" style={{background:"var(--background-secondary)",border:"1px solid var(--background-modifier-border)",borderRadius:"8px",padding:"14px",display:"flex",flexDirection:"column",gap:"10px"}}>
                                    <div style={{display:"flex",alignItems:"center",gap:"10px",flexWrap:"wrap"}}>
                                        <span className="oraset-label" style={{fontWeight:600,fontSize:"0.95rem",flex:1}}>Index Status</span>
                                        {statusBadge && (
                                            <span style={{fontSize:"0.78rem",fontWeight:600,padding:"2px 10px",borderRadius:"20px",background:`color-mix(in srgb, ${statusBadge.color} 15%, transparent)`,color:statusBadge.color}}>
                                                {statusBadge.label}
                                            </span>
                                        )}
                                    </div>
                                    {!stats ? (
                                        <p className="oraset-desc" style={{margin:0,fontSize:"0.82rem",color:"var(--text-muted)"}}>Loading…</p>
                                    ) : total === 0 ? (
                                        <p className="oraset-desc" style={{margin:0,fontSize:"0.82rem",color:"var(--text-muted)"}}>No notes indexed yet. Click <strong>Update Index</strong> to build the semantic index.</p>
                                    ) : (
                                        <p className="oraset-desc" style={{margin:0,fontSize:"0.82rem",color:"var(--text-muted)"}}>
                                            <strong style={{color:"var(--text-normal)"}}>{total}</strong> notes indexed
                                            {stale > 0 && <> · <strong style={{color:"var(--color-yellow, #e5a00d)"}}>{stale} stale</strong></>}
                                            {" · "}last updated {relativeTime(lastUpdated)}
                                        </p>
                                    )}
                                    {(() => {
                                        const parsedExcl = excludedFolders.split("\n").map(s => s.trim()).filter(Boolean);
                                        const excl = parsedExcl.filter(s => !s.startsWith("!"));
                                        const incl = parsedExcl.filter(s => s.startsWith("!")).map(s => s.slice(1));
                                        const allFiles   = dc.app.vault.getMarkdownFiles();
                                        const eligibleCnt = allFiles.filter(f => {
                                            const fm = dc.app.metadataCache.getFileCache(f)?.frontmatter;
                                            if (fm?.dashboard === true) return false;
                                            if (fm?.indexed === false) return false;
                                            const blocked = excl.some(ex => f.path.startsWith(ex + "/") || f.path.startsWith(ex + "\\"));
                                            if (!blocked) return true;
                                            return incl.some(ix => f.path.startsWith(ix + "/") || f.path.startsWith(ix + "\\"));
                                        }).length;
                                        return !indexing && (
                                            <p style={{margin:0,fontSize:"0.78rem",color:"var(--text-faint)"}}>
                                                <strong style={{color:"var(--text-normal)"}}>{eligibleCnt}</strong> notes would be scanned on next index run
                                            </p>
                                        );
                                    })()}

                                    {/* Progress bar */}
                                    {indexing && indexProgress && (
                                        <div style={{display:"flex",flexDirection:"column",gap:"6px"}}>
                                            <div style={{display:"flex",justifyContent:"space-between",fontSize:"0.78rem",color:"var(--text-muted)"}}>
                                                <span>Embedding {indexProgress.current}…</span>
                                                <span>{indexProgress.done} / {indexProgress.total}</span>
                                            </div>
                                            <div style={{height:"6px",borderRadius:"3px",background:"var(--background-modifier-border)",overflow:"hidden"}}>
                                                <div style={{height:"100%",borderRadius:"3px",background:"var(--interactive-accent)",width:indexProgress.total > 0 ? `${Math.round(indexProgress.done / indexProgress.total * 100)}%` : "0%",transition:"width 0.3s"}} />
                                            </div>
                                            <div style={{fontSize:"0.75rem",color:"var(--text-faint)"}}>
                                                {indexProgress.indexed} embedded · {indexProgress.skipped} skipped · {indexProgress.errors} errors
                                            </div>
                                        </div>
                                    )}

                                    <div style={{display:"flex",gap:"8px",flexWrap:"wrap"}}>
                                        <button className="oraset-btn primary" onClick={() => runIndex(false)} disabled={indexing}>
                                            {indexing ? "Indexing…" : "Update Index"}
                                        </button>
                                        <button className="oraset-btn" onClick={() => runIndex(true)} disabled={indexing}>
                                            Re-index All
                                        </button>
                                    </div>
                                    <p className="oraset-desc" style={{margin:0,fontSize:"0.78rem",color:"var(--text-faint)"}}>
                                        <strong>Update Index</strong> — only embeds new or changed notes (rate-limited by RPM + TPM automatically).<br/>
                                        <strong>Re-index All</strong> — wipes and rebuilds from scratch. Use if topics or domains changed significantly.
                                    </p>
                                </div>

                                {/* Excluded folders card */}
                                <div className="oraset-config-row" style={{background:"var(--background-secondary)",border:"1px solid var(--background-modifier-border)",borderRadius:"8px",padding:"14px",display:"flex",flexDirection:"column",gap:"10px"}}>
                                    <span className="oraset-label" style={{fontWeight:600,fontSize:"0.95rem"}}>Excluded Folders</span>
                                    <p className="oraset-desc" style={{margin:0,fontSize:"0.82rem",color:"var(--text-muted)"}}>One folder path per line. Prefix with <code>!</code> to force-include a subfolder (e.g. <code>!Systems/Issues/Archived</code>). Notes with <code>dashboard: true</code> are always excluded. Add <code>indexed: false</code> to any note's frontmatter to exclude it individually.</p>
                                    <textarea
                                        style={{width:"100%",minHeight:"80px",background:"var(--background-primary-alt)",border:"1px solid var(--background-modifier-border)",borderRadius:"8px",padding:"8px 12px",fontSize:"0.82rem",color:"var(--text-normal)",fontFamily:"var(--font-monospace)",resize:"vertical",boxSizing:"border-box"}}
                                        value={excludedFolders}
                                        onInput={e => setExcludedFolders_(e.target.value)}
                                    />
                                    {(() => {
                                        const parsedExcl = excludedFolders.split("\n").map(s => s.trim()).filter(Boolean);
                                        const excl = parsedExcl.filter(s => !s.startsWith("!"));
                                        const incl = parsedExcl.filter(s => s.startsWith("!")).map(s => s.slice(1));
                                        const allFiles = dc.app.vault.getMarkdownFiles();
                                        const isExcl = f => {
                                            const fm = dc.app.metadataCache.getFileCache(f)?.frontmatter;
                                            if (fm?.dashboard === true) return true;
                                            if (fm?.indexed === false) return true;
                                            return excl.some(ex => f.path.startsWith(ex + "/") || f.path.startsWith(ex + "\\"))
                                                && !incl.some(ix => f.path.startsWith(ix + "/") || f.path.startsWith(ix + "\\"));
                                        };
                                        const filtered = allFiles.filter(isExcl);
                                        const eligible = allFiles.length - filtered.length;
                                        return (
                                            <p style={{margin:0,fontSize:"0.78rem",color:"var(--text-faint)"}}>
                                                <strong style={{color:"var(--color-green)"}}>{eligible}</strong> notes eligible to index
                                                {" · "}
                                                <strong style={{color:"var(--text-muted)"}}>{filtered.length}</strong> filtered out (folders + dashboards)
                                                {" · "}
                                                {allFiles.length} total in vault
                                            </p>
                                        );
                                    })()}
                                    <button className="oraset-btn primary" style={{alignSelf:"flex-start"}} onClick={async () => {
                                        const folders = excludedFolders.split("\n").map(s => s.trim()).filter(Boolean);
                                        E.setExcludedFolders(folders);
                                        await S.updateSettings({ excludedFolders: folders });
                                        new Notice("Excluded folders saved.");
                                    }}>Save</button>
                                </div>

                                {/* Test search card */}
                                <div className="oraset-config-row" style={{background:"var(--background-secondary)",border:"1px solid var(--background-modifier-border)",borderRadius:"8px",padding:"14px",display:"flex",flexDirection:"column",gap:"10px"}}>
                                    <span className="oraset-label" style={{fontWeight:600,fontSize:"0.95rem"}}>Test Search</span>
                                    <p className="oraset-desc" style={{margin:0,fontSize:"0.82rem",color:"var(--text-muted)"}}>Verify the index is working before relying on it in chat.</p>
                                    <div style={{display:"flex",gap:"8px"}}>
                                        <input
                                            className="oraset-search"
                                            style={{flex:1,background:"var(--background-primary-alt)",border:"1px solid var(--background-modifier-border)",borderRadius:"8px",padding:"7px 12px",fontSize:"0.85rem",color:"var(--text-normal)",boxSizing:"border-box"}}
                                            placeholder="e.g. how does cache-friendly memory work?"
                                            value={testQuery}
                                            onInput={e => setTestQuery(e.target.value)}
                                            onKeyDown={e => e.key === "Enter" && runTestSearch()}
                                        />
                                        <button className="oraset-btn primary" onClick={runTestSearch} disabled={testSearching || !testQuery.trim()}>
                                            {testSearching ? "…" : "Search"}
                                        </button>
                                    </div>
                                    {testResults && (
                                        <div style={{display:"flex",flexDirection:"column",gap:"4px"}}>
                                            {testResults.error && <p style={{margin:0,fontSize:"0.82rem",color:"var(--color-red)"}}>{testResults.error}</p>}
                                            {(testResults.results ?? []).map(r => (
                                                <div key={r.path} style={{display:"flex",alignItems:"baseline",gap:"8px",padding:"6px 0",borderBottom:"1px solid var(--background-modifier-border)"}}>
                                                    <span style={{fontFamily:"var(--font-monospace)",fontSize:"0.75rem",color:"var(--interactive-accent)",flexShrink:0,minWidth:"42px"}}>{r.score.toFixed(3)}</span>
                                                    <span style={{fontSize:"0.83rem",color:"var(--text-normal)",flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r.title}</span>
                                                    <span style={{fontSize:"0.74rem",color:"var(--text-faint)",flexShrink:0}}>{r.domain}</span>
                                                </div>
                                            ))}
                                            {(testResults.results ?? []).length === 0 && !testResults.error && (
                                                <p style={{margin:0,fontSize:"0.82rem",color:"var(--text-muted)"}}>No results.</p>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Browse Index card */}
                                <div className="oraset-config-row" style={{background:"var(--background-secondary)",border:"1px solid var(--background-modifier-border)",borderRadius:"8px",padding:"14px",display:"flex",flexDirection:"column",gap:"10px"}}>
                                    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                                        <span className="oraset-label" style={{fontWeight:600,fontSize:"0.95rem"}}>Browse Index</span>
                                        <button className="oraset-btn" style={{fontSize:"0.8rem",padding:"3px 10px"}} onClick={async () => {
                                            const notes = await E.getIndexNotes();
                                            setBrowseNotes(notes);
                                            setBrowseFilter("");
                                        }}>Load</button>
                                    </div>
                                    <p className="oraset-desc" style={{margin:0,fontSize:"0.82rem",color:"var(--text-muted)"}}>Inspect every note currently in the index. Click a row to open it.</p>
                                    {browseNotes !== null && (() => {
                                        const q = browseFilter.trim().toLowerCase();
                                        const filtered = q
                                            ? browseNotes.filter(n =>
                                                (n.title ?? "").toLowerCase().includes(q) ||
                                                (n.domain ?? "").toLowerCase().includes(q) ||
                                                (n.topic ?? "").toLowerCase().includes(q) ||
                                                n.path.toLowerCase().includes(q)
                                              )
                                            : browseNotes;
                                        const domainColors = {};
                                        const palette = ["var(--interactive-accent)","var(--color-green)","var(--color-orange)","var(--color-purple)","var(--color-cyan)","var(--color-red)"];
                                        let ci = 0;
                                        const domainColor = d => {
                                            if (!d) return "var(--text-faint)";
                                            if (!domainColors[d]) domainColors[d] = palette[ci++ % palette.length];
                                            return domainColors[d];
                                        };
                                        const relTime = ts => {
                                            if (!ts) return "—";
                                            const diff = Date.now() - ts;
                                            if (diff < 60000) return "just now";
                                            if (diff < 3600000) return Math.floor(diff/60000) + "m ago";
                                            if (diff < 86400000) return Math.floor(diff/3600000) + "h ago";
                                            return Math.floor(diff/86400000) + "d ago";
                                        };
                                        return (
                                            <div style={{display:"flex",flexDirection:"column",gap:"6px"}}>
                                                <div style={{display:"flex",gap:"8px",alignItems:"center"}}>
                                                    <input
                                                        style={{flex:1,background:"var(--background-primary-alt)",border:"1px solid var(--background-modifier-border)",borderRadius:"8px",padding:"5px 10px",fontSize:"0.82rem",color:"var(--text-normal)",boxSizing:"border-box"}}
                                                        placeholder={`Filter ${browseNotes.length} notes by title, domain, topic…`}
                                                        value={browseFilter}
                                                        onInput={e => setBrowseFilter(e.target.value)}
                                                    />
                                                    {browseFilter && <span style={{fontSize:"0.8rem",color:"var(--text-muted)",flexShrink:0}}>{filtered.length} match{filtered.length!==1?"es":""}</span>}
                                                </div>
                                                <div style={{maxHeight:"320px",overflowY:"auto",display:"flex",flexDirection:"column",gap:"0"}}>
                                                    {filtered.map((n, i) => (
                                                        <div key={n.path}
                                                            style={{display:"grid",gridTemplateColumns:"1fr auto auto auto",alignItems:"center",gap:"8px",padding:"6px 4px",borderBottom:"1px solid var(--background-modifier-border)",cursor:"pointer",borderRadius:"4px"}}
                                                            onMouseEnter={e => e.currentTarget.style.background = "var(--background-modifier-hover)"}
                                                            onMouseLeave={e => e.currentTarget.style.background = ""}
                                                            onClick={() => dc.app.workspace.openLinkText(n.path, "", "tab")}
                                                        >
                                                            <div style={{overflow:"hidden"}}>
                                                                <div style={{fontSize:"0.83rem",color:"var(--text-normal)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{n.title ?? n.path}</div>
                                                                {n.topic && <div style={{fontSize:"0.72rem",color:"var(--text-muted)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{n.topic}</div>}
                                                            </div>
                                                            {(() => {
                                                                const c = n.contentChars;
                                                                if (c == null) return <span title="Index quality: unknown — run Update Index" style={{fontSize:"0.72rem",color:"var(--text-faint)",flexShrink:0}}>○</span>;
                                                                const [col, label] = c < 500 ? ["var(--color-red)","sparse"] : c < 2000 ? ["var(--color-orange)","thin"] : ["var(--color-green)","good"];
                                                                return <span title={`Index quality: ${label} (${c} chars)`} style={{fontSize:"0.72rem",color:col,flexShrink:0}}>●</span>;
                                                            })()}
                                                            <span style={{fontSize:"0.72rem",color:domainColor(n.domain),flexShrink:0,fontWeight:500}}>{n.domain ?? "—"}</span>
                                                            <span style={{fontSize:"0.72rem",color:"var(--text-faint)",flexShrink:0,minWidth:"52px",textAlign:"right"}}>{relTime(n.indexedAt)}</span>
                                                        </div>
                                                    ))}
                                                    {filtered.length === 0 && <p style={{margin:"8px 0",fontSize:"0.82rem",color:"var(--text-muted)"}}>No matches.</p>}
                                                </div>
                                            </div>
                                        );
                                    })()}
                                </div>
                            </div>
                        );
                    })()}

                    {settingsTab === "sessions" && (
                        <div className="oraset-section" style={{display:"flex",flexDirection:"column",gap:12}}>
                            <p className="oraset-desc" style={{margin:0,lineHeight:1.5}}>
                                Conversations are saved as JSON to <code>Systems/Oraculum/Sessions/</code>.
                                Sessions are auto-saved when you click <b>New</b>. You can also manually save
                                with 💾. Click <b>Resume</b> to restore a session and continue the conversation.
                            </p>
                            <div style={{display:"flex",gap:8}}>
                                <button className="oraset-btn" onClick={loadSessions} disabled={sessionsLoading}>
                                    {sessionsLoading ? "Loading…" : "↻ Refresh"}
                                </button>
                                <button className="oraset-btn primary"
                                    onClick={async () => { await saveCurrentSession(); await loadSessions(); flashSaved("Session saved"); }}
                                    disabled={!display.length || loading}>
                                    💾 Save Current
                                </button>
                            </div>
                            {!sessionsLoading && sessions.length === 0 && (
                                <div style={{padding:"14px",background:"var(--background-secondary)",borderRadius:8,fontSize:"0.85em",color:"var(--text-muted)",textAlign:"center"}}>
                                    No saved sessions yet — start a conversation and click <b>New</b> to archive it.
                                </div>
                            )}
                            {sessionsLoading && (
                                <div style={{padding:"14px",color:"var(--text-muted)",fontSize:"0.85em",textAlign:"center"}}>Loading sessions…</div>
                            )}
                            <div style={{display:"flex",flexDirection:"column",gap:8}}>
                                {sessions.map(s => (
                                    <div key={s.id} style={{background:"var(--background-secondary)",borderRadius:8,padding:"10px 14px",display:"flex",alignItems:"center",gap:12}}>
                                        <div style={{flex:1,minWidth:0}}>
                                            <div style={{fontWeight:600,fontSize:"0.88em",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",color:"var(--text-normal)"}} title={s.title}>{s.title || "Untitled"}</div>
                                            <div style={{fontSize:"0.74em",color:"var(--text-muted)",marginTop:3}}>
                                                {new Date(s.created_at).toLocaleString([], {month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"})}
                                                {" · "}{s.message_count ?? 0} msg{s.message_count !== 1 ? "s" : ""}
                                                {s.tool_count > 0 ? ` · ${s.tool_count} tool call${s.tool_count !== 1 ? "s" : ""}` : ""}
                                            </div>
                                        </div>
                                        <div style={{display:"flex",gap:6,flexShrink:0}}>
                                            <button className="oraset-btn primary" onClick={() => resumeSession(s)}>Resume</button>
                                            <button className="oraset-btn" onClick={() => deleteSession(s)}
                                                style={{color:"var(--text-error)",borderColor:"var(--text-error)"}}>Delete</button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {settingsTab === "profile" && (() => {
                        const CTX          = "Systems/Oraculum/Context";
                        const VAULT_INTEL  = `${CTX}/Vault Intelligence.md`;
                        const COGITO_INTEL = `${CTX}/Cogito Intelligence.md`;
                        const ANIMA_INTEL  = `${CTX}/Anima Intelligence.md`;
                        const FABRICA_INTEL= `${CTX}/Fabrica Intelligence.md`;
                        const MY_PATH      = `${CTX}/My Profile.md`;

                        function staleBadgeFor(dateStr) {
                            if (!dateStr) return { label: "Not yet generated", color: "var(--text-faint)" };
                            const days = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
                            if (days < 14) return { label: `Fresh (${days}d ago)`, color: "var(--color-green)" };
                            if (days < 30) return { label: `Getting stale (${days}d ago)`, color: "var(--color-yellow, #e5a00d)" };
                            return { label: `Outdated (${days}d ago)`, color: "var(--color-red)" };
                        }

                        const VAULT_REGEN = `[Vault Intelligence Regeneration] Regenerate a holistic intelligence profile for the entire vault. Follow this strategy:

1. Read the three pillar intelligence notes first — they are pre-analysed summaries you can build on:
   - get_note "Systems/Oraculum/Context/Cogito Intelligence.md"
   - get_note "Systems/Oraculum/Context/Anima Intelligence.md"
   - get_note "Systems/Oraculum/Context/Fabrica Intelligence.md"
   (If any are ungenerated/empty, note the gap and proceed.)

2. Use semantic_search to fill in cross-cutting patterns and anything the pillar notes don't cover. Design 5–7 queries yourself targeting cross-pillar themes — things that span knowledge + projects + life, recurring obsessions, inferred trajectories. Do NOT use list_notes_in. Make queries specific (phrases that appear in note bodies, not abstract labels).

3. Read a small number of the most substantive hits with get_note to add depth where needed.

4. Synthesise everything and write the body to "${VAULT_INTEL}" using write_note_body (frontmatter exists — body only). Sections: ## Knowledge Clusters (depth + maturity), ## Consumption Patterns, ## Project Interests, ## Recurring Themes, ## Inferred Interests.

5. Call update_frontmatter on "${VAULT_INTEL}" with generated set to today's ISO date.`;

                        const COGITO_REGEN = `[Cogito Intelligence Regeneration] Analyse the knowledge pillar to regenerate its intelligence summary. Follow this strategy:

1. Structural scan first — call list_notes_in on:
   - "Systems/Cogito/Notes" — note titles are descriptive; note the distinct "topic" values (Software Engineering, System Design, Computer Architecture, Game Development, Machine Learning, etc.) and "domain" values (Knowledge, Process, Idea, Reference) you see across filenames and any result metadata.
   - "Systems/Cogito/Media" — see what content has been consumed.

2. Targeted semantic search — now that you know the actual topics in the vault, design 1–2 specific queries per topic cluster you found. Think about phrases that appear in note bodies, not abstract labels. Aim for 6–10 total queries covering distinct topic areas.

3. Read the most substantive hits with get_note to understand depth and maturity.

4. Write the body to "${COGITO_INTEL}" using write_note_body (frontmatter exists — body only). Sections: ## Knowledge Clusters (topic, domain, depth, maturity — be specific about which topics are deep vs shallow), ## Knowledge Gaps (topics with only Stub notes or absent entirely), ## Consumption Patterns (what media has been saved/watched), ## Recurring Themes.

5. Call update_frontmatter on "${COGITO_INTEL}" with generated set to today's ISO date.`;

                        const ANIMA_REGEN = `[Anima Intelligence Regeneration] Analyse the personal life pillar to regenerate its intelligence summary. Follow this strategy:

1. Structural scan first — call list_notes_in on these bounded folders to see what exists:
   - "Systems/Habits" — habit note names tell you what's being tracked (frequency field: Daily/Weekly).
   - "Systems/Finances/Expenses" — expense names reveal spending categories (Investments, Subscriptions, etc.).
   - "Systems/Finances/Income" — income sources.
   - "Systems/Job Search" — job applications (each has company, role, status fields).

2. Targeted semantic search — design 4–6 queries based on what you found: e.g. specific habits you saw, financial patterns, career/interview prep content, food/health. Think body-level phrases, not labels.

3. Read a small number of the most informative notes with get_note for depth.

4. Write the body to "${ANIMA_INTEL}" using write_note_body (frontmatter exists — body only). Sections: ## Habit Patterns (what's tracked, frequency, any logged consistency you can see), ## Financial Picture (expense categories, income sources, investment behaviour), ## Career State (job applications, roles targeted, interview prep), ## Lifestyle Observations (food, health, routines).

5. Call update_frontmatter on "${ANIMA_INTEL}" with generated set to today's ISO date.`;

                        const FABRICA_REGEN = `[Fabrica Intelligence Regeneration] Analyse the projects/work pillar to regenerate its intelligence summary. Follow this strategy:

1. Structural scan first — call list_notes_in on:
   - "Systems/Projects" — project names reveal what's being built.
   - "Systems/Resources" — resource names and their "category" field (Learning, Bundles, Tools, etc.) reveal what external tools/sites are being tracked.
   - "Systems/Infrastructure/Servers" — server names reveal what's being run.

2. Use list_notes_in on "Systems/Issues" subfolders only if needed to understand issue patterns by project.

3. Targeted semantic search — now that you know the actual projects and resource categories, design 4–6 queries targeting specific project tech, infrastructure patterns, recurring issue types, and build habits. Think body-level phrases.

4. Read a small number of the most informative notes with get_note for depth.

5. Write the body to "${FABRICA_INTEL}" using write_note_body (frontmatter exists — body only). Sections: ## Active Projects (what's being built, momentum, tech stack), ## Resource Landscape (what external resources are tracked by category), ## Tech Stack & Patterns (technologies that keep appearing), ## Infrastructure (systems being run and maintained), ## Issue Patterns (recurring problem types if visible).

6. Call update_frontmatter on "${FABRICA_INTEL}" with generated set to today's ISO date.`;

                        const intelCards = [
                            { key:"vault",   label:"🌐 Vault Intelligence",   desc:"Holistic cross-pillar summary: knowledge clusters, consumption patterns, project interests, and inferred interests.", path:VAULT_INTEL,   date:contextDates.vault,   regen:VAULT_REGEN },
                            { key:"cogito",  label:"🧠 Cogito Intelligence",  desc:"Knowledge pillar deep-dive: knowledge clusters, depth & maturity, gaps, and learning consumption patterns.",         path:COGITO_INTEL,  date:contextDates.cogito,  regen:COGITO_REGEN },
                            { key:"anima",   label:"❤️ Anima Intelligence",   desc:"Personal life summary: habit patterns, financial picture, career state, and lifestyle observations.",                path:ANIMA_INTEL,   date:contextDates.anima,   regen:ANIMA_REGEN },
                            { key:"fabrica", label:"⚙️ Fabrica Intelligence", desc:"Projects & work summary: active projects, tech stack, issue patterns, and infrastructure overview.",               path:FABRICA_INTEL, date:contextDates.fabrica, regen:FABRICA_REGEN },
                        ];

                        return (
                            <div className="oraset-section" style={{display:"flex",flexDirection:"column",gap:"14px"}}>
                                <p className="oraset-desc" style={{fontSize:"0.82rem",color:"var(--text-muted)",margin:0,lineHeight:1.5}}>
                                    Context notes give Oraculum persistent knowledge about you and your vault — used automatically for discovery and recommendation tasks. All are excluded from semantic indexing.
                                </p>

                                {intelCards.map(({ key, label, desc, path, date, regen }) => {
                                    const badge = staleBadgeFor(date);
                                    return (
                                        <div key={key} className="oraset-config-row" style={{background:"var(--background-secondary)",border:"1px solid var(--background-modifier-border)",borderRadius:"8px",padding:"14px",display:"flex",flexDirection:"column",gap:"10px"}}>
                                            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:"8px"}}>
                                                <span className="oraset-label" style={{fontWeight:600,fontSize:"0.95rem"}}>{label}</span>
                                                <span style={{fontSize:"0.78rem",fontWeight:600,color:badge.color}}>{badge.label}</span>
                                            </div>
                                            <p className="oraset-desc" style={{margin:0,fontSize:"0.82rem",color:"var(--text-muted)"}}>{desc}</p>
                                            <div style={{display:"flex",gap:"8px",flexWrap:"wrap"}}>
                                                <button className="oraset-btn primary" onClick={() => { setView("chat"); setTimeout(() => quickSend(regen), 80); }}>↻ Regenerate</button>
                                                <button className="oraset-btn" onClick={() => dc.app.workspace.openLinkText(path, "", "tab")}>Open note</button>
                                            </div>
                                        </div>
                                    );
                                })}

                                {/* My Profile card */}
                                <div className="oraset-config-row" style={{background:"var(--background-secondary)",border:"1px solid var(--background-modifier-border)",borderRadius:"8px",padding:"14px",display:"flex",flexDirection:"column",gap:"10px"}}>
                                    <span className="oraset-label" style={{fontWeight:600,fontSize:"0.95rem"}}>✍️ My Profile</span>
                                    <p className="oraset-desc" style={{margin:0,fontSize:"0.82rem",color:"var(--text-muted)"}}>
                                        Your hand-written context: background, explicit interests, style preferences, and goals. The AI never modifies this. Add topics you care about even if they're not in your vault yet.
                                    </p>
                                    <button className="oraset-btn" style={{alignSelf:"flex-start"}} onClick={() => dc.app.workspace.openLinkText(MY_PATH, "", "tab")}>Open &amp; edit</button>
                                </div>
                            </div>
                        );
                    })()}

                </div>
            </div>
            </div>
        );
    }

    function changeModel(id) { G.setModel(id); setModelState(id); }

    // ── Context trimmer ────────────────────────────────────────────────────
    // Keeps the last MAX_CONTEXT_TURNS user-initiated turns in the API window.
    // The full history is preserved in state/localStorage — only the API
    // request is trimmed so Gemma 4's context window doesn't overflow.
    function trimContextForApi(msgs) {
        let count = 0;
        for (let i = msgs.length - 1; i >= 0; i--) {
            if (msgs[i].role === "user") {
                count++;
                if (count >= MAX_CONTEXT_TURNS) return { from: i, trimmed: msgs.slice(i) };
            }
        }
        return { from: 0, trimmed: msgs };
    }

    // ── Core generation (shared by send / regenerate / quickSend) ─────────
    async function doGenerate(apiMessages, displayPrefix) {
        retryRef.current = { apiMessages, displayPrefix };
        const turnChangesMap = new Map(); // keyed by path — deduplicates write_note_body + update_frontmatter on same note
        const turnTools   = [];
        setLoading(true);
        setError(null);
        setLiveToolLabel("");
        setMessages(apiMessages);
        setDisplay(displayPrefix);
        localStorage.setItem("oraculum:messages", JSON.stringify(apiMessages));
        localStorage.setItem("oraculum:display",  JSON.stringify(displayPrefix));

        // Trim before sending — prevents 500 INTERNAL from context overflow.
        const { from: trimFrom, trimmed: apiForApi } = trimContextForApi(apiMessages);

        const controller = new AbortController();
        abortRef.current = controller;

        try {
            const sys = (await Sk.assemble({ today })) || SYSTEM_FALLBACK;
            const { messages: finalMessages, reply, thinking } = await G.runTurn(
                apiForApi,
                T.getEnabledDeclarations(),
                sys,
                T.executeTool,
                (name, args, result) => {
                    turnTools.push(name);
                    if (result?.path && !result?.error) {
                        const isCreate = /^create_|^log_habit/.test(name);
                        const isUpdate = /^update_|^append_|^add_to_|^write_note_body$/.test(name);
                        if (isCreate || isUpdate) {
                            const p = String(result.path);
                            const existing = turnChangesMap.get(p);
                            // "created" always wins over "updated"; first write wins otherwise
                            if (!existing || (isCreate && existing.action === "updated")) {
                                turnChangesMap.set(p, {
                                    path:   p,
                                    title:  p.split("/").pop().replace(/\.md$/, ""),
                                    action: isCreate ? "created" : "updated",
                                });
                            }
                        }
                    }
                    const label = formatToolNotice(name, args, result);
                    setLiveToolLabel(label);
                    setDisplay(d => {
                        // Store structured tool-call data for the collapsible card UI.
                        // Truncate args/result for localStorage so large scrapes don't blow it up.
                        const compactArgs   = compactForStorage(args,   1200);
                        const compactResult = compactForStorage(result, 2000);
                        const next = [...d, {
                            role: "tool-notice",
                            text: label,
                            name,
                            args:   compactArgs,
                            result: compactResult,
                            timestamp: Date.now(),
                        }];
                        localStorage.setItem("oraculum:display", JSON.stringify(next));
                        return next;
                    });
                },
                controller.signal
            );
            // Rebuild full history: pre-trim prefix + trimmed session (which now
            // includes new model turns added by runTurn).
            const fullFinal = [...apiMessages.slice(0, trimFrom), ...finalMessages];
            setMessages(fullFinal);
            localStorage.setItem("oraculum:messages", JSON.stringify(fullFinal));
            // Fire-and-forget auto-summarizer — compresses old turns when context grows large
            maybeSummarizeMessages(fullFinal).catch(() => {});
            // Flatten the deduplicated map to an array for display + changelog
            const turnChanges = [...turnChangesMap.values()];
            const modelItem = {
                role:        "model",
                text:        reply,
                thinking:    thinking ?? null,
                timestamp:   Date.now(),
                changes:     turnChanges,
            };
            setDisplay(d => {
                const next = [...d, modelItem];
                localStorage.setItem("oraculum:display", JSON.stringify(next));
                return next;
            });

            // Merge turn changes into the persistent changelog (deduped by path)
            if (turnChanges.length > 0) {
                setChangelog(prev => {
                    const map = new Map(prev.map(e => [e.path, e]));
                    for (const c of turnChanges) {
                        const existing = map.get(c.path);
                        map.set(c.path, {
                            path:      c.path,
                            title:     c.title,
                            // Preserve "created" if the note was ever created this session
                            action:    existing?.action === "created" ? "created" : c.action,
                            timestamp: Date.now(),
                        });
                    }
                    // Sort most-recent first
                    const next = [...map.values()].sort((a, b) => b.timestamp - a.timestamp);
                    localStorage.setItem("oraculum:changelog", JSON.stringify(next));
                    return next;
                });
            }
        } catch (e) {
            if (e?.name === "AbortError") {
                // User stopped — show a quiet notice, don't show error banner
                setDisplay(d => {
                    const next = [...d, { role: "tool-notice", text: "⏹ Stopped." }];
                    localStorage.setItem("oraculum:display", JSON.stringify(next));
                    return next;
                });
            } else {
                const msg = String(e);
                if (msg.includes("__NO_KEY__")) setHasKey(false);
                else setError(msg);
            }
        } finally {
            abortRef.current = null;
            setLoading(false);
        }
    }

    // ── Send ──────────────────────────────────────────────────────────────
    async function send() {
        const userText = input.trim();
        if (!userText || loading) return;
        setInput("");

        let apiText = userText;
        if (attachNote.trim()) {
            const files = dc.app.vault.getMarkdownFiles();
            const noteFile = files.find(f =>
                f.basename === attachNote.trim() ||
                f.path === attachNote.trim() ||
                f.path.endsWith("/" + attachNote.trim() + ".md")
            );
            if (noteFile) {
                const content = await dc.app.vault.cachedRead(noteFile);
                apiText = `[Attached note: ${noteFile.path}]\n\`\`\`\n${content.slice(0, 3000)}\n\`\`\`\n\n${userText}`;
            }
        }

        const newMessages = [...messages, G.userMessage(apiText)];
        const newDisplay  = [...display,  { role: "user", text: userText, timestamp: Date.now() }];
        await doGenerate(newMessages, newDisplay);
    }

    // ── Regenerate last response ──────────────────────────────────────────
    async function regenerate() {
        if (loading || display.length === 0) return;
        let lastUserD = -1, lastUserM = -1;
        for (let i = display.length  - 1; i >= 0; i--) if (display[i].role  === "user") { lastUserD = i; break; }
        for (let i = messages.length - 1; i >= 0; i--) if (messages[i].role === "user") { lastUserM = i; break; }
        if (lastUserD === -1 || lastUserM === -1) return;
        await doGenerate(messages.slice(0, lastUserM + 1), display.slice(0, lastUserD + 1));
    }

    // ── Quick-send a suggestion chip ──────────────────────────────────────
    async function quickSend(text) {
        if (loading) return;
        const newMessages = [...messages, G.userMessage(text)];
        const newDisplay  = [...display,  { role: "user", text, timestamp: Date.now() }];
        await doGenerate(newMessages, newDisplay);
    }

    // ── Group consecutive tool-notices into collapsible blocks ────────────
    function groupDisplay(items) {
        const result = [];
        let i = 0;
        while (i < items.length) {
            if (items[i].role === "tool-notice") {
                const notices = [];
                while (i < items.length && items[i].role === "tool-notice") {
                    notices.push({ notice: items[i], origIdx: i });
                    i++;
                }
                result.push({ type: "tool-group", notices });
            } else {
                result.push({ type: "message", message: items[i], origIdx: i });
                i++;
            }
        }
        return result;
    }

    // ── Auto-summarize older turns when context grows ─────────────────────
    // Fire-and-forget — called after doGenerate completes. Does nothing if
    // the user turn count hasn't crossed AUTO_SUMMARIZE_AT yet.
    async function maybeSummarizeMessages(currentMessages) {
        const userTurns = currentMessages.filter(m => m.role === "user").length;
        if (userTurns <= AUTO_SUMMARIZE_AT) return;
        if (summarizing) return;

        // Find the split point: everything before the last SUMMARIZE_KEEP_LAST user turns
        let keepCount = 0;
        let splitIdx  = currentMessages.length;
        for (let i = currentMessages.length - 1; i >= 0; i--) {
            if (currentMessages[i].role === "user") {
                keepCount++;
                if (keepCount >= SUMMARIZE_KEEP_LAST) { splitIdx = i; break; }
            }
        }
        if (splitIdx <= 0) return;

        const toSummarize = currentMessages.slice(0, splitIdx);
        const toKeep      = currentMessages.slice(splitIdx);

        // Already starts with a prior-context summary — don't double-summarize
        if (toSummarize.length <= 2 &&
            toSummarize[0]?.parts?.[0]?.text?.startsWith("[PRIOR CONTEXT SUMMARY]")) return;

        setSummarizing(true);
        try {
            const summaryContents = [
                ...toSummarize,
                {
                    role: "user",
                    parts: [{ text: "Summarize the conversation above in a concise bullet-point form that preserves all key facts, decisions, and vault changes made. Start with '[PRIOR CONTEXT SUMMARY]'." }],
                },
            ];
            const resp = await G.generateContent(
                summaryContents,
                null, // no tools
                "You are a context compressor. Produce a compact summary only."
            );
            const summaryText = resp.candidates?.[0]?.content?.parts?.map(p => p.text || "").join("") || "";
            if (!summaryText) return;

            // Build compressed message history: synthetic prior-context pair + recent turns
            const compressed = [
                { role: "user",  parts: [{ text: summaryText }] },
                { role: "model", parts: [{ text: "Understood — I have the prior context." }] },
                ...toKeep,
            ];
            setMessages(compressed);
            localStorage.setItem("oraculum:messages", JSON.stringify(compressed));
        } catch (e) {
            console.warn("Oraculum auto-summarize failed:", e);
        } finally {
            setSummarizing(false);
        }
    }


    function copyText(text, idx) {
        navigator.clipboard?.writeText(text);
        setCopied(idx);
        setTimeout(() => setCopied(null), 1500);
    }

    // ── Open a vault note ─────────────────────────────────────────────────
    function openNote(pathOrName) { dc.app.workspace.openLinkText(pathOrName, "", "tab"); }

    // ── Save session transcript to vault ─────────────────────────────────
    // ── Session log ───────────────────────────────────────────────────────────

    async function saveCurrentSession() {
        if (!display.length) return;
        const firstUser = display.find(m => m.role === "user");
        const rawTitle = (firstUser?.text ?? "Untitled").replace(/\s+/g, " ").trim();
        const title = rawTitle.length <= 55
            ? rawTitle
            : rawTitle.slice(0, 55).replace(/\s+\S*$/, "") + "…";
        const id = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
        const toolCount = display.reduce((n, m) => n + (m.tools?.length ?? 0), 0);
        const data = {
            id, title,
            created_at: Date.now(),
            message_count: display.filter(m => m.role === "user").length,
            tool_count: toolCount,
            messages, display, changelog,
        };
        try {
            // Ensure folder exists
            if (!dc.app.vault.getAbstractFileByPath(SESSIONS_DIR)) {
                try { await dc.app.vault.createFolder(SESSIONS_DIR); } catch {}
            }
            // Use adapter.write — works for any file type, bypasses Obsidian's markdown cache
            await dc.app.vault.adapter.write(`${SESSIONS_DIR}/${id}.json`, JSON.stringify(data));
        } catch (e) { console.warn("Session save:", e); }
    }

    async function saveSession() {
        if (!display.length || loading) return;
        await saveCurrentSession();
        setDisplay(d => {
            const next = [...d, { role: "tool-notice", text: "💾 Session saved to Systems/Oraculum/Sessions/" }];
            try { localStorage.setItem("oraculum:display", JSON.stringify(next)); } catch {}
            return next;
        });
    }

    async function loadSessions() {
        setSessionsLoading(true);
        try {
            let sessions = [];

            // Primary: walk vault-indexed folder children (works immediately after vault.createFolder)
            const folder = dc.app.vault.getAbstractFileByPath(SESSIONS_DIR);
            if (folder && folder.children) {
                const jsonFiles = folder.children.filter(f => f.extension === "json");
                const loaded = await Promise.all(jsonFiles.map(async f => {
                    try {
                        const content = await dc.app.vault.read(f);
                        return { ...JSON.parse(content), _path: f.path, _file: f };
                    } catch { return null; }
                }));
                sessions = loaded.filter(Boolean);
            }

            // Fallback: adapter.list (catches files not yet in vault index)
            if (sessions.length === 0) {
                try {
                    const result = await dc.app.vault.adapter.list(SESSIONS_DIR);
                    const paths = (result.files ?? []).filter(p => p.endsWith(".json"));
                    if (paths.length > 0) {
                        const loaded = await Promise.all(paths.map(async p => {
                            try {
                                const content = await dc.app.vault.adapter.read(p);
                                return { ...JSON.parse(content), _path: p };
                            } catch { return null; }
                        }));
                        sessions = loaded.filter(Boolean);
                    }
                } catch (e) { console.warn("Oraculum sessions fallback list failed:", e); }
            }

            setSessions(sessions.sort((a, b) => b.created_at - a.created_at));
        } catch (e) {
            console.error("Oraculum sessions load failed:", e);
            setSessions([]);
        }
        finally { setSessionsLoading(false); }
    }

    async function resumeSession(s) {
        setMessages(s.messages ?? []);
        setDisplay(s.display ?? []);
        setChangelog(s.changelog ?? []);
        setError(null);
        setToolGroupOpen({});
        try {
            localStorage.setItem("oraculum:messages",  JSON.stringify(s.messages  ?? []));
            localStorage.setItem("oraculum:display",   JSON.stringify(s.display   ?? []));
            localStorage.setItem("oraculum:changelog", JSON.stringify(s.changelog ?? []));
        } catch {}
        setView("chat");
    }

    async function deleteSession(s) {
        try {
            if (s._path) {
                const file = dc.app.vault.getAbstractFileByPath(s._path);
                if (file) await dc.app.vault.trash(file, true);
                else      await dc.app.vault.adapter.remove(s._path);
            }
        } catch (e) { console.warn("Session delete:", e); }
        setSessions(prev => prev.filter(x => x.id !== s.id));
    }

    async function startNewChat() {
        await saveCurrentSession();
        clearChat();
    }

    // ── Input handlers ────────────────────────────────────────────────────
    function handleKeyDown(e) {
        if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
    }

    function handleInput(e) {
        setInput(e.target.value);
        e.target.style.height = "52px";
        e.target.style.height = Math.min(Math.max(52, e.target.scrollHeight), 160) + "px";
    }

    // ── Clear / forget key ────────────────────────────────────────────────
    function clearChat() {
        setMessages([]); setDisplay([]); setChangelog([]); setError(null);
        setToolGroupOpen({});
        localStorage.removeItem("oraculum:messages");
        localStorage.removeItem("oraculum:display");
        localStorage.removeItem("oraculum:changelog");
        localStorage.removeItem("oraculum:tg-open");
    }

    function clearChangelog() {
        setChangelog([]);
        localStorage.removeItem("oraculum:changelog");
    }

    function forgetKey() { G.clearApiKey(); setHasKey(false); clearChat(); }

    // ── Settings helpers ──────────────────────────────────────────────────────
    function flashSaved(msg) {
        setSettingsSaved(msg);
        setTimeout(() => setSettingsSaved(null), 2200);
    }
    // (saveSystemPrompt / resetSystemPrompt removed — replaced by Skills UI.
    // Per-skill priority and enabled state is persisted directly to the .md
    // frontmatter via Sk.updateSkillMeta(). The localStorage override key
    // "oraculum:system-prompt" is no longer consulted.)
    async function saveScraperLimit() {
        const val = Math.max(100, Number(scraperDraft) || 12000);
        localStorage.setItem("oraculum:scraper-limit", String(val));
        await S.updateSettings({ scraperLimit: val });
        setScraperDraft(val);
        flashSaved("Scraper limit saved");
    }
    async function resetScraperLimit() {
        localStorage.removeItem("oraculum:scraper-limit");
        await S.updateSettings({ scraperLimit: null });
        setScraperDraft(12000);
        flashSaved("Reset to 12 000");
    }
    async function saveSearchLimit() {
        const val = Math.min(30, Math.max(1, Number(searchLimitDraft) || 15));
        localStorage.setItem("oraculum:search-limit", String(val));
        await S.updateSettings({ searchLimit: val });
        setSearchLimitDraft(val);
        flashSaved("Search limit saved");
    }
    async function resetSearchLimit() {
        localStorage.removeItem("oraculum:search-limit");
        await S.updateSettings({ searchLimit: null });
        setSearchLimitDraft(15);
        flashSaved("Reset to 15");
    }

    async function saveSupadataKey() {
        const k = supadataKeyInput.trim();
        if (!k || k.startsWith("•")) { flashSaved("No changes"); return; }
        T.saveSupadataKey(k);
        setSupadataKeyInput("••••••••••••••••");
        flashSaved("Supadata key saved");
    }
    function clearSupadataKey() {
        T.clearSupadataKey();
        setSupadataKeyInput("");
        flashSaved("Supadata key cleared");
    }
    async function saveGeminiKey() {
        const k = geminiKeyInput.trim();
        if (!k || k.startsWith("•")) { flashSaved("No changes"); return; }
        setGeminiSaving(true);
        G.saveApiKey(k);
        setHasKey(true);
        setGeminiKeyInput("••••••••••••••••");
        setGeminiSaving(false);
        flashSaved("Gemini key saved");
    }
    function clearGeminiKey() {
        G.clearApiKey();
        setGeminiKeyInput("");
        setHasKey(false);
        clearChat();
    }

    // ── New integration key handlers ──────────────────────────────────────
    function makeKeyHandlers(input, setInput, save, clear, label) {
        return {
            save: () => {
                const k = (input ?? "").trim();
                if (!k || k.startsWith("•")) { flashSaved("No changes"); return; }
                save(k);
                setInput("••••••••••••••••");
                flashSaved(`${label} saved`);
            },
            clear: () => {
                clear();
                setInput("");
                flashSaved(`${label} cleared`);
            },
        };
    }

    // ── Per-tool enable toggle ───────────────────────────────────────────
    function toggleTool(name) {
        const next = new Set(disabledTools);
        if (next.has(name)) next.delete(name); else next.add(name);
        setDisabledToolsState(next);
        T.setDisabledTools([...next]);
    }
    function setAllToolsEnabled(enable, names) {
        if (enable) {
            const next = new Set(disabledTools);
            for (const n of names) next.delete(n);
            setDisabledToolsState(next);
            T.setDisabledTools([...next]);
            flashSaved(`Enabled ${names.length} tool(s)`);
        } else {
            const next = new Set(disabledTools);
            for (const n of names) next.add(n);
            setDisabledToolsState(next);
            T.setDisabledTools([...next]);
            flashSaved(`Disabled ${names.length} tool(s)`);
        }
    }

    // ── Click delegation: wikilinks + change chips ────────────────────────
    function handleHistoryClick(e) {
        const wikilink = e.target.closest(".oraculum-wikilink");
        if (wikilink) { e.preventDefault(); openNote(wikilink.dataset.note); return; }
        const chip = e.target.closest(".oraculum-change-chip");
        if (chip)     { e.preventDefault(); openNote(chip.dataset.path); }
    }

    // ── Tool notice formatter ─────────────────────────────────────────────
    function formatToolNotice(name, args, result) {
        if (result?.error) return `⚠️ ${name}: ${result.error}`;
        switch (name) {
            case "search_notes":         return `🔍 Searched "${args.query}" → ${result.results?.length ?? 0} result(s)`;
            case "get_note":             return args.section ? `📖 Read ${args.path} § ${args.section}` : `📖 Read ${args.path}`;
            case "get_frontmatter":      return `📋 Read frontmatter: ${args.path}`;
            case "update_frontmatter":   return `✏️ Updated ${result.updated?.join(", ")} on ${args.path}`;
            case "append_to_note":       return `➕ Appended to ${args.path}${args.section ? ` § ${args.section}` : ""}`;
            case "list_folder":          return `📂 Listed ${args.path} (${result.items?.length ?? 0} items)`;
            case "list_field_values":    return `🔭 Browsed ${args.field} in ${args.folder ?? "vault"} (${result.values?.length ?? 0} unique)`;
            case "find_by_field":        return `🔎 Found ${result.count ?? 0} notes where ${args.field} = "${args.value}"`;
            case "find_by_tag":          return `🏷️ Found ${result.count ?? 0} notes tagged "${args.tag}"`;
            case "list_notes_in":        return `📋 Listed ${result.count ?? 0} notes in ${args.folder}`;
            case "list_habits":          return `📋 Checked habits (${result.habits?.length ?? 0})`;
            case "log_habit":            return `✅ Logged ${result.habit} for ${result.date}${result.alreadyLogged ? " (already done)" : ""}`;
            case "create_habit":         return `🌱 Created habit: ${result.path}`;
            case "list_job_applications":return `💼 Listed applications (${result.applications?.length ?? 0})`;
            case "create_job_application":return `💼 Created application: ${result.path}`;
            case "update_job_status":    return `💼 Set status → ${args.new_status}`;
            case "create_note":          return `📝 Created note: ${result.path}`;
            case "create_media_note":    return `🎬 Created media note: ${result.path}`;
            case "update_media_status":  return `🎬 ${args.title} → ${args.new_status}`;
            case "list_projects":        return `🏗️ Listed projects (${result.projects?.length ?? 0})`;
            case "create_project":       return `🏗️ Created project: ${result.path}`;
            case "list_issues":          return `🐛 Listed issues (${result.issues?.length ?? 0})`;
            case "create_issue":         return `🐛 Created issue: ${result.path}`;
            case "update_issue_status":  return `🐛 ${args.title} → ${args.new_status}${result.moved ? " (moved)" : ""}`;
            case "create_release":       return `🚀 Created release: ${result.path}`;
            case "create_resource":      return `🔧 Created resource: ${result.path}`;
            case "create_skill":         return `⭐ Created skill: ${result.path}`;
            case "create_brag":          return `🏆 Created brag: ${result.path}`;
            case "create_adr":           return `📜 Created ADR: ${result.path}`;
            case "fetch_url_metadata":   return result.error ? `🌐 Could not fetch metadata (${args.url})` : `🌐 Fetched: "${result.title}" by ${result.author ?? "unknown"}`;
            case "scrape_webpage":       return result.error
                ? `🕷️ Could not scrape (${args.url})`
                : `🕷️ Scraped "${result.title ?? args.url}" via ${result.method ?? "direct"} (${result.char_count ?? "?"}chars${result.truncated ? ", truncated" : ""})`;
            case "get_habit_insights":   return `📊 Habit "${args.habit_name}": ${result.current_streak}d streak, ${result.completion_rate_pct}% in last ${result.window_days}d`;
            case "get_vault_overview":   return `🗺️ Vault overview: ${result.total_notes} notes, ${result.habits?.done_today}/${result.habits?.total} habits today`;
            case "find_related_notes":   return `🔗 Found ${result.related?.length ?? 0} related notes to ${args.path}`;
            case "generate_daily_digest":return `📅 Digest for ${result.date}: ${result.summary}`;
            case "save_session_summary": return `💾 Session saved: ${result.path}`;
            case "add_to_inbox":         return `📥 Added to inbox: ${String(args.text ?? "").slice(0, 50)}`;
            case "vault_health":         return `🏥 Vault health: ${result.issue_count} issues in ${result.total_checked} notes`;
            case "import_youtube_playlist":   return `📺 Found ${result.count ?? 0} videos in playlist`;
            case "fetch_video_transcript":    return result.error
                ? `📜 No transcript available`
                : `📜 Transcript (${result.lang ?? "?"}) · ${result.char_count?.toLocaleString() ?? "?"} chars${result.segment_count ? `, ${result.segment_count} segments` : ""}`;
            case "fetch_social_metadata":     return result.error
                ? `📊 Metadata unavailable`
                : `📊 ${result.platform ?? "Social"}: ${result.title ?? result.url} · ${result.views != null ? result.views.toLocaleString() + " views" : "no stats"}`;
            case "write_note_body":       return `✍️ Wrote body: ${args.path?.split("/").pop()?.replace(/\.md$/,"")}`;
            case "semantic_search":       return `🔍 Semantic: "${args.query}"${args.folder ? ` in ${args.folder.split("/").pop()}` : ""} → ${result.results?.length ?? 0} result(s)`;
            case "get_recent_notes":      return `🕐 Fetched ${result.total ?? result.notes?.length ?? 0} recent notes (last ${args.days ?? 7}d)`;
            case "move_note":             return `📦 Moved ${args.path?.split("/").pop()} → ${args.new_path?.split("/").pop()}`;
            case "queue_research_topic":     return `🧠 Queued research: "${args.topic}" (${result.queue_size ?? "?"} pending)`;
            case "list_research_queue":      return `🧠 Research queue: ${result.queue?.length ?? 0} topic(s)`;
            case "remove_research_topic":    return `🧠 Removed from queue${args.id ? ` (${args.id})` : ""}`;
            case "propose_research_batch":   return `🧠 Proposed batch of ${result.proposed?.length ?? 0} topic(s)`;
            case "run_deep_research":        return result.skipped?.length
                ? `🚀 Researched ${result.results?.length ?? 0} topic(s) (${result.totalCalls ?? 0} Gemini calls, ${result.skipped.length} cached)`
                : `🚀 Researched ${result.results?.length ?? 0} topic(s) via Gemini 2.5 Flash (${result.totalCalls ?? 0} calls)`;
            case "search_research_results":  return `🧠 Searched past research "${args.query}" → ${result.results?.length ?? 0} hit(s)`;
            case "save_research_to_memory":   return `💾 Saved to Oraculum/Memory: ${result.path?.split("/").pop()?.replace(/\.md$/, "") ?? args.topic}`;
            case "bulk_log_habits":       return `✅ Logged ${result.logged ?? 0}/${args.habits?.length ?? 0} habits for ${result.date}`;
            case "get_week_summary":      return `📅 Week ${result.week}: ${result.notes_created ?? 0} notes, ${result.issues_closed ?? 0} issues, ${result.media_finished ?? 0} media`;
            case "get_habit_history":     return `📊 "${result.habit}" · ${result.completion_pct}% over ${args.days ?? 30}d (streak ${result.current_streak}d)`;
            case "annotate_media":        return `💬 Annotated ${args.path?.split("/").pop()?.replace(/\.md$/, "")}`;
            case "create_moc":            return `🗺️ Created MOC "${args.title}" (${result.links_created} links)`;
            case "create_review":         return `🔄 Created review: ${result.path?.split("/").pop()?.replace(/\.md$/, "")}`;
            case "create_postmortem":     return `💀 Created postmortem: ${result.path?.split("/").pop()?.replace(/\.md$/, "")}`;
            case "list_presentations":    return `📊 Listed presentations (${result.presentations?.length ?? 0})`;
            case "create_presentation":   return `📊 Created presentation: ${result.path?.split("/").pop()?.replace(/\.md$/, "")}`;
            case "get_slide_patterns":    return `🎨 Loaded slide patterns`;
            case "insert_mermaid":        return `📊 Diagram inserted into ${args.path?.split("/").pop()?.replace(/\.md$/, "")}${args.section ? ` § ${args.section}` : ""}`;
            case "generate_image":        return result.ok
                ? `🎨 Image saved → ${result.path?.split("/").pop()} [${result.model ?? "flux"}]`
                : `🎨 Image generation failed`;
            case "github_search_repos":   return `🐙 GitHub repos "${args.query}" → ${result.results?.length ?? 0}/${result.total ?? "?"} result(s)`;
            case "github_get_repo":       return `🐙 ${result.full_name ?? `${args.owner}/${args.repo}`} · ⭐${result.stars ?? "?"} · ${result.language ?? "?"}`;
            case "github_get_file":       return result.type === "directory"
                ? `🐙 ${args.owner}/${args.repo}:${args.path} → ${result.items?.length ?? 0} entries`
                : `🐙 ${args.owner}/${args.repo}:${args.path} (${result.size ?? "?"} bytes)`;
            case "github_search_code":    return `🐙 GitHub code "${args.query}" → ${result.results?.length ?? 0}/${result.total ?? "?"} result(s)`;
            case "github_list_issues":    return `🐙 ${args.owner}/${args.repo} ${args.state ?? "open"} issues → ${result.count ?? 0}`;
            case "open_library_search":   return `📖 Books "${args.query ?? args.author ?? args.subject}" → ${result.results?.length ?? 0}/${result.total ?? "?"} result(s)`;
            case "google_books_search":   return `📚 Books "${args.query}" → ${result.results?.length ?? 0}/${result.total ?? "?"} result(s)`;
            case "stackoverflow_search":  return `💬 ${args.site ?? "stackoverflow"} "${args.query}" → ${result.results?.length ?? 0}/${result.total ?? "?"} result(s)`;
            case "stackoverflow_get_answer": return `💬 Top answer for #${args.question_id} (score ${result.score ?? "?"})`;
            case "wikipedia_search":      return `📖 Wikipedia "${args.query}" → ${result.results?.length ?? 0} article(s)`;
            case "wikipedia_get_summary": return `📖 ${result.title ?? args.title}`;
            case "get_weather":           return `🌤️ Weather ${result.location ?? args.location} → ${result.current?.condition ?? "?"}, ${result.current?.temperature_c ?? "?"}°C`;
            case "get_exchange_rate":     return `💱 ${args.amount ?? 1} ${args.from} → ${result.converted?.toFixed?.(2) ?? "?"} ${args.to}`;
            case "get_quote":             return `💬 Quote by ${result.author ?? "?"}`;
            case "devto_search":          return `👩‍💻 DEV.to ${args.tag ? `#${args.tag}` : "feed"} → ${result.results?.length ?? 0} article(s)`;
            default:                     return `🔧 Used tool: ${name}`;
        }
    }

    // ── Render ────────────────────────────────────────────────────────────
    let lastModelIdx = -1;
    for (let i = display.length - 1; i >= 0; i--) {
        if (display[i].role === "model") { lastModelIdx = i; break; }
    }

    return (
        <div className="oraculum-outer">
        <div className="oraculum-wrap" ref={wrapRef}>
            {/* History panel */}
            <div className="oraculum-history" ref={historyRef} onClick={handleHistoryClick}>
                {display.length === 0 && !loading && (
                    <div style={{
                        display: "flex", flexDirection: "column", alignItems: "center",
                        justifyContent: "center", flex: 1, gap: 20, padding: "32px 16px",
                        color: "var(--text-muted)"
                    }}>
                        <div style={{ fontSize: "2.8em", lineHeight: 1 }}>🔮</div>
                        <div style={{ fontSize: "1.1em", fontWeight: 600, color: "var(--text-normal)" }}>Oraculum</div>
                        <div style={{ fontSize: "0.88em", textAlign: "center", lineHeight: 1.7, maxWidth: 340 }}>
                            Your vault assistant. Ask me anything, tell me what you did today, or drop a link.
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%", maxWidth: 360 }}>
                            {[
                                { icon: "💬", text: "\"I went for a walk and read about system design\"" },
                                { icon: "🔍", text: "\"What do I know about distributed systems?\"" },
                                { icon: "📅", text: "\"Give me a morning briefing\"" },
                            ].map((hint, i) => (
                                <button
                                    key={i}
                                    onClick={() => quickSend(hint.text.replace(/"/g, ""))}
                                    style={{
                                        background: "var(--background-secondary)",
                                        border: "1px solid var(--background-modifier-border)",
                                        borderRadius: 10, padding: "9px 14px",
                                        color: "var(--text-muted)", cursor: "pointer",
                                        fontSize: "0.84em", textAlign: "left",
                                        display: "flex", alignItems: "center", gap: 8,
                                    }}
                                >{hint.icon} {hint.text}</button>
                            ))}
                        </div>
                    </div>
                )}
                {groupDisplay(display).map((group) => {
                    if (group.type === "tool-group") {
                        const { notices } = group;
                        const groupKey = `tg-${notices[0]?.notice?.timestamp ?? notices[0]?.origIdx ?? 0}`;
                        const isOpen = toolGroupOpen[groupKey] ?? true;
                        return <ToolGroup key={groupKey} notices={notices} open={isOpen} onToggle={() => toggleToolGroup(groupKey)} />;
                    }
                    const { message: m, origIdx: i } = group;
                    if (m.role === "user") {
                        return <div key={i} className="oraculum-bubble user">{m.text}</div>;
                    }
                    // Model bubble
                    return (
                        <div key={i} className="oraculum-model-wrap">
                            {m.thinking && (
                                <details className="oraculum-thinking-details">
                                    <summary className="oraculum-thinking-summary">
                                        💭 Thinking ({Math.round(m.thinking.length / 5)} words) — click to expand
                                    </summary>
                                    <div className="oraculum-thinking-body">{m.thinking}</div>
                                </details>
                            )}
                            <div className="oraculum-bubble model">
                                <MarkdownContent source={m.text} />
                            </div>
                            <div className="oraculum-bubble-actions">
                                <button
                                    className="oraculum-copy-btn"
                                    onClick={() => copyText(m.text, i)}
                                    title="Copy response"
                                >{copied === i ? "✓" : "⧉"}</button>
                                {i === lastModelIdx && (
                                    <button
                                        className="oraculum-regen-btn"
                                        onClick={regenerate}
                                        title="Regenerate response"
                                    >↺</button>
                                )}
                                {m.timestamp && (
                                    <span className="oraculum-timestamp">{formatTime(m.timestamp)}</span>
                                )}
                            </div>
                            {m.changes?.length > 0 && (
                                <div className="oraculum-changes-panel">
                                    <span className="oraculum-changes-label">Changes ({m.changes.length}):</span>
                                    {m.changes.map((c, j) => (
                                        <button
                                            key={j}
                                            className="oraculum-change-chip"
                                            data-path={c.path}
                                            title={c.path}
                                        >
                                            {c.action === "created" ? "✨" : "✏️"}{" "}
                                            {c.title}
                                            <span style={{fontSize:"0.75em",opacity:0.65,marginLeft:4}}>{c.action}</span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    );
                })}
                {loading && (
                    <div className="oraculum-thinking">
                        <span className="oraculum-dot" />
                        <span className="oraculum-dot" />
                        <span className="oraculum-dot" />
                    </div>
                )}
                <div ref={bottomRef} style={{ display: "none" }} />
            </div>

            {/* Error */}
            {error && (
                <div className="oraculum-error" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ flex: 1 }}>{error}</span>
                    {retryRef.current && (
                        <button
                            onClick={() => doGenerate(retryRef.current.apiMessages, retryRef.current.displayPrefix)}
                            style={{ fontSize: "0.8em", padding: "2px 10px", cursor: "pointer",
                                whiteSpace: "nowrap", borderRadius: 4,
                                background: "var(--background-secondary)", border: "1px solid var(--background-modifier-border)" }}>
                            ↩ Retry
                        </button>
                    )}
                </div>
            )}

            {/* Attach note context row */}
            {showAttach && (
                <div className="oraculum-attach-row">
                    <span className="oraculum-attach-label">📎 Context note:</span>
                    <input
                        className="oraculum-attach-input"
                        placeholder="Type a note name or path…"
                        value={attachNote}
                        onInput={e => setAttachNote(e.target.value)}
                    />
                    <button className="oraculum-icon-btn" onClick={() => { setAttachNote(""); setShowAttach(false); }}>✕</button>
                </div>
            )}

            {/* Input row */}
            <div className="oraculum-input-row">
                <textarea
                    className="oraculum-textarea"
                    value={input}
                    onInput={handleInput}
                    onKeyDown={handleKeyDown}
                    placeholder="Ask Oraculum…  (Enter to send, Shift+Enter for newline)"
                    disabled={loading}
                />
                {loading
                    ? <button
                        className="oraculum-stop"
                        onClick={() => abortRef.current?.abort()}
                        title="Stop generation"
                      >⏹ Stop</button>
                    : <button
                        className="oraculum-send"
                        onClick={send}
                        disabled={!input.trim()}
                      >Send</button>
                }
            </div>

            {/* Toolbar */}
            <div className="oraculum-toolbar">
                <select
                    className="oraculum-model-select"
                    value={model}
                    onChange={e => changeModel(e.target.value)}
                    disabled={loading}
                    title="Select AI model"
                >
                    {G.MODELS.map(m => (
                        <option key={m.id} value={m.id}>{m.label} ({m.quota})</option>
                    ))}
                </select>
                <button
                    className="oraculum-icon-btn"
                    onClick={() => setShowAttach(v => !v)}
                    title="Attach a note as context"
                    style={showAttach ? { borderColor: "var(--interactive-accent)" } : {}}
                >📎</button>
                {display.length > 0 && (
                    <>
                        <button className="oraculum-icon-btn" onClick={saveSession}    disabled={loading} title="Save session to vault">💾</button>
                        <button className="oraculum-icon-btn" onClick={startNewChat} disabled={loading} title="Save and start new conversation">New</button>
                    </>
                )}
                <button className="oraculum-icon-btn" onClick={() => setView("settings")} disabled={loading} title="Settings">⚙️</button>
                {ctxUserTurns > 0 && (() => {
                    const pct   = ctxUserTurns / MAX_CONTEXT_TURNS;
                    const color = pct >= 0.9 ? "ctx-red" : pct >= 0.7 ? "ctx-yellow" : "ctx-green";
                    return (
                        <span className={`oraculum-ctx-badge ${color}`} title={`Context: ${ctxUserTurns}/${MAX_CONTEXT_TURNS} turns${summarizing ? " — summarizing…" : ""}`}>
                            {ctxUserTurns}/{MAX_CONTEXT_TURNS}{summarizing ? " 🔄" : ""}
                        </span>
                    );
                })()}
            </div>
        </div>

        {/* ── Persistent Changelog ── */}
        {changelog.length > 0 && (
            <div className="oraculum-changelog">
                <div className="oraculum-changelog-header">
                    <span className="oraculum-changelog-title">📋 Session Changes</span>
                    <div className="oraculum-changelog-filters">
                        {[
                            { id: "all",     label: "All" },
                            { id: "created", label: "✨ Created" },
                            { id: "updated", label: "✏️ Updated" },
                        ].map(f => (
                            <button
                                key={f.id}
                                className={`oraculum-filter-pill${changelogFilter === f.id ? " active" : ""}`}
                                onClick={() => setChangelogFilter(f.id)}
                            >{f.label}</button>
                        ))}
                    </div>
                    <button
                        className="oraculum-icon-btn"
                        onClick={clearChangelog}
                        title="Clear changelog"
                    >✕</button>
                </div>
                <div className="oraculum-changelog-list">
                    {changelog
                        .filter(e => changelogFilter === "all" || e.action === changelogFilter)
                        .map(e => (
                            <div
                                key={e.path}
                                className="oraculum-changelog-item"
                                onClick={() => openNote(e.path)}
                                title={e.path}
                            >
                                <span className="oraculum-changelog-icon">
                                    {e.action === "created" ? "✨" : "✏️"}
                                </span>
                                <span style={{flex:1,overflow:"hidden"}}>
                                    <span className="oraculum-changelog-note-title">{e.title}</span>
                                    <span className="oraculum-changelog-path">{e.path.split("/").slice(0,-1).join("/")}</span>
                                </span>
                                <span className="oraculum-changelog-time">{formatTime(e.timestamp)}</span>
                            </div>
                        ))
                    }
                </div>
            </div>
        )}
        </div>
    );
};
```
