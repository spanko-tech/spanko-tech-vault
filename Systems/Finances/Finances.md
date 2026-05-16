---
dashboard: true
aliases: []
tags:
  - system/finances
  - datacore/dashboard
baseCurrency: CZK
EURExchangeRate: 25
USDExchangeRate: 22
---

# Finances

```datacorejsx
const V = await dc.require("Toolkit/Datacore/Vault.js");
const W = await dc.require("Toolkit/Datacore/Web.js");
const { NewForm, useSortBy, SortBar } = await dc.require("Toolkit/Datacore/UI.jsx");
const { setField, setFields } = V;

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const STATUSES   = ["Active", "Inactive"];
const FREQUENCIES = ["Monthly", "Yearly"];

const EXPENSE_CATS = ["Service", "Games", "Development", "Investment", "Savings", "Life"];
const INCOME_CATS  = ["Work", "Benefit", "Other"];
function convertCustomDate(customDate, targetMonth, targetYear) {
    if (!customDate) return new Date(targetYear, targetMonth, 1);
    if (customDate.includes(".X")) {
        const day = customDate.split(".")[0];
        if (day === "Y") return new Date(targetYear, targetMonth, 1);
        const dayNum = parseInt(day);
        const lastDay = new Date(targetYear, targetMonth + 1, 0).getDate();
        return new Date(targetYear, targetMonth, Math.min(dayNum, lastDay));
    }
    if (customDate.includes(".")) {
        const parts = customDate.split(".");
        if (parts.length >= 3) {
            const d = parseInt(parts[0]), m = parseInt(parts[1]) - 1, y = parseInt(parts[2]);
            if (!isNaN(d) && !isNaN(m) && !isNaN(y)) return new Date(y, m, d);
        } else if (parts.length === 2) {
            const d = parseInt(parts[0]), m = parseInt(parts[1]) - 1;
            if (!isNaN(d) && !isNaN(m)) return new Date(targetYear, m, d);
        }
    }
    for (let i = 0; i < MONTHS.length; i++) {
        if (customDate.includes(MONTHS[i])) return new Date(targetYear, i, 1);
    }
    return new Date(targetYear, targetMonth, 1);
}

function shouldShowYearly(dateString, currentMonth) {
    if (!dateString) return false;
    if (dateString.includes(".")) {
        const parts = dateString.split(".");
        if (parts.length >= 2) {
            const m = parseInt(parts[1]);
            if (!isNaN(m)) return m === (currentMonth + 1);
        }
    }
    return dateString.includes(MONTHS[currentMonth]);
}

return function View() {
    const cur     = dc.useCurrentFile();
    const eurRate      = Number(cur.value("EURExchangeRate") ?? 25);
    const usdRate      = Number(cur.value("USDExchangeRate") ?? 22);
    const baseCurrency = String(cur.value("baseCurrency") ?? "CZK").toUpperCase();
    const CURRENCIES   = [...new Set([baseCurrency, "EUR", "USD"])];
    const [selMo, setSelMo] = dc.useState(MONTHS[new Date().getMonth()]);
    const selectedMonth = Math.max(0, MONTHS.indexOf(selMo));
    const currentYear   = new Date().getFullYear();
    const rates = Object.fromEntries(CURRENCIES.map(cur => [cur, cur === baseCurrency ? 1 : cur === "EUR" ? eurRate : usdRate]));

    const incomes  = dc.useQuery('@page and #system/finances/income  and path("Systems/Finances")');
    const expenses = dc.useQuery('@page and #system/finances/expense and path("Systems/Finances")');

    const data = dc.useMemo(() => {
        const transactions = [];
        const push = (pages, type) => {
            for (const p of pages) {
                const status = p.value("status") ?? "Active";
                if (status !== "Active") continue;
                const amount = Number(p.value("amount"));
                if (isNaN(amount)) continue;
                const freq = p.value("frequency");
                const date = p.value("start_date") ?? "";
                const isMonthly = freq === "Monthly";
                const isYearly  = freq === "Yearly" && shouldShowYearly(date, selectedMonth);
                if (!isMonthly && !isYearly) continue;
                const d        = convertCustomDate(date, selectedMonth, currentYear);
                const currency = p.value("currency") ?? baseCurrency;
                const amtBase  = amount * (rates[currency] || 1);
                transactions.push({
                    page: p, date: d,
                    amount:   type === "income" ? amtBase : -amtBase,
                    rawAmount: amount, currency,
                    category: p.value("category") ?? "",
                    frequency: freq,
                    type
                });
            }
        };
        push(incomes,  "income");
        push(expenses, "expense");
        transactions.sort((a, b) => a.date - b.date);

        let totalIncome = 0, totalExpenses = 0, totalSavings = 0;
        for (const t of transactions) {
            if (t.type === "income") totalIncome += t.amount;
            else {
                const a = Math.abs(t.amount);
                if (t.category === "Savings" || t.category === "Investment") totalSavings += a;
                else totalExpenses += a;
            }
        }
        const netIncome = totalIncome - totalExpenses - totalSavings;

        const byDay = {};
        for (const t of transactions) {
            const d = t.date.getDate();
            (byDay[d] ??= []).push(t);
        }
        return { transactions, byDay, totalIncome, totalExpenses, totalSavings, netIncome };
    }, [incomes, expenses, eurRate, usdRate, selectedMonth, currentYear]);

    const firstDay    = new Date(currentYear, selectedMonth, 1);
    const daysInMo    = new Date(currentYear, selectedMonth + 1, 0).getDate();
    const mondayStart = (firstDay.getDay() + 6) % 7;

    const weeks = [];
    let week = [];
    for (let i = 0; i < mondayStart; i++) week.push(null);
    for (let day = 1; day <= daysInMo; day++) {
        week.push(day);
        if (week.length === 7) { weeks.push(week); week = []; }
    }
    if (week.length > 0) {
        while (week.length < 7) week.push(null);
        weeks.push(week);
    }

    const renderCell = (day, key) => {
        if (day === null) return <td key={key} style={{ verticalAlign: "top", padding: "4px" }}></td>;
        const dayTx = data.byDay[day] ?? [];
        let dailyIn = 0, dailyOut = 0;
        for (const t of dayTx) {
            if (t.type === "income") dailyIn += t.amount;
            else dailyOut += Math.abs(t.amount);
        }
        const fmt = (n) => Math.round(n).toLocaleString();
        return (
            <td key={key} style={{ verticalAlign: "top", padding: "4px", minWidth: "100px" }}>
                <div>
                    <strong>{day}</strong>{" "}
                    {dailyIn > 0 && <span style={{ color: "var(--color-green)", fontWeight: "bold", fontSize: "0.8em" }}>+{fmt(dailyIn)}</span>}{" "}
                    {dailyOut > 0 && <span style={{ color: "var(--color-red)", fontWeight: "bold", fontSize: "0.8em" }}>-{fmt(dailyOut)}</span>}
                </div>
                {dayTx.map((t, i) => {
                    return (
                        <div key={i} style={{ fontSize: "0.75em", opacity: 0.85 }}>
                            <dc.Link link={t.page.$link} />
                        </div>
                    );
                })}
            </td>
        );
    };

    const yearly = dc.useMemo(() => {
        const months = MONTHS.map((m, i) => ({ m, i, income: 0, expenses: 0, savings: 0 }));
        const consider = (pages, type) => {
            for (const p of pages) {
                const status = p.value("status") ?? "Active";
                if (status !== "Active") continue;
                const amount = Number(p.value("amount"));
                if (isNaN(amount)) continue;
                const freq = p.value("frequency");
                const date = p.value("start_date") ?? "";
                const currency = p.value("currency") ?? baseCurrency;
                const amtBase = amount * (rates[currency] || 1);
                const cat = p.value("category") ?? "";
                const bucket = type === "income"
                    ? "income"
                    : (cat === "Savings" || cat === "Investment" ? "savings" : "expenses");
                if (freq === "Monthly") {
                    for (const row of months) row[bucket] += amtBase;
                } else if (freq === "Yearly") {
                    for (const row of months) {
                        if (shouldShowYearly(date, row.i)) row[bucket] += amtBase;
                    }
                }
            }
        };
        consider(incomes, "income");
        consider(expenses, "expense");
        const totals = months.reduce((acc, r) => ({
            income: acc.income + r.income,
            expenses: acc.expenses + r.expenses,
            savings: acc.savings + r.savings
        }), { income: 0, expenses: 0, savings: 0 });
        return { months, totals };
    }, [incomes, expenses, eurRate, usdRate, currentYear]);

    const allTx = dc.useMemo(() => {
        const out = [];
        for (const p of incomes)  out.push({ page: p, type: "income" });
        for (const p of expenses) out.push({ page: p, type: "expense" });
        return out.sort((a, b) => a.page.$name.localeCompare(b.page.$name));
    }, [incomes, expenses]);

    const [txTypeFilter, setTxTypeFilter] = dc.useState("All");
    const [txFreqFilter, setTxFreqFilter] = dc.useState("All");
    const [txCatFilter, setTxCatFilter] = dc.useState(new Set());
    const [txMinAmt, setTxMinAmt] = dc.useState("");
    const [fetchingRates, setFetchingRates] = dc.useState(false);

    async function fetchRates() {
        setFetchingRates(true);
        try {
            // Always use EUR as base — most reliable. rates[X] = "how many X per 1 EUR"
            const symbolsNeeded = [...new Set([baseCurrency, "USD"])].filter(c => c !== "EUR");
            const symbolsParam  = symbolsNeeded.length ? symbolsNeeded.join(",") : "USD";
            const r = await W.httpJson(`https://api.frankfurter.dev/v1/latest?base=EUR&symbols=${symbolsParam}`);
            if (r.ok && r.data?.rates) {
                const basePerEur = baseCurrency === "EUR" ? 1 : (r.data.rates[baseCurrency] ?? eurRate);
                const usdPerEur  = r.data.rates.USD ?? 1;
                const newEurRate = Math.round(basePerEur * 100) / 100;
                const newUsdRate = baseCurrency === "USD" ? 1 : Math.round((basePerEur / usdPerEur) * 100) / 100;
                await setFields(cur, { EURExchangeRate: newEurRate, USDExchangeRate: newUsdRate });
                V.notify(`Rates updated (ECB ${r.data.date}): 1 EUR = ${newEurRate} ${baseCurrency} · 1 USD = ${newUsdRate} ${baseCurrency}`);
            } else { V.notify("Failed to fetch rates"); }
        } catch { V.notify("Failed to fetch rates"); }
        finally { setFetchingRates(false); }
    }

    const txCategories = dc.useMemo(() => {
        const s = new Set();
        for (const r of allTx) { const c = r.page.value("category"); if (c) s.add(c); }
        return Array.from(s).sort();
    }, [allTx]);

    const toggleCat = (c) => setTxCatFilter(prev => {
        const n = new Set(prev);
        n.has(c) ? n.delete(c) : n.add(c);
        return n;
    });

    const txFiltered = allTx.filter(r => {
        if (txTypeFilter === "Income"  && r.type !== "income")  return false;
        if (txTypeFilter === "Expense" && r.type !== "expense") return false;
        if (txFreqFilter !== "All" && (r.page.value("frequency") ?? "") !== txFreqFilter) return false;
        if (txCatFilter.size > 0 && !txCatFilter.has(r.page.value("category") ?? "")) return false;
        const minAmt = Number(txMinAmt);
        if (!isNaN(minAmt) && minAmt > 0) {
            const amt = Number(r.page.value("amount") ?? 0);
            const cur = r.page.value("currency") ?? baseCurrency;
            const base = amt * (rates[cur] || 1);
            if (base < minAmt) return false;
        }
        return true;
    });

    const TX_SORT_FIELDS = [
        { value: "$name",      label: "Name" },
        { value: "type",       label: "Type" },
        { value: "category",   label: "Category" },
        { value: "amount",     label: "Amount" },
        { value: "start_date", label: "Date" },
    ];
    const getTxValue = (item, field) => {
        if (field === "$name") return item.page.$name ?? "";
        if (field === "type")  return item.type ?? "";
        if (field === "amount") {
            const amt = Number(item.page.value("amount") ?? 0);
            const cur = item.page.value("currency") ?? baseCurrency;
            return String(Math.round(amt * (rates[cur] || 1)));
        }
        return String(item.page.value(field) ?? "");
    };
    const { sorted: txSorted, sortField: txSortField, setSortField: setTxSortField, sortDir: txSortDir, setSortDir: setTxSortDir } = useSortBy(txFiltered, TX_SORT_FIELDS, "$name", "asc", getTxValue);

    const txFilteredTotal = dc.useMemo(() => {
        let sum = 0;
        for (const r of txFiltered) {
            const amt = Number(r.page.value("amount") ?? 0);
            const cur = r.page.value("currency") ?? baseCurrency;
            const base = amt * (rates[cur] || 1);
            sum += r.type === "income" ? base : -base;
        }
        return sum;
    }, [txFiltered, rates]);

    const TX_COLUMNS = [
        { id: "Name", value: r => r.page.$link },
        {
            id: "Category",
            value: r => r.page.value("category") ?? "",
            render: (_, r) => {
                const opts = r.type === "income" ? INCOME_CATS : EXPENSE_CATS;
                return (
                    <dc.VanillaSelect
                        value={r.page.value("category") ?? ""}
                        options={opts.map(c => ({ value: c, label: c }))}
                        onValueChange={v => setField(r.page, "category", v)}
                    />
                );
            }
        },
        {
            id: `Amount (${baseCurrency})`,
            value: r => {
                const amt = Number(r.page.value("amount") ?? 0);
                const cur = r.page.value("currency") ?? baseCurrency;
                return Math.round(amt * (rates[cur] || 1));
            },
            render: (v, r) => (
                <span style={{ color: r.type === "income" ? "var(--color-green)" : "var(--color-red)", fontWeight: 500 }}>
                    {v.toLocaleString()}
                </span>
            )
        },
        { id: "Date", value: r => r.page.value("start_date") ?? "" }
    ];

    return (
        <div>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "10px" }}>
                <NewForm
                    label="+ New Income"
                    folder='Systems/Finances/Income'
                    tag="system/finances/income"
                    initialValues={{ frequency: txFreqFilter !== "All" ? txFreqFilter : undefined }}
                    fields={[
                        { name: "name", label: "Income name" },
                        { name: "amount", type: "number", width: "100px" },
                        { name: "currency", type: "select", options: CURRENCIES, default: baseCurrency },
                        { name: "category", type: "select", options: ["Work", "Benefit", "Other"], default: "Work" },
                        { name: "frequency", type: "select", options: ["Monthly", "Yearly"], default: "Monthly" },
                        { name: "status", type: "select", options: ["Active", "Inactive"], default: "Active" },
                        { name: "start_date", label: "Start (DD.MM.YYYY)", placeholder: "15.04.2026", width: "130px" }
                    ]}
                />
                <NewForm
                    label="+ New Expense"
                    buttonClass=""
                    folder='Systems/Finances/Expenses'
                    tag="system/finances/expense"
                    initialValues={{ frequency: txFreqFilter !== "All" ? txFreqFilter : undefined }}
                    fields={[
                        { name: "name", label: "Expense name" },
                        { name: "amount", type: "number", width: "100px" },
                        { name: "currency", type: "select", options: CURRENCIES, default: baseCurrency },
                        { name: "category", type: "select", options: ["Service", "Games", "Development", "Investment", "Savings", "Life"], default: "Life" },
                        { name: "frequency", type: "select", options: ["Monthly", "Yearly"], default: "Monthly" },
                        { name: "status", type: "select", options: ["Active", "Inactive"], default: "Active" },
                        { name: "start_date", label: "Start (DD.MM.YYYY)", placeholder: "15.04.2026", width: "130px" }
                    ]}
                />
            </div>

            <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "center", marginBottom: "10px" }}>
                <label>Month:&nbsp;
                    <dc.VanillaSelect
                        value={selMo}
                        options={MONTHS.map(m => ({ value: m, label: m }))}
                        onValueChange={v => setSelMo(v)}
                    />
                </label>
                <label>EUR rate:&nbsp;
                    <dc.Textbox key={eurRate} type="number" step="0.01" defaultValue={String(eurRate)}
                        onBlur={e => setField(cur, "EURExchangeRate", Number(e.currentTarget.value))}
                        style={{ width: "80px" }} />
                </label>
                <label>USD rate:&nbsp;
                    <dc.Textbox key={usdRate} type="number" step="0.01" defaultValue={String(usdRate)}
                        onBlur={e => setField(cur, "USDExchangeRate", Number(e.currentTarget.value))}
                        style={{ width: "80px" }} />
                </label>
                <button onClick={fetchRates} disabled={fetchingRates}
                    style={{ padding: "3px 10px", fontSize: "0.82em", cursor: fetchingRates ? "default" : "pointer" }}>
                    {fetchingRates ? "⟳ Fetching…" : "⟳ Fetch rates"}
                </button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "8px", marginBottom: "12px" }}>
                <dc.Card title="Income"   content={`${Math.round(data.totalIncome).toLocaleString()} ${baseCurrency}`} />
                <dc.Card title="Expenses" content={`${Math.round(data.totalExpenses).toLocaleString()} ${baseCurrency}`} />
                <dc.Card title="Savings"  content={`${Math.round(data.totalSavings).toLocaleString()} ${baseCurrency}`} />
                <dc.Card title="Net"      content={`${Math.round(data.netIncome).toLocaleString()} ${baseCurrency}`} />
            </div>

            <h3>Calendar — {firstDay.toLocaleDateString("en-US", { month: "long", year: "numeric" })}</h3>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                    <tr>
                        {["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map(d =>
                            <th key={d} style={{ border: "1px solid var(--background-modifier-border)", padding: "4px" }}>{d}</th>
                        )}
                    </tr>
                </thead>
                <tbody>
                    {weeks.map((w, wi) => (
                        <tr key={wi}>{w.map((day, di) => renderCell(day, di))}</tr>
                    ))}
                </tbody>
            </table>

            <h3 style={{ marginTop: "20px" }}>Yearly Overview — {currentYear}</h3>
            <p style={{ fontSize: "0.85em", opacity: 0.75 }}>Sum of all <em>Active</em> recurring items projected per month (in {baseCurrency} at current rates).</p>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                    <tr>
                        {["Month","Income","Expenses","Savings","Net"].map(hd =>
                            <th key={hd} style={{ border: "1px solid var(--background-modifier-border)", padding: "4px", textAlign: hd === "Month" ? "left" : "right" }}>{hd}</th>
                        )}
                    </tr>
                </thead>
                <tbody>
                    {yearly.months.map(r => {
                        const net = r.income - r.expenses - r.savings;
                        const isCur = r.i === selectedMonth;
                        const cell = { border: "1px solid var(--background-modifier-border)", padding: "4px", textAlign: "right" };
                        const fmt = (n) => Math.round(n).toLocaleString();
                        return (
                            <tr key={r.m} style={isCur ? { background: "var(--background-modifier-hover)" } : {}}>
                                <td style={{ ...cell, textAlign: "left", fontWeight: isCur ? "bold" : "normal" }}>{r.m}</td>
                                <td style={{ ...cell, color: "var(--color-green)" }}>{fmt(r.income)}</td>
                                <td style={{ ...cell, color: "var(--color-red)" }}>{fmt(r.expenses)}</td>
                                <td style={cell}>{fmt(r.savings)}</td>
                                <td style={{ ...cell, fontWeight: "bold", color: net >= 0 ? "var(--color-green)" : "var(--color-red)" }}>{fmt(net)}</td>
                            </tr>
                        );
                    })}
                    <tr style={{ borderTop: "2px solid var(--background-modifier-border)", fontWeight: "bold" }}>
                        <td style={{ padding: "4px" }}>Year</td>
                        <td style={{ padding: "4px", textAlign: "right", color: "var(--color-green)" }}>{Math.round(yearly.totals.income).toLocaleString()}</td>
                        <td style={{ padding: "4px", textAlign: "right", color: "var(--color-red)" }}>{Math.round(yearly.totals.expenses).toLocaleString()}</td>
                        <td style={{ padding: "4px", textAlign: "right" }}>{Math.round(yearly.totals.savings).toLocaleString()}</td>
                        <td style={{ padding: "4px", textAlign: "right", color: (yearly.totals.income - yearly.totals.expenses - yearly.totals.savings) >= 0 ? "var(--color-green)" : "var(--color-red)" }}>
                            {Math.round(yearly.totals.income - yearly.totals.expenses - yearly.totals.savings).toLocaleString()}
                        </td>
                    </tr>
                </tbody>
            </table>

            <h3 style={{ marginTop: "20px" }}>All Recurring Items</h3>
            <p style={{ fontSize: "0.85em", opacity: 0.75 }}>Your master list of <strong>recurring monthly &amp; yearly</strong> income and expenses. Category is editable inline; open the note to change frequency, status, or currency.</p>

            <div style={{ margin: "8px 0" }}>
                {/* Line 1: Type · Freq · Sort · Min Amount · Total */}
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center", marginBottom: "6px" }}>
                    <span style={{ fontSize: "0.85em", opacity: 0.7 }}>Type:</span>
                    {["All", "Income", "Expense"].map(t => (
                        <button key={t} onClick={() => setTxTypeFilter(t)} className={txTypeFilter === t ? "mod-cta" : ""}
                            style={{ padding: "3px 9px", fontSize: "0.82em", cursor: "pointer" }}>{t}</button>
                    ))}
                    <span style={{ width: "1px", height: "20px", background: "var(--background-modifier-border)", margin: "0 4px" }} />
                    <span style={{ fontSize: "0.85em", opacity: 0.7 }}>Freq:</span>
                    {["All", ...FREQUENCIES].map(f => (
                        <button key={f} onClick={() => setTxFreqFilter(f)} className={txFreqFilter === f ? "mod-cta" : ""}
                            style={{ padding: "3px 9px", fontSize: "0.82em", cursor: "pointer" }}>{f}</button>
                    ))}
                    <span style={{ width: "1px", height: "20px", background: "var(--background-modifier-border)", margin: "0 4px" }} />
                    <SortBar fields={TX_SORT_FIELDS} field={txSortField} setField={setTxSortField} dir={txSortDir} setDir={setTxSortDir} />
                    <span style={{ width: "1px", height: "20px", background: "var(--background-modifier-border)", margin: "0 4px" }} />
                    <label style={{ fontSize: "0.85em", display: "flex", alignItems: "center", gap: "4px" }}>
                        Min {baseCurrency}:
                        <dc.Textbox type="number" value={String(txMinAmt)} placeholder="0"
                            onInput={e => setTxMinAmt(e.currentTarget.value)}
                            style={{ width: "80px" }} />
                    </label>
                    <span style={{ marginLeft: "auto", fontSize: "0.9em", opacity: 0.8 }}>
                        {txFiltered.length} items · net <strong style={{ color: txFilteredTotal >= 0 ? "var(--color-green)" : "var(--color-red)" }}>{Math.round(txFilteredTotal).toLocaleString()} {baseCurrency}</strong>
                    </span>
                </div>
                {/* Line 2: Category pills */}
                {txCategories.length > 0 && (
                    <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", alignItems: "center" }}>
                        <span style={{ fontSize: "0.85em", opacity: 0.7 }}>Category:</span>
                        {txCategories.map(c => (
                            <button key={c} onClick={() => toggleCat(c)}
                                className={txCatFilter.has(c) ? "mod-cta" : ""}
                                style={{ cursor: "pointer", padding: "3px 9px", fontSize: "0.85em", borderRadius: "10px" }}>
                                {c}
                            </button>
                        ))}
                        {txCatFilter.size > 0 && (
                            <button onClick={() => setTxCatFilter(new Set())} style={{ cursor: "pointer", padding: "3px 9px", fontSize: "0.85em", opacity: 0.7 }}>clear</button>
                        )}
                    </div>
                )}
            </div>

            <dc.Table columns={TX_COLUMNS} rows={txSorted} paging={20} />
        </div>
    );
}
```

---

## Notes

Use this section for monthly optimization ideas, budget thoughts, or recurring reminders.
