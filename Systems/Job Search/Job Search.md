---
aliases: []
tags:
  - system/jobs
  - datacore/dashboard
---

# Job Search

Manage job applications with kanban workflow and document tracking.

```datacorejsx
const V = await dc.require("Toolkit/Datacore/Vault.js");
const { NewForm, KPIRow, TabStrip, Kanban, EditText, useDebouncedSearch } = await dc.require("Toolkit/Datacore/UI.jsx");
const { fmtDate, daysSince, today, notify } = V;

const APP_STATUS = ["Applied", "Interview", "Offer", "Rejected", "Archived"];
const APP_COLOR  = { Applied: "var(--color-blue)", Interview: "var(--color-orange)", Offer: "var(--color-green)", Rejected: "var(--color-red)", Archived: "#888" };
const PIPELINE   = ["Applied", "Interview", "Offer", "Rejected"];
const ARCHIVED   = ["Archived"];
const DOCS_FOLDER = "Systems/Job Search/Documents";

function listPdfs() {
    return dc.app.vault.getFiles()
        .filter(f => f.path.startsWith(DOCS_FOLDER + "/") && f.extension === "pdf")
        .map(f => f.path)
        .sort((a, b) => a.localeCompare(b));
}

function pdfBasename(path) {
    if (!path) return "";
    return String(path).split("/").pop().replace(/\.pdf$/i, "");
}

async function setDoc(app, field, value) {
    await V.setField(app, field, value || null);
}

function ImportPdfButton({ app, field, onImported }) {
    const ref = dc.useRef(null);
    const handleFile = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
            const buffer = await file.arrayBuffer();
            await V.ensureFolder(DOCS_FOLDER);
            const destPath = `${DOCS_FOLDER}/${file.name}`;
            await dc.app.vault.adapter.writeBinary(destPath, buffer);
            await V.setField(app, field, destPath);
            if (onImported) onImported();
            V.notify(`Imported ${file.name}`);
        } catch (err) {
            V.notify(`Import failed: ${err.message}`);
        }
        e.target.value = "";
    };
    return (
        <>
            <input ref={ref} type="file" accept=".pdf" style={{ display: "none" }} onChange={handleFile} />
            <button onClick={() => ref.current?.click()}
                title={`Import PDF and assign to ${field}`}
                style={{ cursor: "pointer", background: "transparent", border: "none", padding: "0 3px", fontSize: "0.9em" }}>
                📂
            </button>
        </>
    );
}

async function setStatus(app, newStatus) {
    if ((app.value("status") ?? "Applied") === newStatus) return;
    await V.setFields(app, {
        status: newStatus,
        ...(newStatus === "Applied" && !app.value("applied") ? { applied: today() } : {})
    });
    notify(`Moved to ${newStatus}`);
}

return function View() {
    const apps = dc.useQuery(V.q("system/jobs/application", "Systems/Job Search"));

    const [tab, setTab] = dc.useState("Pipeline");
    const [showArchived, setShowArchived] = dc.useState(false);
    const [listSearchInput, setListSearchInput, listSearch] = useDebouncedSearch(200);
    const [listStatusFilters, setListStatusFilters] = dc.useState(new Set());
    const toggleListStatus = (s) => setListStatusFilters(prev => {
        const n = new Set(prev); n.has(s) ? n.delete(s) : n.add(s); return n;
    });
    const [pdfTick, setPdfTick] = dc.useState(0);
    const pdfs = dc.useMemo(() => listPdfs(), [pdfTick, apps]);
    const pdfOptions = dc.useMemo(() => [{ value: "", label: "—" }].concat(pdfs.map(p => ({ value: p, label: pdfBasename(p) }))), [pdfs]);
    const masterCV = pdfs.find(p => /\bCV\b/i.test(pdfBasename(p))) ?? pdfs.find(p => /cv/i.test(pdfBasename(p))) ?? null;

    function DocCell({ app, field, icon }) {
        const v = String(app.value(field) ?? "");
        return (
            <span style={{ display: "inline-flex", gap: "4px", alignItems: "center" }}>
                <dc.VanillaSelect value={v} options={pdfOptions} onValueChange={async (val) => { await setDoc(app, field, val); setPdfTick(t => t + 1); }} />
                {v ? <button title={`Open ${icon}`} onClick={() => V.openNote(v)} style={{ cursor: "pointer", background: "transparent", border: "none", padding: "0 4px" }}>{icon}</button> : null}
                <ImportPdfButton app={app} field={field} onImported={() => setPdfTick(t => t + 1)} />
            </span>
        );
    }

    const counts  = V.countByStatus(apps, APP_STATUS, { defaultStatus: "Applied" });
    const active  = apps.filter(a => !ARCHIVED.includes(a.value("status") ?? "Applied"));
    const stale   = active.filter(a => (a.value("status") ?? "Applied") === "Applied" && V.isStaleSince(a.value("applied"), 14));

    return (
        <div>
            <KPIRow items={PIPELINE.map(s => ({ label: s, value: counts[s], color: APP_COLOR[s] }))} />

            {stale.length > 0 ? (
                <div style={{ padding: "8px 12px", background: "var(--background-modifier-hover)", borderRadius: "6px", marginBottom: "10px", borderLeft: "3px solid var(--color-orange)", fontSize: "0.88em" }}>
                    ⏰ <strong>{stale.length}</strong> application{stale.length !== 1 ? "s" : ""} silent ≥14 days. Consider following up.
                </div>
            ) : null}

            <div style={{ display: "flex", flexWrap: "wrap", gap: "12px", alignItems: "center", padding: "8px 12px", background: "var(--background-secondary)", borderRadius: "6px", marginBottom: "10px", fontSize: "0.85em" }}>
                <strong>📂 Documents:</strong>
                {masterCV ? (
                    <button onClick={() => V.openNote(masterCV)} style={{ cursor: "pointer", background: "transparent", border: "1px solid var(--background-modifier-border)", borderRadius: "4px", padding: "2px 8px" }}>
                        📄 {pdfBasename(masterCV)}
                    </button>
                ) : <span style={{ opacity: 0.6 }}>No CV detected — drop a PDF named "CV.pdf" into <code>Documents/</code></span>}
                <span style={{ opacity: 0.6 }}>· {pdfs.length} PDF{pdfs.length === 1 ? "" : "s"} in <code>Documents/</code></span>
            </div>

            <NewForm
                label="+ New Application"
                folder='Systems/Job Search'
                tag={["system/jobs/application"]}
                body={() => V.bodyTemplate(["Role", "Why interesting", "Compensation", "Contacts", "Follow-ups", "Notes"])}
                fields={[
                    { name: "name", placeholder: "Company — Role", width: "260px" },
                    { name: "company", placeholder: "Company", width: "180px" },
                    { name: "role", placeholder: "Role", width: "180px" },
                    { name: "status", type: "select", options: APP_STATUS, default: "Applied" },
                    { name: "applied", type: "date", width: "150px" },
                    { name: "url", placeholder: "Posting URL", width: "240px" }
                ]}
            />

            <TabStrip tabs={["Pipeline", "List"]} active={tab} onChange={setTab} />

            {tab === "Pipeline" ? (
                <Kanban
                    columns={PIPELINE}
                    items={active}
                    getCol={a => a.value("status") ?? "Applied"}
                    onMove={(a, col) => setStatus(a, col)}
                    columnHeader={(col, items) => (
                        <div style={{ fontSize: "0.78em", textTransform: "uppercase", opacity: 0.7, marginBottom: "6px", borderBottom: `2px solid ${APP_COLOR[col]}`, paddingBottom: "4px" }}>
                            {col} ({items.length})
                        </div>
                    )}
                    renderCard={(a, col) => {
                        const since = daysSince(a.value("applied"));
                        const cv = String(a.value("cv") ?? "");
                        const cl = String(a.value("cover_letter") ?? "");
                        return <div style={{ background: "var(--background-primary)", borderRadius: "5px", padding: "8px", marginBottom: "6px", borderLeft: `3px solid ${APP_COLOR[col]}` }}>
                            <div style={{ fontSize: "0.88em", fontWeight: "500" }}><dc.Link link={a.$link} /></div>
                            <div style={{ fontSize: "0.75em", opacity: 0.65, marginTop: "2px" }}>
                                {String(a.value("company") ?? "")} · {String(a.value("role") ?? "")}
                            </div>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "4px" }}>
                                {since !== null ? <div style={{ fontSize: "0.7em", opacity: 0.55 }}>{since}d ago</div> : <span />}
                                <div style={{ display: "flex", gap: "4px" }}>
                                    {cv ? <button title={`CV: ${pdfBasename(cv)}`} onClick={() => V.openNote(cv)} style={{ cursor: "pointer", background: "transparent", border: "none", padding: "0 2px", fontSize: "0.9em" }}>📄</button> : null}
                                    {cl ? <button title={`Cover letter: ${pdfBasename(cl)}`} onClick={() => V.openNote(cl)} style={{ cursor: "pointer", background: "transparent", border: "none", padding: "0 2px", fontSize: "0.9em" }}>✉️</button> : null}
                                </div>
                            </div>
                        </div>;
                    }}
                />
            ) : null}

            {tab === "List" ? (
                <div>
                    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center", marginBottom: "10px" }}>
                        <label style={{ fontSize: "0.85em" }}>
                            <input type="checkbox" checked={showArchived} onChange={e => setShowArchived(e.target.checked)} /> Show archived
                        </label>
                        <span style={{ display: "inline-flex", gap: "4px", flexWrap: "wrap", alignItems: "center" }}>
                            <span style={{ fontSize: "0.85em", opacity: 0.7 }}>Status:</span>
                            {APP_STATUS.map(s => (
                                <button key={s} onClick={() => toggleListStatus(s)}
                                    className={listStatusFilters.has(s) ? "mod-cta" : ""}
                                    style={{ padding: "3px 9px", fontSize: "0.82em", cursor: "pointer" }}>{s}</button>
                            ))}
                            {listStatusFilters.size > 0 && (
                                <button onClick={() => setListStatusFilters(new Set())} style={{ padding: "3px 9px", fontSize: "0.82em", cursor: "pointer", opacity: 0.7 }}>clear</button>
                            )}
                        </span>
                        <input type="text" placeholder="🔍 search…" value={listSearchInput} onChange={e => setListSearchInput(e.target.value)}
                            style={{ width: "200px" }} />
                    </div>
                    <dc.Table paging={20} rows={(() => {
                        let rows = showArchived ? apps : active;
                        if (listStatusFilters.size > 0) rows = rows.filter(a => listStatusFilters.has(a.value("status") ?? "Applied"));
                        if (listSearch) {
                            const q = listSearch.toLowerCase();
                            rows = rows.filter(a => [
                                a.$name,
                                String(a.value("company") ?? ""),
                                String(a.value("role") ?? "")
                            ].some(s => s.toLowerCase().includes(q)));
                        }
                        return rows;
                    })()}
                        columns={[
                            { id: "Application", value: a => a.$link },
                            { id: "Company", value: a => String(a.value("company") ?? ""),
                              render: (_, a) => <EditText item={a} field="company" /> },
                            { id: "Role", value: a => String(a.value("role") ?? ""),
                              render: (_, a) => <EditText item={a} field="role" /> },
                            {
                                id: "Status", value: a => String(a.value("status") ?? "Applied"),
                                render: (_, a) => (
                                    <dc.VanillaSelect value={String(a.value("status") ?? "Applied")}
                                        options={APP_STATUS.map(s => ({ value: s, label: s }))}
                                        onValueChange={v => setStatus(a, v)} />
                                )
                            },
                            { id: "Applied", value: a => fmtDate(a.value("applied")) },
                            {
                                id: "Age", value: a => daysSince(a.value("applied")) ?? -1,
                                render: (_, a) => {
                                    const d = daysSince(a.value("applied"));
                                    return d === null ? <span style={{ opacity: 0.4 }}>—</span> : <span>{d}d</span>;
                                }
                            },
                            { id: "📄 CV", value: a => String(a.value("cv") ?? ""), render: (_, a) => <DocCell app={a} field="cv" icon="📄" /> },
                            { id: "✉️ Cover Letter", value: a => String(a.value("cover_letter") ?? ""), render: (_, a) => <DocCell app={a} field="cover_letter" icon="✉️" /> }
                        ]} />
                </div>
            ) : null}
        </div>
    );
};
```

