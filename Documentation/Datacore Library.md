# Datacore Library

Shared helpers and React components for the Datacore JSX dashboards across the vault.
The goal: keep dashboards small and configurable so you can tweak them without re-deriving the same plumbing every time.

## Layout

```
Toolkit/Datacore/
  Vault.js          Pure JS helpers (frontmatter, dates, queries, files)
  Web.js            HTTP helpers + page scraping (httpGet, httpJson, httpBinary, fetchPageText)
  LintRules.js      All lint rule functions and thresholds - single source of truth
  Issues.js         Issue path/move logic shared between dashboard and Oraculum tools
  UI.jsx            Barrel re-exporting everything in ui/*
  ui/
    Forms.jsx       NewForm, EditText, StatusSelect, ChipListCell
    Layout.jsx      Pill, KPI, KPIRow, TabStrip, FilterPills, MultiSelectPills, Section,
                    SearchableSelect, SortBar, EmptyState, FilterRow, deleteColumn
    Boards.jsx      Kanban, KanbanCounts
    Hooks.jsx       useDebouncedSearch, useSortBy, useMultiFilter, useBodyMap, useBodyStats
    Lint.jsx        computeLintMap, useLintState, LintPanel, lintColumn
  README.md         (this file)
```

- **`useBodyMap(items) → Map<path, string>`** - async hook that reads the raw body text of each item from disk. Returns a `Map<$path, bodyString>`. Used when lint rules or rendering need the note body content (not just frontmatter). Re-reads when the item list changes.
  ```jsx
  const bodyMap = useBodyMap(items);
  // in lint:
  const lintMap = dc.useMemo(() => computeLintMap(items, i => lintFn(i, bodyMap.get(i.$path) ?? "")), [items, bodyMap]);
  ```

- **`useBodyStats(items, transform) → Map<path, stats>`** - like `useBodyMap` but applies a `transform(body) → stats` function to each body before storing. Used in Cogito where `sectionStats` from `LintRules.js` parses bodies into structured section data rather than raw strings.
  ```jsx
  const bodyStats = useBodyStats(notes, sectionStats);
  ```

## Web.js - HTTP helpers

Shared HTTP layer used by dashboards and Oraculum tools. Import with:

```js
const W = await dc.require("Toolkit/Datacore/Web.js");
```

| Function | Purpose |
|---|---|
| `httpGet(url)` | Raw GET → `{ ok, text, status }`. Uses `requestUrl` (Obsidian's CORS bypass) with `fetch` fallback. |
| `httpJson(url, opts?)` | GET that parses JSON → `{ ok, data, status }`. Pass `opts.method`, `opts.headers`, `opts.body` for POST/GraphQL. |
| `httpBinary(url, opts?)` | GET returning `{ ok, buffer: ArrayBuffer, status }`. Used for image downloads. |
| `fetchPageText(url, limit?)` | Scrapes a URL and returns cleaned readable text (strips scripts, nav, etc.). Falls back to Jina Reader (`r.jina.ai`) if the direct fetch returns sparse content. `limit` defaults to 6000 chars. |

## LintRules.js - lint functions

Single source of truth for all lint rules and quality thresholds. Both dashboards (via `computeLintMap`) and Oraculum's `vault_health` tool import from here so thresholds stay in sync. Import with:

```js
const { lintProject, PROJ_ISSUE_CODES, PROJ_ISSUE_LABELS, ... } = await dc.require("Toolkit/Datacore/LintRules.js");
```

**Exported lint functions** (each takes `(item, body)` and returns `{ code, severity, message }[]`):

| Function | Used in |
|---|---|
| `lintProject(project, body)` | Projects |
| `lintRelease(r, body)` | Releases |
| `lintResource(resource, body)` | Resources |
| `lintLeetcode(problem, body)` | Leetcode |
| `lintBrag(item, body)` | Growth - Brags |
| `lintAdr(item, body)` | Growth - ADRs |
| `lintReview(item, body)` | Growth - Reviews |
| `lintPostmortem(item, body)` | Growth - Postmortems |
| `lintPresentation(item, body)` | Presentations |
| `lintNote(n, bodyStats)` | Cogito - Notes |
| `lintMedia(m, bodyStats)` | Cogito - Media |
| `lintIndexQuality(body)` | Cogito - MOC index quality |
| `lintFm(fm)` | Oraculum `vault_health` tool - raw frontmatter check |

Each domain also exports `*_ISSUE_CODES` and `*_ISSUE_LABELS` arrays/maps for use with `<LintPanel>`.

**Thresholds** are constants at the top of the file (`STUB_AGE_DAYS`, `MIN_BACKLINKS_EVERGREEN`, `STALE_BACKLOG_DAYS`, etc.) - change them there and every dashboard + Oraculum picks up the change automatically.

## How dashboards consume it

Every `datacorejsx` codeblock is its own script - each block must independently `dc.require` what it needs.

```jsx
const V  = await dc.require("Toolkit/Datacore/Vault.js");
const UI = await dc.require("Toolkit/Datacore/UI.jsx");
const { NewForm, KPIRow, FilterPills, Kanban } = UI;

return function Dashboard() {
    const items = dc.useArray(dc.useQuery(V.q("system/projects/project", "Systems/Projects")));
    // ...
};
```

You can also import a single submodule for slightly leaner cold loads:

```jsx
const { Kanban } = await dc.require("Toolkit/Datacore/ui/Boards.jsx");
```

`dc.require` caches modules after the first load, so subsequent blocks get them instantly.

## Vault.js - helpers

| Function | Purpose |
|---|---|
| `setField(item, key, val)` | Write a single frontmatter field. |
| `setFields(item, obj)` | Write multiple fields in one go. |
| `notify(msg)` | Obsidian toast. |
| `ensureFolder(path)` | mkdir -p in the vault. |
| `trashFile(file, system?)` | Move to trash. |
| `confirmTrash(fileOrItem, msg?)` | Confirm dialog → trash. Returns `true` if trashed. |
| `safeName(s)` | Strip illegal filename chars. |
| `linkBasename(link)` | Pull a clean basename from a wikilink, path, or link object. |
| `fmtDate(v)` | → `YYYY-MM-DD`. Handles `d_` prefixes. |
| `today()` | → `YYYY-MM-DD` for today. |
| `daysSince(v)` | Whole days since `v`, or `null`. |
| `isStaleSince(v, days)` | True if `v` is at least `days` days old. |
| `q(tag, folder)` | Build `@page and #tag and path("folder")`. |
| `sortByDateDesc(items, field?)` | New array sorted descending by string field. |
| `sortBy(items, fn, dir?)` | Generic sort by extractor. |
| `groupByStatus(items, statuses, opts?)` | `{[status]: items[]}` with all keys present. |
| `countByStatus(items, statuses, opts?)` | `{[status]: count}`. |
| `bodyTemplate(headings)` | Build a body from `## Heading` list. |
| `openNote(path)` | Open via workspace. |
| `runTemplater(templatePath, folderPath?)` | Run a Templater template. |

Hover any function in your editor to see the JSDoc signature with parameter docs.

## UI.jsx - components

### Forms

- **`<NewForm folder|folderFn tag fields defaults body effects onCreated />`** - universal "+ New X" button → expands to a field row → creates a markdown file with frontmatter. Supports `text` / `number` / `checkbox` / `textarea` / `select` / `multiselect` / `version` field types and a per-field `suggestions` datalist.
- **`<EditText item field placeholder? mono? suggestions? />`** - inline editable cell, writes on blur.
- **`<StatusSelect item field? options defaultValue? />`** - dropdown bound to a frontmatter field. `field` defaults to `"status"`.
- **`<ChipListCell item field options? placeholder? parse? format? />`** - click-to-edit chip list for array fields. Defaults to wikilinks; pass `parse` / `format` for plain strings.

### Layout

- **`<Pill label color? textColor? />`** - small colored label.
- **`<KPI label value color? />`** - single tile.
- **`<KPIRow items=[{label,value,color?}] />`** - row of tiles.
- **`<TabStrip tabs active onChange />`** - tabs may be strings or `{id, label?, count?}`.
- **`<FilterPills label? options value onChange counts? />`** - single-select pill row with optional counts. Pass `["All", ...OPTIONS]` as `options`; `value="All"` means no filter active.
- **`<MultiSelectPills label? options selected onToggle onClear counts? />`** - multi-select pill row. `selected` is a `Set`; use with `useMultiFilter`. Nothing selected = all items pass (behaves like "All"). Adds a "clear" link when any option is active. Use this when options are preset/static. Use `SearchableSelect` when options come from data.
- **`<Section title defaultOpen? children />`** - `<details>` panel. `title` accepts JSX.
- **`<SearchableSelect value options onValueChange />`** - single-select dropdown with fuzzy search. Options may be `string[]` or `{value,label}[]`. Renders as a compact button when closed; expands to a filtered input when open.
- **`<SortBar fields field setField dir setDir />`** - compact sort control: a `SearchableSelect` for the field + an asc/desc toggle arrow button. Used alongside `useSortBy`.

- **`<EmptyState icon? title? subtitle? />`** - empty state placeholder. Defaults: icon `"📭"`, title `"No items"`. Use inside table or list containers when `filtered.length === 0`.
- **`<FilterRow children style? />`** - thin flex wrapper for a row of filter controls. Use to wrap `SearchableSelect` dropdowns + search input + `SortBar` into a consistent horizontal bar.
- **`deleteColumn(noun?) → column`** - column descriptor for `dc.Table` that renders a delete button on each row. `noun` is used in the confirmation prompt (default `"item"`). Place as the last column alongside or instead of `lintColumn`.

### Boards

- **`<KanbanCounts items statuses colors? getStatus? defaultStatus? />`** - totals strip (no DnD).
- **`<Kanban columns items getCol onMove renderCard columnHeader? />`** - drag-and-drop board. `items` should already be filtered to what you want visible; `getCol(item)` decides the column. `onMove(item, toCol)` is awaited.

### Hooks

- **`useDebouncedSearch(delay=200) → [input, setInput, debounced]`** - wires a search input + debounced value. `input` binds to the `<input>` element; `debounced` is safe to use in `useMemo` deps.
- **`useSortBy(items, fields, defaultField?, defaultDir?, getValue?) → { sorted, sortField, setSortField, sortDir, setSortDir }`** - stable sort with user-controlled field + direction. Prevents reactive reordering when unrelated fields change. Pair with `<SortBar>` to expose the controls. `getValue(item, field)` can be used for custom extraction (e.g. sort by derived property).
- **`useMultiFilter() → [selected, toggle, clear, passes]`** - multi-select filter state backed by a `Set`. Nothing selected = all items pass. `passes(v)` returns `true` when the Set is empty or contains `v` - use directly in filter predicates. Pair with `<MultiSelectPills>`.
  ```jsx
  const [statusFilters, toggleStatus, clearStatus, statusPasses] = useMultiFilter();
  // in filter:
  if (!statusPasses(item.value("status"))) return false;
  // in render:
  <MultiSelectPills options={MY_STATUS} selected={statusFilters} onToggle={toggleStatus} onClear={clearStatus} counts={counts} />
  ```

### Lint

Four primitives that implement the lint pattern used in Projects, Resources, Releases, and Infrastructure.

- **`computeLintMap(items, lintFn) → Map<path, issue[]>`** - builds the path→issue[] Map from items + a domain-specific lint function. Call inside `dc.useMemo`. Only items with issues are stored.
  ```jsx
  const lintIssues = dc.useMemo(() => computeLintMap(projects, lintProject), [projects]);
  ```

- **`useLintState(items, lintMap) → { issueFilter, setIssueFilter, issueCounts, totalIssues, itemsWithLint }`** - hook that manages `issueFilter` state and derives counts. Call at the top level of `View()`. Works with any lint Map including the `lint.issues` Map returned by `lintInfra()`.
  ```jsx
  const { issueFilter, setIssueFilter, issueCounts, totalIssues, itemsWithLint } =
      useLintState(projects, lintIssues);
  ```

- **`<LintPanel totalIssues itemsWithLint issueCounts issueFilter setIssueFilter codes? labels? icon? noun? />`** - health bar with clickable chips. Hidden when `totalIssues === 0`. Pass `codes` for consistent chip ordering; if omitted, chips appear in insertion order. `icon` defaults to `"⚠"`, `noun` defaults to `"item"`.
  ```jsx
  <LintPanel totalIssues={totalIssues} itemsWithLint={itemsWithLint}
      codes={MY_CODES} labels={MY_LABELS}
      issueCounts={issueCounts} issueFilter={issueFilter}
      setIssueFilter={setIssueFilter} icon="📋" noun="project" />
  ```

- **`lintColumn(lintMap, issueFilter, setIssueFilter) → column`** - column descriptor for `dc.Table`. Shows `✓` for clean items, clickable chips for items with issues. Place as the **last column**.
  ```jsx
  columns={[
      { id: "Name", value: p => p.$link },
      // …
      lintColumn(lintIssues, issueFilter, setIssueFilter)
  ]}
  ```

**Infrastructure note:** `lintInfra()` returns `{ issues: Map, counts }` rather than a per-item function. Pass `lint.issues` directly as the `lintMap` argument to `useLintState` and `lintColumn`. Call `useLintState` once per entity type (servers, services, networks) - it's a hook so each call creates independent state.

## Conventions

- **Folder paths** are absolute from the vault root, e.g. `"Systems/Projects"`.
- **Tags** in `q()` are passed without `#`.
- **Frontmatter dates** are written via `V.today()` so they stay `YYYY-MM-DD`.
- **Kanban columns** with custom counts/labels: pass `columnHeader={(col, items) => <...>}`.
- **Items must come from Datacore queries** (so they have `.value(field)` and `$path`).

## Performance notes

- `dc.require` caches modules - splitting Forms/Layout/Boards/Hooks does not add per-call cost after the first load.
- Pure components (`Pill`, `KPI`, `EditText`, `StatusSelect`, `ChipListCell`) are wrapped in `preact.memo` (with a no-op fallback if memo isn't exposed) so they only re-render when their props change.
- The biggest perf cost in dashboards is Datacore re-running queries when any frontmatter changes. Memoize derived data with `dc.useMemo` if you notice lag - e.g. `const filtered = dc.useMemo(() => items.filter(...), [items, search])`.

## Adding new helpers

1. **JS-only utility?** → add to `Vault.js`, include a JSDoc block, add to the `return { ... }`.
2. **Reusable component?** → put it in the right `ui/*` file and add it to that file's `return`. The barrel `UI.jsx` re-exports automatically (it spreads each submodule).
3. **Document it here** under the matching section.

---

## UI Patterns

These are the recurring patterns you'll see in every active dashboard. When building a new one, follow these conventions so the codebase stays consistent.

### Preset options → pills. Dynamic options → SearchableSelect.

| Case | Component | Hook |
|---|---|---|
| Preset list, pick **one** (e.g. release status) | `<FilterPills options={["All", ...STATUS]} value={f} onChange={setF} />` | `dc.useState("All")` |
| Preset list, pick **many** (e.g. project status) | `<MultiSelectPills options={STATUS} selected={sel} onToggle={tog} onClear={clr} />` | `useMultiFilter()` |
| Dynamic list (e.g. categories from data, project names) | `<SearchableSelect value={v} options={["All", ...derived]} onValueChange={setV} />` | `dc.useState("All")` |

**Why the split?** Preset lists are short and stable - pills give one-click access and show everything at once. Dynamic lists grow with the data and would bloat a pill row; a searchable dropdown scales better.

### Standard filter bar layout

Two rows, always in this order:

```
Row 1: [status pills / multi-select pills]
Row 2: [SearchableSelect dropdown(s)] [search input] [SortBar]
```

If there is a cascading filter (category → project), the outer filter is on the left and resets the inner one on change:
```jsx
onValueChange={v => { setOuterFilter(v); setInnerFilter("All"); }}
```

### List view (table dashboards)

All table dashboards follow this order inside `View()`:

1. Queries (`dc.useQuery`)
2. State declarations (filters, search, sort via hooks)
3. Derived maps (`dc.useMemo`) - **lint map and `useLintState` must come before any `filtered` memo that references `issueFilter`**
4. Filtered + sorted array (`dc.useMemo`)
5. Render: `<NewForm>` → `<KPIRow>` → filter bar → `<LintPanel>` → `<dc.Table>`

Columns in `dc.Table`:
- Domain columns (name, category, status, etc.) come first
- **Issues column is always last** - use `lintColumn(lintMap, issueFilter, setIssueFilter)`

### Lint column position

Every table that has a linter ends with `lintColumn(...)` as the last entry in the `columns` array. This is a hard convention, not just style - it keeps the actionable "health" signal visually separated from the content columns.

### Cogito exception

Cogito uses `SearchableSelect` for Status and Domain even though they're preset lists, because the notes table has too many filters to display as a full pill row. It also uses a custom `IssueChips` renderer instead of `lintColumn` because its lint result shape is richer (a `Set` of codes with per-code emoji). These are intentional deviations - don't replicate them in new dashboards unless you have the same constraints.
