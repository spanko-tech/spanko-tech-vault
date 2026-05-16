async function scrap(tp, url) {
    try {
        const html = await tp.obsidian.request({
            url,
            method: "GET",
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Accept": "text/html,application/xhtml+xml"
            }
        });

        const get = (re) => (html.match(re) || [])[1]?.trim() || '';

        // <h1> may wrap name in <a> when portionid is used — handle both cases
        const name = get(/<h1[^>]*style="text-transform:none">(?:<a[^>]*>)?([^<]+)/);

        // Prefer <h2 class="portion"> (clean: "1 medium") over the verbose td description
        const h2Serving = get(/<h2[^>]*class="portion">([^<]+)/);
        const tdServing = get(/class="[^"]*serving_size_value[^"]*">([^<]+)<\/td>/);
        const serving   = (h2Serving || tdServing).trim();

        const kcal = parseFloat(get(/class="hero_value[^"]*">\s*([\d.]+)\s*<\/div>/)) || 0;

        function macro(label) {
            const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const r = new RegExp(
                `class="nutrient[^"]*left[^"]*"[^>]*>${escaped}<\\/div>\\s*<div[^>]*>\\s*([\\d.]+)g`
            );
            return parseFloat((html.match(r) || [])[1]) || 0;
        }

        return {
            name,
            serving,
            kcal,
            protein: macro('Protein'),
            carbs:   macro('Total Carbohydrate'),
            fat:     macro('Total Fat'),
            fiber:   macro('Dietary Fiber'),
            success: !!name
        };
    } catch (e) {
        return { name: '', serving: '', kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, success: false };
    }
}

// Parses a serving string like "30g", "250ml", "1 l", "2 tbsp (30g)", "1 large"
// Returns { size: number, unit: 'g'|'ml'|'piece', desc: string }
function parseServing(s) {
    if (!s) return { size: 1, unit: 'piece', desc: '1 piece' };

    // "2 tbsp (30g)" or "1 cup (240ml)" — extract numeric size from parentheses
    const inParens = s.match(/\(([\d.]+)\s*(g|ml|l)\)/i);
    if (inParens) {
        const u = inParens[2].toLowerCase();
        const n = parseFloat(inParens[1]);
        return u === 'l' ? { size: n * 1000, unit: 'ml', desc: s } : { size: n, unit: u, desc: s };
    }

    const m = s.match(/^([\d.]+)\s*(g|ml|l)$/i);
    if (m) {
        const u = m[2].toLowerCase();
        const n = parseFloat(m[1]);
        return u === 'l' ? { size: n * 1000, unit: 'ml', desc: s } : { size: n, unit: u, desc: s };
    }

    // "1 large", "1 medium", "3 oz" → piece, take leading number if any
    const lead = s.match(/^([\d.]+)/);
    return { size: lead ? parseFloat(lead[1]) : 1, unit: 'piece', desc: s };
}

module.exports = { scrap, parseServing };
