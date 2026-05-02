// Reusable lint UI: health panel, issue column, and state hook.
// Every dashboard that does quality-checking follows the same pattern —
// this module removes all the boilerplate so each dashboard only defines
// its domain-specific lint function and constants.
//
// Usage:
//   const { computeLintMap, useLintState, LintPanel, lintColumn } =
//       await dc.require("Toolkit/Datacore/ui/Lint.jsx");
//
// Quick recipe:
//   // 1. Define your lint function (returns issue[]):
//   function lintProject(p) {
//       const issues = [];
//       if (!p.value("category")) issues.push({ code: "no-category", severity: "warn", message: "no category" });
//       return issues;
//   }
//
//   // 2. Build the map and hook inside View():
//   const lintIssues = dc.useMemo(() => computeLintMap(projects, lintProject), [projects]);
//   const { issueFilter, setIssueFilter, issueCounts, totalIssues, itemsWithLint } =
//       useLintState(projects, lintIssues);
//
//   // 3. Render the health panel (above the table):
//   <LintPanel totalIssues={totalIssues} itemsWithLint={itemsWithLint}
//       codes={PROJ_ISSUE_CODES} labels={PROJ_ISSUE_LABELS}
//       issueCounts={issueCounts} issueFilter={issueFilter}
//       setIssueFilter={setIssueFilter} icon="📋" noun="project" />
//
//   // 4. Add the Issues column to dc.Table (as the last column):
//   lintColumn(lintIssues, issueFilter, setIssueFilter)
//
// Infrastructure note:
//   lintInfra() returns { issues: Map, counts: {} } — pass lint.issues as lintIssues
//   and call useLintState three times (once per entity type: servers, services, networks).

/**
 * Build a `path → issue[]` Map from an array of items and a per-item lint function.
 * Only items that have at least one issue are stored in the Map.
 *
 * @param {any[]} items            Datacore page objects (have .$path, .value(), .$body, …)
 * @param {(item: any) => {code: string, severity: "warn"|"error", message: string}[]} lintFn
 *     Per-item lint function. Return an empty array if the item is clean.
 * @returns {Map<string, {code:string, severity:string, message:string}[]>}
 *
 * @example
 *   const lintIssues = dc.useMemo(() => computeLintMap(projects, lintProject), [projects]);
 */
function computeLintMap(items, lintFn) {
    const m = new Map();
    for (const item of items) {
        const iss = lintFn(item);
        if (iss.length) m.set(item.$path, iss);
    }
    return m;
}

/**
 * Hook: manages `issueFilter` state and derives `issueCounts`, `totalIssues`, `itemsWithLint`
 * from a lint map. Replaces the four boilerplate useMemos every dashboard used to have.
 *
 * NOTE: call this at the top level of your View() function (React hook rules apply).
 *
 * @param {any[]} items            All items (same array you passed to computeLintMap).
 * @param {Map<string, any[]>} lintMap  Path→issue[] map (from computeLintMap or lintInfra().issues).
 * @returns {{
 *   issueFilter: string,
 *   setIssueFilter: (v: string | ((prev: string) => string)) => void,
 *   issueCounts: Record<string, number>,
 *   totalIssues: number,
 *   itemsWithLint: any[]
 * }}
 *
 * @example
 *   const { issueFilter, setIssueFilter, issueCounts, totalIssues, itemsWithLint } =
 *       useLintState(projects, lintIssues);
 */
function useLintState(items, lintMap) {
    const [issueFilter, setIssueFilter] = dc.useState("All");

    const { issueCounts, totalIssues, itemsWithLint } = dc.useMemo(() => {
        const counts = {};
        let total = 0;
        const withLint = [];
        for (const item of items) {
            const arr = lintMap.get(item.$path) ?? [];
            if (arr.length) withLint.push(item);
            for (const iss of arr) {
                counts[iss.code] = (counts[iss.code] ?? 0) + 1;
                total++;
            }
        }
        return { issueCounts: counts, totalIssues: total, itemsWithLint: withLint };
    }, [items, lintMap]);

    return { issueFilter, setIssueFilter, issueCounts, totalIssues, itemsWithLint };
}

/**
 * Health panel: shows a summary line then clickable chips, one per issue code.
 * Clicking a chip toggles the `issueFilter` for that code (filters the table).
 * Hidden when `totalIssues === 0`.
 *
 * @param {{
 *   totalIssues: number,
 *   itemsWithLint: any[],
 *   issueCounts: Record<string, number>,
 *   issueFilter: string,
 *   setIssueFilter: (v: string | ((p: string) => string)) => void,
 *   codes?: string[],        // ordered list of codes — determines chip order.
 *                            // If omitted, uses Object.keys(issueCounts) (insertion order).
 *   labels?: Record<string, string>,  // human-readable label per code. Falls back to the code itself.
 *   icon?: string,           // emoji prefix in the summary line. Default "⚠"
 *   noun?: string            // singular noun for items ("project", "resource", …). Default "item"
 * }} props
 *
 * @example
 *   <LintPanel totalIssues={totalIssues} itemsWithLint={projectsWithLint}
 *       codes={PROJ_ISSUE_CODES} labels={PROJ_ISSUE_LABELS}
 *       issueCounts={issueCounts} issueFilter={issueFilter}
 *       setIssueFilter={setIssueFilter} icon="📋" noun="project" />
 */
function LintPanel({ totalIssues, itemsWithLint, issueCounts, issueFilter, setIssueFilter,
                     codes, labels = {}, icon = "⚠", noun = "item" }) {
    if (totalIssues === 0) return null;
    const activeCodes = codes
        ? codes.filter(c => issueCounts[c] > 0)
        : Object.keys(issueCounts).filter(c => issueCounts[c] > 0);
    return (
        <div style={{
            padding: "8px 12px", background: "var(--background-secondary)",
            borderRadius: "6px", marginBottom: "10px", fontSize: "0.88em",
            display: "flex", flexWrap: "wrap", alignItems: "center", gap: "6px"
        }}>
            <span>
                {icon}{" "}
                <strong>{totalIssues}</strong> issue{totalIssues !== 1 ? "s" : ""} across{" "}
                <strong>{itemsWithLint.length}</strong> {noun}{itemsWithLint.length !== 1 ? "s" : ""}
            </span>
            <span style={{ opacity: 0.5 }}>·</span>
            {activeCodes.map(c => (
                <span key={c}
                    onClick={() => setIssueFilter(f => f === c ? "All" : c)}
                    style={{
                        cursor: "pointer", padding: "2px 8px", borderRadius: "10px",
                        background: issueFilter === c ? "var(--interactive-accent)" : "var(--background-modifier-border)",
                        color: issueFilter === c ? "var(--text-on-accent)" : undefined,
                        fontSize: "0.85em"
                    }}>
                    {issueCounts[c]} {labels[c] ?? c}
                </span>
            ))}
            {issueFilter !== "All" && (
                <a onClick={() => setIssueFilter("All")}
                    style={{ cursor: "pointer", fontSize: "0.85em", opacity: 0.7, marginLeft: "6px" }}>
                    clear
                </a>
            )}
        </div>
    );
}

/**
 * Build a `dc.Table` column definition that shows "✓" for clean items and
 * clickable issue chips for items with problems.
 * Clicking a chip toggles the `issueFilter` for that code.
 * Intended to be placed as the LAST column in the table.
 *
 * @param {Map<string, {code:string, severity:string, message:string}[]>} lintMap
 *     Path→issue[] map.
 * @param {string} issueFilter      Current active filter value ("All" or a code string).
 * @param {(v: string | ((p: string) => string)) => void} setIssueFilter  State setter.
 * @returns {object}  Column descriptor compatible with dc.Table `columns` prop.
 *
 * @example
 *   columns={[
 *       { id: "Name", value: p => p.$link },
 *       // … other columns …
 *       lintColumn(lintIssues, issueFilter, setIssueFilter)
 *   ]}
 */
function lintColumn(lintMap, issueFilter, setIssueFilter) {
    return {
        id: "Issues",
        value: item => (lintMap.get(item.$path) ?? []).length,
        render: (_, item) => {
            const iss = lintMap.get(item.$path) ?? [];
            if (!iss.length) {
                return <span style={{ color: "var(--color-green)", fontSize: "0.85em" }}>✓</span>;
            }
            return (
                <span style={{ display: "inline-flex", gap: "4px", flexWrap: "wrap" }}>
                    {iss.map((issue, idx) => (
                        <span key={idx}
                            onClick={() => setIssueFilter(f => f === issue.code ? "All" : issue.code)}
                            title={issue.message}
                            style={{
                                cursor: "pointer", padding: "1px 6px", borderRadius: "8px",
                                background: issueFilter === issue.code
                                    ? "var(--interactive-accent)"
                                    : "var(--background-modifier-border)",
                                color: issueFilter === issue.code ? "var(--text-on-accent)" : undefined,
                                fontSize: "0.72em"
                            }}>
                            {issue.message}
                        </span>
                    ))}
                </span>
            );
        }
    };
}

return { computeLintMap, useLintState, LintPanel, lintColumn };
