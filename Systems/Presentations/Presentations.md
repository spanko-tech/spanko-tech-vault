---
dashboard: true
tags:
  - datacore/dashboard
---

# Presentations

```datacorejsx
const V = await dc.require("Toolkit/Datacore/Vault.js");
const {
    NewForm, KPIRow, FilterPills, SortBar, EmptyState,
    useDebouncedSearch, useBodyMap, useSortBy,
    computeLintMap, useLintState, LintPanel, lintColumn, deleteColumn,
} = await dc.require("Toolkit/Datacore/UI.jsx");
const { lintPresentation, PRES_ISSUE_CODES, PRES_ISSUE_LABELS } =
    await dc.require("Toolkit/Datacore/LintRules.js");

const CATEGORIES   = ["Technical", "Deep Dive", "Personal", "Demo"];
const STATUSES     = ["Idea", "Drafting", "Review", "Done"];
const SORT_FIELDS  = ["name", "category", "status", "created"];
const STATUS_COLOR = {
    Idea:     "var(--text-muted)",
    Drafting: "var(--color-orange)",
    Review:   "var(--color-blue)",
    Done:     "var(--color-green)",
};

async function exportPresentation(item) {
    const file = dc.app.vault.getAbstractFileByPath(item.$path);
    if (!file) { new window.Notice("File not found"); return; }
    const raw = await dc.app.vault.read(file);

    const fmMatch = raw.match(/^---\n([\s\S]*?)\n---\n?/);
    const fmText  = fmMatch ? fmMatch[1] : "";
    const body    = fmMatch ? raw.slice(fmMatch[0].length) : raw;

    const get = (key, def) => (fmText.match(new RegExp(`^${key}:\\s*(.+)$`, "m"))?.[1] ?? def).trim();
    const theme      = get("theme", "moon");
    const transition = get("transition", "slide");
    const hlTheme    = get("highlightTheme", "monokai");

    const cdn = "https://cdn.jsdelivr.net/npm/reveal.js@5.1.0";
    const mermaidCdn = "https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js";
    const safeBody = body.replace(/<\/textarea>/gi, "<\\/textarea>");

    const html = [
        `<!DOCTYPE html>`,
        `<html><head>`,
        `  <meta charset="utf-8">`,
        `  <meta name="viewport" content="width=device-width, initial-scale=1.0">`,
        `  <title>${item.$name}</title>`,
        `  <link rel="stylesheet" href="${cdn}/dist/reveal.css">`,
        `  <link rel="stylesheet" href="${cdn}/dist/theme/${theme}.css">`,
        `  <link rel="stylesheet" href="${cdn}/plugin/highlight/${hlTheme}.css">`,
        `</head><body>`,
        `  <div class="reveal"><div class="slides">`,
        `    <section data-markdown data-separator="\\n---\\n" data-separator-notes="^Note:">`,
        `      <textarea data-template>`,
        safeBody,
        `      </textarea>`,
        `    </section>`,
        `  </div></div>`,
        `  <script src="${cdn}/dist/reveal.js"></script>`,
        `  <script src="${cdn}/plugin/markdown/markdown.js"></script>`,
        `  <script src="${cdn}/plugin/highlight/highlight.js"></script>`,
        `  <script src="${cdn}/plugin/notes/notes.js"></script>`,
        `  <script src="${mermaidCdn}"></script>`,
        `  <script>`,
        `    mermaid.initialize({ startOnLoad: false, theme: 'dark' });`,
        `    Reveal.initialize({ hash: true, transition: '${transition}',`,
        `      plugins: [RevealMarkdown, RevealHighlight, RevealNotes] });`,
        `    Reveal.on('ready', () => mermaid.run());`,
        `  </script>`,
        `</body></html>`,
    ].join("\n");

    const url = URL.createObjectURL(new Blob([html], { type: "text/html" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: `${item.$name}.html` });
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    new window.Notice(`Exported: ${item.$name}.html`);
}

// Scaffold shows the three main patterns (title-slide → section-divider → content).
// The AI replaces this via write_note_body after calling get_slide_patterns.
function presBody(vals) {
    const cat      = vals.category ?? "Technical";
    const withRefs = ["Technical", "Deep Dive"].includes(cat);
    const title    = vals.name || "Title";
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
    return parts.join("\n");
}

return function View() {
    const all = dc.useQuery(V.q("system/presentations/presentation", "Systems/Presentations"));

    const [catFilter,    setCatFilter]    = dc.useState("All");
    const [statusFilter, setStatusFilter] = dc.useState("All");
    const [searchInput,  setSearchInput, search] = useDebouncedSearch(200);

    const bodyMap    = useBodyMap(all);
    const lintIssues = dc.useMemo(
        () => computeLintMap(all, p => lintPresentation(p, bodyMap.get(p.$path) ?? "")),
        [all, bodyMap],
    );

    const { issueFilter, setIssueFilter, issueCounts, totalIssues, itemsWithLint } =
        useLintState(all, lintIssues);

    const { sorted, sortField, setSortField, sortDir, setSortDir } = useSortBy(
        all, SORT_FIELDS, "created", "desc",
        (item, f) => f === "name" ? item.$name : String(item.value(f) ?? ""),
    );

    const filtered = dc.useMemo(() => {
        const q = search.toLowerCase();
        return sorted.filter(p => {
            if (catFilter    !== "All" && String(p.value("category") ?? "") !== catFilter)    return false;
            if (statusFilter !== "All" && String(p.value("status")   ?? "") !== statusFilter) return false;
            if (issueFilter  !== "All") {
                const iss = lintIssues.get(p.$path) ?? [];
                if (!iss.some(i => i.code === issueFilter)) return false;
            }
            if (q && !p.$name.toLowerCase().includes(q)) return false;
            return true;
        });
    }, [sorted, catFilter, statusFilter, search, issueFilter, lintIssues]);

    const counts = V.countByStatus(all, STATUSES, { defaultStatus: "Idea" });

    return (
        <div>
            <KPIRow items={[
                { label: "Total",    value: all.length },
                { label: "Idea",     value: counts.Idea,     color: STATUS_COLOR.Idea },
                { label: "Drafting", value: counts.Drafting, color: STATUS_COLOR.Drafting },
                { label: "Review",   value: counts.Review,   color: STATUS_COLOR.Review },
                { label: "Done",     value: counts.Done,     color: STATUS_COLOR.Done },
            ]} />

            <LintPanel
                totalIssues={totalIssues} itemsWithLint={itemsWithLint}
                codes={PRES_ISSUE_CODES} labels={PRES_ISSUE_LABELS}
                issueCounts={issueCounts} issueFilter={issueFilter}
                setIssueFilter={setIssueFilter} icon="🎞" noun="presentation"
            />

            <NewForm
                label="+ New Presentation"
                folder="Systems/Presentations"
                tag={["system/presentations/presentation"]}
                defaults={{ theme: "moon", highlightTheme: "github-dark", transition: "slide", created: V.today(), aliases: [] }}
                fields={[
                    { name: "name",     placeholder: "Presentation title", width: "260px" },
                    { name: "category", type: "select", options: CATEGORIES, default: "Technical" },
                    { name: "status",   type: "select", options: STATUSES,   default: "Idea" },
                ]}
                body={presBody}
                addHeading={false}
            />

            <FilterPills label="Category:" options={["All", ...CATEGORIES]} value={catFilter} onChange={setCatFilter} />
            <FilterPills label="Status:"   options={["All", ...STATUSES]}   value={statusFilter} onChange={setStatusFilter} />

            <div style={{ display: "flex", gap: "8px", alignItems: "center", margin: "6px 0 8px" }}>
                <input
                    type="text" placeholder="🔍 search title…" value={searchInput}
                    onChange={e => setSearchInput(e.target.value)}
                    style={{ width: "220px" }}
                />
                <SortBar
                    fields={SORT_FIELDS} field={sortField} setField={setSortField}
                    dir={sortDir} setDir={setSortDir}
                />
                <span style={{ fontSize: "0.78em", color: "var(--text-muted)", marginLeft: "auto" }}>
                    {filtered.length} of {all.length}
                </span>
            </div>

            {filtered.length === 0
                ? <EmptyState message={
                    all.length === 0
                        ? "No presentations yet — create one above."
                        : "No presentations match the current filters."
                  } />
                : <dc.Table paging={20} rows={filtered} columns={[
                    { id: "Presentation", value: p => p.$link },
                    {
                        id: "Category",
                        value: p => String(p.value("category") ?? ""),
                        render: (_, p) => (
                            <dc.VanillaSelect
                                value={String(p.value("category") ?? "")}
                                options={CATEGORIES.map(c => ({ value: c, label: c }))}
                                onValueChange={v => V.setField(p, "category", v)}
                            />
                        ),
                    },
                    {
                        id: "Status",
                        value: p => String(p.value("status") ?? "Idea"),
                        render: (_, p) => {
                            const s = String(p.value("status") ?? "Idea");
                            return (
                                <dc.VanillaSelect
                                    value={s}
                                    options={STATUSES.map(st => ({ value: st, label: st }))}
                                    onValueChange={v => V.setField(p, "status", v)}
                                />
                            );
                        },
                    },
                    {
                        id: "Created",
                        value: p => String(p.value("created") ?? ""),
                        render: (_, p) => (
                            <span style={{ fontSize: "0.85em", color: "var(--text-muted)" }}>
                                {V.fmtDate(p.value("created"))}
                            </span>
                        ),
                    },
                    lintColumn(lintIssues, issueFilter, setIssueFilter),
                    {
                        id: " ",
                        value: () => 0,
                        render: (_, p) => (
                            <button title="Export as standalone HTML presentation"
                                onClick={() => exportPresentation(p)}
                                style={{ fontSize: "0.75em", padding: "1px 5px", cursor: "pointer",
                                    color: "var(--color-blue)", background: "none", border: "none" }}>
                                📤
                            </button>
                        ),
                    },
                    deleteColumn("presentation"),
                ]} />
            }
        </div>
    );
};
```
