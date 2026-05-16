# spanko-tech-vault

A developer PKM vault built around systems I actually use daily. Everything is a Datacore JSX dashboard - React components rendering live vault data.

## Structure

```
Systems/       One dashboard per system, no data yet - add your own notes
Toolkit/       Shared Datacore components, scripts, and templates
Documentation/ System and architecture docs
```

## Systems

| System | Purpose |
|---|---|
| `Systems/Oraculum/` | Embedded Gemini AI assistant - 60+ tools, semantic search, deep research |
| `Systems/Home/` | Vault-wide KPI dashboard with news feeds, weather, quotes, and LeetCode daily challenge |
| `Systems/Cogito/` | Notes, media, inbox - knowledge management |
| `Systems/Habits/` | Daily / weekly habit heatmaps |
| `Systems/Finances/` | Income and expense tracking (multi-currency) |
| `Systems/Food/` | Recipes and ingredients with nutrition |
| `Systems/Job Search/` | Application kanban + document tracking |
| `Systems/Projects/` | Project catalog and resource linking |
| `Systems/Issues/` | Kanban issue tracker |
| `Systems/Releases/` | Semantic versioning and release notes |
| `Systems/Infrastructure/` | Servers, services, networks |
| `Systems/Growth/` | Skills, brags, ADRs, reviews, postmortems |
| `Systems/Leetcode/` | Algorithm practice with LeetCode import |
| `Systems/Resources/` | Permanent tools and resource catalog |
| `Systems/Presentations/` | Slide deck management (Advanced Slides / Reveal.js) |

## Toolkit

| Path | Purpose |
|---|---|
| `Toolkit/Datacore/Vault.js` | Pure JS helpers (dates, queries, frontmatter, files) |
| `Toolkit/Datacore/Web.js` | HTTP helpers and page scraping (httpGet, httpJson, httpBinary, fetchPageText) |
| `Toolkit/Datacore/LintRules.js` | All lint rule functions and thresholds - single source of truth for every dashboard |
| `Toolkit/Datacore/Issues.js` | Issue path and move logic shared between the Issues dashboard and Oraculum tools |
| `Toolkit/Datacore/UI.jsx` | Barrel re-export of all UI components |
| `Toolkit/Datacore/ui/` | Forms, Layout, Boards, Hooks, Lint components |
| `Toolkit/Scripts/Templater/` | Automation scripts (LeetCode, FatSecret scrapers) |
| `Toolkit/Templates/` | Note creation templates |
| `Toolkit/Snippets/` | Reusable embedded blocks (Recipe Editor) |

## Required Plugins

- **Datacore** - query engine and React integration (required, nothing renders without it)
- **Templater** - required for LeetCode and FatSecret scrapers
- **Editor Width Slider** - strongly recommended; dashboards are significantly more usable at full width
- **Folder Notes** - enables the folder.md dashboard pattern
- **Excalidraw** - drawing integration (optional)
- **Advanced Slides** - required for the Presentations system (optional)

## Getting Started

1. Open in Obsidian and install Datacore and Templater (required), plus any optional plugins above
2. In Templater settings, set:
   - Template folder to `Toolkit/Templates`
   - User Scripts folder to `Toolkit/Scripts/Templater`
   - Enable "Trigger Templater on new file creation"
3. Open `Systems/Oraculum/Oraculum.md`, click ⚙️, and paste your Gemini API key
4. Fill in `Systems/Oraculum/Skills/25 User Profile.md` and the files in `Systems/Oraculum/Context/`
5. Open any `Systems/<name>/<name>.md` to see its dashboard
6. Create your first note using the `+ New` button in a dashboard
