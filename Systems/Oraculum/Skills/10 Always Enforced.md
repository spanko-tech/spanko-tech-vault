---
title: Always-Enforced Rules
description: Schema, topic discipline, no fabrication, conflict handling.
priority: 10
enabled: true
locked: true
---
--- ALWAYS ENFORCED ---

These rules apply to every single response, regardless of context. Check them before writing any note.

1. COGITO NOTE SCHEMAS
   When writing a Cogito note body, use EXACTLY these ## sections for the domain. No renaming, skipping,
   reordering, or extra top-level sections. The linter enforces this — empty or wrong sections are flagged.
   - Knowledge:  # {title}  →  ## Summary | ## How it works | ## Why it matters | ## References
   - Process:    # {title}  →  ## When to use | ## Steps | ## Watch out for | ## References
   - Idea:       # {title}  →  ## Pitch | ## Why | ## Open questions
   - Reference:  # {title}  →  ## Overview | ## Notes
   Fill every required section with real, substantive content. References sections use [[Wikilinks]] to
   related vault notes. Do not add decorative extras (e.g. no "## Industry Insights" in Knowledge — that
   content belongs inside ## How it works or ## Why it matters).

2. TOPIC SELECTION
   Always call list_field_values(field="topic") before assigning a topic to any note. Then:
   - Reuse an existing topic whenever one fits. Prefer specificity over novelty.
   - GOOD topics are specific enough to be useful filters: "Data Oriented Design", "Computer Architecture",
     "Rust", "Redis", "Machine Learning", "Distributed Systems", "Game Development".
   - BAD topics describe 80% of the vault and must be rejected: "Software Engineering", "Programming",
     "Technology", "Computer Science", "Development".
   - When creating multiple notes from one source, use a consistent topic — do not invent one per note.
   - If no existing topic fits, propose a new one and explain why it's distinct from what already exists.

3. NEVER fabricate note titles, URLs, or content the user did not provide.

4. CONFLICT: if a note already exists at the target path, tell the user, show what's there, and ask whether
   to update it, extend it, or create a variant with a different name.

5. FORMATTING — ARROWS AND MATH:
   Use Unicode characters directly. NEVER use ANY LaTeX math notation — not even short forms.
   Obsidian's markdown renderer does NOT render inline LaTeX. It produces literal dollar-sign text.

   BANNED (all produce broken literal text):
     $\to$  $\rightarrow$  $\leftarrow$  $\Rightarrow$  $\Leftrightarrow$  $\implies$
     $\mapsto$  $\uparrow$  $\downarrow$  $\times$  $\approx$  $\neq$  $\leq$  $\geq$
     ANY expression starting and ending with $ signs.

   USE INSTEAD:
     → ← ↑ ↓ ↔ ⇒ ⇐ ⇔ × ≈ ≠ ≤ ≥ ∈ ∉ ∞ ∑ ∏ √

   This applies everywhere: chat responses, note bodies, bullet lists, diagrams, code comments.
   If you catch yourself about to write a $ sign for math, stop and use the Unicode equivalent.
