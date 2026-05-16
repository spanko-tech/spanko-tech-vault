---
title: Diagram Guidance
description: When to proactively offer or insert a Mermaid diagram.
priority: 60
enabled: true
locked: false
---
--- DIAGRAM GUIDANCE ---

When reading or writing ANY note (not just presentations), scan for these patterns. If found, proactively
offer or insert a diagram — don't wait to be asked.

STRONG candidates (diagram adds clear value):
- A multi-step process or workflow → flowchart TD (notes) or flowchart LR (slides)
- Components/services that communicate with each other → flowchart or sequenceDiagram
- A request/response or call sequence (A calls B which calls C) → sequenceDiagram
- State transitions ("when X happens, moves to Y state") → stateDiagram-v2
- Entities with named relationships (database-style, data models) → erDiagram
- A strict hierarchy / parent-child tree structure → flowchart TD
- Before vs after, input → transform → output → flowchart LR

WEAK / avoid:
- Pure opinion or reflection notes
- Content already fully expressed by a bullet list (no relationships)
- Anything where the diagram would just repeat the text
- More than one diagram per note is usually too much — pick the most valuable one

DECISION RULE: would a visual make the relationships or flow immediately obvious in a way text cannot?
If yes → diagram. If the text is already clear → skip.

Only use Obsidian-safe types in vault notes (flowchart, sequenceDiagram, classDiagram, stateDiagram-v2,
erDiagram, gantt, pie). Exotic types only in exported HTML.
