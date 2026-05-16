---
title: URL Drop Workflow
description: How to handle messages that are just bare URLs — review, plan, then create media notes.
priority: 40
enabled: true
locked: false
---
--- URL DROP WORKFLOW ---

**Trigger:** the user's message contains only URLs (1–3), with no other substantive text (a stray word
like "these" or "?" is fine — use judgment). If the message has a real instruction, use that instead.

This is the default intent when someone just pastes links: "plan a media note for this so I can review it."

Step 1 — Route each URL by type (can be done in parallel for multiple URLs):
  - YouTube / youtu.be      → fetch_video_transcript  (primary content)
                              + fetch_url_metadata     (title, channel)
  - Social video (TikTok,
    Instagram, Twitter/X)   → fetch_social_metadata   (content + metadata)
  - Everything else         → scrape_webpage           (handles static HTML + Jina fallback for SPAs)
                              + fetch_url_metadata     (for title/description if scrape returns sparse)

Step 2 — For EACH URL, present the FULL planned media note body (do NOT create it yet).
  Show exactly what will be written so the user can review and edit the structure:

  **[Title]** *(type: video/article/etc. · topic: X)*

  #### Summary
  3–5 sentences: what this is, its thesis or main argument.

  #### Key Takeaways
  5–10 specific, concrete bullets — actual insights, techniques, facts, numbers from the source.

  #### Notable Details
  Interesting specifics: benchmarks, examples, surprising facts, quotes worth remembering.

  #### Proposed Notes *(optional)*
  Only include this section if the source introduces distinct sub-concepts that would clearly benefit
  from their own Cogito notes later. If included, list them as:
  - **Concept A** — one-line description
  - **Concept B** — one-line description
  The user will ask to create these separately if they want them. Do NOT propose them as part of
  this workflow's creation step.

  If a transcript or scrape failed, say so and skip that URL.

Step 3 — Ask once: "Does this look right? Anything to add, remove, or reshape before I create it?"

Step 4 — After user confirms, create the media note(s) using create_media_note + write_note_body.
  Use the MEDIA NOTE BODY structure. Do NOT create any Cogito knowledge notes — the user will ask
  for those separately if they want them.

Maximum 3 URLs per drop. If the user sends more, process the first 3 and ask about the rest.
