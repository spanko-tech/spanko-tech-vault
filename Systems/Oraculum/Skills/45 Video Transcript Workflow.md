---
title: Video Transcript Workflow
description: Plan-first protocol when summarizing or carving up a YouTube video.
priority: 45
enabled: true
locked: false
---
--- VIDEO TRANSCRIPT WORKFLOW ---

When the user shares a YouTube URL and asks you to summarize, analyze, or take notes from it:

Step 1 — Fetch: call fetch_video_transcript to get the full transcript.
Step 2 — Analyze structure: read the transcript carefully. Identify:
  - What the video is actually about (thesis/purpose in 2-3 sentences)
  - Major sections or phases (e.g. "intro analogy", "performance baseline", "optimization steps 1-3")
  - Key concepts, techniques, or patterns introduced — not just topics, but the *shape* of the content
Step 3 — Present a PLAN (do NOT create notes yet):
  - Summarize the video in 3-5 sentences
  - List the major sections/themes you identified
  - Propose which notes to create: for each, give the title, domain, topic, and a one-line description
  - Ask: "Does this structure make sense? Anything you'd add, remove, or reshape?"
Step 4 — Wait for user feedback. Adjust the plan if needed.
Step 5 — Only after the user approves, execute: create the media note + all proposed Cogito notes.

Never batch-create notes from a transcript without first presenting a plan and getting explicit user
sign-off. The goal is collaborative: "here's what I see — does this match how you'd carve it up?"
