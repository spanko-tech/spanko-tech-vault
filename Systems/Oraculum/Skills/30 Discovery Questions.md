---
title: Discovery Questions Protocol
description: Mandatory semantic_search-first protocol for open-ended "what could I…" questions.
priority: 30
enabled: true
locked: false
---
--- DISCOVERY QUESTIONS ---

Open-ended discovery questions ("what could I work on?", "is there anything worth adding to my knowledge
base?", "what could I present on?", "what should I learn next?") require reasoning about vault information
flow — not just keyword search.

⚠ MANDATORY PROTOCOL — no exceptions:
semantic_search MUST be called before writing any discovery recommendation. Reading My Profile.md or
intelligence docs is background context only — it does NOT substitute for vault search. If you finish
reading context docs and have not yet called semantic_search, you are not done with your tool calls.
A discovery answer with zero semantic_search calls is always wrong, regardless of answer quality.

The vault may be sparse (few notes, incomplete intelligence docs). That is normal and expected — do not
let it short-circuit the protocol. Run the searches anyway. If results are thin, say so, cite the evidence,
then clearly distinguish "what your vault shows" from "what I suggest based on your profile."

The vault has a natural flow:
  Raw capture:          Systems/Cogito/Inbox (fleeting ideas, quick notes)
  External input:       Systems/Cogito/Media (books, videos, podcasts — many unprocessed), Systems/Resources (saved links,
                        resources)
  Processed knowledge:  Systems/Cogito/Notes (the real knowledge base)
  Actionable work:      Systems/Projects, Systems/Issues
  Skill building:       Systems/Growth (Skills, Brags, ADRs, Postmortems), Systems/Leetcode
  Career:               Systems/Job Search

Systems/Habits, Systems/Finances, Systems/Food, and Systems/Job Search are largely self-contained.
Exceptions: Job Search can spawn a Systems/Cogito/Notes note when an interview question exposes a knowledge gap.
Leetcode can eventually connect to Habits if a weekly practice habit is tracked.

Systems/Cogito and Systems/Growth/Projects feed each other. Cogito is the brain; Projects is the workshop. Cross-system flows:

  Cogito → Projects:
    Systems/Cogito/Notes (Idea domain) can graduate to a Systems/Projects note (status: Idea → In Progress).
    Knowledge notes can inspire new Projects, Infrastructure improvements, or Presentations.

  Projects → Cogito:
    Systems/Leetcode problems often spawn Systems/Cogito/Notes (Knowledge or Process domain) — the concept
      behind a problem is worth capturing separately from the problem itself.
    Systems/Growth notes (Skills, Brags, ADRs, Postmortems) can spawn Knowledge or Process notes
      when a pattern is worth generalising.
    Systems/Issues can surface missing knowledge — a hard bug often implies a gap worth a Cogito note.

  Semantic search bridges both directions — when suggesting connections or gaps, always check whether
  a Fabrica item implies a missing Cogito note and vice versa.

DISCOVERY STRATEGY — reason about which systems are "sources" for the user's implied goal.
Follow the numbered steps in order. Do not skip steps.

"What could I add to my knowledge base?" (destination: Systems/Cogito/Notes)
  1. read_file My Profile.md — identify interests and known gaps
  2. semantic_search (4+ calls) — broad queries on Systems/Cogito/Media and Systems/Resources; each query a distinct theme
     (e.g. "database internals backlog", "unread systems design material", "saved but unprocessed articles")
  3. list_notes_in("Systems/Cogito/Media") — confirm backlog items missed by semantic_search
  4. get_note on 2–3 richest unprocessed media notes to assess conversion potential
  5. Synthesize: which unprocessed items have the most substance to turn into knowledge notes?

"What project could I work on?" (destination: Systems/Projects)
  1. read_file My Profile.md + Fabrica Intelligence.md — extract known project interests
  2. semantic_search (4+ calls) scoped to Systems/Cogito/Notes, Systems/Issues, Systems/Cogito/Inbox, Systems/Cogito/Media;
     probe different angles (e.g. "tool I want to build", "problem I keep hitting", "inspiration from media")
  3. list_notes_in("Systems/Issues") — look for open issues that imply a missing tool or system
  4. list_notes_in("Systems/Cogito/Inbox") — check idle project-idea captures
  5. get_note on top semantic hits to assess depth
  6. Synthesize: knowledge clusters with no project; open issues implying a gap; inbox ideas ripe to start

"What could I present on?" (destination: Presentations)
  1. read_file My Profile.md + Cogito Intelligence.md — extract known interest areas and clusters
  2. list_presentations — see what already exists to avoid duplicating topics
  3. semantic_search (6–8 calls) scoped to "Systems/Cogito/Notes" — each call probes a DISTINCT domain
     (e.g. "memory hierarchy and cache performance", "distributed system scaling", "machine learning
     retrieval", "game engine architecture"). Every call must be a different area — do NOT query the
     same domain multiple ways.
  4. get_note on the top 2–3 hits per distinct angle to verify actual depth and maturity
  5. Synthesize: which topics have enough substance to sustain a talk? Which connect interestingly?
     Suggest 3 directions with a narrative hook for each.

"What should I learn next?" (destination: Systems/Cogito/Notes via study)
  1. read_file My Profile.md + Cogito Intelligence.md — understand current knowledge depth, clusters,
     and explicitly identified gaps. If docs are empty or sparse, proceed anyway — do not stop here.
  2. semantic_search (4–6 calls) — MANDATORY regardless of what step 1 returned. Probe the EDGES of
     existing clusters: what would naturally extend what's already there? What's adjacent but absent?
     Scope to Systems/Cogito/Notes and Systems/Cogito/Media. Each call must probe a distinct angle — do not query the
     same domain multiple ways. Design queries even if step 1 was sparse, using Profile interests as seeds.
  3. list_notes_in("Systems/Cogito/Notes") — identify stubs (thin notes that imply an interest)
  4. list_notes_in("Systems/Cogito/Media") — look for backlog items that signal unconsumed learning
  5. get_note on the most relevant stubs and top semantic hits to gauge genuine depth
  6. Synthesize — offer 3 paths:
     - Solidify: deepen existing stub notes using media already in the vault
     - Expand: adjacent territory not yet represented, grounded in known interests
     - Bridge: connect two existing clusters that don't currently link but naturally should

GENERAL RULE: identify the destination → semantic_search the source areas → get_note on hits → reason
about gaps. Never recommend without showing vault evidence. If the vault is thin, say so explicitly.
