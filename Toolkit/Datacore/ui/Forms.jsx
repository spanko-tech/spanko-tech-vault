// Editable cells, inputs and the new-note creation form.
// Loaded with: const F = await dc.require("Toolkit/Datacore/ui/Forms.jsx");

const V = await dc.require("Toolkit/Datacore/Vault.js");
const memo = dc.preact?.memo ?? (c => c);

/**
 * Inline editable text cell that writes a single frontmatter field on blur.
 * @param {{
 *   item: any,            // Datacore page object
 *   field: string,        // frontmatter key
 *   width?: string,
 *   placeholder?: string,
 *   mono?: boolean,
 *   suggestions?: string[]  // if set, renders a <datalist>
 * }} props
 */
const EditText = memo(function EditText({ item, field, width = "100%", placeholder = "", mono = false, suggestions }) {
    const cur = String(item.value(field) ?? "");
    const [v, setV] = dc.useState(cur);
    const last = dc.useRef(cur);
    const listId = dc.useMemo(() => suggestions ? `et-${field}-${Math.random().toString(36).slice(2, 7)}` : null, [field, !!suggestions]);
    dc.useEffect(() => { if (cur !== last.current) { setV(cur); last.current = cur; } }, [cur]);
    const commit = async () => { if (v === cur) return; last.current = v; await V.setField(item, field, v || null); };
    return <span>
        <input type="text" value={v} placeholder={placeholder} list={listId ?? undefined}
            onInput={e => setV(e.currentTarget.value)} onBlur={commit}
            onKeyDown={e => { if (e.key === "Enter") e.currentTarget.blur(); }}
            style={{ width, background: "transparent", border: "1px solid transparent", padding: "2px 4px", fontFamily: mono ? "var(--font-monospace)" : undefined }}
            onFocus={e => e.currentTarget.style.border = "1px solid var(--background-modifier-border)"} />
        {suggestions && <datalist id={listId}>{suggestions.map(s => <option key={s} value={s} />)}</datalist>}
    </span>;
});

/**
 * Dropdown select bound to a frontmatter field.
 * @param {{item:any, field?:string, options:string[], defaultValue?:string}} props
 *   `field` defaults to "status".
 */
const StatusSelect = memo(function StatusSelect({ item, field = "status", options, defaultValue }) {
    const cur = String(item.value(field) ?? defaultValue ?? options[0]);
    return <dc.VanillaSelect value={cur} options={options.map(s => ({ value: s, label: s }))}
        onValueChange={v => V.setField(item, field, v)} />;
});

/**
 * Inline chip-list editor for an array frontmatter field (defaults to wikilinks).
 * Click to edit as comma-separated text; blur/Enter commits.
 * @param {{
 *   item:any,
 *   field:string,
 *   options?:string[],
 *   placeholder?:string,
 *   parse?:(csv:string)=>any[],   // override CSV→array (default: wraps each in [[...]])
 *   format?:(arr:any[])=>string   // override array→CSV (default: basenames joined)
 * }} props
 */
const ChipListCell = memo(function ChipListCell({ item, field, options = [], placeholder = "+ add", parse, format }) {
    const _parse = parse ?? (csv => csv.split(",").map(s => s.trim()).filter(Boolean).map(s => `[[${s.replace(/^\[\[|\]\]$/g, "")}]]`));
    const _format = format ?? (arr => arr.map(V.linkBasename).filter(Boolean).join(", "));
    const arr = (() => { const v = item.value(field) ?? []; return Array.isArray(v) ? v : [v]; })();
    const names = arr.map(V.linkBasename).filter(Boolean);
    const [editing, setEditing] = dc.useState(false);
    const [v, setV] = dc.useState(_format(arr));
    if (editing) {
        return <input type="text" autoFocus value={v}
            placeholder={placeholder}
            list={options.length ? `cl-${field}` : undefined}
            onChange={e => setV(e.target.value)}
            onBlur={async () => { await V.setField(item, field, _parse(v)); setEditing(false); }}
            onKeyDown={e => { if (e.key === "Enter") e.currentTarget.blur(); if (e.key === "Escape") { setV(_format(arr)); setEditing(false); } }}
            style={{ width: "100%", padding: "2px 4px", border: "1px solid var(--background-modifier-border)" }} />;
    }
    return <div onClick={() => setEditing(true)}
        style={{ display: "flex", flexWrap: "wrap", gap: "4px", minHeight: "22px", cursor: "text", padding: "2px" }}
        title="Click to edit">
        {names.length === 0
            ? <span style={{ color: "var(--text-faint)", fontStyle: "italic", fontSize: "0.85em" }}>{placeholder}</span>
            : names.map(n => <span key={n} style={{ background: "var(--background-modifier-hover)", padding: "1px 8px", borderRadius: "10px", fontSize: "0.78em", whiteSpace: "nowrap" }}>{n}</span>)
        }
    </div>;
});

/**
 * Universal "+ New X" form. Click button to expand, fill fields, click Create.
 * Creates a markdown file with YAML frontmatter built from `defaults` + field values.
 *
 * @param {{
 *   label?:string, buttonClass?:string,
 *   folder?:string, folderFn?:(vals:object)=>string,   // destination folder
 *   tag?:string|string[],                              // tag(s) added to fm.tags
 *   fields:Array<{
 *     name:string, label?:string, default?:any, placeholder?:string, width?:string,
 *     type?:"text"|"number"|"checkbox"|"textarea"|"select"|"multiselect"|"version",
 *     options?:string[],            // for select/multiselect
 *     suggestions?:string[],        // for text: <datalist>
 *     emptyLabel?:string,           // multiselect placeholder
 *     transform?:(raw:any,vals:object)=>any
 *   }>,
 *   defaults?:object,
 *   body?:string|((vals:object)=>string),
 *   effects?:Array<{when:string, set:string, compute:(v:any,vals:object)=>any}>,
 *   onCreated?:(path:string)=>void,
 *   openOnCreate?:boolean,
 *   addHeading?:boolean
 * }} props
 *
 * @example
 *   <NewForm folder="Notes" tag="note"
 *     fields={[
 *       {name:"name", label:"Title"},
 *       {name:"status", type:"select", options:["Draft","Published"]}
 *     ]}
 *     body={vals => V.bodyTemplate(["Notes","Refs"])}
 *   />
 */
function NewForm({
    label = "+ New", folder, folderFn, tag, fields = [], body = "",
    defaults = {}, effects, onCreated, openOnCreate = false, addHeading = true,
    buttonClass = "mod-cta", initialValues = {}
}) {
    const initial = () => { const o = {}; for (const f of fields) o[f.name] = f.default ?? (f.type === "multiselect" ? [] : f.type === "checkbox" ? false : ""); return o; };
    const [open, setOpen] = dc.useState(false);
    const [vals, setVals] = dc.useState(initial);
    const set = (k, v) => setVals(prev => {
        const next = { ...prev, [k]: v };
        if (effects) for (const eff of effects) if (eff.when === k) {
            const c = eff.compute(v, next); if (c !== undefined) next[eff.set] = c;
        }
        return next;
    });

    const create = async () => {
        try {
            const name = V.safeName(vals.name || "Untitled");
            if (!name) return;
            const dir = folderFn ? folderFn(vals) : folder;
            await V.ensureFolder(dir);
            const path = `${dir}/${name}.md`;
            if (dc.app.vault.getAbstractFileByPath(path)) {
                if (openOnCreate) dc.app.workspace.openLinkText(path, "");
                return;
            }
            const fm = { ...defaults };
            for (const f of fields) {
                if (f.name === "name") continue;
                const raw = vals[f.name];
                if (raw === "" || raw == null) continue;
                let v = raw;
                if (f.transform) v = f.transform(raw, vals);
                else if (f.type === "number") v = Number(raw);
                else if (f.type === "checkbox") v = !!raw;
                if (v === "" || v == null) continue;
                fm[f.name] = v;
            }
            if (tag) fm.tags = [...(fm.tags || []), ...(Array.isArray(tag) ? tag : [tag])];
            fm.created = V.today();
            const yamlScalar = (v) => {
                if (typeof v === "boolean" || typeof v === "number") return String(v);
                const s = String(v ?? "");
                if (/^[\w\s./_:-]+$/.test(s) && !/^[\d-]/.test(s)) return s;
                return `"${s.replace(/"/g, '\\"')}"`;
            };
            const yamlVal = (v) => Array.isArray(v)
                ? `[${v.map(yamlScalar).join(", ")}]`
                : yamlScalar(v);
            const front = "---\n" + Object.entries(fm).map(([k, v]) => `${k}: ${yamlVal(v)}`).join("\n") + "\n---\n";
            const heading = addHeading ? `\n# ${name}\n` : "\n";
            const bodyStr = typeof body === "function" ? body(vals) : (body ?? "");
            await dc.app.vault.create(path, front + heading + bodyStr);
            V.notify(`Created ${name}`);
            setVals(prev => ({ ...prev, name: "" }));
            if (openOnCreate) dc.app.workspace.openLinkText(path, "");
            onCreated?.(path);
        } catch (e) { console.error(e); V.notify(`Create failed: ${e.message}`); }
    };

    if (!open) {
        return <button className={buttonClass} onClick={() => {
            let v = initial();
            const overrides = Object.entries(initialValues).filter(([, val]) => val != null && val !== "");
            for (const [k, val] of overrides) {
                v[k] = val;
                if (effects) for (const eff of effects) {
                    if (eff.when === k) { const c = eff.compute(val, v); if (c !== undefined) v[eff.set] = c; }
                }
            }
            setVals(v);
            setOpen(true);
        }} style={{ marginBottom: "8px", cursor: "pointer" }}>{label}</button>;
    }

    const renderField = (f) => {
        const value = String(vals[f.name] ?? "");
        if (f.type === "select") {
            return <dc.VanillaSelect value={value || (f.options?.[0] ?? "")} options={(f.options ?? []).map(o => ({ value: o, label: o }))} onValueChange={v => set(f.name, v)} />;
        }
        if (f.type === "checkbox") {
            return <input type="checkbox" checked={!!vals[f.name]} onChange={e => set(f.name, e.target.checked)} />;
        }
        if (f.type === "textarea") {
            return <textarea value={value} placeholder={f.placeholder ?? ""} onInput={e => set(f.name, e.currentTarget.value)} style={{ width: f.width ?? "260px", height: "60px" }} />;
        }
        if (f.type === "multiselect") {
            const cur = Array.isArray(vals[f.name]) ? vals[f.name] : [];
            const remaining = (f.options ?? []).filter(o => !cur.includes(o));
            return <span style={{ display: "inline-flex", flexWrap: "wrap", alignItems: "center", gap: "4px" }}>
                {cur.length === 0 && f.emptyLabel && <span style={{ opacity: 0.55, fontStyle: "italic" }}>{f.emptyLabel}</span>}
                {cur.map(c => <span key={c} style={{ background: "var(--background-modifier-hover)", padding: "1px 6px", borderRadius: "10px", display: "inline-flex", gap: "4px" }}>{c}<a onClick={() => set(f.name, cur.filter(x => x !== c))} style={{ cursor: "pointer", opacity: 0.6, fontWeight: "bold" }}>×</a></span>)}
                {remaining.length > 0 && <dc.VanillaSelect value="" options={[{value:"",label:"+ add"}, ...remaining.map(o => ({value:o,label:o}))]} onValueChange={v => { if (v) set(f.name, [...cur, v]); }} />}
            </span>;
        }
        if (f.type === "version") {
            const parts = (value || "0.0.0").split(".");
            const a = parts[0] ?? "0", b = parts[1] ?? "0", c = parts[2] ?? "0";
            const upd = (i, v) => { const arr = [a, b, c]; arr[i] = v.replace(/\D/g, "") || "0"; set(f.name, arr.join(".")); };
            const box = (v, i) => <input key={i} type="text" value={v} onChange={e => upd(i, e.target.value)} style={{ width: "42px", textAlign: "center" }} />;
            return <span style={{ display: "inline-flex", gap: "2px", alignItems: "center" }}>{box(a, 0)}<span>.</span>{box(b, 1)}<span>.</span>{box(c, 2)}</span>;
        }
        if (f.suggestions) {
            const listId = `nf-${f.name}-${Math.random().toString(36).slice(2, 7)}`;
            return <span><input type={f.type ?? "text"} list={listId} value={value} placeholder={f.placeholder ?? ""} onInput={e => set(f.name, e.currentTarget.value)} style={{ width: f.width ?? "160px" }} /><datalist id={listId}>{f.suggestions.map(s => <option key={s} value={s} />)}</datalist></span>;
        }
        return <input type={f.type ?? "text"} value={value} placeholder={f.placeholder ?? f.label ?? f.name} onInput={e => set(f.name, e.currentTarget.value)} style={{ width: f.width ?? "180px" }} />;
    };

    return (
        <div style={{ display: "flex", gap: "8px", padding: "10px", background: "var(--background-modifier-hover)", borderRadius: "6px", flexWrap: "wrap", alignItems: "flex-end", margin: "8px 0" }}>
            {fields.map(f => (
                <label key={f.name} style={{ display: "flex", flexDirection: "column", fontSize: "0.85em" }}>
                    <span style={{ opacity: 0.7 }}>{f.label ?? f.name}</span>
                    {renderField(f)}
                </label>
            ))}
            <button className="mod-cta" onClick={create} style={{ cursor: "pointer" }}>Create</button>
            <button onClick={() => setOpen(false)} style={{ cursor: "pointer" }}>Cancel</button>
        </div>
    );
}

return { NewForm, EditText, StatusSelect, ChipListCell };
