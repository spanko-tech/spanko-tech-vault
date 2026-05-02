---
tags:
  - fabrica/issues-system
---

# Issues

```datacorejsx
const V = await dc.require("Toolkit/Datacore/Vault.js");
const { Kanban, Section, StatusSelect, useDebouncedSearch, SearchableSelect, useSortBy, SortBar } = await dc.require("Toolkit/Datacore/UI.jsx");
const { safeName, daysSince, fmtDate, ensureFolder, notify, today } = V;

const ACTIVE_STATUS = ["Todo", "In Progress", "Review", "Done"];
const ALL_STATUS    = ["Backlog", ...ACTIVE_STATUS];
const PRIORITY      = ["Low", "Med", "High", "Critical"];
const PRIO_COLOR    = { Low: "#888", Med: "var(--color-blue)", High: "var(--color-orange)", Critical: "var(--color-red)" };
const DONE_RECENT_DAYS = 7;
const ROOT = "Systems/Issues";

async function setStatus(page, newStatus) {
    const proj = page.value("project") ?? "Unfiled";
    const oldPath = page.$path;
    await V.setFields(page, {
        status: newStatus,
        ...(newStatus === "Done" && !page.value("done") ? { done: today() } : {})
    });
    const cleanProj = safeName(proj) || "Unfiled";
    const destFolder = `${ROOT}/${cleanProj}/${newStatus}`;
    await ensureFolder(destFolder);
    const fileName = oldPath.split("/").pop();
    const newPath = `${destFolder}/${fileName}`;
    if (oldPath !== newPath) {
        const file = dc.app.vault.getAbstractFileByPath(oldPath);
        if (file) try { await dc.app.fileManager.renameFile(file, newPath); } catch (_) {}
    }
}

async function archiveIssue(page) {
    await V.setFields(page, { archived: true, ...(page.value("archived_date") ? {} : { archived_date: today() }) });
    notify("Archived");
}

async function unarchiveIssue(page) {
    await V.setField(page, "archived", false);
    notify("Unarchived");
}

async function deleteIssue(page) {
    const file = dc.app.vault.getAbstractFileByPath(page.$path);
    if (file) await dc.app.vault.delete(file);
    notify("Deleted");
}

async function setIssueReleaseField(issue, relName, allReleases) {
    if (!relName) { await V.setField(issue, "release", null); return; }
    const proj = issue.value("project") ?? "";
    const r = allReleases.find(x => x.$name === relName && (x.value("project") ?? "") === proj);
    const linkTarget = r ? r.$path.replace(/\.md$/, "") : relName;
    await V.setField(issue, "release", `[[${linkTarget}|${relName}]]`);
}

function NewIssueForm({ projects, releases, defaultProject, defaultRelease = "" }) {
    const [open, setOpen] = dc.useState(false);
    const [name, setName] = dc.useState("");
    const [project, setProject] = dc.useState(defaultProject ?? (projects[0]?.$name ?? ""));
    const [priority, setPriority] = dc.useState("Med");
    const [status, setStatus_] = dc.useState("Backlog");
    const [release, setRelease] = dc.useState(defaultRelease);
    const [aiDelegated, setAiDelegated] = dc.useState(false);

    const releaseOptions = dc.useMemo(() => {
        const opts = [{ value: "", label: "— none —" }];
        for (const r of releases) {
            if ((r.value("project") ?? "") !== project) continue;
            if ((r.value("status") ?? "Released") === "Released") continue;
            opts.push({ value: r.$name, label: r.$name });
        }
        return opts;
    }, [releases, project]);

    if (!open) return <button className="mod-cta" onClick={() => {
        setName(""); setProject(defaultProject ?? projects[0]?.$name ?? ""); setPriority("Med"); setStatus_("Backlog"); setRelease(defaultRelease ?? ""); setOpen(true);
    }} style={{ marginBottom: "8px" }}>+ New Issue</button>;
    return (
        <div style={{ padding: "10px", background: "var(--background-secondary)", borderRadius: "6px", marginBottom: "10px" }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", alignItems: "center" }}>
                <input type="text" placeholder="Issue title" value={name} onChange={e => setName(e.target.value)} style={{ width: "260px" }} />
                <label style={{ fontSize: "0.85em" }}>Project: <dc.VanillaSelect value={project} options={projects.map(p => ({ value: p.$name, label: p.$name }))} onValueChange={v => { setProject(v); setRelease(""); }} /></label>
                <label style={{ fontSize: "0.85em" }}>Status: <dc.VanillaSelect value={status} options={ALL_STATUS.map(s => ({ value: s, label: s }))} onValueChange={setStatus_} /></label>
                <label style={{ fontSize: "0.85em" }}>Priority: <dc.VanillaSelect value={priority} options={PRIORITY.map(p => ({ value: p, label: p }))} onValueChange={setPriority} /></label>
                <label style={{ fontSize: "0.85em" }}>Release: <dc.VanillaSelect value={release} options={releaseOptions} onValueChange={setRelease} /></label>
                <label style={{ fontSize: "0.85em", display: "inline-flex", alignItems: "center", gap: "4px" }} title="When checked, an AI agent is allowed to work on this issue">
                    <input type="checkbox" checked={aiDelegated} onChange={e => setAiDelegated(e.target.checked)} />🤖 AI delegated
                </label>
                <button className="mod-cta" onClick={async () => {
                    const cleanName = safeName(name) || "Untitled";
                    const cleanProj = safeName(project) || "Unfiled";
                    const folder = `${ROOT}/${cleanProj}/${status}`;
                    await ensureFolder(folder);
                    const fmLines = [
                        "---",
                        "tags: [fabrica/issue]",
                        `project: ${project}`,
                        `status: ${status}`,
                        `priority: ${priority}`
                    ];
                    if (release) {
                        const r = releases.find(x => x.$name === release && (x.value("project") ?? "") === project);
                        const linkTarget = r ? r.$path.replace(/\.md$/, "") : release;
                        fmLines.push(`release: "[[${linkTarget}|${release}]]"`);
                    }
                    if (aiDelegated) fmLines.push("ai_delegated: true");
                    fmLines.push(`created: ${today()}`, "---", "", `# ${cleanName}`, "");
                    const path = `${folder}/${cleanName}.md`;
                    try {
                        await dc.app.vault.create(path, fmLines.join("\n"));
                        notify(`Created ${cleanName}`);
                        setName(""); // keep form open for chaining
                    } catch (e) { notify(`Failed: ${e.message}`); }
                }}>Create</button>
                <button onClick={() => { setOpen(false); setName(""); }}>Close</button>
            </div>
        </div>
    );
}

function IssueRow({ issue, opacity = 1, action, releases = [], hideReleased = false }) {
    const proj = issue.value("project") ?? "";
    const relName = V.linkBasename(issue.value("release")) ?? "";
    const rowRelOpts = dc.useMemo(() => {
        const opts = [{ value: "", label: "— none —" }];
        for (const r of releases) {
            if ((r.value("project") ?? "") !== proj) continue;
            if (hideReleased && (r.value("status") ?? "") === "Released") continue;
            opts.push({ value: r.$name, label: r.$name });
        }
        return opts;
    }, [releases, proj, hideReleased]);
    return <div style={{
        display: "flex", alignItems: "center", gap: "8px",
        padding: "5px 8px", marginBottom: "4px",
        background: "var(--background-primary)", borderRadius: "4px",
        borderLeft: `3px solid ${PRIO_COLOR[issue.value("priority") ?? "Med"]}`,
        opacity
    }}>
        <div style={{ flex: 1, fontSize: "0.85em" }}>
            <span style={{ fontWeight: 500 }}><dc.Link link={issue.$link} /></span>
            <span style={{ opacity: 0.55, marginLeft: "8px", fontSize: "0.85em" }}>
                {proj || "—"}
                {issue.value("archived_date") ? ` · archived ${fmtDate(issue.value("archived_date"))}` : ""}
            </span>
        </div>
        <span
            title={issue.value("ai_delegated") ? "AI delegated · click to remove" : "Not AI delegated · click to delegate"}
            onClick={() => V.setField(issue, "ai_delegated", issue.value("ai_delegated") ? null : true)}
            style={{ fontSize: "0.85em", cursor: "pointer", opacity: issue.value("ai_delegated") ? 1 : 0.25 }}>
            🤖
        </span>
        <span style={{ fontSize: "0.75em" }}>
            <dc.VanillaSelect value={relName} options={rowRelOpts} onValueChange={v => setIssueReleaseField(issue, v, releases)} />
        </span>
        <span style={{ fontSize: "0.75em" }}>
            <StatusSelect item={issue} field="priority" options={PRIORITY} defaultValue="Med" />
        </span>
        {action}
    </div>;
}

function IssueCard({ issue, extra, releases = [], hideReleased = false }) {
    const prio = issue.value("priority") ?? "Med";
    const proj = issue.value("project") ?? "";
    const relName = V.linkBasename(issue.value("release")) ?? "";
    const cardRelOpts = dc.useMemo(() => {
        const opts = [{ value: "", label: "— none —" }];
        for (const r of releases) {
            if ((r.value("project") ?? "") !== proj) continue;
            if (hideReleased && (r.value("status") ?? "") === "Released") continue;
            opts.push({ value: r.$name, label: r.$name });
        }
        return opts;
    }, [releases, proj, hideReleased]);
    return (
        <div style={{
            background: "var(--background-primary)", borderRadius: "5px",
            padding: "6px 8px", marginBottom: "6px",
            borderLeft: `3px solid ${PRIO_COLOR[prio]}`
        }}>
            <div style={{ fontSize: "0.88em", fontWeight: 500 }}><dc.Link link={issue.$link} /></div>
            <div style={{ fontSize: "0.72em", opacity: 0.75, marginTop: "2px", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "4px" }}>
                <span style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "4px 6px", flex: 1, minWidth: 0 }}>
                    <span style={{ opacity: 0.7 }}>{proj || "—"}</span>
                    <StatusSelect item={issue} field="priority" options={PRIORITY} defaultValue="Med" />
                    <dc.VanillaSelect value={relName} options={cardRelOpts} onValueChange={v => setIssueReleaseField(issue, v, releases)} style={{ maxWidth: "120px", overflow: "hidden", textOverflow: "ellipsis" }} />
                    <span
                        title={issue.value("ai_delegated") ? "AI delegated · click to remove" : "Not AI delegated · click to delegate"}
                        onClick={() => V.setField(issue, "ai_delegated", issue.value("ai_delegated") ? null : true)}
                        style={{ fontSize: "0.85em", cursor: "pointer", opacity: issue.value("ai_delegated") ? 1 : 0.25 }}>
                        🤖
                    </span>
                </span>
                {extra}
            </div>
        </div>
    );
}

return function View() {
    const allIssues = dc.useQuery(V.q("fabrica/issue",   "Systems/Issues"));
    const projects  = dc.useQuery(V.q("fabrica/project", "Systems/Projects"));
    const releases  = dc.useQuery(V.q("fabrica/release", "Systems/Releases"));
    const [issueProject, setIssueProject]     = dc.useState("All");
    const [issueRelease, setIssueRelease]     = dc.useState("All");
    const [issueCategoryFilter, setIssueCategoryFilter] = dc.useState("All");
    const [showAllDone,  setShowAllDone]      = dc.useState(false);
    const [hideReleasedReleases, setHideReleasedReleases] = dc.useState(true);
    const [archiveProject, setArchiveProject] = dc.useState("All");
    const [searchInput, setSearchInput, search] = useDebouncedSearch(200);

    const projectNames = ["All", ...projects.map(p => p.$name)];

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
        if (issueCategoryFilter === "All") return projectNames;
        return ["All", ...projects.filter(p => (projectCategoryMap[p.$name] ?? "") === issueCategoryFilter).map(p => p.$name)];
    }, [projectNames, projects, issueCategoryFilter, projectCategoryMap]);

    const releaseOptions = dc.useMemo(() => {
        const opts = [{ value: "All", label: "All" }, { value: "__none__", label: "— none —" }];
        for (const r of releases) {
            if (issueProject !== "All" && (r.value("project") ?? "") !== issueProject) continue;
            if (hideReleasedReleases && (r.value("status") ?? "") === "Released") continue;
            const proj = r.value("project") ?? "Unassigned";
            const label = issueProject === "All" ? `${r.$name} (${proj})` : r.$name;
            opts.push({ value: `${proj}::${r.$name}`, label });
        }
        return opts;
    }, [releases, issueProject, hideReleasedReleases]);

    const live     = dc.useMemo(() => allIssues.filter(i => i.value("archived") !== true), [allIssues]);
    const archived = dc.useMemo(() => allIssues.filter(i => i.value("archived") === true), [allIssues]);

    const filtered = dc.useMemo(
        () => live.filter(i => {
            if (issueProject !== "All" && i.value("project") !== issueProject) return false;
            if (issueRelease !== "All") {
                const rn = V.linkBasename(i.value("release")) || null;
                if (issueRelease === "__none__") { if (rn != null) return false; }
                else {
                    const [relProj, relName] = issueRelease.split("::");
                    if (!(rn === relName && i.value("project") === relProj)) return false;
                }
            }
            if (search && !String(i.$name).toLowerCase().includes(search)) return false;
            return true;
        }),
        [live, issueProject, issueRelease, search]
    );

    const archivedFiltered = dc.useMemo(
        () => archiveProject === "All" ? archived : archived.filter(i => i.value("project") === archiveProject),
        [archived, archiveProject]
    );

    const ISSUE_SORT_FIELDS = [
        { value: "$name",       label: "Name" },
        { value: "priority",    label: "Priority" },
        { value: "status",      label: "Status" },
        { value: "project",     label: "Project" },
        { value: "release",     label: "Release" },
        { value: "ai_delegated",label: "AI delegated" },
        { value: "created",     label: "Created" },
    ];
    const { sorted: filteredSorted, sortField: issueSortField, setSortField: setIssueSortField, sortDir: issueSortDir, setSortDir: setIssueSortDir } = useSortBy(filtered, ISSUE_SORT_FIELDS);
    const archiveSorted = dc.useMemo(() => {
        return [...archivedFiltered].sort((a, b) => {
            const va = issueSortField === "$name" ? (a.$name ?? "") : String(a.value?.(issueSortField) ?? "");
            const vb = issueSortField === "$name" ? (b.$name ?? "") : String(b.value?.(issueSortField) ?? "");
            const cmp = va.localeCompare(vb, undefined, { numeric: true, sensitivity: "base" });
            return issueSortDir === "asc" ? cmp : -cmp;
        });
    }, [archivedFiltered, issueSortField, issueSortDir]);

    const byStatus = V.groupByStatus(filteredSorted, ALL_STATUS, { defaultStatus: "Backlog" });
    const backlog = byStatus["Backlog"];
    const doneAll = byStatus["Done"];
    const doneRecentItems = doneAll.filter(i => {
        const age = daysSince(i.value("done") ?? i.value("created"));
        return age != null && age <= DONE_RECENT_DAYS;
    });

    const boardItems = dc.useMemo(() => {
        const out = [];
        for (const col of ACTIVE_STATUS) {
            if (col === "Done") {
                out.push(...(showAllDone ? doneAll : doneRecentItems));
            } else {
                out.push(...byStatus[col]);
            }
        }
        return out;
    }, [byStatus, showAllDone]);

    return (
        <div>
            <NewIssueForm projects={projects} releases={releases}
                defaultProject={issueProject !== "All" ? issueProject : undefined}
                defaultRelease={issueRelease !== "All" && issueRelease !== "__none__" ? issueRelease.split("::")[1] : ""} />

            <div style={{ marginBottom: "10px", display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
                <label style={{ display: "flex", alignItems: "center", gap: "4px" }}>Category:&nbsp;
                    <SearchableSelect value={issueCategoryFilter}
                        options={["All", ...projectCategories]}
                        onValueChange={v => { setIssueCategoryFilter(v); setIssueProject("All"); }} />
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: "4px" }}>Project:&nbsp;
                    <SearchableSelect value={issueProject}
                        options={filteredProjectNames}
                        onValueChange={v => { setIssueProject(v); setIssueRelease("All"); }} />
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: "4px" }}>Release:&nbsp;
                    <SearchableSelect value={issueRelease}
                        options={releaseOptions}
                        onValueChange={v => {
                            setIssueRelease(v);
                            if (v !== "All" && v !== "__none__") {
                                const [relProj] = v.split("::");
                                if (relProj && relProj !== "Unassigned") setIssueProject(relProj);
                            }
                        }} />
                </label>
                <input type="text" placeholder="🔍 search issues…" value={searchInput}
                    onChange={e => setSearchInput(e.target.value)}
                    style={{ width: "200px" }} />
                <label style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "0.85em", cursor: "pointer" }}>
                    <input type="checkbox" checked={hideReleasedReleases} onChange={e => setHideReleasedReleases(e.target.checked)} />
                    Hide Released
                </label>
                <SortBar fields={ISSUE_SORT_FIELDS} field={issueSortField} setField={setIssueSortField} dir={issueSortDir} setDir={setIssueSortDir} />
            </div>

            <Section title={<span>📥 Backlog ({backlog.length}) <span style={{ opacity: 0.5, fontSize: "0.85em" }}>· promote items into the active flow</span></span>} defaultOpen={backlog.length > 0}>
                {backlog.length === 0
                    ? <div style={{ fontSize: "0.82em", opacity: 0.6, fontStyle: "italic", padding: "4px 0" }}>nothing parked</div>
                    : backlog.map(i => <IssueRow key={i.$path} issue={i} releases={releases} hideReleased={hideReleasedReleases}
                        action={<button onClick={() => setStatus(i, "Todo")} style={{ fontSize: "0.78em", padding: "2px 8px" }}>→ Todo</button>} />)}
            </Section>

            <Kanban
                columns={ACTIVE_STATUS}
                items={boardItems}
                getCol={i => i.value("status") ?? "Backlog"}
                onMove={(i, col) => setStatus(i, col)}
                columnHeader={(col, items) => {
                    const isDone = col === "Done";
                    const total = isDone ? doneAll.length : items.length;
                    return <div>
                        <div style={{ fontSize: "0.78em", textTransform: "uppercase", opacity: 0.7, marginBottom: "6px" }}>{col} ({total})</div>
                    </div>;
                }}
                renderCard={(i, col) => <IssueCard issue={i} releases={releases} hideReleased={hideReleasedReleases} extra={col === "Done" ? (
                    <span style={{ display: "inline-flex", gap: "4px" }}>
                        <button onClick={() => archiveIssue(i)} title="Archive (hide from board, keep file)" style={{ fontSize: "0.7em", padding: "1px 6px" }}>🗄</button>
                        <button onClick={() => deleteIssue(i)} title="Delete file permanently" style={{ fontSize: "0.7em", padding: "1px 6px" }}>✕</button>
                    </span>
                ) : null} />}
            />

            {doneAll.length > doneRecentItems.length ? (
                <div style={{ textAlign: "center", marginTop: "6px" }}>
                    <a onClick={() => setShowAllDone(s => !s)} style={{ fontSize: "0.78em", opacity: 0.7, cursor: "pointer" }}>
                        {showAllDone ? `← Collapse Done to last ${DONE_RECENT_DAYS}d` : `Show ${doneAll.length - doneRecentItems.length} older Done →`}
                    </a>
                </div>
            ) : null}

            <div style={{ marginTop: "16px" }}>
                <Section title={`🗄 Archive (${archived.length})`}>
                    <label style={{ fontSize: "0.82em", display: "flex", alignItems: "center", gap: "4px" }}>Project:&nbsp;
                        <SearchableSelect value={archiveProject}
                            options={projectNames}
                            onValueChange={setArchiveProject} />
                    </label>
                    <div style={{ marginTop: "8px" }}>
                        {archivedFiltered.length === 0
                            ? <div style={{ fontSize: "0.82em", opacity: 0.6, fontStyle: "italic" }}>nothing archived</div>
                            : archiveSorted.map(i => <IssueRow key={i.$path} issue={i} releases={releases} hideReleased={hideReleasedReleases} opacity={0.85}
                                action={<button onClick={() => unarchiveIssue(i)} title="Restore to board" style={{ fontSize: "0.72em", padding: "2px 6px" }}>↩ Restore</button>} />)}
                    </div>
                </Section>
            </div>
        </div>
    );
};
```
