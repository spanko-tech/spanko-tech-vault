---
schema: 1
type: vault
name: Codex Vitae
tagline: Developer PKM vault with an embedded Gemini AI assistant, 15 Datacore JSX dashboards, and lint-checked systems
author: spanko-tech
categories:
  - developer
  - pkm
  - ai
  - project-management
  - habit-tracker
  - finance
  - dashboard
  - tracker
  - kanban
tags:
  - datacore
  - gemini
screenshots:
  - https://raw.githubusercontent.com/spanko-tech/spanko-tech-vault/main/Documentation/Screenshots/preview.png
  - https://raw.githubusercontent.com/spanko-tech/spanko-tech-vault/main/Documentation/Screenshots/screenshot-home.png
  - https://raw.githubusercontent.com/spanko-tech/spanko-tech-vault/main/Documentation/Screenshots/screenshot-oraculum-chat.png
  - https://raw.githubusercontent.com/spanko-tech/spanko-tech-vault/main/Documentation/Screenshots/screenshot-oraculum-research.png
  - https://raw.githubusercontent.com/spanko-tech/spanko-tech-vault/main/Documentation/Screenshots/screenshot-cogito.png
  - https://raw.githubusercontent.com/spanko-tech/spanko-tech-vault/main/Documentation/Screenshots/screenshot-research-panel.png
  - https://raw.githubusercontent.com/spanko-tech/spanko-tech-vault/main/Documentation/Screenshots/screenshot-research-results.png
  - https://raw.githubusercontent.com/spanko-tech/spanko-tech-vault/main/Documentation/Screenshots/screenshot-food.png
  - https://raw.githubusercontent.com/spanko-tech/spanko-tech-vault/main/Documentation/Screenshots/screenshot-finances.png
plugins:
  - id: datacore
    name: Datacore
  - id: templater-obsidian
    name: Templater
  - id: obsidian-excalidraw-plugin
    name: Excalidraw
  - id: obsidian-advanced-slides
    name: Advanced Slides
environment:
  obsidian_version: 1.8.0
  theme: AnuPpuccin
---

# Codex Vitae - spanko-tech-vault

A personal [Obsidian](https://obsidian.md) vault built around systems I actually use daily. Pick the systems that fit your workflow - almost everything is independent, nothing requires everything else, but it clicks together very well :)

**The standout piece is Oraculum** - a fully embedded AI assistant powered by the Gemini API, with 60+ tools, deep research, semantic search, and a settings panel. More on that below.

All dashboard code is built with [Datacore](https://github.com/blacksmithgu/datacore) (JSX/React inside Obsidian), co-developed with [GitHub Copilot](https://github.com/features/copilot). This is **not** a Dataview vault - Datacore replaces it entirely. An effort went into keeping the code maintainable: shared UI components, a centralized lint rule system, and a reusable utility layer mean individual dashboards stay lean and consistent rather than each reinventing the wheel.

> **Note:** This is a sanitized public fork of my personal vault, with a completely different folder structure. I test before new versions, but issues may slip through (tags, wrong folders, etc.) - if you find one, open an issue.

## Systems

| System | TLDR | Lint |
| ------------------ | -------------------------------------------------------------------------------------------------------- | ---- |
| **🔮 Oraculum** | Embedded Gemini AI assistant with 60+ tools, deep research, semantic search, and a full settings panel. | |
| **🏠 Home** | Vault-wide dashboard with KPIs, news feeds, weather, quotes, and a bird's eye view of everything in motion. | |
| **🧠 Cogito** | A knowledge base for notes, media, and MOCs - promoting ideas from Stub to Draft to Solid to Reference. | ✅ Notes (age, backlinks, section quality), Media (stale backlog, progress), MOC index quality |
| **📊 Finances** | Track income, expenses, and budgets with multi-currency support. | |
| **🍽️ Food** | Log daily meals and track calorie and macro targets (kcal, protein, carbs). | |
| **🌱 Growth** | Growth-oriented hub - skills tree, brag doc, reviews, ADRs, and postmortems. | ✅ Brags, ADRs, Reviews, Postmortems (missing sections, incomplete entries) |
| **✅ Habits** | Track daily and weekly habits with visual heatmaps and progress statistics. | |
| **🖥️ Infrastructure** | Keep track of servers, services, and networks. | ✅ Cross-entity rules - missing links between servers, services, and networks |
| **🐛 Issues** | Kanban issue tracker linked to Projects and Releases with priority and category filtering. | |
| **💼 Job Search** | Manage job applications through a kanban workflow with document and status tracking. | |
| **🧩 Leetcode** | Algorithm practice log with automated problem import and per-topic progress tracking. | ✅ Missing solution, unsolved problems, incomplete notes |
| **📽️ Presentations** | Manage slide decks and talks built with Advanced Slides (Reveal.js). | ✅ Missing slide file, stale drafts |
| **🚀 Projects** | Lifecycle management for projects from Idea through Active/Paused to Shipped/Archived. | ✅ Stale active projects, missing sections, no linked issues |
| **📦 Releases** | Plan and document software releases with version tracking, highlights, and changelogs. | ✅ Missing highlights, empty changelog, no linked project |
| **📚 Resources** | Curated reference library for tools, links, and assets with use-case notes. | ✅ Missing URL, empty notes, stale entries |

## Why This Exists

There are better dedicated apps for most of these things - Jira does issues better, almost any food tracking app does food tracking better, and so on. I know.

What I wanted was everything in one place, and that place happens to be Obsidian. These are the systems I actually use daily and that made sense to centralize. Some will feel like overkill for what they do, and that's fine - use what fits, skip what doesn't.

Many systems include lint checkers that surface issues - missing sections, stale frontmatter, incomplete entries. They're annoying in the best way.

## Oraculum

Oraculum is an AI assistant embedded directly in the vault as a Datacore dashboard. It uses the Gemini API and has access to 60+ tools that can read, create, and update notes across every system - no copy-pasting context into a chat window.

**Why Gemini?** At the time of writing, Google offers exceptionally generous free-tier rate limits on Gemma 4 (chat), `text-embedding-004` (semantic search), and Gemini 2.5 Flash with Search grounding (deep research). The combination of all three being free-tier viable is what made this project worth building. That may change - but for now, it's hard to beat.

**Semantic search** is powered by `text-embedding-004` (768-dimensional embeddings). Trigger indexing from the Oraculum settings panel - once built, it can find conceptually related notes even with zero keyword overlap. Datacore's built-in metadata indexing means the embeddings layer sits on top of already-fast vault queries.

**Deep Research** is the more powerful mode - it uses Gemini 2.5 Flash with Google Search grounding to research topics across the web, synthesize findings, and save structured results back into the vault. Results are stored per-topic and can be recalled in future conversations without re-running the research.

### Setup

Oraculum needs a [Gemini API key](https://aistudio.google.com/apikeys) to work. The key is stored in browser `localStorage` only - never written to disk or committed.

1. Open `Systems/Oraculum/Oraculum.md`
2. Click the settings icon
3. Paste your Gemini API key and save

Before using Oraculum, fill in the placeholder files in `Systems/Oraculum/Context/` and `Systems/Oraculum/Skills/25 User Profile.md` - that's where you tell it about yourself.

## Finances - Currency

The system defaults to **CZK** as the display currency. To change it, open `Systems/Finances/Finances.md` and update the `baseCurrency` frontmatter field to your currency code (e.g. `EUR`, `USD`, `GBP`).

## Setup

> **Datacore is required.** This vault uses [Datacore](https://github.com/blacksmithgu/datacore) exclusively for all dashboards - not Dataview. Install it first or nothing will render.

### Plugins

**Required**

| Plugin | Purpose |
|--------|---------|
| [Datacore](https://github.com/blacksmithgu/datacore) | Powers every dashboard - JSX/React query engine for Obsidian. Nothing renders without this. |
| [Templater](https://github.com/SilentVoid13/Templater) | Scripting layer for automated note creation - LeetCode problem scraper, FatSecret ingredient scraper. |

**Strongly recommended**

| Plugin | Purpose |
|--------|---------|
| [Editor Width Slider](https://github.com/MugishoMp/obsidian-editor-width-slider) | Status bar slider to widen notes - dashboards are significantly more usable at full width. |
| [Folder Notes](https://github.com/LostPaul/obsidian-folder-notes) | Lets folders have their own note, which is how every system dashboard is mounted. |
| [Filename Heading Sync](https://github.com/dvcrn/obsidian-filename-heading-sync) | Keeps H1 headings in sync with filenames. |

**Optional - feature-specific**

| Plugin | Purpose |
|--------|---------|
| [Excalidraw](https://github.com/zsviczian/obsidian-excalidraw-plugin) | Drawing integration for Cogito notes. |
| [Advanced Slides](https://github.com/MSzturc/obsidian-advanced-slides) | Reveal.js presentation builder - powers the Presentations system. |

### Templater Configuration

After installing Templater, configure under `Settings - Templater`:

| Setting | Value |
|---------|-------|
| Template folder location | `Toolkit/Templates` |
| Script files folder location | `Toolkit/Scripts/Templater` |

Enable **"Trigger Templater on new file creation"** and map folder templates: `Systems/Leetcode` → `Toolkit/Templates/Leetcode Problem.md`, `Systems/Food/Recipes` → `Toolkit/Templates/Ingredient (FatSecret).md`.

### External Integrations

| Service | Used in | Auth |
|---------|---------|------|
| [Gemini API](https://aistudio.google.com/apikeys) | Oraculum | API key - free tier |
| [Supadata](https://supadata.ai) | Oraculum | API key - free tier |
| [GitHub](https://github.com/settings/tokens) | Oraculum | Optional PAT |
| [Stack Overflow](https://api.stackexchange.com/) | Oraculum | Optional key |
| [Google Books](https://developers.google.com/books) | Oraculum | Optional API key |
| [Open Library](https://openlibrary.org/developers/api) | Oraculum | Optional contact email |
| [Wikipedia REST API](https://en.wikipedia.org/api/rest_v1/) | Home, Oraculum | None |
| [Jina Reader](https://jina.ai/reader/) | Oraculum, Web scraping | None |
| [Frankfurter](https://www.frankfurter.app) | Finances | None |
| [Open-Meteo](https://open-meteo.com) | Home | None |
| [ZenQuotes](https://zenquotes.io) | Home | None |
| [Hacker News API](https://github.com/HackerNews/API) | Home | None |
| [Dev.to API](https://developers.forem.com/api) | Home | None |
| [Lobsters](https://lobste.rs) | Home | None |
| RSS feeds | Home | None |
| [LeetCode GraphQL API](https://leetcode.com/graphql/) | Home, Leetcode | None |
| [FatSecret](https://platform.fatsecret.com) | Food | None |
