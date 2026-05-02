---
tags:
  - fabrica/growth-system
---

# Growth

> Engineering self-management. Skills tree, brag doc, reviews, ADRs, postmortems.

```datacorejsx
const V = await dc.require("Toolkit/Datacore/Vault.js");
const { NewForm, StatusSelect, TabStrip, useDebouncedSearch } = await dc.require("Toolkit/Datacore/UI.jsx");
const { fmtDate } = V;

const SKILL_LEVELS = ["Novice", "Advanced Beginner", "Competent", "Proficient", "Expert"];
const ADR_STATUS   = ["Proposed", "Accepted", "Superseded", "Rejected"];

return function View() {
    const skills  = dc.useQuery(V.q("fabrica/skill",      "Systems/Growth"));
    const brags   = dc.useQuery(V.q("fabrica/brag",       "Systems/Growth"));
    const reviews = dc.useQuery(V.q("fabrica/review",     "Systems/Growth"));
    const adrs    = dc.useQuery(V.q("fabrica/adr",        "Systems/Growth"));
    const pms     = dc.useQuery(V.q("fabrica/postmortem", "Systems/Growth"));
    const [tab, setTab] = dc.useState("Skills");
    const [searchInput, setSearchInput, search] = useDebouncedSearch(200);

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
                    <NewForm label="+ Skill" folder='Systems/Growth/Skills' tag={["fabrica/skill"]}
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
                    <NewForm label="+ Brag" folder='Systems/Growth/Brag' tag={["fabrica/brag"]}
                        body={() => V.bodyTemplate(["What", "Impact", "Skills demonstrated"])}
                        fields={[
                            { name: "name", placeholder: "Win title", width: "260px" },
                            { name: "date", type: "date", default: V.today(), width: "150px" }
                        ]}
                    />
                    <SearchBox />
                    <dc.Table paging={20} rows={V.sortByDateDesc(brags).filter(b => !search || b.$name.toLowerCase().includes(search))}
                        columns={[
                            { id: "Win", value: b => b.$link },
                            { id: "Date", value: b => fmtDate(b.value("date")) }
                        ]} />
                </div>
            ) : null}

            {tab === "Reviews" ? (
                <div>
                    <NewForm label="+ Review" folder='Systems/Growth/Reviews' tag={["fabrica/review"]}
                        body={() => V.bodyTemplate(["Went well", "Stuck on", "Struggled with", "Patterns", "Next"])}
                        fields={[{ name: "name", placeholder: "Review title (e.g. 2026-04 monthly)", width: "300px" }]}
                    />
                    <SearchBox />
                    <dc.Table paging={20} rows={reviews.filter(r => !search || r.$name.toLowerCase().includes(search))}
                        columns={[{ id: "Review", value: r => r.$link }]} />
                </div>
            ) : null}

            {tab === "ADRs" ? (
                <div>
                    <NewForm label="+ ADR" folder='Systems/Growth/ADRs' tag={["fabrica/adr"]}
                        body={() => V.bodyTemplate(["Context", "Decision", "Consequences", "Alternatives considered"])}
                        fields={[
                            { name: "name", placeholder: "ADR-XXX — Title", width: "300px" },
                            { name: "status", type: "select", options: ADR_STATUS, default: "Proposed" }
                        ]}
                    />
                    <SearchBox />
                    <dc.Table paging={20} rows={adrs.filter(a => !search || a.$name.toLowerCase().includes(search))}
                        columns={[
                            { id: "ADR", value: a => a.$link },
                            { id: "Status", value: a => String(a.value("status") ?? ""),
                              render: (_, a) => <StatusSelect item={a} field="status" options={ADR_STATUS} defaultValue="Proposed" /> }
                        ]} />
                </div>
            ) : null}

            {tab === "Postmortems" ? (
                <div>
                    <NewForm label="+ Postmortem" folder='Systems/Growth/Postmortems' tag={["fabrica/postmortem"]}
                        body={() => V.bodyTemplate(["Summary", "Timeline", "Root cause", "5 whys", "Action items"])}
                        fields={[
                            { name: "name", placeholder: "Incident title", width: "300px" },
                            { name: "date", type: "date", default: V.today(), width: "150px" }
                        ]}
                    />
                    <SearchBox />
                    <dc.Table paging={20} rows={V.sortByDateDesc(pms).filter(p => !search || p.$name.toLowerCase().includes(search))}
                        columns={[
                            { id: "Incident", value: p => p.$link },
                            { id: "Date", value: p => fmtDate(p.value("date")) }
                        ]} />
                </div>
            ) : null}
        </div>
    );
};
```

