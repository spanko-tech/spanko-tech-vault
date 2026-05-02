# Datacore Library

Shared helpers and React components for the Datacore JSX dashboards across the vault.
The goal: keep dashboards small and configurable so you can tweak them without re-deriving the same plumbing every time.

## Layout

```
Toolkit/Datacore/
  Vault.js          Pure JS helpers (frontmatter, dates, queries, files)
  UI.jsx            Barrel re-exporting everything in ui/*
  ui/
    Forms.jsx       NewForm, EditText, StatusSelect, ChipListCell
    Layout.jsx      Pill, KPI, KPIRow, TabStrip, FilterPills, Section
    Boards.jsx      Kanban, KanbanCounts
    Hooks.jsx       useDebouncedSearch
  README.md         (this file)
```

## How dashboards consume it

Every `datacorejsx` codeblock is its own script — each block must independently `dc.require` what it needs.

```jsx
const V  = await dc.require("Toolkit/Datacore/Vault.js");
const UI = await dc.require("Toolkit/Datacore/UI.jsx");
const { NewForm, KPIRow, FilterPills, Kanban } = UI;

return function Dashboard() {
    const items = dc.useArray(dc.useQuery(V.q("project", "Systems/Projects")));
    // ...
};
```

You can also import a single submodule for slightly leaner cold loads:

```jsx
const { Kanban } = await dc.require("Toolkit/Datacore/ui/Boards.jsx");
```

`dc.require` caches modules after the first load, so subsequent blocks get them instantly.

## Vault.js — helpers

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

## UI.jsx — components

### Forms

- **`<NewForm folder|folderFn tag fields defaults body effects onCreated />`** — universal "+ New X" button → expands to a field row → creates a markdown file with frontmatter. Supports `text` / `number` / `checkbox` / `textarea` / `select` / `multiselect` / `version` field types and a per-field `suggestions` datalist.
- **`<EditText item field placeholder? mono? suggestions? />`** — inline editable cell, writes on blur.
- **`<StatusSelect item field? options defaultValue? />`** — dropdown bound to a frontmatter field. `field` defaults to `"status"`.
- **`<ChipListCell item field options? placeholder? parse? format? />`** — click-to-edit chip list for array fields. Defaults to wikilinks; pass `parse` / `format` for plain strings.

### Layout

- **`<Pill label color? textColor? />`** — small colored label.
- **`<KPI label value color? />`** — single tile.
- **`<KPIRow items=[{label,value,color?}] />`** — row of tiles.
- **`<TabStrip tabs active onChange />`** — tabs may be strings or `{id, label?, count?}`.
- **`<FilterPills label? options value onChange counts? />`** — single-select pill row with optional counts.
- **`<Section title defaultOpen? children />`** — `<details>` panel. `title` accepts JSX.

### Boards

- **`<KanbanCounts items statuses colors? getStatus? defaultStatus? />`** — totals strip (no DnD).
- **`<Kanban columns items getCol onMove renderCard columnHeader? />`** — drag-and-drop board. `items` should already be filtered to what you want visible; `getCol(item)` decides the column. `onMove(item, toCol)` is awaited.

### Hooks

- **`useDebouncedSearch(delay=200) → [input, setInput, debounced]`** — wires a search input + debounced value.

## Conventions

- **Folder paths** are absolute from the vault root, e.g. `"Systems/Projects"`.
- **Tags** in `q()` are passed without `#`.
- **Frontmatter dates** are written via `V.today()` so they stay `YYYY-MM-DD`.
- **Kanban columns** with custom counts/labels: pass `columnHeader={(col, items) => <...>}`.
- **Items must come from Datacore queries** (so they have `.value(field)` and `$path`).

## Performance notes

- `dc.require` caches modules — splitting Forms/Layout/Boards/Hooks does not add per-call cost after the first load.
- Pure components (`Pill`, `KPI`, `EditText`, `StatusSelect`, `ChipListCell`) are wrapped in `preact.memo` (with a no-op fallback if memo isn't exposed) so they only re-render when their props change.
- The biggest perf cost in dashboards is Datacore re-running queries when any frontmatter changes. Memoize derived data with `dc.useMemo` if you notice lag — e.g. `const filtered = dc.useMemo(() => items.filter(...), [items, search])`.

## Adding new helpers

1. **JS-only utility?** → add to `Vault.js`, include a JSDoc block, add to the `return { ... }`.
2. **Reusable component?** → put it in the right `ui/*` file and add it to that file's `return`. The barrel `UI.jsx` re-exports automatically (it spreads each submodule).
3. **Document it here** under the matching section.

