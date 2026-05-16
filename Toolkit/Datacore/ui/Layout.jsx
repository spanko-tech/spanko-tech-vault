// Layout & display primitives. No I/O, no Vault dependency.
// Loaded with: const L = await dc.require("Toolkit/Datacore/ui/Layout.jsx");

const memo = dc.preact?.memo ?? (c => c);

/**
 * Pill-style label.
 * @param {{label: string, color?: string, textColor?: string}} props
 * @example <Pill label="WIP" color="orange" />
 */
const Pill = memo(function Pill({label, color = "var(--background-modifier-border)", textColor = "white" }) {
    return <span style={{ padding: "1px 8px", borderRadius: "10px", background: color, color: textColor, fontSize: "0.75em" }}>{label}</span>;
});

/**
 * Single KPI tile (label + big value).
 * @param {{label: string, value: any, color?: string}} props
 */
const KPI = memo(function KPI({ label, value, color }) {
    return <div style={{ background: "var(--background-secondary)", padding: "8px 14px", borderRadius: "6px", minWidth: "90px" }}>
        <div style={{ fontSize: "0.72em", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>{label}</div>
        <div style={{ fontSize: "1.4em", fontWeight: 600, color: color ?? "var(--text-normal)" }}>{value}</div>
    </div>;
});

/**
 * Horizontal row of KPI tiles.
 * @param {{items: Array<{label:string,value:any,color?:string}>}} props
 * @example <KPIRow items={[{label:"Open",value:5},{label:"Done",value:12,color:"green"}]} />
 */
function KPIRow({ items }) {
    return <div style={{ display: "flex", gap: "8px", marginBottom: "12px", flexWrap: "wrap" }}>
        {items.map((it, i) => <KPI key={it.label ?? i} {...it} />)}
    </div>;
}

/**
 * Tab bar. Tabs may be strings or `{id,label?,count?}` objects.
 * @param {{tabs: (string|{id:string,label?:string,count?:number})[], active: string, onChange: (id:string)=>void}} props
 * @example
 *   const [tab, setTab] = dc.useState("all");
 *   <TabStrip tabs={[{id:"all",label:"All",count:n}, "todo"]} active={tab} onChange={setTab} />
 */
function TabStrip({ tabs, active, onChange }) {
    return <div style={{ display: "flex", gap: "4px", marginBottom: "10px", borderBottom: "1px solid var(--background-modifier-border)", flexWrap: "wrap" }}>
        {tabs.map(t => {
            const id = typeof t === "string" ? t : t.id;
            const label = typeof t === "string" ? t : (t.label ?? t.id);
            const count = typeof t === "object" ? t.count : undefined;
            return <button key={id} onClick={() => onChange(id)} className={active === id ? "mod-cta" : ""}
                style={{ cursor: "pointer", padding: "6px 14px", borderRadius: "5px 5px 0 0", border: "none", background: active === id ? undefined : "transparent" }}>
                {label}{count != null ? ` (${count})` : ""}
            </button>;
        })}
    </div>;
}

/**
 * Row of filter buttons with optional counts.
 * @param {{label?: string, options: string[], value: string, onChange: (v:string)=>void, counts?: Record<string,number>, minWidth?: string}} props
 * @example <FilterPills label="Status" options={["All","Open","Done"]} value={f} onChange={setF} counts={{Open:3,Done:9}} />
 */
function FilterPills({ label, options, value, onChange, counts, minWidth = "55px" }) {
    return <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", alignItems: "center", marginBottom: "4px" }}>
        {label && <span style={{ fontSize: "0.85em", opacity: 0.7, minWidth }}>{label}</span>}
        {options.map(o => (
            <button key={o} onClick={() => onChange(o)} className={value === o ? "mod-cta" : ""}
                style={{ padding: "3px 9px", fontSize: "0.82em", cursor: "pointer" }}>
                {o}{counts?.[o] != null ? ` (${counts[o]})` : ""}
            </button>
        ))}
    </div>;
}

/**
 * Multi-select pill row for preset option sets. Use with `useMultiFilter`.
 * Nothing selected = all pass (same as "All"). Adds a "clear" link when any are selected.
 * @param {{label?: string, options: string[], selected: Set<string>, onToggle: (v:string)=>void, onClear: ()=>void, counts?: Record<string,number>, minWidth?: string}} props
 * @example
 *   const [sel, toggle, clear, passes] = useMultiFilter();
 *   <MultiSelectPills label="Status:" options={STATUS} selected={sel} onToggle={toggle} onClear={clear} counts={counts} />
 */
function MultiSelectPills({ label, options, selected, onToggle, onClear, counts, minWidth = "55px" }) {
    return <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", alignItems: "center", marginBottom: "4px" }}>
        {label && <span style={{ fontSize: "0.85em", opacity: 0.7, minWidth }}>{label}</span>}
        {options.map(o => (
            <button key={o} onClick={() => onToggle(o)} className={selected.has(o) ? "mod-cta" : ""}
                style={{ padding: "3px 9px", fontSize: "0.82em", cursor: "pointer" }}>
                {o}{counts?.[o] != null ? ` (${counts[o]})` : ""}
            </button>
        ))}
        {selected.size > 0 && (
            <button onClick={onClear} style={{ padding: "3px 9px", fontSize: "0.82em", cursor: "pointer", opacity: 0.7 }}>clear</button>
        )}
    </div>;
}

/**
 * Collapsible `<details>` panel. Title may be a string or JSX.
 * @param {{title: any, defaultOpen?: boolean, children?: any}} props
 */
function Section({ title, defaultOpen = false, children }) {
    return <details {...(defaultOpen ? { open: true } : {})} style={{ marginBottom: "10px", background: "var(--background-secondary)", borderRadius: "6px", padding: "6px 10px" }}>
        <summary style={{ cursor: "pointer", fontSize: "0.88em" }}>{title}</summary>
        <div style={{ marginTop: "6px" }}>{children}</div>
    </details>;
}

/**
 * Searchable single-select dropdown. Accepts string[] or {value,label}[] options.
 * Renders as a clickable button when closed; an input+dropdown when open.
 * @param {{value: string, options: (string|{value:string,label:string})[], onValueChange: (v:string)=>void}} props
 */
const SearchableSelect = memo(function SearchableSelect({ value, options, onValueChange, style }) {
    const normed = (options ?? []).map(o => typeof o === "string" ? { value: o, label: o } : o);
    const selectedLabel = normed.find(o => o.value === value)?.label ?? (value != null ? String(value) : "");
    const [open, setOpen] = dc.useState(false);
    const [query, setQuery] = dc.useState("");
    const inputRef = dc.useRef(null);
    const filtered = dc.useMemo(() => {
        if (!query) return normed;
        const q = query.toLowerCase();
        return normed.filter(o => o.label.toLowerCase().includes(q));
    }, [normed, query]);
    const doOpen = () => { setQuery(""); setOpen(true); setTimeout(() => inputRef.current?.focus(), 0); };
    const doSelect = (v) => { onValueChange(v); setOpen(false); setQuery(""); };
    const baseStyle = { cursor: "pointer", padding: "2px 8px", border: "1px solid var(--background-modifier-border)", borderRadius: "4px", background: "transparent", fontSize: "inherit", display: "inline-flex", alignItems: "center", gap: "4px" };
    if (!open) {
        return (
            <button onClick={doOpen} style={{ ...baseStyle, ...style }}>
                <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textAlign: "left" }}>{selectedLabel}</span>
                <span style={{ opacity: 0.4, fontSize: "0.8em", flexShrink: 0 }}>▾</span>
            </button>
        );
    }
    const inputWidth = (style?.width) ? "100%" : "150px";
    return (
        <span style={{ position: "relative", display: "inline-block", ...(style?.width ? { width: style.width } : {}) }}>
            <input ref={inputRef} type="text" value={query}
                onInput={e => setQuery(e.currentTarget.value)}
                onKeyDown={e => {
                    if (e.key === "Enter" && filtered.length > 0) doSelect(filtered[0].value);
                    if (e.key === "Escape") { setOpen(false); setQuery(""); }
                }}
                onBlur={() => setTimeout(() => setOpen(false), 160)}
                placeholder={selectedLabel}
                style={{ width: inputWidth, padding: "2px 6px", fontSize: "inherit" }} />
            <div style={{
                position: "absolute", top: "calc(100% + 2px)", left: 0, zIndex: 9999,
                background: "var(--background-primary)",
                border: "1px solid var(--background-modifier-border)",
                borderRadius: "4px", minWidth: "180px", maxHeight: "220px", overflowY: "auto",
                boxShadow: "0 4px 12px rgba(0,0,0,0.25)"
            }}>
                {filtered.length === 0
                    ? <div style={{ padding: "5px 10px", opacity: 0.5, fontSize: "0.85em", fontStyle: "italic" }}>No match</div>
                    : filtered.map(o => (
                        <div key={o.value}
                            onMouseDown={e => { e.preventDefault(); doSelect(o.value); }}
                            style={{
                                padding: "5px 10px", cursor: "pointer", fontSize: "0.85em",
                                background: o.value === value ? "var(--background-modifier-hover)" : "transparent",
                                fontWeight: o.value === value ? 500 : "normal"
                            }}>
                            {o.label}
                        </div>
                    ))
                }
            </div>
        </span>
    );
});

/**
 * Compact sort control: a field SearchableSelect + an asc/desc toggle button.
 * @param {{fields: {value:string,label:string}[], field: string, setField: (f:string)=>void, dir: string, setDir: (d:string)=>void}} props
 */
const SortBar = memo(function SortBar({ fields, field, setField, dir, setDir }) {
    return (
        <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "0.85em" }}>
            <span style={{ opacity: 0.7 }}>Sort:</span>
            <SearchableSelect value={field} options={fields} onValueChange={setField} />
            <button
                onClick={() => setDir(d => d === "asc" ? "desc" : "asc")}
                title={dir === "asc" ? "Ascending — click to reverse" : "Descending — click to reverse"}
                style={{ padding: "2px 6px", cursor: "pointer", border: "1px solid var(--background-modifier-border)", borderRadius: "4px", background: "transparent", lineHeight: 1 }}>
                {dir === "asc" ? "↑" : "↓"}
            </button>
        </span>
    );
});

/**
 * Consistent empty-state display when a section or filtered list has no items.
 * @param {{icon?: string, title?: string, subtitle?: string}} props
 */
function EmptyState({ icon = "📭", title = "No items", subtitle }) {
    return (
        <div style={{
            padding: "24px 16px", textAlign: "center",
            background: "var(--background-secondary)", borderRadius: "6px", opacity: 0.7
        }}>
            <div style={{ fontSize: "1.8em", marginBottom: "6px" }}>{icon}</div>
            <div style={{ fontSize: "0.95em", fontWeight: 500 }}>{title}</div>
            {subtitle && <div style={{ fontSize: "0.82em", opacity: 0.75, marginTop: "4px" }}>{subtitle}</div>}
        </div>
    );
}

/**
 * Consistent filter/search bar wrapper. Provides the standard flex layout for
 * filter controls. Children can be labels, SearchableSelects, inputs, etc.
 * @param {{children: any, style?: object}} props
 */
function FilterRow({ children, style }) {
    return (
        <div style={{
            display: "flex", gap: "8px", flexWrap: "wrap",
            marginBottom: "10px", alignItems: "center", ...style
        }}>
            {children}
        </div>
    );
}

/**
 * Build a dc.Table column with a 🗑 trash button on each row.
 * Uses vault.trash (moves to system trash — recoverable).
 * @param {string} [noun="item"] Singular noun used in the confirm dialog.
 * @returns {object} Column descriptor compatible with dc.Table `columns` prop.
 * @example
 *   columns={[..., deleteColumn("note")]}
 */
function deleteColumn(noun = "item") {
    return {
        id: " ",
        value: () => 0,
        render: (_, item) => (
            <button title={`Delete this ${noun}`}
                onClick={async () => {
                    if (!window.confirm(`Delete "${item.$name}"? This cannot be undone.`)) return;
                    const file = dc.app.vault.getAbstractFileByPath(item.$path);
                    if (file) await dc.app.vault.trash(file, true);
                    new window.Notice("Deleted");
                }}
                style={{ fontSize: "0.75em", padding: "1px 5px", cursor: "pointer",
                    color: "var(--text-error)", background: "none", border: "none" }}>
                🗑
            </button>
        )
    };
}

return { Pill, KPI, KPIRow, TabStrip, FilterPills, MultiSelectPills, Section, SearchableSelect, SortBar, EmptyState, FilterRow, deleteColumn };
