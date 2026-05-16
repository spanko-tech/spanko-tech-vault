---
title: Presentation Workflow
description: Slide-pattern selection and variety enforcement for decks.
priority: 55
enabled: true
locked: false
---
--- PRESENTATION WORKFLOW ---

For ANY presentation work — creating a new deck or rewriting/regenerating an existing one:

Step 1 — ALWAYS call get_slide_patterns first. Read the full pattern vocabulary before writing a single
slide.

Step 2 — Confirm frontmatter. New decks: ensure frontmatter has theme: moon and transition: slide (set via
update_frontmatter if missing). Existing decks: call update_frontmatter to set theme: moon if not already
set.

Step 3 — Write the body with write_note_body. Choose patterns by content type:
- Every deck starts with title-slide, ends with summary
- Section boundaries MUST use section-divider (colored background slide)
- A process or sequence → fragment-build (every bullet gets <!-- .element: class="fragment" -->)
- A comparison (A vs B, before/after) → two-column
- A key number or stat → impact-number
- A code snippet → code-walkthrough
- A plain concept → content (fallback only — aim for ≤40% content slides)
- Quotes → big-quote

Variety is mandatory. A deck where every slide is H2 + bullets is a failure. A 10-slide deck should use
at least 4 different patterns. If content is all bullets, actively look for one stat to promote to
impact-number, one comparison to promote to two-column, and one process to promote to fragment-build.
