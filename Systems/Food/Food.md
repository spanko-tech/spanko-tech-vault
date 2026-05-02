---
aliases: []
tags:
  - food/system
  - datacore/dashboard
plan_items:
  - food: "[[Egg (Whole)]]"
    amount: 1
goal_kcal: 2300
goal_protein: 140
goal_carbs: 270
goal_fat: 60
goal_fiber: 35
efficiency_numerator: protein
efficiency_denominator: kcal
efficiency_scale: 100
---

# Food

Track recipes, ingredients, and meal planning with nutrition calculations.

```datacorejsx
const V = await dc.require("Toolkit/Datacore/Vault.js");
const { NewForm: NewFormShared } = await dc.require("Toolkit/Datacore/UI.jsx");

function NewForm({ folder, fields, label = "+ New", defaults = {}, tag, body = "", buttonClass = "mod-cta" }) {
    const bodyFn = typeof body === "function"
        ? body
        : (vals) => body ? body.replace(/\{\{name\}\}/g, vals.name || "Untitled") : "\n";
    return <NewFormShared label={label} folder={folder} tag={tag} defaults={defaults}
        fields={fields} body={bodyFn} buttonClass={buttonClass} addHeading={false} />;
}

const RECIPE_TEMPLATE_BODY = `
# {{name}}

> One-line description.

## Ingredients

` + "```" + `datacorejsx
const { Editor } = await dc.require(dc.headerLink("Toolkit/Snippets/Recipe Editor.md", "Editor"));
return Editor;
` + "```" + `
`;

return function View() {
    const recipes     = dc.useQuery('@page and #food/recipe and path("Systems/Food")');
    const ingredients = dc.useQuery('@page and #food/ingredient and path("Systems/Food")');
    return (
        <div>
            <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", marginBottom: "10px" }}>
                <div style={{ padding: "8px 14px", background: "var(--background-secondary)", borderRadius: "6px" }}>
                    <div style={{ fontSize: "1.4em", fontWeight: "bold" }}>{recipes.length}</div>
                    <div style={{ fontSize: "0.72em", opacity: 0.75 }}>RECIPES</div>
                </div>
                <div style={{ padding: "8px 14px", background: "var(--background-secondary)", borderRadius: "6px" }}>
                    <div style={{ fontSize: "1.4em", fontWeight: "bold" }}>{ingredients.length}</div>
                    <div style={{ fontSize: "0.72em", opacity: 0.75 }}>INGREDIENTS</div>
                </div>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap" }}>
                <NewForm
                    label="+ New Recipe"
                    folder='Systems/Food/Recipes'
                    tag="food/recipe"
                    fields={[
                        { name: "name", label: "Recipe" },
                        { name: "meal_type", type: "select", options: ["Snack", "Main Meal"], default: "Main Meal" },
                        { name: "portions", type: "number", default: "1", width: "70px" }
                    ]}
                    defaults={{ aliases: [], recipe_items: [] }}
                    body={RECIPE_TEMPLATE_BODY}
                />
                <NewForm
                    label="+ New Ingredient"
                    buttonClass=""
                    folder='Systems/Food/Items'
                    tag="food/ingredient"
                    fields={[
                        { name: "name", label: "Ingredient" },
                        { name: "serving_size", label: "Serving size", type: "number", default: "100", width: "90px" },
                        { name: "unit", type: "select", options: ["g", "ml", "piece"], default: "g" },
                        { name: "kcal_per_serving",    label: "kcal",    type: "number", width: "70px" },
                        { name: "protein_per_serving", label: "Protein", type: "number", width: "70px" },
                        { name: "carbs_per_serving",   label: "Carbs",   type: "number", width: "70px" },
                        { name: "fat_per_serving",     label: "Fat",     type: "number", width: "70px" },
                        { name: "fiber_per_serving",   label: "Fiber",   type: "number", width: "70px" }
                    ]}
                    defaults={{ aliases: [] }}
                />
                <button onClick={async () => {
                    try {
                        const tplPath = "Toolkit/Templates/Ingredient (FatSecret).md";
                        const folderPath = "Systems/Food/Items";
                        const templater = dc.app.plugins.plugins["templater-obsidian"];
                        if (!templater) { new window.Notice("Templater plugin not enabled."); return; }
                        const tpl = dc.app.vault.getAbstractFileByPath(tplPath);
                        const folder = dc.app.vault.getAbstractFileByPath(folderPath);
                        if (!tpl) { new window.Notice(`Template not found: ${tplPath}`); return; }
                        await templater.templater.create_new_note_from_template(tpl, folder, undefined, true);
                    } catch (e) { new window.Notice(`FatSecret failed: ${e.message}`); }
                }} style={{ marginRight: "6px", marginLeft: "6px" }}>+ Ingredient via FatSecret</button>
            </div>
        </div>
    );
};
```

---

## 📝 Today's Log

```datacorejsx

const V = await dc.require("Toolkit/Datacore/Vault.js");

function resolveBasename(link) {
    if (!link) return null;
    if (typeof link === "object" && link.path) return link.path.split("/").pop().replace(/\.md$/, "");
    if (typeof link === "object" && link.name) return link.name;
    return String(link).replace(/^\[\[|\]\]$/g, "").split("|")[0].split("/").pop().replace(/\.md$/, "");
}

function r1(v) { return Math.round(v * 10) / 10; }
function pct(v, g) { return g > 0 ? Math.round(v / g * 100) : 0; }

const setField = V.setField;

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

function recipeMacrosPerPortion(recipe, ingByName) {
    const items    = recipe.value("recipe_items") ?? [];
    const portions = Number(recipe.value("portions") ?? 1) || 1;
    let k = 0, p = 0, c = 0, f = 0, fi = 0;
    for (const it of items) {
        const ing = ingByName.get(resolveBasename(it.ingredient));
        if (!ing) continue;
        const amt = Number(it.amount ?? it.servings ?? 0);
        if (!amt) continue;
        const mm = ingMacros(ing, amt);
        k += mm.kcal; p += mm.protein; c += mm.carbs; f += mm.fat; fi += mm.fiber;
    }
    return { kcal: k / portions, protein: p / portions, carbs: c / portions, fat: f / portions, fiber: fi / portions };
}

return function View() {
    const cur = dc.useCurrentFile();
    const items = cur.value("plan_items") ?? [];

    const goalKcal    = Number(cur.value("goal_kcal"))    || 2300;
    const goalProtein = Number(cur.value("goal_protein")) || 140;
    const goalCarbs   = Number(cur.value("goal_carbs"))   || 270;
    const goalFat     = Number(cur.value("goal_fat"))     || 60;
    const goalFiber   = Number(cur.value("goal_fiber"))   || 35;

    const effNum   = String(cur.value("efficiency_numerator")   ?? "protein");
    const effDen   = String(cur.value("efficiency_denominator") ?? "kcal");
    const effScale = Number(cur.value("efficiency_scale") ?? 100) || 100;

    const recipes     = dc.useQuery('@page and #food/recipe and path("Systems/Food")');
    const ingredients = dc.useQuery('@page and #food/ingredient and path("Systems/Food")');

    const [picked, setPicked] = dc.useState("");
    const [amount, setAmount] = dc.useState("");

    const recipeByName = dc.useMemo(() => {
        const m = new Map();
        for (const r of recipes) m.set(r.$name, r);
        return m;
    }, [recipes]);
    const ingByName = dc.useMemo(() => {
        const m = new Map();
        for (const i of ingredients) m.set(i.$name, i);
        return m;
    }, [ingredients]);

    const pickedKind = recipeByName.has(picked) ? "recipe" : (ingByName.has(picked) ? "ingredient" : null);
    const pickedUnit = pickedKind === "recipe"
        ? "portion"
        : (pickedKind === "ingredient" ? String(ingByName.get(picked).value("unit") ?? "") : "");
    const pickedDefaultAmount = pickedKind === "ingredient" ? (Number(ingByName.get(picked).value("serving_size")) || 1) : 1;

    const computed = dc.useMemo(() => {
        let totKcal = 0, totProtein = 0, totCarbs = 0, totFat = 0, totFiber = 0;
        const rows = [];
        items.forEach((item, idx) => {
            const amt = Number(item.amount ?? item.servings ?? 0);
            if (!amt) return;
            const foodName = resolveBasename(item.food);
            if (!foodName) return;
            const recipe = recipeByName.get(foodName);
            const ing    = !recipe ? ingByName.get(foodName) : null;
            if (!recipe && !ing) return;

            let macros, unit;
            if (recipe) {
                const per = recipeMacrosPerPortion(recipe, ingByName);
                macros = { kcal: per.kcal * amt, protein: per.protein * amt, carbs: per.carbs * amt, fat: per.fat * amt, fiber: per.fiber * amt };
                unit = "portion";
            } else {
                macros = ingMacros(ing, amt);
                unit = String(ing.value("unit") ?? "");
            }

            totKcal += macros.kcal; totProtein += macros.protein; totCarbs += macros.carbs; totFat += macros.fat; totFiber += macros.fiber;
            rows.push({
                idx,
                page:    recipe || ing,
                kind:    recipe ? "Recipe" : "Ingredient",
                amount:  amt,
                unit,
                kcal:    Math.round(macros.kcal),
                protein: r1(macros.protein),
                carbs:   r1(macros.carbs),
                fat:     r1(macros.fat),
                fiber:   r1(macros.fiber)
            });
        });
        return { rows, totKcal, totProtein, totCarbs, totFat, totFiber };
    }, [items, recipeByName, ingByName]);

    const foodOptions = dc.useMemo(() => {
        const opts = [{ value: "", label: "— pick a recipe or ingredient —" }];
        for (const r of [...recipes].sort((a, b) => a.$name.localeCompare(b.$name))) {
            opts.push({ value: r.$name, label: `🍽️ ${r.$name}` });
        }
        for (const i of [...ingredients].sort((a, b) => a.$name.localeCompare(b.$name))) {
            const u = i.value("unit") ?? "";
            const s = i.value("serving_size") ?? "";
            opts.push({ value: i.$name, label: `🥑 ${i.$name} (per ${s}${u})` });
        }
        return opts;
    }, [recipes, ingredients]);

    const addToPlan = async () => {
        if (!picked) return;
        const amt = Number(amount) || pickedDefaultAmount;
        const next = [...items, { food: `[[${picked}]]`, amount: amt }];
        await setField(cur, "plan_items", next);
        setPicked("");
        setAmount("");
    };

    const removeAt = async (idx) => {
        const next = items.filter((_, i) => i !== idx);
        await setField(cur, "plan_items", next);
    };

    const setRowAmount = async (idx, val) => {
        const v = Number(val);
        if (!Number.isFinite(v) || v <= 0) return;
        const next = items.map((it, i) => i === idx ? { ...it, amount: v } : it);
        await setField(cur, "plan_items", next);
    };

    const clearPlan = async () => { await setField(cur, "plan_items", []); };

    const effValueOf = (m) => {
        const num = m[effNum] ?? 0;
        const den = m[effDen] ?? 0;
        return den > 0 ? r1(num / den * effScale) : 0;
    };
    const eff = effValueOf({ kcal: computed.totKcal, protein: computed.totProtein, carbs: computed.totCarbs, fat: computed.totFat, fiber: computed.totFiber });
    const effLabel = `${effNum[0].toUpperCase() + effNum.slice(1)}/${effScale}${effDen}`;

    const PLAN_COLUMNS = [
        { id: "Item", value: r => r.page.$link },
        { id: "Kind", value: r => r.kind },
        {
            id: "Amount",
            value: r => r.amount,
            render: (_, r) => (
                <span style={{ display: "inline-flex", gap: "4px", alignItems: "center" }}>
                    <dc.Textbox type="number" defaultValue={String(r.amount)} key={`a-${r.idx}-${r.amount}`} min="0" step="any"
                        onBlur={e => setRowAmount(r.idx, e.currentTarget.value)} style={{ width: "70px" }} />
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
            render: (_, r) => (
                <button onClick={() => removeAt(r.idx)} style={{ cursor: "pointer", color: "var(--color-red)" }}>×</button>
            )
        }
    ];

    return (
        <div>
            <div style={{ display: "flex", gap: "8px", alignItems: "center", marginBottom: "8px", flexWrap: "wrap" }}>
                <dc.VanillaSelect value={picked} options={foodOptions} onValueChange={setPicked} />
                <dc.Textbox type="number" value={String(amount)} placeholder={picked ? String(pickedDefaultAmount) : "amount"} min="0" step="any"
                    onInput={e => setAmount(e.currentTarget.value)} style={{ width: "80px" }} />
                {pickedUnit ? <span style={{ opacity: 0.6, fontSize: "0.85em" }}>{pickedUnit}</span> : null}
                <dc.Button intent="primary" onClick={addToPlan} disabled={!picked}>+ Add</dc.Button>
                {computed.rows.length > 0 && (
                    <dc.Button intent="warning" onClick={clearPlan}>🗑️ Clear log</dc.Button>
                )}
            </div>

            {computed.rows.length === 0 ? (
                <p><em>Nothing logged yet today.</em></p>
            ) : (
                <div>
                    <dc.Table columns={PLAN_COLUMNS} rows={computed.rows} paging={20} />
                    <p>
                        🔥 <strong>{Math.round(computed.totKcal)} kcal ({pct(computed.totKcal, goalKcal)}%)</strong> |{" "}
                        💪 <strong>{r1(computed.totProtein)}g protein ({pct(computed.totProtein, goalProtein)}%)</strong> |{" "}
                        🌾 <strong>{r1(computed.totCarbs)}g carbs ({pct(computed.totCarbs, goalCarbs)}%)</strong> |{" "}
                        🥑 <strong>{r1(computed.totFat)}g fat ({pct(computed.totFat, goalFat)}%)</strong> |{" "}
                        🌿 <strong>{r1(computed.totFiber)}g fiber ({pct(computed.totFiber, goalFiber)}%)</strong> |{" "}
                        🏆 <strong>{eff} {effLabel}</strong>
                    </p>
                </div>
            )}
        </div>
    );
}
```

---

## 🎯 Daily Goals

```datacorejsx
const V = await dc.require("Toolkit/Datacore/Vault.js");
const setField = V.setField;

const GOALS = [
    { key: "goal_kcal",    label: "kcal",    fallback: 2300 },
    { key: "goal_protein", label: "Protein", fallback: 140, suffix: "g" },
    { key: "goal_carbs",   label: "Carbs",   fallback: 270, suffix: "g" },
    { key: "goal_fat",     label: "Fat",     fallback: 60,  suffix: "g" },
    { key: "goal_fiber",   label: "Fiber",   fallback: 35,  suffix: "g" }
];
const MACRO_KEYS = ["kcal", "protein", "carbs", "fat", "fiber"];

return function Goals() {
    const cur = dc.useCurrentFile();
    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
                {GOALS.map(g => (
                    <label key={g.key} style={{ display: "flex", flexDirection: "column", fontSize: "0.85em" }}>
                        <span style={{ opacity: 0.7 }}>{g.label}{g.suffix ? ` (${g.suffix})` : ""}</span>
                        <dc.Textbox type="number" defaultValue={String(cur.value(g.key) ?? g.fallback)}
                            key={`${g.key}-${cur.value(g.key)}`}
                            onBlur={e => setField(cur, g.key, Number(e.currentTarget.value) || g.fallback)}
                            style={{ width: "80px" }} />
                    </label>
                ))}
            </div>
            <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap", padding: "8px 10px", background: "var(--background-secondary)", borderRadius: "6px" }}>
                <span style={{ fontSize: "0.85em", opacity: 0.75 }}>🏆 Efficiency =</span>
                <dc.VanillaSelect value={String(cur.value("efficiency_numerator") ?? "protein")}
                    options={MACRO_KEYS.map(k => ({ value: k, label: k }))}
                    onValueChange={v => setField(cur, "efficiency_numerator", v)} />
                <span style={{ opacity: 0.6 }}>per</span>
                <dc.Textbox type="number" defaultValue={String(cur.value("efficiency_scale") ?? 100)}
                    key={`escale-${cur.value("efficiency_scale")}`}
                    onBlur={e => setField(cur, "efficiency_scale", Number(e.currentTarget.value) || 100)}
                    style={{ width: "60px" }} />
                <dc.VanillaSelect value={String(cur.value("efficiency_denominator") ?? "kcal")}
                    options={MACRO_KEYS.map(k => ({ value: k, label: k }))}
                    onValueChange={v => setField(cur, "efficiency_denominator", v)} />
                <span style={{ fontSize: "0.78em", opacity: 0.6 }}>(default protein per 100 kcal)</span>
            </div>
        </div>
    );
}
```

---

## 🍽️ Recipes

```datacorejsx
const V = await dc.require("Toolkit/Datacore/Vault.js");
const setField = V.setField;

const MEAL_TYPES = ["Snack", "Main Meal"];

function resolveBasename(link) {
    if (!link) return null;
    if (typeof link === "object" && link.path) return link.path.split("/").pop().replace(/\.md$/, "");
    if (typeof link === "object" && link.name) return link.name;
    return String(link).replace(/^\[\[|\]\]$/g, "").split("|")[0].split("/").pop().replace(/\.md$/, "");
}

function r1(v) { return Math.round(v * 10) / 10; }
function pct(v, g) { return g > 0 ? Math.round(v / g * 100) : 0; }

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

return function View() {
    const cur     = dc.useCurrentFile();
    const goalKcal    = Number(cur.value("goal_kcal"))    || 2300;
    const goalProtein = Number(cur.value("goal_protein")) || 140;
    const goalCarbs   = Number(cur.value("goal_carbs"))   || 270;
    const goalFat     = Number(cur.value("goal_fat"))     || 60;
    const goalFiber   = Number(cur.value("goal_fiber"))   || 35;
    const effNum   = String(cur.value("efficiency_numerator")   ?? "protein");
    const effDen   = String(cur.value("efficiency_denominator") ?? "kcal");
    const effScale = Number(cur.value("efficiency_scale") ?? 100) || 100;

    const [search,  setSearch]  = dc.useState("");

    const recipes     = dc.useQuery('@page and #food/recipe and path("Systems/Food")');
    const ingredients = dc.useQuery('@page and #food/ingredient and path("Systems/Food")');

    const ingByName = dc.useMemo(() => {
        const m = new Map();
        for (const ing of ingredients) m.set(ing.$name, ing);
        return m;
    }, [ingredients]);

    const rows = dc.useMemo(() => {
        const q = search.trim().toLowerCase();
        const out = [];
        for (const recipe of recipes) {
            if (q && !recipe.$name.toLowerCase().includes(q)) continue;
            const items    = recipe.value("recipe_items") ?? [];
            const portions = Number(recipe.value("portions") ?? 1) || 1;
            let totKcal = 0, totProtein = 0, totCarbs = 0, totFat = 0, totFiber = 0;
            for (const item of items) {
                const ing = ingByName.get(resolveBasename(item.ingredient));
                if (!ing) continue;
                const amt = Number(item.amount ?? item.servings ?? 0);
                if (!amt) continue;
                const mm = ingMacros(ing, amt);
                totKcal += mm.kcal; totProtein += mm.protein; totCarbs += mm.carbs; totFat += mm.fat; totFiber += mm.fiber;
            }
            const macros = { kcal: totKcal, protein: totProtein, carbs: totCarbs, fat: totFat, fiber: totFiber };
            const num = macros[effNum] ?? 0;
            const den = macros[effDen] ?? 0;
            const efficiency = den > 0 ? r1(num / den * effScale) : 0;
            out.push({
                page: recipe,
                type: recipe.value("meal_type") ?? "—",
                kcal: Math.round(totKcal),
                kcalPP: Math.round(totKcal / portions),
                protein: r1(totProtein),
                carbs:   r1(totCarbs),
                fat:     r1(totFat),
                fiber:   r1(totFiber),
                efficiency,
                portions
            });
        }
        return out.sort((a, b) => a.page.$name.localeCompare(b.page.$name));
    }, [recipes, ingByName, search, effNum, effDen, effScale]);

    const effHeader = `🏆 ${effNum[0].toUpperCase() + effNum.slice(1)}/${effScale}${effDen}`;

    const COLUMNS = [
        { id: "Recipe", value: r => r.page.$link },
        {
            id: "Type",
            value: r => r.type,
            render: (_, r) => (
                <dc.VanillaSelect
                    value={r.type === "—" ? "" : r.type}
                    options={[{ value: "", label: "—" }, ...MEAL_TYPES.map(t => ({ value: t, label: t }))]}
                    onValueChange={v => setField(r.page, "meal_type", v || null)}
                />
            )
        },
        {
            id: "Portions",
            value: r => r.portions,
            render: (_, r) => (
                <dc.Textbox type="number" defaultValue={String(r.portions)} key={`p-${r.page.$path}-${r.portions}`} min="0.25" step="0.25"
                    onBlur={e => setField(r.page, "portions", Number(e.currentTarget.value) || 1)}
                    style={{ width: "70px" }} />
            )
        },
        { id: "kcal (% goal)", value: r => r.kcal,    render: (_, r) => `${r.kcal} (${pct(r.kcal, goalKcal)}%)` },
        { id: "kcal/portion",  value: r => r.kcalPP },
        { id: "Protein",       value: r => r.protein, render: (_, r) => `${r.protein}g (${pct(r.protein, goalProtein)}%)` },
        { id: "Carbs",         value: r => r.carbs,   render: (_, r) => `${r.carbs}g (${pct(r.carbs, goalCarbs)}%)` },
        { id: "Fat",           value: r => r.fat,     render: (_, r) => `${r.fat}g (${pct(r.fat, goalFat)}%)` },
        { id: "Fiber",         value: r => r.fiber,   render: (_, r) => `${r.fiber}g (${pct(r.fiber, goalFiber)}%)` },
        { id: effHeader,       value: r => r.efficiency }
    ];

    return (
        <div>
            <div style={{ display: "flex", gap: "8px", alignItems: "center", marginBottom: "8px", flexWrap: "wrap" }}>
                <dc.Textbox placeholder="Search recipes…" value={search}
                    onInput={e => setSearch(e.currentTarget.value)} style={{ flex: "1 1 200px" }} />
                <span style={{ fontSize: "0.78em", opacity: 0.55 }}>Click column headers to sort.</span>
            </div>
            {rows.length === 0 ? (
                <p><em>{search ? "No recipes match." : "No recipes yet. Create one with the button above."}</em></p>
            ) : (
                <dc.Table columns={COLUMNS} rows={rows} paging={20} />
            )}
        </div>
    );
}
```

---

## 🥑 Ingredients

```datacorejsx
const V = await dc.require("Toolkit/Datacore/Vault.js");
const setField = V.setField;

const UNIT_OPTIONS = ["g", "ml", "piece"];

function NumCell({ page, field, value, width = "70px", suffix = "" }) {
    return (
        <span style={{ display: "inline-flex", gap: "2px", alignItems: "center" }}>
            <dc.Textbox type="number" defaultValue={String(value ?? "")} key={`${field}-${page.$path}-${value}`} min="0" step="any"
                onBlur={e => {
                    const v = e.currentTarget.value;
                    setField(page, field, v === "" ? null : Number(v));
                }} style={{ width }} />
            {suffix ? <span style={{ opacity: 0.6, fontSize: "0.85em" }}>{suffix}</span> : null}
        </span>
    );
}

function UnitCell({ page, value }) {
    return (
        <dc.VanillaSelect value={String(value ?? "g")}
            options={UNIT_OPTIONS.map(u => ({ value: u, label: u }))}
            onValueChange={v => setField(page, "unit", v)} />
    );
}

return function View() {
    const [search, setSearch] = dc.useState("");
    const ings = dc.useQuery('@page and #food/ingredient and path("Systems/Food")');

    const rows = dc.useMemo(() => {
        const q = search.trim().toLowerCase();
        const out = [];
        for (const p of ings) {
            if (q && !p.$name.toLowerCase().includes(q)) continue;
            out.push({
                page:    p,
                size:    p.value("serving_size")        ?? null,
                unit:    p.value("unit")                ?? "g",
                kcal:    p.value("kcal_per_serving")    ?? 0,
                protein: p.value("protein_per_serving") ?? 0,
                carbs:   p.value("carbs_per_serving")   ?? 0,
                fat:     p.value("fat_per_serving")     ?? 0,
                fiber:   p.value("fiber_per_serving")   ?? 0
            });
        }
        return out.sort((a, b) => a.page.$name.localeCompare(b.page.$name));
    }, [ings, search]);

    const COLUMNS = [
        { id: "Ingredient", value: r => r.page.$link },
        { id: "Per",        value: r => Number(r.size ?? 0), render: (_, r) => <NumCell page={r.page} field="serving_size" value={r.size} width="60px" /> },
        { id: "Unit",       value: r => r.unit,              render: (_, r) => <UnitCell page={r.page} value={r.unit} /> },
        { id: "kcal",       value: r => r.kcal,              render: (_, r) => <NumCell page={r.page} field="kcal_per_serving"    value={r.kcal} /> },
        { id: "Protein",    value: r => r.protein,           render: (_, r) => <NumCell page={r.page} field="protein_per_serving" value={r.protein} suffix="g" /> },
        { id: "Carbs",      value: r => r.carbs,             render: (_, r) => <NumCell page={r.page} field="carbs_per_serving"   value={r.carbs}   suffix="g" /> },
        { id: "Fat",        value: r => r.fat,               render: (_, r) => <NumCell page={r.page} field="fat_per_serving"     value={r.fat}     suffix="g" /> },
        { id: "Fiber",      value: r => r.fiber,             render: (_, r) => <NumCell page={r.page} field="fiber_per_serving"   value={r.fiber}   suffix="g" /> }
    ];

    return (
        <div>
            <div style={{ display: "flex", gap: "8px", alignItems: "center", marginBottom: "8px", flexWrap: "wrap" }}>
                <dc.Textbox placeholder="Search ingredients…" value={search}
                    onInput={e => setSearch(e.currentTarget.value)} style={{ flex: "1 1 200px" }} />
                <span style={{ fontSize: "0.78em", opacity: 0.55 }}>Click column headers to sort. Macros are per the listed serving size.</span>
            </div>
            {rows.length === 0 ? (
                <p><em>{search ? "No ingredients match." : "No ingredients yet. Create one with the button above."}</em></p>
            ) : (
                <dc.Table columns={COLUMNS} rows={rows} paging={20} />
            )}
        </div>
    );
}
```

