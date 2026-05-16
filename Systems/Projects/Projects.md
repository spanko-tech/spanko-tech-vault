---
dashboard: true
tags:
  - system/projects
---
# Projects

```datacorejsx
const V = await dc.require("Toolkit/Datacore/Vault.js");
const { NewForm, EditText, StatusSelect, SearchableSelect, useSortBy, SortBar, useDebouncedSearch, useBodyMap, MultiSelectPills, useMultiFilter, FilterRow, computeLintMap, useLintState, LintPanel, lintColumn } = await dc.require("Toolkit/Datacore/UI.jsx");
const { lintProject, PROJ_ISSUE_CODES, PROJ_ISSUE_LABELS } = await dc.require("Toolkit/Datacore/LintRules.js");

const PROJECT_STATUS = ["Idea", "Active", "Paused", "Shipped", "Archived"];

return function View() {
    const projects = dc.useQuery(V.q("system/projects/project", "Systems/Projects"));
    const [statusFilters, toggleStatus, clearStatusFilters, statusPasses] = useMultiFilter();
    const [categoryFilter, setCategoryFilter] = dc.useState("All");
    const [searchInput, setSearchInput, search] = useDebouncedSearch(200);

    const categories = dc.useMemo(() => {
        const s = new Set();
        for (const p of projects) { const c = String(p.value("category") ?? "").trim(); if (c) s.add(c); }
        return Array.from(s).sort();
    }, [projects]);

    const counts = dc.useMemo(() => {
        const c = { All: projects.length };
        for (const s of PROJECT_STATUS) c[s] = 0;
        for (const p of projects) { const s = p.value("status") ?? "Active"; if (c[s] != null) c[s]++; }
        return c;
    }, [projects]);

    const bodyMap = useBodyMap(projects);

    const lintIssues = dc.useMemo(() => computeLintMap(projects, p => lintProject(p, bodyMap.get(p.$path) ?? "")), [projects, bodyMap]);
    const { issueFilter, setIssueFilter, issueCounts, totalIssues: totalLintIssues, itemsWithLint: projectsWithLint } =
        useLintState(projects, lintIssues);

    const filtered = dc.useMemo(() => {
        const q = search.toLowerCase().trim();
        return projects.filter(p => {
            if (!statusPasses(p.value("status") ?? "Active")) return false;
            if (categoryFilter !== "All" && String(p.value("category") ?? "").trim() !== categoryFilter) return false;
            if (q && !p.$name.toLowerCase().includes(q)) return false;
            if (issueFilter !== "All") {
                const iss = lintIssues.get(p.$path) ?? [];
                if (!iss.some(i => i.code === issueFilter)) return false;
            }
            return true;
        });
    }, [projects, statusFilters, categoryFilter, search, issueFilter, lintIssues]);

    const PROJECT_SORT_FIELDS = [
        { value: "$name",    label: "Name" },
        { value: "category", label: "Category" },
        { value: "status",   label: "Status" },
        { value: "stack",    label: "Stack" },
        { value: "summary",  label: "Summary" },
    ];
    const { sorted: sortedProjects, sortField: projSortField, setSortField: setProjSortField, sortDir: projSortDir, setSortDir: setProjSortDir } = useSortBy(filtered, PROJECT_SORT_FIELDS);

    return (
        <div>
            <NewForm label="+ New Project" folder='Systems/Projects' tag={["system/projects/project"]}
                addHeading={true}
                initialValues={{ status: statusFilters.size === 1 ? Array.from(statusFilters)[0] : undefined }}
                body={() => "\n## Goals\n\n## Stack\n\n## Resources\n\n```datacorejsx\nreturn function() {\n    const here = dc.useCurrentPath();\n    const name = here.split(\"/\").pop().replace(/\\.md$/, \"\");\n    const all = dc.useQuery('@page and #system/resources/resource');\n    const mine = all.filter(r => {\n        const ps = r.value(\"projects\") ?? [];\n        const arr = Array.isArray(ps) ? ps : [ps];\n        return arr.some(p => String(p).includes(name));\n    });\n    if (!mine.length) return <em>No resources tagged to this project yet.</em>;\n    return <dc.Table paging={20} rows={mine} columns={[\n        { id: \"Resource\", value: r => r.$link },\n        { id: \"Category\", value: r => String(r.value(\"category\") ?? \"\") },\n        { id: \"Vendor\",   value: r => String(r.value(\"vendor\") ?? \"\") }\n    ]} />;\n};\n```\n\n## Notes\n"}
                fields={[
                    { name: "name", placeholder: "Project name", width: "260px" },
                    { name: "status", type: "select", options: PROJECT_STATUS, default: "Idea" },
                    { name: "category", placeholder: "Category", width: "160px" },
                    { name: "stack", placeholder: "Stack (comma sep)", width: "200px" },
                    { name: "summary", placeholder: "1-line summary", width: "300px" }
                ]}
            />
            <div style={{ marginBottom: "8px" }}>
                <MultiSelectPills label="Status:" options={PROJECT_STATUS} selected={statusFilters} onToggle={toggleStatus} onClear={clearStatusFilters} counts={counts} />
                <FilterRow>
                    <span style={{ opacity: 0.7 }}>Category:</span>
                    <SearchableSelect value={categoryFilter} options={["All", ...categories]} onValueChange={setCategoryFilter} />
                    <input type="text" placeholder="🔍 search…" value={searchInput} onChange={e => setSearchInput(e.target.value)} style={{ width: "160px" }} />
                    <SortBar fields={PROJECT_SORT_FIELDS} field={projSortField} setField={setProjSortField} dir={projSortDir} setDir={setProjSortDir} />
                </FilterRow>
            </div>
            <LintPanel totalIssues={totalLintIssues} itemsWithLint={projectsWithLint}
                codes={PROJ_ISSUE_CODES} labels={PROJ_ISSUE_LABELS}
                issueCounts={issueCounts} issueFilter={issueFilter}
                setIssueFilter={setIssueFilter} icon="📋" noun="project" />
            <dc.Table paging={20} rows={sortedProjects}
                columns={[
                    { id: "Project", value: p => p.$link },
                    { id: "Category", value: p => String(p.value("category") ?? ""),
                      render: (_, p) => <EditText item={p} field="category" placeholder="category…" suggestions={categories} /> },
                    { id: "Status", value: p => String(p.value("status") ?? ""),
                      render: (_, p) => <StatusSelect item={p} options={PROJECT_STATUS} defaultValue="Active" /> },
                    { id: "Stack", value: p => String(p.value("stack") ?? ""), render: (_, p) => <EditText item={p} field="stack" /> },
                    { id: "Summary", value: p => String(p.value("summary") ?? ""), render: (_, p) => <EditText item={p} field="summary" /> },
                    lintColumn(lintIssues, issueFilter, setIssueFilter)
                ]} />
        </div>
    );
};
```

