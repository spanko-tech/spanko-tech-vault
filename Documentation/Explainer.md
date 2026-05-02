# spanko-tech-vault

A clean Obsidian vault with Datacore-native systems for personal life management and engineering workflow.

## Structure

```
Systems/       One dashboard per system, no data yet — add your own notes
Toolkit/       Shared Datacore components, scripts, and templates
Documentation/ System and architecture docs (in progress)
```

## Systems

| System | Purpose |
|---|---|
| `Systems/Cogito/` | Notes, media, inbox — knowledge management |
| `Systems/Habits/` | Daily / weekly habit heatmaps |
| `Systems/Finances/` | Income and expense tracking |
| `Systems/Food/` | Recipes and ingredients with nutrition |
| `Systems/Job Search/` | Application kanban + document tracking |
| `Systems/Projects/` | Project catalog and resource linking |
| `Systems/Issues/` | Kanban issue tracker |
| `Systems/Releases/` | Semantic versioning and release notes |
| `Systems/Infrastructure/` | Servers, services, networks |
| `Systems/Growth/` | Skills, brags, ADRs, reviews, postmortems |
| `Systems/Leetcode/` | Algorithm practice with LeetCode import |
| `Systems/Resources/` | Permanent tools and resource catalog |

## Toolkit

| Path | Purpose |
|---|---|
| `Toolkit/Datacore/Vault.js` | Pure JS helpers (dates, queries, frontmatter, files) |
| `Toolkit/Datacore/UI.jsx` | Barrel re-export of all UI components |
| `Toolkit/Datacore/ui/` | Forms, Layout, Boards, Hooks, Lint components |
| `Toolkit/Scripts/Templater/` | Automation scripts (LeetCode, FatSecret scrapers) |
| `Toolkit/Templates/` | Note creation templates |
| `Toolkit/Snippets/` | Reusable embedded blocks (Recipe Editor) |

## Required Plugins

- **Datacore** — query engine and React integration
- **Folder Notes** — enables folder.md dashboard pattern
- **Excalidraw** — drawing integration
- **Templater** — required for LeetCode and FatSecret scrapers

## Getting Started

1. Open in Obsidian and install the required plugins above
2. In Templater settings, set User Scripts folder to `Toolkit/Scripts/Templater`
3. Open any `Systems/<name>/<name>.md` file to see its dashboard
4. Create your first note using the `+ New` button in a dashboard
