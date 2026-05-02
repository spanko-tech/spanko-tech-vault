// Reusable Datacore hooks.
// Loaded with: const H = await dc.require("Toolkit/Datacore/ui/Hooks.jsx");

/**
 * Debounced text input state.
 * @param {number} delay  ms before `debounced` updates after the last keystroke.
 * @returns {[string, (v:string)=>void, string]} `[input, setInput, debounced]`.
 *
 * @example
 *   const [search, setSearch, debouncedSearch] = H.useDebouncedSearch(200);
 *   const filtered = items.filter(i => i.name.includes(debouncedSearch));
 *   return <input value={search} onInput={e => setSearch(e.currentTarget.value)} />;
 */
function useDebouncedSearch(delay = 200) {
    const [input, setInput] = dc.useState("");
    const [debounced, setDebounced] = dc.useState("");
    dc.useEffect(() => {
        const t = setTimeout(() => setDebounced(input), delay);
        return () => clearTimeout(t);
    }, [input, delay]);
    return [input, setInput, debounced];
}

/**
 * Stable sort with a user-controlled sort field and direction.
 * Prevents reactive reordering when unrelated fields change.
 * @param {any[]} items  Array from dc.useQuery or useMemo.
 * @param {{value:string,label:string}[]} fields  Sortable field descriptors. Use value "$name" for the page name.
 * @param {string} [defaultField="$name"]  Initial sort field.
 * @param {"asc"|"desc"} [defaultDir="asc"]  Initial sort direction.
 * @param {(item:any, field:string)=>string} [getValue]  Optional custom value extractor.
 * @returns {{ sorted: any[], sortField: string, setSortField: (f:string)=>void, sortDir: string, setSortDir: (d:string)=>void }}
 */
function useSortBy(items, fields, defaultField, defaultDir, getValue) {
    const df = defaultField ?? (fields?.[0]?.value ?? "$name");
    const [sortField, setSortField] = dc.useState(df);
    const [sortDir,   setSortDir]   = dc.useState(defaultDir ?? "asc");

    const sorted = dc.useMemo(() => {
        if (!items?.length) return items ?? [];
        const extract = getValue
            ? (item) => getValue(item, sortField)
            : (item) => sortField === "$name" ? (item.$name ?? "") : String(item.value?.(sortField) ?? "");
        return [...items].sort((a, b) => {
            const cmp = String(extract(a)).localeCompare(String(extract(b)), undefined, { numeric: true, sensitivity: "base" });
            return sortDir === "asc" ? cmp : -cmp;
        });
    }, [items, sortField, sortDir]);

    return { sorted, sortField, setSortField, sortDir, setSortDir };
}

/**
 * Multi-select filter state backed by a Set.
 * Nothing selected = all items pass (behaves like "All").
 * @returns {[Set<string>, (v:string)=>void, ()=>void, (v:string)=>boolean]}
 *   `[selected, toggle, clear, passes]`
 *   - `selected` — current Set of active values
 *   - `toggle(v)` — add v if absent, remove if present
 *   - `clear()` — deselect everything
 *   - `passes(v)` — true when nothing is selected OR v is in the Set; use in filter predicates
 *
 * @example
 *   const [statusFilters, toggleStatus, clearStatus, statusPasses] = useMultiFilter();
 *   // In filter:
 *   if (!statusPasses(item.value("status"))) return false;
 *   // In render:
 *   <MultiSelectPills options={MY_STATUS} selected={statusFilters} onToggle={toggleStatus} onClear={clearStatus} />
 */
function useMultiFilter() {
    const [selected, setSelected] = dc.useState(new Set());
    const toggle = (v) => setSelected(prev => { const n = new Set(prev); n.has(v) ? n.delete(v) : n.add(v); return n; });
    const clear  = () => setSelected(new Set());
    const passes = (v) => selected.size === 0 || selected.has(v);
    return [selected, toggle, clear, passes];
}

return { useDebouncedSearch, useSortBy, useMultiFilter };
