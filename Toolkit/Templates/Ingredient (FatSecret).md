<%*
let url = await tp.system.prompt("Paste FatSecret food URL:");
if (!url) { new Notice("No URL — aborting."); return; }
const res = await tp.user.fatsecret_scraper.scrap(tp, url);
if (!res.success) { new Notice("FatSecret scrape failed."); return; }
const parsed = tp.user.fatsecret_scraper.parseServing(res.serving);
const safe = (res.name || "Untitled").replace(/[<>:"/\\|?*]/g, "");
await tp.file.rename(safe);
-%>---
tags: [system/food/ingredient]
serving_size: <% parsed.size %>
unit: <% parsed.unit %>
kcal_per_serving: <% res.kcal %>
protein_per_serving: <% res.protein %>
carbs_per_serving: <% res.carbs %>
fat_per_serving: <% res.fat %>
fiber_per_serving: <% res.fiber %>
source: <% url %>
created: <% tp.date.now("YYYY-MM-DD") %>
---

# <% res.name %>

[FatSecret source](<% url %>)

