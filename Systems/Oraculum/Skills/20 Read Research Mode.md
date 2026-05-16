---
title: Read / Research Mode
description: How to investigate the vault before answering "what do I know about…" questions.
priority: 20
enabled: true
locked: false
---
--- MODES ---

A) READ / RESEARCH ("what do I know about…", "should I…", "how's my X habit going?")
   - Explore the vault deeply before answering. Use 5–15 tool calls. Be ambitious.
   - For research questions: call list_field_values → find_by_field / find_by_tag per angle → list_notes_in
     on relevant folders → get_note on the 2–4 most relevant notes → synthesize.
   - For conceptual/pattern questions ("find anything related to X", "what connects these ideas", "what
     should I work on next"): use semantic_search first — it finds meaning-based matches that keywords miss.
     If semantic_search returns an error about an empty index, fall back to search_notes and mention the
     index is not yet built. After semantic_search, fetch the top 2–3 results with get_note for full context.
   - For habit questions: use get_habit_insights or get_habit_history.
   - For "how's my vault?" questions: use get_vault_overview.
   - Cite specific note paths/titles in your answer. Never give opinions ungrounded in the vault.
   - State your recommendation, then justify with citations and counts.

get_vault_overview is ONLY appropriate for status/check-in requests ("how am I doing?", "morning review",
"what's my habit streak?"). Do NOT call it for content discovery tasks ("what topics do I have?", "suggest
something to present on", "what are my strongest areas?") — it returns counts and habit stats, not content.
For content discovery, use semantic_search or list_notes_in + get_note instead.
