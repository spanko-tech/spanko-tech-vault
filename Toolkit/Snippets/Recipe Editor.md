---
tags: [snippet]
---

# Editor

Reusable Datacore JSX block embedded in every Recipe note. Loaded with `dc.require(dc.headerLink("Toolkit/Snippets/Recipe Editor.md", "Editor"))`.

```datacorejsx

function resolveBasename(link) {
    if (!link) return null;
    if (typeof link === "object" && link.path) return link.path.split("/").pop().replace(/\.md$/, "");
    if (typeof link === "object" && link.name) return link.name;
    return String(link).replace(/^\[\[|\]\]$/g, "").split("|")[0].split("/").pop().replace(/\.md$/, "");
}

function r1(v) { return Math.round(v * 10) / 10; }

async function setField(page, field, value) {
    const file = dc.app.vault.getAbstractFileByPath(page.$path);
    if (file) await dc.app.fileManager.processFrontMatter(file, fm => { fm[field] = value; });
}

function ingMacros(ing, amount) {
    const size = Number(ing.value("serving_size") ?? 1) || 1;
    const m = amount / size;
    return {
        kcal:    (Number(ing.value("kcal_per_serving"))    || 0) * m,
        protein: (Number(ing.value("protein_per_serving")) || 0) * m,
        carbs:   (Number(ing.value("carbs_per_serving"))   || 0) * m,
        fat:     (Number(ing.value("fat_per_serving"))     || 0) * m,
        fiber:   (Number(ing.value("fiber_per_serving"))   || 0) * m
    };
}

function Editor() {
    const cur = dc.useCurrentFile();
    const items = cur.value("recipe_items") ?? [];
    const portions = Number(cur.value("portions") ?? 1) || 1;

    const ingredients = dc.useQuery('@page and #food/ingredient and path("Systems/Food")');
    const ingByName = dc.useMemo(() => {
        const m = new Map();
        for (const i of ingredients) m.set(i.$name, i);
        return m;
    }, [ingredients]);

    const [picked, setPicked] = dc.useState("");
    const [amount, setAmount] = dc.useState("");
    const pickedIng  = picked ? ingByName.get(picked) : null;
    const pickedUnit = pickedIng ? String(pickedIng.value("unit") ?? "") : "";
    const pickedDefaultAmount = pickedIng ? (Number(pickedIng.value("serving_size")) || 1) : 1;

    const computed = dc.useMemo(() => {
        let totK = 0, totP = 0, totC = 0, totF = 0, totFi = 0;
        const rows = [];
        items.forEach((it, idx) => {
            const ing = ingByName.get(resolveBasename(it.ingredient));
            const amt = Number(it.amount ?? it.servings ?? 0);
            if (!ing || !amt) {
                rows.push({ idx, page: null, name: resolveBasename(it.ingredient) ?? "?", amount: amt, unit: "", kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, missing: !ing });
                return;
            }
            const mm = ingMacros(ing, amt);
            totK += mm.kcal; totP += mm.protein; totC += mm.carbs; totF += mm.fat; totFi += mm.fiber;
            rows.push({
                idx, page: ing, name: ing.$name,
                amount: amt, unit: String(ing.value("unit") ?? ""),
                kcal: Math.round(mm.kcal),
                protein: r1(mm.protein), carbs: r1(mm.carbs), fat: r1(mm.fat), fiber: r1(mm.fiber),
                missing: false
            });
        });
        return { rows, totK, totP, totC, totF, totFi };
    }, [items, ingByName]);

    const ingOptions = dc.useMemo(() => {
        const opts = [{ value: "", label: "— pick an ingredient —" }];
        for (const i of [...ingredients].sort((a, b) => a.$name.localeCompare(b.$name))) {
            const u = i.value("unit") ?? "";
            const s = i.value("serving_size") ?? "";
            opts.push({ value: i.$name, label: `🥑 ${i.$name} (per ${s}${u})` });
        }
        return opts;
    }, [ingredients]);

    const addItem = async () => {
        if (!picked) return;
        const amt = Number(amount) || pickedDefaultAmount;
        const next = [...items, { ingredient: `[[${picked}]]`, amount: amt }];
        await setField(cur, "recipe_items", next);
        setPicked(""); setAmount("");
    };
    const removeAt  = async (idx) => { await setField(cur, "recipe_items", items.filter((_, i) => i !== idx)); };
    const setAmountAt = async (idx, v) => {
        const n = Number(v); if (!Number.isFinite(n) || n <= 0) return;
        await setField(cur, "recipe_items", items.map((it, i) => i === idx ? { ...it, amount: n } : it));
    };

    const COLUMNS = [
        { id: "Ingredient", value: r => r.page ? r.page.$link : r.name },
        {
            id: "Amount",
            value: r => r.amount,
            render: (_, r) => r.missing ? <span style={{ color: "var(--color-red)" }}>missing ingredient</span> : (
                <span style={{ display: "inline-flex", gap: "4px", alignItems: "center" }}>
                    <dc.Textbox type="number" defaultValue={String(r.amount)} key={`a-${r.idx}-${r.amount}`} min="0" step="any"
                        onBlur={e => setAmountAt(r.idx, e.currentTarget.value)} style={{ width: "70px" }} />
                    <span style={{ opacity: 0.6, fontSize: "0.85em" }}>{r.unit}</span>
                </span>
            )
        },
        { id: "kcal",    value: r => r.kcal },
        { id: "Protein", value: r => r.protein, render: (_, r) => `${r.protein}g` },
        { id: "Carbs",   value: r => r.carbs,   render: (_, r) => `${r.carbs}g` },
        { id: "Fat",     value: r => r.fat,     render: (_, r) => `${r.fat}g` },
        { id: "Fiber",   value: r => r.fiber,   render: (_, r) => `${r.fiber}g` },
        {
            id: "",
            value: () => "",
            render: (_, r) => <button onClick={() => removeAt(r.idx)} style={{ cursor: "pointer", color: "var(--color-red)" }}>×</button>
        }
    ];

    return (
        <div>
            <div style={{ display: "flex", gap: "8px", alignItems: "center", marginBottom: "8px", flexWrap: "wrap" }}>
                <dc.VanillaSelect value={picked} options={ingOptions} onValueChange={setPicked} />
                <dc.Textbox type="number" value={String(amount)} placeholder={picked ? String(pickedDefaultAmount) : "amount"} min="0" step="any"
                    onInput={e => setAmount(e.currentTarget.value)} style={{ width: "80px" }} />
                <span style={{ opacity: 0.6, fontSize: "0.85em", minWidth: "44px" }}>{pickedUnit}</span>
                <dc.Button intent="primary" onClick={addItem} disabled={!picked}>➕ Add</dc.Button>
            </div>

            {computed.rows.length === 0 ? (
                <p><em>No ingredients yet. Pick one above.</em></p>
            ) : (
                <div>
                    <dc.Table columns={COLUMNS} rows={computed.rows} paging={50} />
                    <p style={{ fontSize: "0.9em", opacity: 0.85 }}>
                        <strong>Total:</strong> 🔥 {Math.round(computed.totK)} kcal · 💪 {r1(computed.totP)}g protein · 🌾 {r1(computed.totC)}g carbs · 🥑 {r1(computed.totF)}g fat · 🌿 {r1(computed.totFi)}g fiber
                        {portions !== 1 ? ` · per portion (÷${portions}): 🔥 ${Math.round(computed.totK / portions)} kcal · 💪 ${r1(computed.totP / portions)}g protein` : ""}
                    </p>
                </div>
            )}
        </div>
    );
}

return { Editor };
```

