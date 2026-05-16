# Systems

This document describes how each system works and what has been extracted from the dashboards.

## Home

### Home Dashboard
**Location**: `Systems/Home/Home.md`  
**Purpose**: Vault-wide overview and external feed aggregator

**How it works**:
- KPI tiles pulled live from every other system (notes, projects, habits, issues, etc.)
- External feeds fetched on load and cached: news, weather, quotes, Wikipedia, LeetCode daily challenge
- "Rediscover" feature surfaces random notes from Cogito
- "Needs Attention" panel pulls lint issues from other dashboards
- Quick capture sends text directly to the Cogito inbox

**Key Features**:
- Hacker News, Dev.to, Lobsters feeds with category/tag filtering
- Configurable RSS panel (The New Stack, Ars Technica, DevClass, InfoQ by default)
- Weather via Open-Meteo (geocoding + forecast)
- Wikipedia "On This Day" events
- ZenQuotes quote of the day
- LeetCode daily challenge widget
- Recently edited notes list

---

## Oraculum

### Oraculum AI Assistant
**Location**: `Systems/Oraculum/Oraculum.md`  
**Purpose**: Embedded AI assistant with full vault access

**How it works**:
- Connects to the Gemini API (Gemma 4 by default) via a `localStorage`-stored API key - never written to disk
- Agentic loop: up to 25 tool-calling rounds per message
- Loads skills from `Systems/Oraculum/Skills/` and context from `Systems/Oraculum/Context/` at startup
- Sessions are saved as markdown notes under `Systems/Oraculum/Sessions/`
- Settings panel manages API keys, model selection, tool toggles, and integration keys

**Key Features**:
- 60+ tools across all vault systems (read, create, update notes in every system)
- **Semantic search**: `text-embedding-004` builds a 768-dimensional embedding index; trigger rebuild from the settings panel
- **Deep Research**: Gemini 2.5 Flash with Google Search grounding; results stored per-topic and recalled in future conversations
- Integrations panel shows all external services with key status
- Customizable skills and context files (fill in `Skills/25 User Profile.md` to personalize)

---

## Personal Systems

### Habits System
**Location**: `Systems/Habits/`  
**Purpose**: Daily/weekly habit tracking with heatmap visualization

**How it works**:
- Each habit is a separate note with `#system/habits/habit` tag
- Daily check-ins stored as `log: ["d_YYYY-MM-DD", ...]` in frontmatter
- The `d_` prefix prevents YAML from auto-parsing dates as JavaScript Date objects
- Click habit cells to toggle completion for that day
- Supports both Daily and Weekly frequency habits
- Visual heatmaps show completion patterns by month and year

**Key Features**:
- Inline frequency editor (Daily ↔ Weekly)
- Monthly heatmap with week-aware calculations for weekly habits
- Year overview with best month detection
- Filtering by frequency type or individual habit

### Job Search System
**Location**: `Systems/Job Search/`  
**Purpose**: Hiring pipeline management with document tracking

**How it works**:
- Notes → `Systems/Job Search/`, tagged `#system/jobs/application`
- One file per opportunity, status drives the kanban
- PDFs (CV + cover letters) → `Systems/Job Search/Documents/`
- Document linking via inline dropdowns in dashboard
- Automatic detection of master CV file (looks for "CV" in filename)

**Key Features**:
- Kanban pipeline: Applied → Interview → Offer → Rejected
- Stale application alerts (≥14 days without update)
- PDF document management with quick-open buttons
- List view with inline editing of company/role fields
- Age tracking from application date

### Finances System
**Location**: `Systems/Finances/`  
**Purpose**: Income and expense tracking

**How it works**:
- Separate notes for incomes (`#system/finances/income`) and expenses (`#system/finances/expense`)
- Each note lives in its respective subfolder: `Systems/Finances/Income/` or `Systems/Finances/Expenses/`
- Status options: Active, Inactive
- Frequency options: Monthly, Yearly
- Currency: configurable via `baseCurrency` frontmatter field in `Finances.md` (defaults to CZK; change to EUR, USD, GBP, or any code supported by Frankfurter). Each entry can be logged in the base currency, EUR, or USD - the dashboard converts everything to the base currency for display.

**Key Features**:
- Separate creation forms for income and expense entries
- Filtering by frequency
- Sort controls

### Food System
**Location**: `Systems/Food/`  
**Purpose**: Recipe and ingredient management with nutrition tracking

**How it works**:
- Dual tracking: Recipes (`Systems/Food/Recipes/`) and Items (`Systems/Food/Items/`)
- Nutrition data entry via FatSecret integration or manual input
- Recipe template includes embedded ingredient editor component
- Goal tracking for calories, macros (protein/carbs/fat), and fiber
- Efficiency calculations (e.g., protein per 100 calories)

**Key Features**:
- **FatSecret scraper**: "+ Ingredient via FatSecret" button runs Templater template - paste FatSecret URL for auto-filled nutrition data
- **Recipe editor**: New recipes embed per-recipe ingredient editor (`Toolkit/Snippets/Recipe Editor.md`) with live macro totals
- Macro goal visualization
- Custom nutrition efficiency metrics
- Template-driven recipe creation

**Requirements**:
- Templater plugin with User Scripts folder set to `Toolkit/Scripts/Templater`
- Manual fallback available for ingredient entry

---

## Workshop

### Projects System
**Location**: `Systems/Projects/`  
**Purpose**: Development project tracking and resource linking

**How it works**:
- Each project gets its own folder under `Systems/Projects/`
- Project notes have embedded resource queries showing linked tools/services
- Status-based filtering: Idea, Active, Paused, Shipped, Archived
- Stack and summary fields editable inline

**Key Features**:
- Automatic resource embedding via project name matching
- Status counts in filter pills
- Inline editing of stack and summary fields

### Releases System
**Location**: `Systems/Releases/`  
**Purpose**: Version release planning and tracking

**How it works**:
- Organized by project with automatic version increment suggestions
- Three-state workflow: Planned → In Progress → Released
- Release notes template with standard sections (Highlights, Added, Changed, Fixed, Breaking)
- Issue linking shows completion status per release

**Key Features**:
- Semantic version management with auto-increment
- Breaking change indicators
- Issue completion tracking
- Inline status editing

### Issues System
**Location**: `Systems/Issues/`  
**Purpose**: Project issue/task management

**How it works**:
- Kanban workflow: Backlog → Todo → In Progress → Review → Done
- Priority-based color coding (Low, Med, High, Critical)
- Project and release association
- Archive system for completed items

**Key Features**:
- Drag-and-drop status changes
- Inline priority editing on all cards/rows
- Backlog promotion to active workflow
- Done item auto-archiving with restore capability
- Recent vs. all done item filtering

### Growth System
**Location**: `Systems/Growth/`  
**Purpose**: Skills, decisions, and learning tracking

**How it works**:
- Multiple content types: Skills, Brags, ADRs (Architecture Decision Records), Reviews, Postmortems
- Tab-based interface with separate forms for each type
- Skills have level progression tracking
- ADRs have status workflow for decision tracking

**Key Features**:
- Tabbed multi-system dashboard
- Skills level progression: Novice → Advanced Beginner → Competent → Proficient → Expert
- Decision status tracking for ADRs
- Lint checks across all four subtabs: missing sections, incomplete entries (Brags, ADRs, Reviews, Postmortems each have their own rules)

### Resources System
**Location**: `Systems/Resources/`  
**Purpose**: Development tools and service catalog

**Mental filter for adding resources**:
- **Permanent** - not monthly subscriptions (Synty packs, Mixamo, one-time purchases like Shodan)
- **Worth a name** - not too obvious (like Rider) or too narrow (single YouTube video)
- **Latent intent** - tools you want surfaced when starting new projects

**How it works**:
- Free-form categories invented as needed
- Project wikilinks for automatic embedding in project pages
- Every new project includes "Resources" block automatically
- Vendor tracking for service management
- Search with debounced input

**Key Features**:
- Real-time search across name/category/vendor
- Chip-based project association editing
- Category suggestions in form
- KPI dashboard showing total counts

### Infrastructure System
**Location**: `Systems/Infrastructure/`  
**Purpose**: Server, service, and network management

**How it works**:
- Three entity types: Servers, Services, Networks
- Tabbed interface with separate management for each
- Service health monitoring and status tracking
- Network topology with subnet management

**Key Features**:
- Multi-tab infrastructure overview
- Inline editing for operational fields
- Service status tracking per entity type

### LeetCode System
**Location**: `Systems/Leetcode/`  
**Purpose**: Algorithm practice tracking

**How it works**:
- Integration with Templater to scrape LeetCode problems
- Auto-generates notes with problem details and images
- Status tracking: To Do → In Progress → Completed → Review
- Difficulty and topic categorization

**Key Features**:
- Templater integration for problem import
- Difficulty and status inline editing
- Topic and ID search
- Count-based status overview
- Lint checks: missing solution body, unsolved problems with no recent activity, incomplete notes

**Technical Details**:  
The "+ New Problem" button runs `Toolkit/Scripts/Templater/leetcode_scrapper.js` which:
1. Fetches problem from LeetCode's GraphQL API
2. Downloads inline images to per-problem `Images/` subfolder
3. Creates note from `Leetcode Problem.md` template
4. Requires **Templater** plugin

### Presentations System
**Location**: `Systems/Presentations/`  
**Purpose**: Slide deck planning and management

**How it works**:
- Each presentation is a note tagged `#system/presentation`
- Slide content is authored in a separate `.md` file rendered by the Advanced Slides plugin (Reveal.js)
- Status workflow: Draft → Ready → Delivered → Archived
- Lint checks flag missing slide file links and presentations stuck in Draft

**Key Features**:
- Status tracking and inline editing
- Lint: missing linked slide file, stale drafts
- Quick-open button to jump to the slide file

**Requirements**:
- [Advanced Slides](https://github.com/MSzturc/obsidian-advanced-slides) plugin for rendering slides

---

## Knowledge

### Notes System
**Location**: `Systems/Cogito/Notes/`  
**Purpose**: General knowledge management with domain organization

**How it works**:
- Domain-based categorization (Tech, Creative, Meta, etc.)
- Status workflow for note maturity
- Topic tagging with autocomplete
- Age and backlink tracking

**Key Features**:
- Domain and topic inline editing
- Status progression tracking
- Lint issue detection
- Custom body templates per domain type

### Media System
**Location**: `Systems/Cogito/Media/`  
**Purpose**: Book, game, article, and video tracking

**How it works**:
- Type-based categorization (Book, Game, Article, Video, etc.)
- Status tracking for consumption progress
- Spawned note counting for follow-up content

**Key Features**:
- Media type indicators (read-only, intrinsic to item)
- Status progression tracking
- Spawn relationship tracking

---

## Toolkit

### Datacore Library
**Location**: `Toolkit/Datacore/`  
**Purpose**: Shared React components and utilities

See [Datacore Library](Datacore%20Library.md) for detailed documentation.

### Templates
**Location**: `Toolkit/Templates/`  
**Purpose**: Note creation templates

Available templates:
- `Leetcode Problem.md` - created by the LeetCode scraper
- `Ingredient (FatSecret).md` - created by the FatSecret scraper
- `Excalidraw Template.md` - blank canvas for drawings

### Scripts
**Location**: `Toolkit/Scripts/Templater/`  
**Purpose**: Automation scripts (Templater User Scripts folder)

Current scripts:
- **`leetcode_scrapper.js`** - Fetches problems from LeetCode's GraphQL API
- **`fatsecret_scraper.js`** - Fetches nutrition data from FatSecret
- **`github_scrapper.js`** - Fetches GitHub project metadata
- **`image_downloader.js`** - Downloads and embeds images for scraped content

### Snippets
**Location**: `Toolkit/Snippets/`  
**Purpose**: Embeddable component notes (transclusion targets)

Current snippets:
- **`Recipe Editor.md`** - ingredient editor embedded inside recipe notes; manages per-recipe ingredient list with live macro totals

---

## Common Dashboard Patterns

Most dashboards are built from the same skeleton. Knowing the patterns makes it easy to add a new dashboard or extend an existing one without reverse-engineering from scratch.

### Standard Dashboard Structure

Every active dashboard follows this shape:

```jsx
async () => {
    const V  = await dc.require("Toolkit/Datacore/Vault.js");
    const { ... } = await dc.require("Toolkit/Datacore/UI.jsx");

    return function View() {
        // 1. Queries
        const items = dc.useArray(dc.useQuery(V.q("tag", "Systems/Folder")));

        // 2. State
        const [filter, setFilter] = dc.useState("All");
        const [searchInput, setSearchInput, search] = useDebouncedSearch(200);

        // 3. Derived data (useMemo)
        const { sorted, sortField, setSortField, sortDir, setSortDir } = useSortBy(items, SORT_FIELDS, "date", "desc");
        const lintMap = dc.useMemo(() => computeLintMap(items, lintFn), [items]);
        const { issueFilter, setIssueFilter, issueCounts, totalIssues, itemsWithLint } =
            useLintState(items, lintMap);
        const filtered = dc.useMemo(() => sorted.filter(...), [...]);

        // 4. Render
        return (
            <div>
                <NewForm ... />
                <KPIRow items={[{label:"Total",value:items.length}, ...]} />
                <div> {/* filter bar row 1: status pills */} </div>
                <div> {/* filter bar row 2: dropdowns + search + sort */} </div>
                <LintPanel ... />
                <dc.Table rows={filtered} columns={[
                    ...,
                    lintColumn(lintMap, issueFilter, setIssueFilter)   // LAST column
                ]} />
            </div>
        );
    };
}
```

### KPI Row

A horizontal strip of counts shown above the filter bar. Pass an `items` array of `{label, value, color?}` objects:

```jsx
<KPIRow items={[
    { label: "Total",  value: items.length },
    { label: "Active", value: items.filter(i => i.value("status") === "Active").length },
    { label: "Shipped", value: items.filter(i => i.value("status") === "Shipped").length, color: "green" },
]} />
```

### Two-Row Filter Bar

- **Row 1** - status pill buttons (`["All", ...STATUS_OPTIONS].map(...)`)
- **Row 2** - `<SearchableSelect>` dropdowns for cascading filters (e.g. category → project) + debounced search `<input>` + `<SortBar>`

### Category → Project Cascade

When two filters are dependent, the inner filter clears when the outer changes:

```jsx
const [catFilter, setCatFilter] = dc.useState("All");
const [projectFilter, setProjectFilter] = dc.useState("All");

const projectOptions = dc.useMemo(() =>
    catFilter === "All" ? allProjects : allProjects.filter(p => projectCategoryMap[p] === catFilter),
[catFilter, allProjects, projectCategoryMap]);

// Reset inner on outer change
onValueChange={v => { setCatFilter(v); setProjectFilter("All"); }}
```

### Lint Pattern

All quality-tracking dashboards (Projects, Resources, Releases, Infrastructure) share the same lint plumbing:

1. **Define lint codes** - `const MY_CODES = ["CODE_A", "CODE_B"]` and a labels map.
2. **Write a domain lint function** - `(item) => issue[]` where each issue is `{ code, severity, message }`.
3. **Wire at top of View():**
   ```jsx
   const lintMap = dc.useMemo(() => computeLintMap(items, myLintFn), [items]);
   const { issueFilter, setIssueFilter, issueCounts, totalIssues, itemsWithLint } =
       useLintState(items, lintMap);
   ```
4. **Render panel + column:**
   ```jsx
   <LintPanel totalIssues={totalIssues} itemsWithLint={itemsWithLint}
       codes={MY_CODES} labels={MY_LABELS} issueCounts={issueCounts}
       issueFilter={issueFilter} setIssueFilter={setIssueFilter}
       icon="📋" noun="item" />
   // ...in columns array:
   lintColumn(lintMap, issueFilter, setIssueFilter)
   ```

See [Datacore Library](Datacore%20Library.md) for the full API.

### Kanban

Used in Issues and Job Search. Groups items by status and renders each group as a card column.

```jsx
<Kanban
    columns={STATUS_OPTIONS}
    items={items}
    getCol={item => item.value("status") ?? STATUS_OPTIONS[0]}
    onMove={(item, col) => V.setField(item, "status", col)}
    renderCard={item => <MyCard item={item} />}
/>
```

### Inline Editing

Fields are edited directly in the table without opening the note. Use `<EditText>` for free text and `<StatusSelect>` for option fields:

```jsx
{ id: "Role",   render: (_, item) => <EditText item={item} field="role" /> },
{ id: "Status", render: (_, item) =>
    <StatusSelect item={item} field="status" options={STATUS_OPTIONS} /> }
```

### NewForm

Every dashboard that creates items uses `<NewForm>`. It renders a `+` button that expands to an inline form and creates the note on submit:

```jsx
<NewForm
    label="+ New Thing"
    folder="Systems/Folder"
    tag={["my/tag"]}
    folderFn={vals => `Systems/Folder/${vals.project}`}   // optional dynamic subfolder
    body={() => V.bodyTemplate(["Section A", "Section B"])}
    fields={[
        { name: "name", placeholder: "Title" },
        { name: "status", type: "select", options: STATUS_OPTIONS, default: "Active" },
        { name: "date", type: "date", default: V.today() },
    ]}
/>
```

---

## Non-Conforming Systems

These systems intentionally deviate from the standard patterns. Deviations are by design, not oversight.

### Finances - No Lint

**Deviation**: No lint, limited inline editing.

**Why**: Financial records don't have quality requirements that lint could enforce - a transaction is either complete or it isn't.

### Habits - Heatmap Instead of Table

**Deviation**: No table, no sort bar, no filter pills, no lint.

**Why**: Habits are binary daily/weekly toggles, not structured tasks. A heatmap conveys patterns far better than a row-per-item table. Completion is toggled directly on the calendar grid. Lint is inappropriate - there is no "quality" to track on a habit entry.

### Food - No Dashboard Table

**Deviation**: No main dashboard table, no lint, no sort/filter UI.

**Why**: Food is primarily composition, not tracking. Recipes are authored documents, not status-tracked tasks. The "dashboard" is a creation wizard (NewForm + FatSecret scraper), not a management view.

### LeetCode - No `lintColumn` in Kanban View

**Deviation**: Has a full kanban + table + lint panel, but the kanban view doesn't use `lintColumn` since kanban cards don't use `dc.Table`.

**Why**: The lint panel still works and filters items - the lint column just can't attach to a kanban card layout. The table view does show the lint column.

### Cogito (Notes) - Original Lint Implementation, More Complex

**Deviation**: The lint here predates the shared `Lint.jsx` module and uses a richer model. Issue codes are stored in a `Set`, not a plain string. The panel uses hand-rolled `IssueChips` logic with backlink and age-based staleness checks that don't fit the generic `useLintState` signature.

**Why it hasn't been migrated**: The Cogito lint is meaningfully more complex (aging rules, backlinks, domain-aware messages) and was the reference implementation from which `Lint.jsx` was extracted. It could theoretically use `computeLintMap` + `LintPanel`, but the `useLintState` hook's simple `issueFilter` string wouldn't replace the Set-based multi-select in Cogito without extra work.

### Infrastructure - Three Parallel Lint States

**Deviation**: Calls `useLintState` three times (once per entity type: servers, services, networks). All three share a single `lint.issues` Map generated by `lintInfra()` but each has its own independent filter state.

**Why**: Infrastructure manages three physically different entity types displayed in separate sections. A single lint panel would obscure which entity type has issues. The tradeoff is three sets of props flowing to three `<LintPanel>` + `lintColumn` calls, but the clarity is worth it.

### Releases - No `lintColumn`

**Deviation**: Uses `computeLintMap` + `useLintState` + `LintPanel`, but does NOT use `lintColumn`.

**Why**: Releases are rendered as a grouped-by-project card view, not a `dc.Table`. There is no table column to attach `lintColumn` to. Issue filtering still works via `relIssueFilter` in the `grouped` loop.
