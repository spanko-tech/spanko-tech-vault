---
tags:
  - fabrica/releases-system
---

# Releases

```datacorejsx
const V = await dc.require("Toolkit/Datacore/Vault.js");
const { NewForm, StatusSelect, FilterPills, useDebouncedSearch, SearchableSelect, useSortBy, SortBar, computeLintMap, useLintState, LintPanel } = await dc.require("Toolkit/Datacore/UI.jsx");
const fmtDate = V.fmtDate;

const REL_ISSUE_CODES = ["no-highlights", "no-changes", "breaking-empty"];
const REL_ISSUE_LABELS = { "no-highlights": "no highlights", "no-changes": "no changes", "breaking-empty": "breaking empty" };

function sectionContent(body, name) {
    const esc = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`##\\s+${esc}\\s*\\n([\\s\\S]*?)(?=\\n##\\s|$)`, "i");
    const m = body.match(re);
    return m ? m[1].trim() : null;
}

function lintRelease(r) {
    const issues = [];
    const status = r.value("status") ?? "Planned";
    const breaking = r.value("breaking") === "Yes";
    const body = String(r.$body ?? "");
    if (status !== "Planned") {
        if (!sectionContent(body, "Highlights")) issues.push({ code: "no-highlights", severity: "warn", message: "Highlights empty" });
        if (!sectionContent(body, "Added") && !sectionContent(body, "Changed") && !sectionContent(body, "Fixed"))
            issues.push({ code: "no-changes", severity: "warn", message: "Added/Changed/Fixed all empty" });
    }
    if (breaking && !sectionContent(body, "Breaking")) issues.push({ code: "breaking-empty", severity: "error", message: "Breaking section empty" });
    return issues;
}

function DateEditor({ item, field }) {
    const [editing, setEditing] = dc.useState(false);
    const raw = String(item.value(field) ?? "");
    if (editing) {
        return (
            <span style={{ display: "inline-flex", alignItems: "center", gap: "2px" }}>
                <input type="date"
                    defaultValue={raw || new Date().toISOString().slice(0, 10)}
                    autoFocus
                    onBlur={async e => { if (e.target.value) await V.setField(item, field, e.target.value); setEditing(false); }}
                    onKeyDown={e => { if (e.key === "Escape") setEditing(false); if (e.key === "Enter") { V.setField(item, field, e.target.value); setEditing(false); } }}
                    style={{ width: "130px" }}
                />
                <button onMouseDown={e => { e.preventDefault(); setEditing(false); }}
                    style={{ cursor: "pointer", background: "transparent", border: "none", padding: "0 2px", opacity: 0.7, fontSize: "0.8em" }}>✕</button>
            </span>
        );
    }
    return (
        <span onClick={() => setEditing(true)} title="Click to edit date"
            style={{ cursor: "pointer", opacity: 0.65, borderBottom: "1px dashed var(--text-muted)" }}>
            {fmtDate(raw) || "—"}
        </span>
    );
}

return function View() {
    const releases = dc.useQuery(V.q("fabrica/release", "Systems/Releases"));
    const projects = dc.useQuery(V.q("fabrica/project", "Systems/Projects"));
    const issues   = dc.useQuery(V.q("fabrica/issue",   "Systems/Issues"));
    const [projFilter, setProjFilter]     = dc.useState("All");
    const [statusFilter, setStatusFilter] = dc.useState("All");
    const [relCategoryFilter, setRelCategoryFilter] = dc.useState("All");
    const [searchInput, setSearchInput, search] = useDebouncedSearch(200);

    const RELEASE_STATUS = ["Planned", "In Progress", "Released"];
    const STATUS_COLOR   = { Planned: "var(--color-orange)", "In Progress": "var(--color-blue)", Released: "var(--color-green)" };

    const projectNames = ["All", ...projects.map(p => p.$name).sort(), "Unassigned"];

    const projectCategoryMap = dc.useMemo(() => {
        const m = {};
        for (const p of projects) m[p.$name] = String(p.value("category") ?? "").trim();
        return m;
    }, [projects]);
    const projectCategories = dc.useMemo(() => {
        const s = new Set(Object.values(projectCategoryMap).filter(Boolean));
        return Array.from(s).sort();
    }, [projectCategoryMap]);
    const filteredProjectNames = dc.useMemo(() => {
        if (relCategoryFilter === "All") return projectNames;
        const matching = projects.filter(p => (projectCategoryMap[p.$name] ?? "") === relCategoryFilter).map(p => p.$name).sort();
        return ["All", ...matching, "Unassigned"];
    }, [projectNames, projects, relCategoryFilter, projectCategoryMap]);

    const RELEASE_SORT_FIELDS = [
        { value: "$name",   label: "Name" },
        { value: "date",    label: "Date" },
        { value: "status",  label: "Status" },
        { value: "version", label: "Version" },
        { value: "project", label: "Project" },
    ];
    const { sorted: sortedReleases, sortField: relSortField, setSortField: setRelSortField, sortDir: relSortDir, setSortDir: setRelSortDir } = useSortBy(releases, RELEASE_SORT_FIELDS, "date", "desc");

    const relLints = dc.useMemo(() => computeLintMap(releases, lintRelease), [releases]);
    const { issueFilter: relIssueFilter, setIssueFilter: setRelIssueFilter, issueCounts: relIssueCounts, totalIssues: totalRelIssues, itemsWithLint: relWithIssues } =
        useLintState(releases, relLints);

    const issuesByRelease = dc.useMemo(() => {
        const m = {};
        for (const i of issues) {
            const rel = i.value("release");
            if (!rel) continue;
            const relName = V.linkBasename(rel);
            if (!relName) continue;
            const key = `${i.value("project") ?? ""}::${relName}`;
            (m[key] ??= []).push(i);
        }
        return m;
    }, [issues]);

    const grouped = {};
    for (const r of sortedReleases) {
        const p = r.value("project") ?? "Unassigned";
        const s = r.value("status") ?? "Released";
        if (projFilter !== "All" && p !== projFilter) continue;
        if (statusFilter !== "All" && s !== statusFilter) continue;
        if (search && !r.$name.toLowerCase().includes(search)) continue;
        if (relIssueFilter !== "All") {
            const iss = relLints.get(r.$path) ?? [];
            if (!iss.some(i => i.code === relIssueFilter)) continue;
        }
        (grouped[p] ??= []).push(r);
    }

    const nextVersionFor = (proj) => {
        const rels = releases.filter(r => (r.value("project") ?? "") === proj);
        if (rels.length === 0) return "0.1.0";
        const parsed = rels.map(r => {
            const v = String(r.value("version") ?? "0.0.0").split(".").map(n => parseInt(n, 10) || 0);
            return [v[0] ?? 0, v[1] ?? 0, v[2] ?? 0];
        }).sort((a, b) => b[0]-a[0] || b[1]-a[1] || b[2]-a[2]);
        const [x, y, z] = parsed[0];
        return `${x}.${y}.${z + 1}`;
    };

    const defaultProject = projects[0]?.$name ?? "";
    const defaultVersion = defaultProject ? nextVersionFor(defaultProject) : "0.1.0";

    return (
        <div>
            <NewForm label="+ New Release" folder='Systems/Releases' tag={["fabrica/release"]}
                folderFn={vals => `Systems/Releases/${(vals.project || "Unassigned").replace(/[\\/:*?"<>|]/g, "-")}`}
                body={() => V.bodyTemplate(["Highlights", "Added", "Changed", "Fixed", "Breaking"])}
                effects={[{ when: "project", set: "version", compute: (proj) => nextVersionFor(proj) }]}
                initialValues={{
                    project: projFilter !== "All" && projFilter !== "Unassigned" ? projFilter : undefined,
                    status:  statusFilter !== "All" ? statusFilter : undefined
                }}
                fields={[
                    { name: "name", placeholder: "Title (e.g. v0.3.0)", width: "260px" },
                    { name: "project", type: "select", options: projects.map(p => p.$name), default: defaultProject },
                    { name: "version", type: "version", default: defaultVersion },
                    { name: "status", type: "select", options: RELEASE_STATUS, default: "Planned" },
                    { name: "date", type: "date", default: V.today(), width: "150px" },
                    { name: "breaking", type: "select", options: ["No", "Yes"], default: "No" }
                ]}
            />
            <div style={{ marginBottom: "10px" }}>
                <FilterPills label="Status:" options={["All", ...RELEASE_STATUS]} value={statusFilter} onChange={setStatusFilter} />
                {/* Category + Project */}
                <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.85em", marginBottom: "4px" }}>
                    <span style={{ opacity: 0.7 }}>Category:</span>
                    <SearchableSelect value={relCategoryFilter} options={["All", ...projectCategories]}
                        onValueChange={v => { setRelCategoryFilter(v); setProjFilter("All"); }} />
                    <span style={{ opacity: 0.7 }}>Project:</span>
                    <SearchableSelect value={projFilter} options={filteredProjectNames} onValueChange={setProjFilter} />
                </div>
                {/* Search + Sort */}
                <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "2px" }}>
                    <input type="text" placeholder="🔍 search releases…" value={searchInput}
                        onChange={e => setSearchInput(e.target.value)}
                        style={{ width: "220px" }} />
                    <SortBar fields={RELEASE_SORT_FIELDS} field={relSortField} setField={setRelSortField} dir={relSortDir} setDir={setRelSortDir} />
                </div>
            </div>
            <LintPanel totalIssues={totalRelIssues} itemsWithLint={relWithIssues}
                codes={REL_ISSUE_CODES} labels={REL_ISSUE_LABELS}
                issueCounts={relIssueCounts} issueFilter={relIssueFilter}
                setIssueFilter={setRelIssueFilter} icon="📦" noun="release" />
            {Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b)).map(([proj, rels]) => (
                <div key={proj} style={{ marginBottom: "14px" }}>
                    <h4 style={{ marginBottom: "4px" }}>{proj}</h4>
                    <div style={{ borderLeft: "2px solid var(--background-modifier-border)", paddingLeft: "10px" }}>
                        {rels.map(r => {
                            const breaking = r.value("breaking") === "Yes";
                            const status   = r.value("status") ?? "Released";
                            const linked   = issuesByRelease[`${proj}::${r.$name}`] ?? [];
                            const doneCt   = linked.filter(i => i.value("status") === "Done").length;
                            return <div key={r.$path} style={{ marginBottom: "8px", padding: "6px 10px", background: "var(--background-secondary)", borderRadius: "4px", borderLeft: breaking ? "3px solid var(--color-red)" : "3px solid var(--interactive-accent)" }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                    <span onClick={() => V.openNote(r.$path)}
                                        style={{ cursor: "pointer", fontWeight: "bold", color: "var(--text-accent)" }}>
                                        {r.$name} {String(r.value("version") ?? "") ? `· v${r.value("version")}` : ""}
                                    </span>
                                    <span style={{ fontSize: "0.8em", opacity: 0.85, display: "flex", alignItems: "center", gap: "8px" }}>
                                        <span style={{ borderLeft: `3px solid ${STATUS_COLOR[status] ?? "var(--background-modifier-border)"}`, paddingLeft: "6px" }}>
                                            <StatusSelect item={r} field="status" options={RELEASE_STATUS} defaultValue="Planned" />
                                        </span>
                                        <DateEditor item={r} field="date" />
                                        <span
                                            onClick={async () => { await V.setField(r, "breaking", breaking ? "No" : "Yes"); }}
                                            title={breaking ? "Breaking · click to mark non-breaking" : "Non-breaking · click to mark breaking"}
                                            style={{ fontSize: "0.85em", cursor: "pointer", color: breaking ? "var(--color-red)" : "var(--text-muted)", opacity: breaking ? 1 : 0.35 }}>
                                            BREAKING
                                        </span>
                                        {(() => {
                                            const iss = lintRelease(r);
                                            if (!iss.length) return null;
                                            return <span title={iss.map(i => i.message).join(", ")} style={{ color: iss.some(i => i.severity === "error") ? "var(--color-red)" : "var(--color-orange)", fontSize: "0.9em" }}>⚠</span>;
                                        })()}
                                    </span>
                                </div>
                                {linked.length > 0 && (
                                    <div style={{ marginTop: "6px", paddingTop: "6px", borderTop: "1px solid var(--background-modifier-border)", fontSize: "0.8em" }}>
                                        <div style={{ opacity: 0.7, marginBottom: "3px" }}>Issues ({doneCt}/{linked.length} done)</div>
                                        {linked.map(i => (
                                            <div key={i.$path} style={{ display: "flex", gap: "6px", alignItems: "center", padding: "2px 0" }}>
                                                <span style={{ fontSize: "0.75em", opacity: 0.6, minWidth: "70px" }}>{i.value("status") ?? "Backlog"}</span>
                                                <dc.Link link={i.$link} />
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>;
                        })}
                    </div>
                </div>
            ))}
        </div>
    );
};
```

