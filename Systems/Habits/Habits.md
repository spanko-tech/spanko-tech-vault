---
dashboard: true
aliases: []
tags:
  - system/habits
  - datacore/dashboard
---

# Habits

```datacorejsx
const V = await dc.require("Toolkit/Datacore/Vault.js");
const { NewForm, StatusSelect, SearchableSelect, useSortBy, SortBar, useDebouncedSearch } = await dc.require("Toolkit/Datacore/UI.jsx");

const ENC = (s) => "d_" + s;
const DEC = (x) => {
    if (x instanceof Date && !isNaN(x.getTime())) {
        const y = x.getFullYear(), m = String(x.getMonth() + 1).padStart(2, "0"), d = String(x.getDate()).padStart(2, "0");
        return `${y}-${m}-${d}`;
    }
    return String(x ?? "").replace(/^d_/, "");
};

function dateStr(d) {
    const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, "0"), day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
}

function weekKey(year, monthIdx, dayOfMonth) {
    const dt = new Date(year, monthIdx, dayOfMonth);
    const dow = (dt.getDay() + 6) % 7; // 0 = Mon
    dt.setDate(dt.getDate() - dow);
    return dateStr(dt);
}

function currentWeek(offset = 0) {
    const today = new Date(); today.setHours(0,0,0,0);
    const dow = today.getDay();
    const offsetToMon = dow === 0 ? -6 : 1 - dow;
    const monday = new Date(today); monday.setDate(today.getDate() + offsetToMon + offset * 7);
    const out = [];
    for (let i = 0; i < 7; i++) {
        const d = new Date(monday); d.setDate(monday.getDate() + i);
        out.push(dateStr(d));
    }
    return out;
}

function fmtWeekLabel(days) {
    const fmt = (d) => {
        const [y, m, day] = d.split("-").map(Number);
        return `${day} ${new Date(y, m - 1, day).toLocaleString(undefined, { month: "short" })}`;
    };
    return `${fmt(days[0])} – ${fmt(days[6])} ${days[6].slice(0, 4)}`;
}

function lastNDays(n) {
    const out = [];
    const today = new Date(); today.setHours(0,0,0,0);
    for (let i = n - 1; i >= 0; i--) {
        const d = new Date(today); d.setDate(today.getDate() - i);
        out.push(dateStr(d));
    }
    return out;
}

function monthGrid(year, month) {
    // returns weeks (Mon-Sun) covering the given month; cells outside month are null
    const first = new Date(year, month, 1);
    const last = new Date(year, month + 1, 0);
    const startOffset = (first.getDay() + 6) % 7; // Mon=0
    const weeks = [];
    let cur = new Date(year, month, 1 - startOffset);
    while (cur <= last || ((cur.getDay() + 6) % 7) !== 0) {
        const week = [];
        for (let i = 0; i < 7; i++) {
            week.push(cur.getMonth() === month ? dateStr(cur) : null);
            cur = new Date(cur); cur.setDate(cur.getDate() + 1);
        }
        weeks.push(week);
        if (weeks.length > 6) break;
    }
    return weeks;
}

// NewForm imported from UI.md

function CategoryCell({ habit, category, categories }) {
    const [val, setVal] = dc.useState(category ?? "");
    const lastSyncedRef = dc.useRef(category ?? "");
    const listId = dc.useMemo(() => `cats-${Math.random().toString(36).slice(2, 9)}`, []);
    dc.useEffect(() => {
        if ((category ?? "") !== lastSyncedRef.current) {
            setVal(category ?? "");
            lastSyncedRef.current = category ?? "";
        }
    }, [category]);
    const commit = async () => {
        if (val === (category ?? "")) return;
        lastSyncedRef.current = val;
        await V.setField(habit, "category", val || null);
    };
    return (
        <span>
            <input type="text" value={val} list={listId}
                onInput={e => setVal(e.currentTarget.value)}
                onBlur={commit}
                onKeyDown={e => { if (e.key === "Enter") e.currentTarget.blur(); }}
                placeholder="category…"
                style={{ width: "120px", fontSize: "0.85em" }} />
            <datalist id={listId}>
                {categories.map(c => <option key={c} value={c} />)}
            </datalist>
        </span>
    );
}

return function View() {
    const habits = dc.useQuery('@page and #system/habits/habit and path("Systems/Habits")');
    const HABIT_SORT_FIELDS = [
        { value: "$name",      label: "Name" },
        { value: "frequency",  label: "Frequency" },
    ];
    const [searchInput, setSearchInput, search] = useDebouncedSearch(200);
    const [categoryFilter, setCategoryFilter] = dc.useState("All");
    const allCategories = dc.useMemo(() => {
        const s = new Set();
        for (const h of habits) { const c = h.value("category"); if (c) s.add(String(c)); }
        return Array.from(s).sort();
    }, [habits]);
    const filteredHabits = dc.useMemo(() => habits.filter(h => {
        if (categoryFilter !== "All" && (h.value("category") ?? "") !== categoryFilter) return false;
        if (search && !h.$name.toLowerCase().includes(search.toLowerCase())) return false;
        return true;
    }), [habits, categoryFilter, search]);
    const { sorted: sortedHabits, sortField: habitSortField, setSortField: setHabitSortField, sortDir: habitSortDir, setSortDir: setHabitSortDir } = useSortBy(filteredHabits, HABIT_SORT_FIELDS);
    const groupedHabits = dc.useMemo(() => {
        const groups = {};
        for (const h of sortedHabits) {
            const cat = String(h.value("category") ?? "").trim() || "Uncategorized";
            (groups[cat] ??= []).push(h);
        }
        const keys = Object.keys(groups).sort((a, b) => {
            if (a === "Uncategorized") return 1;
            if (b === "Uncategorized") return -1;
            return a.localeCompare(b);
        });
        return keys.map(cat => ({ cat, items: groups[cat] }));
    }, [sortedHabits]);
    const [weekOffset, setWeekOffset] = dc.useState(0);
    const [viewMonthIdx, setViewMonthIdx] = dc.useState(new Date().getMonth());
    const days = dc.useMemo(() => currentWeek(weekOffset), [weekOffset]);
    const weekLabel = dc.useMemo(() => fmtWeekLabel(days), [days]);
    const [filter, setFilter] = dc.useState("__all__");

    const today = new Date(); today.setHours(0,0,0,0);
    const year = today.getFullYear();
    const monthIdx = today.getMonth();
    const monthName = today.toLocaleString(undefined, { month: "long" });

    const toggle = async (habit, day) => {
        try {
            const file = dc.app.vault.getFileByPath?.(habit.$path) ?? dc.app.vault.getAbstractFileByPath(habit.$path);
            if (!file) { new window.Notice(`Not found: ${habit.$path}`); return; }
            await dc.app.fileManager.processFrontMatter(file, fm => {
                const raw = Array.isArray(fm.log) ? fm.log : [];
                // migrate any old entries (Date objects, bare strings) → d_ encoded
                const log = raw.map(x => ENC(DEC(x)));
                const target = ENC(day);
                const idx = log.indexOf(target);
                if (idx >= 0) log.splice(idx, 1); else log.push(target);
                fm.log = log;
            });
        } catch (e) {
            console.error("toggle failed:", e);
            new window.Notice(`Toggle failed: ${e.message}`);
        }
    };

    const openHabit = (habit) => dc.app.workspace.openLinkText(habit.$path, "", "tab");

    // Aggregate based on filter: if a single habit is selected, max count = 1; otherwise total habits in scope
    const sourceHabits = dc.useMemo(() => {
        if (filter === "__all__") return habits;
        if (filter === "__daily__") return habits.filter(h => (h.value("frequency") ?? "Daily") === "Daily");
        if (filter === "__weekly__") return habits.filter(h => h.value("frequency") === "Weekly");
        if (filter.startsWith("__cat__")) return habits.filter(h => (h.value("category") ?? "") === filter.slice(7));
        return habits.filter(h => h.$path === filter);
    }, [habits, filter]);

    const dayCount = dc.useMemo(() => {
        const dc_ = {};
        for (const h of sourceHabits) {
            const log = (h.value("log") ?? []).map(DEC);
            for (const d of log) dc_[d] = (dc_[d] || 0) + 1;
        }
        return dc_;
    }, [sourceHabits]);
    const denom = Math.max(1, sourceHabits.length);

    // Per-month frequency-aware totals (daily habit: possible = elapsed days; weekly habit: possible = elapsed weeks)
    const monthStats = dc.useMemo(() => {
        const stats = Array.from({ length: 12 }, () => ({ done: 0, possible: 0 }));
        const todayY = today.getFullYear(), todayM = today.getMonth(), todayD = today.getDate();
        for (let m = 0; m < 12; m++) {
            const lastDay = new Date(year, m + 1, 0).getDate();
            let endDay;
            if (year > todayY || (year === todayY && m > todayM)) endDay = 0;
            else if (year === todayY && m === todayM) endDay = todayD;
            else endDay = lastDay;
            if (endDay === 0) continue;

            for (const h of sourceHabits) {
                const freq = h.value("frequency") ?? "Daily";
                const log = (h.value("log") ?? []).map(DEC);
                if (freq === "Weekly") {
                    const possibleWeeks = new Set();
                    for (let d = 1; d <= endDay; d++) possibleWeeks.add(weekKey(year, m, d));
                    const doneWeeks = new Set();
                    for (const ds of log) {
                        const [yy, mm, dd] = ds.split("-").map(Number);
                        if (yy === year && (mm - 1) === m && dd <= endDay) doneWeeks.add(weekKey(year, m, dd));
                    }
                    stats[m].possible += possibleWeeks.size;
                    stats[m].done     += doneWeeks.size;
                } else {
                    stats[m].possible += endDay;
                    const logSet = new Set(log);
                    for (let d = 1; d <= endDay; d++) {
                        if (logSet.has(dateStr(new Date(year, m, d)))) stats[m].done++;
                    }
                }
            }
        }
        return stats;
    }, [sourceHabits, year, monthIdx]);

    const monthWeeks = dc.useMemo(() => monthGrid(year, viewMonthIdx), [year, viewMonthIdx]);

    const heatColor = (n) => {
        if (!n) return "var(--background-modifier-border)";
        const ratio = Math.min(1, n / denom);
        // continuous: faint at low ratios, solid only when fully complete
        const op = 0.2 + 0.8 * ratio;
        return `rgba(33, 110, 57, ${op})`;
    };

    const monthHeatColor = (m) => {
        const s = monthStats[m];
        if (!s.possible || !s.done) return "var(--background-modifier-border)";
        const ratio = Math.min(1, s.done / s.possible);
        const op = 0.15 + 0.85 * ratio;
        return `rgba(33, 110, 57, ${op})`;
    };

    const monthShort = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    const viewMonthName = new Date(year, viewMonthIdx, 1).toLocaleString(undefined, { month: "long" });

    const clickMonthDay = (d) => {
        if (!d) return;
        const [dy, dm, dd] = d.split("-").map(Number);
        const dt = new Date(dy, dm - 1, dd);
        const todayBase = new Date(); todayBase.setHours(0,0,0,0);
        const todayDow = (todayBase.getDay() + 6) % 7;
        const todayMon = new Date(todayBase); todayMon.setDate(todayBase.getDate() - todayDow);
        const cellDow = (dt.getDay() + 6) % 7;
        const cellMon = new Date(dt); cellMon.setDate(dt.getDate() - cellDow);
        setWeekOffset(Math.round((cellMon - todayMon) / (7 * 24 * 60 * 60 * 1000)));
    };

    return (
        <div>
            <NewForm
                label="+ New Habit"
                folder='Systems/Habits'
                tag="system/habits/habit"
                fields={[
                    { name: "name", label: "Habit name", width: "200px" },
                    { name: "frequency", label: "Frequency", type: "select", options: ["Daily", "Weekly"], default: "Daily" },
                    { name: "category", label: "Category", placeholder: "e.g. Health, Mind", width: "160px", suggestions: allCategories }
                ]}
                defaults={{ log: [] }}
            />

            {habits.length === 0 ? <p><em>No habits yet.</em></p> : (
                <div>
                    <div style={{ display: "flex", gap: "8px", alignItems: "center", marginBottom: "8px", flexWrap: "wrap", fontSize: "0.85em" }}>
                        <SearchableSelect
                            value={categoryFilter}
                            options={[{ value: "All", label: "All categories" }, ...allCategories.map(c => ({ value: c, label: c }))]}
                            onValueChange={setCategoryFilter}
                        />
                        <input
                            type="text"
                            placeholder="Search habits…"
                            value={searchInput}
                            onInput={e => setSearchInput(e.currentTarget.value)}
                            style={{ padding: "2px 8px", borderRadius: "4px", border: "1px solid var(--background-modifier-border)", width: "160px" }}
                        />
                        {(categoryFilter !== "All" || search) && (
                            <a onClick={() => { setCategoryFilter("All"); setSearchInput(""); }} style={{ cursor: "pointer", opacity: 0.7 }}>clear</a>
                        )}
                        <SortBar fields={HABIT_SORT_FIELDS} field={habitSortField} setField={setHabitSortField} dir={habitSortDir} setDir={setHabitSortDir} />
                    </div>
                    <div style={{ overflowX: "auto" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px", fontSize: "0.85em" }}>
                            <button
                                onClick={() => setWeekOffset(wo => wo - 1)}
                                style={{ cursor: "pointer", padding: "2px 8px", borderRadius: "4px", border: "1px solid var(--background-modifier-border)", background: "transparent" }}>
                                ←
                            </button>
                            <span style={{ fontWeight: 500, minWidth: "160px", textAlign: "center" }}>{weekLabel}</span>
                            <button
                                onClick={() => setWeekOffset(wo => wo + 1)}
                                disabled={weekOffset >= 0}
                                style={{ cursor: weekOffset >= 0 ? "default" : "pointer", padding: "2px 8px", borderRadius: "4px", border: "1px solid var(--background-modifier-border)", background: "transparent", opacity: weekOffset >= 0 ? 0.3 : 1 }}>
                                →
                            </button>
                            {weekOffset !== 0 && (
                                <button
                                    onClick={() => setWeekOffset(0)}
                                    style={{ cursor: "pointer", padding: "2px 8px", borderRadius: "4px", border: "1px solid var(--background-modifier-border)", background: "transparent", fontSize: "0.85em" }}>
                                    Today
                                </button>
                            )}
                        </div>
                        {groupedHabits.map(({ cat, items }) => (
                            <div key={cat} style={{ marginBottom: "20px" }}>
                                <h3 style={{ margin: "0 0 4px 0", fontSize: "1em", color: "var(--text-accent)" }}>{cat}</h3>
                                <table style={{ borderCollapse: "collapse", width: "auto" }}>
                                    <thead>
                                        <tr>
                                            <th style={{ textAlign: "left", padding: "4px 8px" }}>Habit</th>
                                            <th style={{ textAlign: "left", padding: "4px 8px" }}>Category</th>
                                            {days.map(d => {
                                                const [y, m, day] = d.split("-").map(Number);
                                                const dayName = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][new Date(y, m - 1, day).getDay()];
                                                return (
                                                    <th key={d} style={{ padding: "2px 4px", fontSize: "0.75em", textAlign: "center" }}>
                                                        <div>{dayName}</div>
                                                        <div style={{ opacity: 0.6 }}>{d.slice(8)}</div>
                                                    </th>
                                                );
                                            })}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {items.map(habit => {
                                            const log = (habit.value("log") ?? []).map(DEC);
                                            const set = new Set(log);
                                            return (
                                                <tr key={habit.$path}>
                                                    <td style={{ padding: "4px 8px" }}>
                                                        <a className="internal-link" style={{ cursor: "pointer" }}
                                                           onClick={() => openHabit(habit)}>{habit.$name}</a>
                                                        <span style={{ marginLeft: "6px", fontSize: "0.75em", opacity: 0.7 }}>
                                                            <StatusSelect item={habit} field="frequency" options={["Daily","Weekly"]} defaultValue="Daily" />
                                                        </span>
                                                    </td>
                                                    <td style={{ padding: "4px 8px" }}>
                                                        <CategoryCell habit={habit} category={habit.value("category") ?? ""} categories={allCategories} />
                                                    </td>
                                                    {days.map(d => (
                                                        <td key={d} style={{ padding: "1px", textAlign: "center" }}>
                                                            <button onClick={() => toggle(habit, d)}
                                                                style={{
                                                                    cursor: "pointer", width: "22px", height: "22px",
                                                                    border: "1px solid var(--background-modifier-border)",
                                                                    background: set.has(d) ? "var(--color-green)" : "transparent",
                                                                    color: set.has(d) ? "white" : "inherit",
                                                                    borderRadius: "3px", fontSize: "0.85em"
                                                                }}>
                                                                {set.has(d) ? "✓" : ""}
                                                            </button>
                                                        </td>
                                                    ))}
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        ))}
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "10px", marginTop: "20px" }}>
                        <h3 style={{ margin: 0 }}>Heatmap</h3>
                        <label style={{ fontSize: "0.85em", opacity: 0.7 }}>Filter:</label>
                        <SearchableSelect
                            value={filter}
                            options={[
                                { value: "__all__", label: "All habits" },
                                { value: "__daily__", label: "Daily only" },
                                { value: "__weekly__", label: "Weekly only" },
                                ...allCategories.map(c => ({ value: `__cat__${c}`, label: `📁 ${c}` })),
                                ...habits.slice().sort((a, b) => a.$name.localeCompare(b.$name)).map(h => ({ value: h.$path, label: h.$name }))
                            ]}
                            onValueChange={v => setFilter(v)}
                        />
                        <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "0.85em" }}>
                            <button onClick={() => setViewMonthIdx(m => (m + 11) % 12)} style={{ cursor: "pointer", padding: "2px 6px", borderRadius: "4px", border: "1px solid var(--background-modifier-border)", background: "transparent" }}>←</button>
                            <dc.VanillaSelect value={String(viewMonthIdx)} options={monthShort.map((m, i) => ({ value: String(i), label: m }))} onValueChange={v => setViewMonthIdx(Number(v))} />
                            <button onClick={() => setViewMonthIdx(m => (m + 1) % 12)} style={{ cursor: "pointer", padding: "2px 6px", borderRadius: "4px", border: "1px solid var(--background-modifier-border)", background: "transparent" }}>→</button>
                        </span>
                    </div>

                    <h4 style={{ marginTop: "12px", marginBottom: "6px" }}>{viewMonthName} {year}</h4>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "4px", width: "100%" }}>
                        {["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map(dn => (
                            <div key={dn} style={{ fontSize: "0.7em", opacity: 0.6, textAlign: "center" }}>{dn}</div>
                        ))}
                        {monthWeeks.flat().map((d, i) => (
                            <div key={i}
                                title={d ? `${d}: ${dayCount[d] || 0} / ${denom} · click to jump to this week` : ""}
                                onClick={() => clickMonthDay(d)}
                                style={{
                                    aspectRatio: "1 / 1", borderRadius: "4px",
                                    background: d ? heatColor(dayCount[d] || 0) : "transparent",
                                    display: "flex", alignItems: "center", justifyContent: "center",
                                    fontSize: "0.7em", color: d && dayCount[d] ? "white" : "var(--text-muted)",
                                    cursor: d ? "pointer" : "default"
                                }}>
                                {d ? Number(d.slice(8)) : ""}
                            </div>
                        ))}
                    </div>

                    <h4 style={{ marginTop: "16px", marginBottom: "6px" }}>{year} by month</h4>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(12, 1fr)", gap: "4px", width: "100%" }}>
                        {monthShort.map((mn, mi) => (
                            <div key={mi} style={{ display: "flex", flexDirection: "column", alignItems: "stretch", gap: "3px" }}>
                                <div title={`${mn}: ${monthStats[mi].done} / ${monthStats[mi].possible} · click to view this month`}
                                    onClick={() => setViewMonthIdx(mi)}
                                    style={{
                                        aspectRatio: "1 / 1", borderRadius: "4px", cursor: "pointer",
                                        background: monthHeatColor(mi),
                                        border: mi === viewMonthIdx ? "2px solid var(--text-accent)" : "1px solid var(--background-modifier-border)"
                                    }} />
                                <span style={{ fontSize: "0.7em", opacity: 0.7, textAlign: "center" }}>{mn}</span>
                            </div>
                        ))}
                    </div>

                    <div style={{ display: "flex", gap: "6px", alignItems: "center", marginTop: "10px", fontSize: "0.75em", opacity: 0.7 }}>
                        <span>Less</span>
                        {[0, 1, Math.ceil(denom/3), Math.ceil(denom*2/3), denom].map((n, i) => (
                            <div key={i} style={{ width: "12px", height: "12px", borderRadius: "2px", background: heatColor(n) }} />
                        ))}
                        <span>More</span>
                    </div>

                    {(() => {
                        const monthDone = monthStats[viewMonthIdx].done;
                        const monthPossible = monthStats[viewMonthIdx].possible;
                        const monthPct = monthPossible ? Math.round(100 * monthDone / monthPossible) : 0;
                        const yearDone = monthStats.reduce((a, s) => a + s.done, 0);
                        const yearPossible = monthStats.reduce((a, s) => a + s.possible, 0);
                        const yearPct = yearPossible ? Math.round(100 * yearDone / yearPossible) : 0;
                        let bestIdx = -1, bestPct = -1;
                        for (let m = 0; m < 12; m++) {
                            if (!monthStats[m].possible) continue;
                            const pct = monthStats[m].done / monthStats[m].possible;
                            if (pct > bestPct) { bestPct = pct; bestIdx = m; }
                        }
                        const scopeLabel = filter === "__all__" ? "all habits"
                            : filter === "__daily__" ? "daily habits"
                            : filter === "__weekly__" ? "weekly habits"
                            : filter.startsWith("__cat__") ? `${filter.slice(7)} habits`
                            : (habits.find(h => h.$path === filter)?.$name ?? "selection");
                        const dailyN  = sourceHabits.filter(h => (h.value("frequency") ?? "Daily") === "Daily").length;
                        const weeklyN = sourceHabits.filter(h => h.value("frequency") === "Weekly").length;
                        const breakdown = (dailyN && weeklyN) ? ` (${dailyN}d + ${weeklyN}w)`
                                         : weeklyN ? ` (${weeklyN} weekly)`
                                         : ` (${dailyN} daily)`;
                        return (
                            <div style={{ marginTop: "14px", padding: "10px 12px", background: "var(--background-secondary)", borderRadius: "6px", fontSize: "0.85em", display: "flex", flexWrap: "wrap", gap: "16px" }}>
                                <div><strong>Scope:</strong> {scopeLabel}{breakdown}</div>
                                <div><strong>{viewMonthName}:</strong> {monthDone} / {monthPossible} ({monthPct}%)</div>
                                <div><strong>{year}:</strong> {yearDone} / {yearPossible} ({yearPct}%)</div>
                                {bestIdx >= 0 && <div><strong>Best month:</strong> {monthShort[bestIdx]} ({Math.round(bestPct * 100)}%)</div>}
                            </div>
                        );
                    })()}
                </div>
            )}
        </div>
    );
}
```

