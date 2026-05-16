---
dashboard: true
tags:
  - system/growth
---

# Growth
```datacorejsx
const V = await dc.require("Toolkit/Datacore/Vault.js");
const { NewForm, StatusSelect, TabStrip, useDebouncedSearch, useBodyMap, computeLintMap, useLintState, LintPanel, lintColumn, deleteColumn } = await dc.require("Toolkit/Datacore/UI.jsx");
const { lintBrag, lintAdr, lintReview, lintPostmortem, GROWTH_ISSUE_CODES, GROWTH_ISSUE_LABELS } = await dc.require("Toolkit/Datacore/LintRules.js");
const { fmtDate } = V;

const SKILL_LEVELS = ["Novice", "Advanced Beginner", "Competent", "Proficient", "Expert"];
const ADR_STATUS   = ["Proposed", "Accepted", "Superseded", "Rejected"];

return function View() {
    const skills  = dc.useQuery(V.q("system/growth/skill",      "Systems/Growth"));
    const brags   = dc.useQuery(V.q("system/growth/brag",       "Systems/Growth"));
    const reviews = dc.useQuery(V.q("system/growth/review",     "Systems/Growth"));
    const adrs    = dc.useQuery(V.q("system/growth/adr",        "Systems/Growth"));
    const pms     = dc.useQuery(V.q("system/growth/postmortem", "Systems/Growth"));
    const [tab, setTab] = dc.useState("Skills");
    const [searchInput, setSearchInput, search] = useDebouncedSearch(200);

    // Load body content for all growth types that have body sections to lint
    const allItems = [...brags, ...adrs, ...reviews, ...pms];
    const bodyMap = useBodyMap(allItems);

    const bragLintIssues   = dc.useMemo(() => computeLintMap(brags,   p => lintBrag(p,       bodyMap.get(p.$path) ?? "")), [brags,   bodyMap]);
    const adrLintIssues    = dc.useMemo(() => computeLintMap(adrs,    p => lintAdr(p,        bodyMap.get(p.$path) ?? "")), [adrs,    bodyMap]);
    const reviewLintIssues = dc.useMemo(() => computeLintMap(reviews, p => lintReview(p,     bodyMap.get(p.$path) ?? "")), [reviews, bodyMap]);
    const pmLintIssues     = dc.useMemo(() => computeLintMap(pms,     p => lintPostmortem(p, bodyMap.get(p.$path) ?? "")), [pms,     bodyMap]);

    const { issueFilter: bragFilter, setIssueFilter: setBragFilter, issueCounts: bragCounts, totalIssues: bragTotalIssues, itemsWithLint: bragsWithLint }       = useLintState(brags,   bragLintIssues);
    const { issueFilter: adrFilter,  setIssueFilter: setAdrFilter,  issueCounts: adrCounts,  totalIssues: adrTotalIssues,  itemsWithLint: adrsWithLint }         = useLintState(adrs,    adrLintIssues);
    const { issueFilter: rvwFilter,  setIssueFilter: setRvwFilter,  issueCounts: rvwCounts,  totalIssues: rvwTotalIssues,  itemsWithLint: reviewsWithLint }       = useLintState(reviews, reviewLintIssues);
    const { issueFilter: pmFilter,   setIssueFilter: setPmFilter,   issueCounts: pmCounts,   totalIssues: pmTotalIssues,   itemsWithLint: pmsWithLint }           = useLintState(pms,     pmLintIssues);

    const SearchBox = () => (
        <input type="text" placeholder="🔍 search…" value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            style={{ marginBottom: "8px", width: "220px" }} />
    );

    const tabs = [
        { id: "Skills",      count: skills.length },
        { id: "Brags",       count: brags.length },
        { id: "Reviews",     count: reviews.length },
        { id: "ADRs",        count: adrs.length },
        { id: "Postmortems", count: pms.length }
    ];

    return (
        <div>
            <TabStrip tabs={tabs} active={tab} onChange={t => { setTab(t); setSearchInput(""); }} />

            {tab === "Skills" ? (
                <div>
                    <NewForm label="+ Skill" folder='Systems/Growth/Skills' tag={["system/growth/skill"]}
                        fields={[
                            { name: "name", placeholder: "Skill name", width: "220px" },
                            { name: "level", type: "select", options: SKILL_LEVELS, default: "Competent" }
                        ]}
                    />
                    <SearchBox />
                    <dc.Table paging={20} rows={skills.filter(s => !search || s.$name.toLowerCase().includes(search))}
                        columns={[
                            { id: "Skill", value: s => s.$link },
                            { id: "Level", value: s => String(s.value("level") ?? ""),
                              render: (_, s) => <StatusSelect item={s} field="level" options={SKILL_LEVELS} defaultValue="Competent" /> }
                        ]} />
                </div>
            ) : null}

            {tab === "Brags" ? (
                <div>
                    <NewForm label="+ Brag" folder='Systems/Growth/Brag' tag={["system/growth/brag"]}
                        body={() => V.bodyTemplate(["What", "Impact", "Skills demonstrated"])}
                        fields={[
                            { name: "name", placeholder: "Win title", width: "260px" },
                            { name: "date", type: "date", default: V.today(), width: "150px" }
                        ]}
                    />
                    <LintPanel codes={["incomplete-brag"]} labels={GROWTH_ISSUE_LABELS}
                        issueFilter={bragFilter} setIssueFilter={setBragFilter} issueCounts={bragCounts}
                        totalIssues={bragTotalIssues} itemsWithLint={bragsWithLint} />
                    <SearchBox />
                    <dc.Table paging={20} rows={V.sortByDateDesc(brags).filter(b => {
                        if (bragFilter !== "All" && !bragLintIssues.get(b.$path)?.some(i => i.code === bragFilter)) return false;
                        return !search || b.$name.toLowerCase().includes(search);
                    })}
                        columns={[
                            { id: "Win", value: b => b.$link },
                            { id: "Date", value: b => fmtDate(b.value("date")) },
                            lintColumn(bragLintIssues, bragFilter, setBragFilter),
                            deleteColumn("win"),
                        ]} />
                </div>
            ) : null}

            {tab === "Reviews" ? (
                <div>
                    <NewForm label="+ Review" folder='Systems/Growth/Reviews' tag={["system/growth/review"]}
                        body={() => V.bodyTemplate(["Went well", "Stuck on", "Struggled with", "Patterns", "Next"])}
                        fields={[{ name: "name", placeholder: "Review title (e.g. 2026-04 monthly)", width: "300px" }]}
                    />
                    <LintPanel codes={["incomplete-review"]} labels={GROWTH_ISSUE_LABELS}
                        issueFilter={rvwFilter} setIssueFilter={setRvwFilter} issueCounts={rvwCounts}
                        totalIssues={rvwTotalIssues} itemsWithLint={reviewsWithLint} />
                    <SearchBox />
                    <dc.Table paging={20} rows={reviews.filter(r => {
                        if (rvwFilter !== "All" && !reviewLintIssues.get(r.$path)?.some(i => i.code === rvwFilter)) return false;
                        return !search || r.$name.toLowerCase().includes(search);
                    })}
                        columns={[
                            { id: "Review", value: r => r.$link },
                            lintColumn(reviewLintIssues, rvwFilter, setRvwFilter),
                            deleteColumn("review"),
                        ]} />
                </div>
            ) : null}

            {tab === "ADRs" ? (
                <div>
                    <NewForm label="+ ADR" folder='Systems/Growth/ADRs' tag={["system/growth/adr"]}
                        body={() => V.bodyTemplate(["Context", "Decision", "Consequences", "Alternatives considered"])}
                        fields={[
                            { name: "name", placeholder: "ADR-XXX — Title", width: "300px" },
                            { name: "status", type: "select", options: ADR_STATUS, default: "Proposed" }
                        ]}
                    />
                    <LintPanel codes={["incomplete-adr"]} labels={GROWTH_ISSUE_LABELS}
                        issueFilter={adrFilter} setIssueFilter={setAdrFilter} issueCounts={adrCounts}
                        totalIssues={adrTotalIssues} itemsWithLint={adrsWithLint} />
                    <SearchBox />
                    <dc.Table paging={20} rows={adrs.filter(a => {
                        if (adrFilter !== "All" && !adrLintIssues.get(a.$path)?.some(i => i.code === adrFilter)) return false;
                        return !search || a.$name.toLowerCase().includes(search);
                    })}
                        columns={[
                            { id: "ADR", value: a => a.$link },
                            { id: "Status", value: a => String(a.value("status") ?? ""),
                              render: (_, a) => <StatusSelect item={a} field="status" options={ADR_STATUS} defaultValue="Proposed" /> },
                            lintColumn(adrLintIssues, adrFilter, setAdrFilter),
                            deleteColumn("ADR"),
                        ]} />
                </div>
            ) : null}

            {tab === "Postmortems" ? (
                <div>
                    <NewForm label="+ Postmortem" folder='Systems/Growth/Postmortems' tag={["system/growth/postmortem"]}
                        body={() => V.bodyTemplate(["Summary", "Timeline", "Root cause", "5 whys", "Action items"])}
                        fields={[
                            { name: "name", placeholder: "Incident title", width: "300px" },
                            { name: "date", type: "date", default: V.today(), width: "150px" }
                        ]}
                    />
                    <LintPanel codes={["incomplete-postmortem"]} labels={GROWTH_ISSUE_LABELS}
                        issueFilter={pmFilter} setIssueFilter={setPmFilter} issueCounts={pmCounts}
                        totalIssues={pmTotalIssues} itemsWithLint={pmsWithLint} />
                    <SearchBox />
                    <dc.Table paging={20} rows={V.sortByDateDesc(pms).filter(p => {
                        if (pmFilter !== "All" && !pmLintIssues.get(p.$path)?.some(i => i.code === pmFilter)) return false;
                        return !search || p.$name.toLowerCase().includes(search);
                    })}
                        columns={[
                            { id: "Incident", value: p => p.$link },
                            { id: "Date", value: p => fmtDate(p.value("date")) },
                            lintColumn(pmLintIssues, pmFilter, setPmFilter),
                            deleteColumn("postmortem"),
                        ]} />
                </div>
            ) : null}
        </div>
    );
};
```

