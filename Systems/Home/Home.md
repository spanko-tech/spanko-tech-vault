---
dashboard: true
aliases: [Home, Vault Home]
tags:
  - system/oraculum/system
  - datacore/dashboard
---
```datacorejsx
const V  = await dc.require("Toolkit/Datacore/Vault.js");
const W  = await dc.require("Toolkit/Datacore/Web.js");
const C  = await dc.require("Toolkit/Datacore/Cache.js");
const UI = await dc.require("Toolkit/Datacore/UI.jsx");
const L  = await dc.require("Toolkit/Datacore/LintRules.js");
const { EmptyState, SearchableSelect } = UI;

const DEFAULT_DEVTO_TAGS    = ["csharp", "javascript", "docker"];
const DEFAULT_LOBSTERS_TAGS = ["programming", "devops", "linux", "security", "web", "databases", "sysadmin", "rust", "go", "performance"];
const DEFAULT_RSS_FEEDS  = [
    "https://devclass.com/feed/",
    "https://thenewstack.io/feed/",
    "https://feeds.arstechnica.com/arstechnica/index",
    "https://www.infoq.com/feed/"
];

return function Home() {
    // ── Settings ───────────────────────────────────────────────────────
    const [weatherLoc, setWeatherLoc] = dc.useState(() => localStorage.getItem("home:weather-loc") || "Prague");
    const [devtoTags, setDevtoTags]   = dc.useState(() => {
        try { return JSON.parse(localStorage.getItem("home:devto-tags")) || DEFAULT_DEVTO_TAGS; }
        catch { return DEFAULT_DEVTO_TAGS; }
    });
    const [devtoTag, setDevtoTag] = dc.useState(() => {
        const t = localStorage.getItem("home:devto-tag");
        const ts = (() => { try { return JSON.parse(localStorage.getItem("home:devto-tags")); } catch { return null; } })();
        return t || (ts && ts[0]) || DEFAULT_DEVTO_TAGS[0];
    });
    const [devtoTagsDraft, setDevtoTagsDraft] = dc.useState(() => {
        try { return (JSON.parse(localStorage.getItem("home:devto-tags")) || DEFAULT_DEVTO_TAGS).join(", "); }
        catch { return DEFAULT_DEVTO_TAGS.join(", "); }
    });
    const [showSettings, setShowSettings] = dc.useState(false);
    const [hnCategory, setHnCategory]     = dc.useState("top");
    const [lobstersTag, setLobstersTag]   = dc.useState(() => localStorage.getItem("home:lobsters-tag") || "hottest");
    const [lobstersTags, setLobstersTags] = dc.useState(() => {
        try { return JSON.parse(localStorage.getItem("home:lobsters-tags")) || DEFAULT_LOBSTERS_TAGS; }
        catch { return DEFAULT_LOBSTERS_TAGS; }
    });
    const [lobstersTagsDraft, setLobstersTagsDraft] = dc.useState(() => {
        try { return (JSON.parse(localStorage.getItem("home:lobsters-tags")) || DEFAULT_LOBSTERS_TAGS).join(", "); }
        catch { return DEFAULT_LOBSTERS_TAGS.join(", "); }
    });
    const [selectedHabit, setSelectedHabit] = dc.useState("__all__");
    const [refreshKey, setRefreshKey]     = dc.useState(0);
    const [discoverIdx, setDiscoverIdx]   = dc.useState(0);
    const [attentionIdx, setAttentionIdx] = dc.useState(0);

    // ── Vault file data ────────────────────────────────────────────────
    const allFiles = dc.useMemo(() => {
        try { return dc.app?.vault?.getMarkdownFiles?.() ?? []; } catch { return []; }
    }, []);
    const allVaultFiles = dc.useMemo(() => {
        try { return dc.app?.vault?.getFiles?.() ?? []; } catch { return []; }
    }, []);

    const counts = dc.useMemo(() => ({
        notes:        allFiles.filter(f => f.path.startsWith("Systems/Cogito/Notes/")).length,
        media:        allFiles.filter(f => f.path.startsWith("Systems/Cogito/Media/")).length,
        inbox:        allFiles.filter(f => f.path.startsWith("Systems/Cogito/Inbox/")).length,
        mocs:         allFiles.filter(f => { const t = dc.app.metadataCache.getFileCache(f)?.frontmatter?.tags; return (Array.isArray(t)?t:[t??""]).some(x=>String(x).includes("system/cogito/moc")); }).length,
        habits:       allFiles.filter(f => f.path.startsWith("Systems/Habits/") && !f.path.endsWith("Habits.md")).length,
        jobs:         allFiles.filter(f => f.path.startsWith("Systems/Job Search/") && !f.path.endsWith("Job Search.md")).length,
        recipes:      allFiles.filter(f => f.path.startsWith("Systems/Food/Recipes/")).length,
        foodItems:    allFiles.filter(f => f.path.startsWith("Systems/Food/Items/")).length,
        projects:     allFiles.filter(f => f.path.startsWith("Systems/Projects/") && !f.path.endsWith("Projects.md")).length,
        issues:       allFiles.filter(f => f.path.startsWith("Systems/Issues/") && !f.path.endsWith("Issues.md")).length,
        releases:     allFiles.filter(f => f.path.startsWith("Systems/Releases/") && !f.path.endsWith("Releases.md")).length,
        resources:    allFiles.filter(f => f.path.startsWith("Systems/Resources/") && !f.path.endsWith("Resources.md")).length,
        presentations:allFiles.filter(f => f.path.startsWith("Systems/Presentations/") && !f.path.endsWith("Presentations.md") && !f.path.endsWith("Slide Patterns.md")).length,
        leetcode:     allFiles.filter(f => f.path.startsWith("Systems/Leetcode/") && !f.path.endsWith("Leetcode.md") && f.path.split("/").length === 4).length,
        growth:       allFiles.filter(f => f.path.startsWith("Systems/Growth/") && !f.path.endsWith("Growth.md")).length,
        growthSkills: allFiles.filter(f => f.path.startsWith("Systems/Growth/Skills/")).length,
        growthBrags:  allFiles.filter(f => f.path.startsWith("Systems/Growth/Brag/")).length,
        growthAdrs:   allFiles.filter(f => f.path.startsWith("Systems/Growth/ADRs/")).length,
        growthReviews:allFiles.filter(f => f.path.startsWith("Systems/Growth/Reviews/")).length,
        orSkills:     allFiles.filter(f => f.path.startsWith("Systems/Oraculum/Skills/")).length,
        orMemory:     allFiles.filter(f => f.path.startsWith("Systems/Oraculum/Memory/")).length,
        orResearch:   allVaultFiles.filter(f => f.path?.startsWith("Systems/Oraculum/Data/Research/") && f.path?.endsWith(".json") && !f.name?.includes("research_results") && !f.name?.includes("research_index")).length,
    }), [allFiles, allVaultFiles]);

    const recent = dc.useMemo(() => {
        try {
            return allFiles
                .filter(f => !f.path.startsWith(".trash") && !f.path.startsWith("Templates") && f.path !== "Codex Vitae.md")
                .sort((a, b) => (b.stat?.mtime ?? 0) - (a.stat?.mtime ?? 0))
                .slice(0, 5);
        } catch { return []; }
    }, [allFiles]);

    // ── Inbox items ────────────────────────────────────────────────────
    const inboxItems = dc.useMemo(() => {
        return allFiles
            .filter(f => f.path.startsWith("Systems/Cogito/Inbox/"))
            .sort((a, b) => (b.stat?.mtime ?? 0) - (a.stat?.mtime ?? 0))
            .slice(0, 5);
    }, [allFiles]);

    // ── Active projects ────────────────────────────────────────────────
    const activeProjects = dc.useMemo(() => {
        return allFiles
            .filter(f => f.path.startsWith("Systems/Projects/") && !f.path.endsWith("Projects.md"))
            .map(f => ({ file: f, fm: dc.app.metadataCache.getFileCache(f)?.frontmatter }))
            .filter(({ fm }) => fm?.status === "Active")
            .map(({ file, fm }) => ({ path: file.path, name: file.basename, sub: fm?.subtitle || "" }));
    }, [allFiles]);

    // ── LeetCode stats ─────────────────────────────────────────────────
    const leetcodeStats = dc.useMemo(() => {
        const files = allFiles.filter(f => f.path.startsWith("Systems/Leetcode/") && !f.path.endsWith("Leetcode.md") && f.path.split("/").length === 4);
        let easy = 0, medium = 0, hard = 0, solved = 0;
        files.forEach(f => {
            const fm = dc.app.metadataCache.getFileCache(f)?.frontmatter;
            if (!fm) return;
            if (fm.status === "Completed") solved++;
            const d = (fm.difficulty ?? "").toLowerCase();
            if (d === "easy") easy++;
            else if (d === "medium") medium++;
            else if (d === "hard") hard++;
        });
        const unsolved = files.filter(f => {
            const st = dc.app.metadataCache.getFileCache(f)?.frontmatter?.status;
            return st !== "Completed" && st !== "In Review";
        });
        const pick = unsolved.length > 0 ? unsolved[Math.floor(Math.random() * unsolved.length)] : null;
        const pickFm = pick ? dc.app.metadataCache.getFileCache(pick)?.frontmatter : null;
        return { total: files.length, solved, easy, medium, hard, challenge: pick ? { path: pick.path, name: pick.basename, difficulty: pickFm?.difficulty ?? "" } : null };
    }, [allFiles]);

    // ── Habits data — 28-day aggregate + per-habit + weekly view ──────
    const habitsData = dc.useMemo(() => {
        const todayDate = new Date();
        const days28 = [];
        for (let i = 27; i >= 0; i--) {
            const d = new Date(todayDate); d.setDate(todayDate.getDate() - i);
            days28.push(d.toISOString().slice(0, 10));
        }
        // Current Mon–Sun week
        const dow = todayDate.getDay();
        const mondayOff = dow === 0 ? -6 : 1 - dow;
        const weekDays = [];
        for (let i = 0; i < 7; i++) {
            const d = new Date(todayDate); d.setDate(todayDate.getDate() + mondayOff + i);
            weekDays.push(d.toISOString().slice(0, 10));
        }
        const habitFiles = allFiles.filter(f => f.path.startsWith("Systems/Habits/") && !f.path.endsWith("Habits.md"));
        const habitsMap = {};
        const dayCountsAgg  = {}; days28.forEach(d => { dayCountsAgg[d]  = 0; });
        const weekCountsAgg = {}; weekDays.forEach(d => { weekCountsAgg[d] = 0; });
        habitFiles.forEach(f => {
            const fm = dc.app.metadataCache.getFileCache(f)?.frontmatter;
            const log = fm?.log ?? [];
            const entries = Array.isArray(log) ? log : [log];
            const logSet = new Set(entries.map(e => String(e ?? "").replace(/^d_/, "").trim()));
            habitsMap[f.path] = { name: f.basename, logSet };
            days28.forEach(d => { if (logSet.has(d)) dayCountsAgg[d]++; });
            weekDays.forEach(d => { if (logSet.has(d)) weekCountsAgg[d]++; });
        });
        return { days28, weekDays, dayCountsAgg, weekCountsAgg, habitsMap, totalHabits: habitFiles.length, habitFiles };
    }, [allFiles, refreshKey]);

    // ── Finance mini-summary ───────────────────────────────────────────
    const financeSummary = dc.useMemo(() => {
        const now = new Date();
        const curMonth = now.getMonth();
        const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
        const monthName = MONTHS[curMonth];
        const finFile = dc.app.vault.getAbstractFileByPath("Systems/Finances/Finances.md");
        const finFm = finFile ? dc.app.metadataCache.getFileCache(finFile)?.frontmatter : null;
        const base = finFm?.baseCurrency ?? "CZK";
        const rates = { [base]: 1, EUR: Number(finFm?.EURExchangeRate ?? 25), USD: Number(finFm?.USDExchangeRate ?? 22) };
        const finFiles = allFiles.filter(f => f.path.startsWith("Systems/Finances/") && !f.path.endsWith("Finances.md"));
        let income = 0, expenses = 0;
        const upcoming = [];
        finFiles.forEach(f => {
            const fm = dc.app.metadataCache.getFileCache(f)?.frontmatter;
            if (!fm || fm.status !== "Active") return;
            const tags = Array.isArray(fm.tags) ? fm.tags : [fm.tags ?? ""];
            const isIncome  = tags.some(t => String(t).includes("income"));
            const isExpense = tags.some(t => String(t).includes("expense"));
            const amtCzk = Number(fm.amount ?? 0) * (rates[fm.currency] ?? 1);
            const freq = fm.frequency ?? "Monthly";
            let show = freq === "Monthly";
            if (!show && freq === "Yearly") {
                const ds = String(fm.start_date ?? "");
                const parts = ds.split(".");
                if (parts.length >= 2 && !isNaN(parseInt(parts[1]))) show = parseInt(parts[1]) === curMonth + 1;
                else show = MONTHS.some((mn, i) => ds.includes(mn) && i === curMonth);
            }
            if (!show) return;
            // Date is stored in start_date as "DD.M.YYYY"
            const ds = String(fm.start_date ?? "");
            const day = ds.match(/^\d+/) ? parseInt(ds.split(".")[0]) : null;
            if (isIncome) {
                income += amtCzk;
                upcoming.push({ name: f.basename, amount: amtCzk, day, currency: fm.currency ?? "CZK", type: "income" });
            } else if (isExpense) {
                expenses += amtCzk;
                upcoming.push({ name: f.basename, amount: amtCzk, day, currency: fm.currency ?? "CZK", type: "expense" });
            }
        });
        upcoming.sort((a, b) => (a.day ?? 99) - (b.day ?? 99));
        const todayDay = now.getDate();
        const cluster = upcoming.filter(tx => tx.day != null && tx.day >= todayDay).slice(0, 6);
        return { income: Math.round(income), expenses: Math.round(expenses), net: Math.round(income - expenses), month: monthName, cluster, base };
    }, [allFiles]);

    // ── Discovery queue: random Cogito notes ──────────────────────────
    const discoveryQueue = dc.useMemo(() => {
        const notes = allFiles.filter(f => f.path.startsWith("Systems/Cogito/Notes/"));
        const shuffled = [...notes].sort(() => Math.random() - 0.5);
        const random = shuffled.slice(0, Math.min(5, shuffled.length));
        return { random };
    }, [allFiles]);

    // ── Needs Attention: vault-wide lint via LintRules.lintFm ─────────
    const attentionQueue = dc.useMemo(() => {
        const out = [];
        const seen = new Set();
        const PILLAR_OF = (p) => {
            if (p.startsWith("Systems/Cogito/")) return "Cogito";
            if (p.startsWith("Systems/Oraculum/")) return "Oraculum";
            if (p.startsWith("Systems/")) return "Systems";
            return "Vault";
        };
        // Only lint user content — exclude tooling and Oraculum internals
        const CONTENT_PREFIXES = ["Systems/Cogito/", "Systems/Habits/", "Systems/Finances/", "Systems/Food/", "Systems/Job Search/", "Systems/Projects/", "Systems/Issues/", "Systems/Releases/", "Systems/Growth/", "Systems/Resources/", "Systems/Infrastructure/", "Systems/Leetcode/", "Systems/Presentations/"];
        const SEV_RANK = { high: 0, medium: 1, low: 2 };
        for (const f of allFiles) {
            const p = f.path;
            if (!CONTENT_PREFIXES.some(pre => p.startsWith(pre))) continue;
            if (p.includes("/Templates/")) continue;
            const fm = dc.app.metadataCache.getFileCache(f)?.frontmatter;
            if (!fm) continue;
            if (fm.dashboard === true) continue;
            const issues = L.lintFm(fm);
            if (!issues || issues.length === 0) continue;
            // Take the highest-severity issue as the headline
            const sorted = [...issues].sort((a, b) => (SEV_RANK[a.severity] ?? 9) - (SEV_RANK[b.severity] ?? 9));
            const top = sorted[0];
            if (seen.has(p)) continue;
            seen.add(p);
            out.push({
                path: p,
                name: f.basename,
                pillar: PILLAR_OF(p),
                issue: top.issue,
                severity: top.severity,
                count: issues.length,
            });
        }
        // High first, then medium, then low; stable within
        out.sort((a, b) => (SEV_RANK[a.severity] ?? 9) - (SEV_RANK[b.severity] ?? 9));
        return out;
    }, [allFiles, refreshKey]);

    // ── Widget state ───────────────────────────────────────────────────
    const [weather, setWeather]         = dc.useState(null);
    const [onThisDay, setOnThisDay]     = dc.useState(null);
    const [quote, setQuote]             = dc.useState(null);
    const [leetcodeDaily, setLeetcodeDaily] = dc.useState(null);
    const [devto, setDevto]     = dc.useState(null);
    const [hn, setHn]           = dc.useState(null);
    const [lobsters, setLobsters] = dc.useState(null);
    const [news, setNews]           = dc.useState(null);
    const [newsSourceFilter, setNewsSourceFilter] = dc.useState("All");
    const [newsCatFilter, setNewsCatFilter]       = dc.useState("All");
    const [rssFeeds, setRssFeeds]   = dc.useState(() => {
        try { return JSON.parse(localStorage.getItem("home:rss-feeds")) || DEFAULT_RSS_FEEDS; }
        catch { return DEFAULT_RSS_FEEDS; }
    });
    const [rssInput, setRssInput]   = dc.useState("");
    const [foodPicked, setFoodPicked] = dc.useState("");
    const [foodAmt, setFoodAmt]       = dc.useState("");
    const [foodSaving, setFoodSaving] = dc.useState(false);

    // ── Food tracker data ─────────────────────────────────────────────
    const foodData = dc.useMemo(() => {
        const foodFile = allFiles.find(f => f.path === "Systems/Food/Food.md");
        if (!foodFile) return null;
        const fm = dc.app.metadataCache.getFileCache(foodFile)?.frontmatter;
        if (!fm) return null;
        const goals = { kcal: Number(fm.goal_kcal)||2300, protein: Number(fm.goal_protein)||140, carbs: Number(fm.goal_carbs)||270, fat: Number(fm.goal_fat)||60, fiber: Number(fm.goal_fiber)||35 };
        const ingMap = new Map(), recipeMap = new Map();
        allFiles.forEach(f => {
            const ffm = dc.app.metadataCache.getFileCache(f)?.frontmatter;
            if (!ffm) return;
            const tags = Array.isArray(ffm.tags) ? ffm.tags : [ffm.tags ?? ""];
            if (tags.some(t => String(t).includes("system/food/ingredient"))) ingMap.set(f.basename, ffm);
            else if (tags.some(t => String(t).includes("system/food/recipe"))) recipeMap.set(f.basename, ffm);
        });
        function ingM(ifm, amt) {
            const s = Number(ifm.serving_size)||1;
            const m = amt/s;
            return { kcal:(Number(ifm.kcal_per_serving)||0)*m, protein:(Number(ifm.protein_per_serving)||0)*m, carbs:(Number(ifm.carbs_per_serving)||0)*m, fat:(Number(ifm.fat_per_serving)||0)*m, fiber:(Number(ifm.fiber_per_serving)||0)*m };
        }
        const planItems = fm.plan_items ?? [];
        let tot = { kcal:0, protein:0, carbs:0, fat:0, fiber:0 };
        const rows = [];
        planItems.forEach((item, idx) => {
            const raw = item.food;
            let name = null;
            if (typeof raw === "string") name = raw.replace(/^\[\[|\]\]$/g, "").split("|")[0].split("/").pop().replace(/\.md$/,"");
            else if (raw?.path) name = raw.path.split("/").pop().replace(/\.md$/,"");
            const amt = Number(item.amount)||1;
            if (!name) return;
            const rfm = recipeMap.get(name), ifm = !rfm ? ingMap.get(name) : null;
            if (!rfm && !ifm) return;
            let m, unit;
            if (rfm) {
                const portions = Number(rfm.portions)||1;
                let pp = { kcal:0, protein:0, carbs:0, fat:0, fiber:0 };
                (rfm.recipe_items??[]).forEach(it => {
                    const iraw = it.ingredient;
                    let iname = null;
                    if (typeof iraw==="string") iname = iraw.replace(/^\[\[|\]\]$/g,"").split("|")[0].split("/").pop().replace(/\.md$/,"");
                    else if (iraw?.path) iname = iraw.path.split("/").pop().replace(/\.md$/,"");
                    const ii = iname ? ingMap.get(iname) : null;
                    if (!ii) return;
                    const mm = ingM(ii, Number(it.amount)||0);
                    Object.keys(pp).forEach(k => pp[k] += mm[k]/portions);
                });
                m = {}; Object.keys(pp).forEach(k => m[k] = pp[k]*amt);
                unit = "portion";
            } else {
                m = ingM(ifm, amt); unit = String(ifm.unit??"");
            }
            Object.keys(tot).forEach(k => tot[k] += m[k]);
            rows.push({ idx, name, amt, unit, kcal: Math.round(m.kcal), protein: Math.round(m.protein*10)/10 });
        });
        const foodOptions = [];
        recipeMap.forEach((_, n) => foodOptions.push({ value: n, label: `🍽️ ${n}` }));
        ingMap.forEach((ifm, n) => foodOptions.push({ value: n, label: `🥑 ${n} (per ${ifm.serving_size??1}${ifm.unit??""})` }));
        foodOptions.sort((a,b) => a.label.localeCompare(b.label));
        return { goals, rows, tot, foodFile, foodOptions };
    }, [allFiles, refreshKey]);

    // Individual loaders — force=true bypasses cache
    async function loadWeather(force = false) {
        try {
            const key = `home:weather:${weatherLoc}`;
            const cached = !force && C.get(key, 3 * 60 * 60 * 1000);
            if (cached) { setWeather(cached); return; }
            const g = await W.httpJson(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(weatherLoc)}&count=1&language=en&format=json`);
            const hit = g.data?.results?.[0];
            if (!hit) return;
            const w = await W.httpJson(`https://api.open-meteo.com/v1/forecast?latitude=${hit.latitude}&longitude=${hit.longitude}&current=temperature_2m,weather_code,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min,weather_code&forecast_days=3&timezone=auto`);
            const cm = {0:"☀️",1:"🌤️",2:"⛅",3:"☁️",45:"🌫️",48:"🌫️",51:"🌦️",53:"🌧️",55:"🌧️",61:"🌧️",63:"🌧️",65:"🌧️",71:"🌨️",73:"🌨️",75:"❄️",80:"🌦️",81:"🌧️",82:"⛈️",95:"⛈️",96:"⛈️",99:"⛈️"};
            const data = {
                place: `${hit.name}${hit.country ? ", " + hit.country : ""}`,
                now:   `${cm[w.data?.current?.weather_code] ?? "🌡️"} ${w.data?.current?.temperature_2m}°C`,
                forecast: (w.data?.daily?.time ?? []).map((d, i) => ({ date: d, icon: cm[w.data.daily.weather_code?.[i]] ?? "🌡️", hi: w.data.daily.temperature_2m_max?.[i], lo: w.data.daily.temperature_2m_min?.[i] })),
            };
            C.set(key, data); setWeather(data);
        } catch { /* swallow */ }
    }

    async function loadOnThisDay(force = false) {
        try {
            const today = new Date().toISOString().slice(0, 10);
            const cached = !force && C.get(`home:onthisday:${today}`, 24 * 60 * 60 * 1000);
            if (cached) { setOnThisDay(cached); return; }
            const now = new Date();
            const r = await W.httpJson(`https://en.wikipedia.org/api/rest_v1/feed/onthisday/events/${now.getMonth() + 1}/${now.getDate()}`);
            if (r.ok && r.data?.events?.length) {
                const picks = [...r.data.events]
                    .sort(() => Math.random() - 0.5)
                    .slice(0, 5)
                    .map(e => ({ year: e.year, text: e.text, url: e.pages?.[0]?.content_urls?.desktop?.page ?? null }));
                C.set(`home:onthisday:${today}`, picks);
                setOnThisDay(picks);
            }
        } catch { /* swallow */ }
    }

    async function loadQuote(force = false) {
        try {
            const today = new Date().toISOString().slice(0, 10);
            const cached = !force && C.get(`home:quote:${today}`, 24 * 60 * 60 * 1000);
            if (cached) { setQuote(cached); return; }
            const r = await W.httpJson("https://zenquotes.io/api/today");
            if (r.ok && r.data?.[0]) { const d = { content: r.data[0].q, author: r.data[0].a }; C.set(`home:quote:${today}`, d); setQuote(d); }
        } catch { /* swallow */ }
    }

    async function loadLeetcodeDaily() {
        try {
            const today = new Date().toISOString().slice(0, 10);
            const cached = C.get(`home:lc-daily:${today}`, 24 * 60 * 60 * 1000);
            if (cached) { setLeetcodeDaily(cached); return; }
            const r = await W.httpJson("https://leetcode.com/graphql/", {
                method: "POST",
                body: { query: "{ activeDailyCodingChallengeQuestion { link question { title difficulty } } }" }
            });
            const q = r.data?.data?.activeDailyCodingChallengeQuestion;
            if (q) {
                const d = { title: q.question.title, difficulty: q.question.difficulty, url: `https://leetcode.com${q.link}` };
                C.set(`home:lc-daily:${today}`, d);
                setLeetcodeDaily(d);
            }
        } catch { /* swallow */ }
    }

    async function loadDevto(tag, force = false) {
        try {
            const key = `home:devto2:${tag}`;
            const cached = !force && C.get(key, 60 * 60 * 1000);
            if (cached) { setDevto(cached); return; }
            const r = await W.httpJson(`https://dev.to/api/articles?tag=${encodeURIComponent(tag)}&per_page=15&top=15`);
            if (r.ok && Array.isArray(r.data)) {
                const d = r.data.map(a => ({ title: a.title, url: a.url, author: a.user?.name, minutes: a.reading_time_minutes, reactions: a.positive_reactions_count }));
                C.set(key, d); setDevto(d);
            }
        } catch { /* swallow */ }
    }

    async function loadHN(category = "top", force = false) {
        try {
            const key = `home:hn2:${category}`;
            const cached = !force && C.get(key, 60 * 60 * 1000);
            if (cached) { setHn(cached); return; }
            const epMap = { top: "topstories", ask: "askstories", show: "showstories", best: "beststories" };
            const ids = await W.httpJson(`https://hacker-news.firebaseio.com/v0/${epMap[category] || "topstories"}.json`);
            if (!ids.ok || !Array.isArray(ids.data)) return;
            const stories = await Promise.all(ids.data.slice(0, 15).map(id => W.httpJson(`https://hacker-news.firebaseio.com/v0/item/${id}.json`)));
            const d = stories.filter(r => r.ok && r.data?.title).map(r => ({ title: r.data.title, url: r.data.url || `https://news.ycombinator.com/item?id=${r.data.id}`, score: r.data.score, comments: r.data.descendants ?? 0 }));
            C.set(key, d); setHn(d);
        } catch { /* swallow */ }
    }

    async function loadLobsters(force = false, tag) {
        const t = tag ?? lobstersTag;
        try {
            const key = `home:lobsters2:${t}`;
            const cached = !force && C.get(key, 60 * 60 * 1000);
            if (cached) { setLobsters(cached); return; }
            const url = t === "hottest" ? "https://lobste.rs/hottest.json" : `https://lobste.rs/t/${t}.json`;
            const r = await W.httpJson(url);
            if (r.ok && Array.isArray(r.data)) {
                const d = r.data.slice(0, 15).map(s => ({ title: s.title, url: s.url, score: s.score, comments: s.comments_count, tags: (s.tags ?? []).slice(0, 2) }));
                C.set(key, d); setLobsters(d);
            }
        } catch { /* swallow */ }
    }

    async function loadRssFeeds(force = false, feedsOverride) {
        const feeds = feedsOverride ?? rssFeeds;
        if (!feeds.length) { setNews([]); return; }
        const ckey = `home:rss:${feeds.join("|").slice(0, 80)}`;
        const cached = !force && C.get(ckey, 3 * 60 * 60 * 1000);
        if (cached) { setNews(cached); return; }
        try {
            const results = await Promise.all(feeds.map(async url => {
                try {
                    const r = await W.httpGet(url);
                    if (!r.ok || !r.text) return [];
                    const xml = new DOMParser().parseFromString(r.text, "text/xml");
                    // Clean channel title — strip common feed suffixes like "- All content", "| Recent"
                    const rawTitle = xml.querySelector("channel > title")?.textContent?.trim() ?? "";
                    const channelTitle = rawTitle.replace(/\s*[-–|:]\s*(All content|RSS Feed|Feed|News|Main|Latest).*$/i, "").trim() || new URL(url).hostname;
                    return Array.from(xml.querySelectorAll("item")).slice(0, 20).map(item => ({
                        title:      item.querySelector("title")?.textContent?.trim() ?? "",
                        url:        item.querySelector("link")?.textContent?.trim() ?? "",
                        source:     channelTitle,
                        categories: Array.from(item.querySelectorAll("category")).map(c => c.textContent.trim()).filter(Boolean),
                        pubDate:    new Date(item.querySelector("pubDate")?.textContent ?? 0)
                    })).filter(a => a.title && a.url);
                } catch { return []; }
            }));
            // Store ALL articles sorted by date — balancing is applied at render time only for "All" view
            const d = results.flat().sort((a, b) => b.pubDate - a.pubDate).map(a => ({
                title: a.title, url: a.url, source: a.source, categories: a.categories,
                ago: a.pubDate && !isNaN(a.pubDate) ? Math.round((Date.now() - a.pubDate) / 3600000) + "h" : ""
            }));
            C.set(ckey, d); setNews(d);
        } catch (e) { setNews({ error: String(e?.message ?? e) }); }
    }

    dc.useEffect(() => { loadWeather(); }, [weatherLoc]);
    dc.useEffect(() => { loadOnThisDay(); loadQuote(); loadLeetcodeDaily(); loadHN("top"); loadLobsters(); loadRssFeeds(); }, []);
    dc.useEffect(() => { loadDevto(devtoTag); }, [devtoTag]);

    const today    = new Date();
    const todayStr = today.toISOString().slice(0, 10);
    const dateStr  = today.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });

    // ── Quick capture ──────────────────────────────────────────────────
    const [captureText, setCaptureText] = dc.useState("");
    const [capturing, setCapturing]     = dc.useState(false);
    async function quickCapture() {
        const text = captureText.trim();
        if (!text) return;
        setCapturing(true);
        try {
            const ts = new Date();
            const path = `Systems/Cogito/Inbox/${ts.toISOString().slice(0,10)} ${V.safeName(text.slice(0,50)) || "Inbox"}.md`;
            await V.ensureFolder("Systems/Cogito/Inbox");
            await app.vault.create(path, `---\ntags: [system/cogito/inbox]\ncreated: "${V.today()}"\n---\n\n${text}\n`);
            setCaptureText(""); V.notify(`Captured to Inbox`);
        } catch (e) { V.notify(`Failed: ${e?.message ?? e}`); }
        finally { setCapturing(false); }
    }

    // ── Habit day toggle ──────────────────────────────────────────────
    async function toggleHabitDay(habitPath, day) {
        if (!habitPath || habitPath === "__all__") return;
        const file = dc.app.vault.getAbstractFileByPath(habitPath);
        if (!file) return;
        let added = false;
        await dc.app.fileManager.processFrontMatter(file, fm => {
            const existing = Array.isArray(fm.log) ? [...fm.log] : fm.log ? [fm.log] : [];
            const dKey = `d_${day}`;
            const idx = existing.findIndex(e => String(e).trim() === dKey);
            if (idx >= 0) { existing.splice(idx, 1); added = false; }
            else { existing.push(dKey); added = true; }
            fm.log = existing;
        });
        V.notify(added ? `✅ Logged ${day}` : `↩️ Removed ${day}`);
        await new Promise(r => setTimeout(r, 150));
        setRefreshKey(k => k + 1);
    }

    // ── Helpers ────────────────────────────────────────────────────────
    const fmtCzk = n => `${Math.round(n).toLocaleString()} ${financeSummary.base ?? "CZK"}`;
    const r1 = v => Math.round(v*10)/10;
    const weekdayLabels = ["M","T","W","T","F","S","S"];

    async function addFood() {
        if (!foodPicked || !foodData?.foodFile) return;
        setFoodSaving(true);
        try {
            const amt = Number(foodAmt) || 1;
            await dc.app.fileManager.processFrontMatter(foodData.foodFile, fm => {
                const cur = fm.plan_items ?? [];
                fm.plan_items = [...cur, { food: `[[${foodPicked}]]`, amount: amt }];
            });
            setFoodPicked(""); setFoodAmt("");
            await new Promise(r => setTimeout(r, 150));
            setRefreshKey(k => k + 1);
        } catch(e) { V.notify(`Food add failed: ${e?.message}`); }
        finally { setFoodSaving(false); }
    }

    async function clearFood() {
        if (!foodData?.foodFile) return;
        await dc.app.fileManager.processFrontMatter(foodData.foodFile, fm => { fm.plan_items = []; });
        await new Promise(r => setTimeout(r, 150));
        setRefreshKey(k => k + 1);
    }

    function MacroBar({ label, val, goal, color }) {
        const pct = goal > 0 ? Math.min(100, Math.round(val/goal*100)) : 0;
        return (
            <div style={{ marginBottom: 3 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.6em", color: "var(--text-faint)", marginBottom: 1 }}>
                    <span>{label}</span><span style={{ color }}>{r1(val)}/{goal}</span>
                </div>
                <div style={{ height: 3, borderRadius: 2, background: "var(--background-modifier-border)" }}>
                    <div style={{ height: "100%", width: `${pct}%`, borderRadius: 2, background: color, transition: "width 0.3s" }} />
                </div>
            </div>
        );
    }

    function heatColor(count, total, binary = false) {
        if (binary) return count > 0 ? "#16a34a" : "var(--background-modifier-border)";
        if (total === 0) return "var(--background-modifier-border)";
        const r = count / total;
        return r === 0 ? "var(--background-modifier-border)" : r < 0.25 ? "#14532d" : r < 0.5 ? "#166534" : r < 0.75 ? "#15803d" : "#22c55e";
    }

    function PanelHeader({ label, onRefresh, onClick }) {
        return (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, minHeight: "24px" }}>
                <div style={{ fontSize: "0.75em", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", cursor: onClick ? "pointer" : "default" }} onClick={onClick}>{label}</div>
                {onRefresh && <button onClick={onRefresh} title="Refresh" style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--text-faint)", fontSize: "0.9em", padding: "0 2px", lineHeight: 1 }}>⟳</button>}
            </div>
        );
    }

    const pillars = [
        { icon: "🧠", name: "Cogito",   path: "Systems/Cogito/Cogito.md",              kpi: `${counts.notes} notes · ${counts.inbox} inbox`,                           sub: `${counts.media} media · ${counts.mocs} MOCs`,                                    color: "#a78bfa" },
        { icon: "🎯", name: "Habits",    path: "Systems/Habits/Habits.md",        kpi: `${counts.habits} habits · ${counts.jobs} jobs`,                           sub: `${counts.recipes} recipes · ${counts.foodItems} items`,                          color: "#34d399" },
        { icon: "🏭", name: "Projects",  path: "Systems/Projects/Projects.md",  kpi: `${counts.projects} projects · ${counts.presentations} presentations · ${counts.resources} resources`, sub: `${counts.issues} issues · ${counts.releases} releases`, color: "#fbbf24" },
        { icon: "🔮", name: "Oraculum", path: "Systems/Oraculum/Oraculum.md",          kpi: `${counts.orSkills} skills · 63 tools`,                                                                      sub: `${counts.orMemory} memories · ${counts.orResearch} research topics`, color: "#60a5fa" },
        { icon: "🌱", name: "Growth",   path: "Systems/Growth/Growth.md",      kpi: `${counts.growth} entries`,                                                sub: `${counts.growthSkills} skills · ${counts.growthBrags} brags · ${counts.growthAdrs} ADRs`, color: "#f97316" },
    ];

    // ── Render ─────────────────────────────────────────────────────────
    // Per-habit log set for the heatmap when a single habit is selected
    const habitLogSet = dc.useMemo(() => {
        if (selectedHabit === "__all__") return null;
        return habitsData.habitsMap[selectedHabit]?.logSet ?? new Set();
    }, [selectedHabit, habitsData]);

    // ── Mobile detection ───────────────────────────────────────────────
    const [isMobile, setIsMobile] = dc.useState(() => window.innerWidth < 700);
    dc.useEffect(() => {
        const handler = () => setIsMobile(window.innerWidth < 700);
        window.addEventListener("resize", handler);
        return () => window.removeEventListener("resize", handler);
    }, []);

    const [mobileNewsTab, setMobileNewsTab] = dc.useState("hn");
    const [mobileHabitPick, setMobileHabitPick] = dc.useState(() => {
        const files = habitsData.habitFiles;
        return files.length > 0 ? files[0].path : "";
    });

    if (isMobile) {
        const mobileNewsFeeds = {
            hn:       { label: "HN",   data: hn,       refresh: () => loadHN(hnCategory, true) },
            devto:    { label: "DT",   data: devto,    refresh: () => loadDevto(devtoTag, true) },
            lobsters: { label: "LS",   data: lobsters, refresh: () => loadLobsters(true, lobstersTag) },
            news:     { label: "News", data: news,     refresh: () => loadRssFeeds(true) },
        };
        const curFeed = mobileNewsFeeds[mobileNewsTab];
        const rawItems = Array.isArray(curFeed?.data) ? curFeed.data : [];
        const feedItems = mobileNewsTab === "news" && newsSourceFilter !== "All"
            ? rawItems.filter(a => a.source === newsSourceFilter)
            : rawItems;

        const newsSources = dc.useMemo(() => ["All", ...Array.from(new Set((Array.isArray(news) ? news : []).map(a => a.source).filter(Boolean)))], [news]);
        const mobileFilterConfig = {
            hn:       { options: ["top","ask","show","best"], value: hnCategory,       onChange: v => { setHnCategory(v); loadHN(v, false); } },
            devto:    { options: devtoTags,                  value: devtoTag,          onChange: v => { setDevtoTag(v); localStorage.setItem("home:devto-tag", v); loadDevto(v, false); } },
            lobsters: { options: ["hottest", ...lobstersTags], value: lobstersTag,    onChange: v => { setLobstersTag(v); localStorage.setItem("home:lobsters-tag", v); loadLobsters(false, v); } },
            news:     { options: newsSources,                value: newsSourceFilter,  onChange: v => setNewsSourceFilter(v) },
        };
        const curFilter = mobileFilterConfig[mobileNewsTab];

        const habitNames = habitsData.habitFiles.map(f => ({ value: f.path, label: f.basename }));
        const todayHabitLogged = mobileHabitPick && habitsData.habitsMap[mobileHabitPick]?.logSet.has(todayStr);

        return (
            <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: "100%", padding: "0 2px" }}>

                {/* Header */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ fontSize: "1.1em", fontWeight: 700, color: "var(--text-accent)" }}>Codex Vitae</div>
                    <div style={{ fontSize: "0.82em", fontWeight: 600, padding: "3px 10px", background: "var(--background-secondary)", borderRadius: 20, border: "1px solid var(--background-modifier-border)" }}>
                        📅 {dateStr}
                    </div>
                </div>

                {/* Quick Capture */}
                <div style={{ background: "var(--background-secondary)", borderRadius: 10, padding: 12 }}>
                    <div style={{ fontSize: "0.72em", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>📥 Quick Capture</div>
                    <textarea
                        value={captureText}
                        onInput={e => setCaptureText(e.target.value)}
                        placeholder="Capture a thought..."
                        rows={3}
                        style={{ width: "100%", boxSizing: "border-box", background: "var(--background-primary)", border: "1px solid var(--background-modifier-border)", borderRadius: 6, padding: "8px 10px", fontSize: "0.9em", color: "var(--text-normal)", resize: "none", fontFamily: "inherit" }}
                        onKeyDown={e => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) quickCapture(); }}
                    />
                    <button
                        onClick={quickCapture}
                        disabled={capturing || !captureText.trim()}
                        style={{ marginTop: 6, width: "100%", padding: "8px", background: captureText.trim() ? "var(--interactive-accent)" : "var(--background-modifier-border)", color: captureText.trim() ? "white" : "var(--text-muted)", border: "none", borderRadius: 6, cursor: captureText.trim() ? "pointer" : "default", fontSize: "0.88em", fontWeight: 600 }}
                    >
                        {capturing ? "Saving…" : "Save to Inbox"}
                    </button>
                </div>

                {/* Quote of the day */}
                {quote && (
                    <div style={{ background: "var(--background-secondary)", borderRadius: 10, padding: 12 }}>
                        <div style={{ fontSize: "0.72em", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>💬 Quote of the day</div>
                        <div style={{ fontStyle: "italic", fontSize: "0.88em", lineHeight: 1.5, color: "var(--text-normal)" }}>"{quote.content}"</div>
                        <div style={{ fontSize: "0.72em", color: "var(--text-muted)", marginTop: 6, textAlign: "right" }}>— {quote.author}</div>
                    </div>
                )}

                {/* Food Today */}
                {foodData && (
                    <div style={{ background: "var(--background-secondary)", borderRadius: 10, padding: 12 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                            <div style={{ fontSize: "0.72em", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>🍽️ Food Today</div>
                            <button onClick={clearFood} style={{ fontSize: "0.7em", background: "transparent", border: "1px solid var(--background-modifier-border)", borderRadius: 4, padding: "2px 6px", cursor: "pointer", color: "var(--text-muted)" }}>Clear</button>
                        </div>
                        <MacroBar label="Calories" val={foodData.tot.kcal}    goal={foodData.goals.kcal}    color="#f97316" />
                        <MacroBar label="Protein"  val={foodData.tot.protein} goal={foodData.goals.protein} color="#60a5fa" />
                        <MacroBar label="Carbs"    val={foodData.tot.carbs}   goal={foodData.goals.carbs}   color="#a78bfa" />
                        <MacroBar label="Fat"      val={foodData.tot.fat}     goal={foodData.goals.fat}     color="#fbbf24" />
                        <MacroBar label="Fiber"    val={foodData.tot.fiber}   goal={foodData.goals.fiber}   color="#34d399" />
                        <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
                            <div style={{ flex: 1 }}>
                                <SearchableSelect
                                    options={foodData.foodOptions}
                                    value={foodPicked}
                                    onChange={setFoodPicked}
                                    placeholder="Search food…"
                                />
                            </div>
                            <input
                                type="number"
                                min="0"
                                value={foodAmt}
                                onInput={e => setFoodAmt(e.target.value)}
                                placeholder="Amt"
                                style={{ width: 58, background: "var(--background-primary)", border: "1px solid var(--background-modifier-border)", borderRadius: 6, padding: "4px 6px", fontSize: "0.82em", color: "var(--text-normal)" }}
                            />
                            <button onClick={addFood} disabled={foodSaving || !foodPicked} style={{ padding: "4px 10px", background: foodPicked ? "var(--interactive-accent)" : "var(--background-modifier-border)", color: foodPicked ? "white" : "var(--text-muted)", border: "none", borderRadius: 6, cursor: foodPicked ? "pointer" : "default", fontSize: "0.82em", fontWeight: 600, whiteSpace: "nowrap" }}>
                                {foodSaving ? "…" : "Add"}
                            </button>
                        </div>
                    </div>
                )}

                {/* Habits — week strip + quick log */}
                <div style={{ background: "var(--background-secondary)", borderRadius: 10, padding: 12 }}>
                    <div style={{ fontSize: "0.72em", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>🎯 Habits</div>
                    {/* Week strip */}
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, marginBottom: 10 }}>
                        {habitsData.weekDays.map((d, i) => {
                            const count = habitsData.weekCountsAgg[d] ?? 0;
                            const isToday = d === todayStr;
                            return (
                                <div key={d} style={{ textAlign: "center" }}>
                                    <div style={{ fontSize: "0.58em", color: "var(--text-faint)", marginBottom: 2 }}>{weekdayLabels[i]}</div>
                                    <div style={{ height: 24, borderRadius: 4, background: heatColor(count, habitsData.totalHabits), border: isToday ? "1px solid var(--text-accent)" : "none" }} title={`${count}/${habitsData.totalHabits}`} />
                                </div>
                            );
                        })}
                    </div>
                    {/* Quick log */}
                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                        <div style={{ flex: 1 }}>
                            <SearchableSelect
                                options={habitNames}
                                value={mobileHabitPick}
                                onChange={setMobileHabitPick}
                                placeholder="Select habit…"
                            />
                        </div>
                        <button
                            onClick={() => mobileHabitPick && toggleHabitDay(mobileHabitPick, todayStr)}
                            style={{ padding: "4px 10px", background: todayHabitLogged ? "#166534" : "var(--interactive-accent)", color: "white", border: "none", borderRadius: 6, cursor: "pointer", fontSize: "0.82em", fontWeight: 600, whiteSpace: "nowrap" }}
                        >
                            {todayHabitLogged ? "✓ Done" : "Log today"}
                        </button>
                    </div>
                </div>

                {/* News feeds — tabbed */}
                <div style={{ background: "var(--background-secondary)", borderRadius: 10, padding: 12, display: "flex", flexDirection: "column", maxHeight: "66vh", overflow: "hidden" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, flexShrink: 0, gap: 6 }}>
                        <div style={{ display: "flex", gap: 0, background: "var(--background-primary)", borderRadius: 6, overflow: "hidden", border: "1px solid var(--background-modifier-border)", flexShrink: 0 }}>
                            {Object.entries(mobileNewsFeeds).map(([k, f]) => (
                                <button key={k} onClick={() => setMobileNewsTab(k)} style={{ padding: "4px 8px", background: mobileNewsTab === k ? "var(--interactive-accent)" : "transparent", color: mobileNewsTab === k ? "white" : "var(--text-muted)", border: "none", cursor: "pointer", fontSize: "0.72em", fontWeight: 600 }}>{f.label}</button>
                            ))}
                        </div>
                        <select value={curFilter.value} onChange={e => curFilter.onChange(e.target.value)}
                            style={{ flex: 1, minWidth: 0, fontSize: "0.7em", padding: "3px 4px", background: "var(--background-primary)", color: "var(--text-normal)", border: "1px solid var(--background-modifier-border)", borderRadius: 5, cursor: "pointer" }}>
                            {curFilter.options.map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                        <button onClick={() => curFeed?.refresh()} style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--text-faint)", fontSize: "0.9em", flexShrink: 0 }}>⟳</button>
                    </div>
                    {mobileNewsTab === "news" && news?.error ? (
                        <div style={{ fontSize: "0.78em", color: "#f87171" }}>{news.error}</div>
                    ) : feedItems.length === 0 ? (
                        <div style={{ fontSize: "0.78em", color: "var(--text-faint)" }}>Loading…</div>
                    ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: 8, overflowY: "scroll", flex: 1, minHeight: 0, WebkitOverflowScrolling: "touch" }}>
                            {feedItems.map((item, i) => (
                                <a key={i} href={item.url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none", color: "inherit" }}>
                                    <div style={{ fontSize: "0.84em", fontWeight: 500, lineHeight: 1.35, color: "var(--text-normal)" }}>{item.title}</div>
                                    <div style={{ fontSize: "0.68em", color: "var(--text-faint)", marginTop: 2 }}>
                                        {item.score != null && `▲ ${item.score}  `}
                                        {item.comments != null && `💬 ${item.comments}  `}
                                        {item.minutes != null && `${item.minutes} min  `}
                                        {item.reactions != null && `❤️ ${item.reactions}  `}
                                        {item.source && `${item.source}  `}
                                        {item.ago && `${item.ago}`}
                                    </div>
                                </a>
                            ))}
                        </div>
                    )}
                </div>

                {/* Finances */}
                <div style={{ background: "var(--background-secondary)", borderRadius: 10, padding: 12 }}>
                    <div style={{ fontSize: "0.72em", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>💰 Finances — {financeSummary.month}</div>
                    <div style={{ display: "flex", justifyContent: "space-around", marginBottom: 10 }}>
                        <div style={{ textAlign: "center" }}>
                            <div style={{ fontSize: "0.6em", color: "var(--text-faint)" }}>Income</div>
                            <div style={{ fontSize: "1em", fontWeight: 700, color: "#22c55e" }}>{fmtCzk(financeSummary.income)}</div>
                        </div>
                        <div style={{ textAlign: "center" }}>
                            <div style={{ fontSize: "0.6em", color: "var(--text-faint)" }}>Expenses</div>
                            <div style={{ fontSize: "1em", fontWeight: 700, color: "#f87171" }}>{fmtCzk(financeSummary.expenses)}</div>
                        </div>
                        <div style={{ textAlign: "center" }}>
                            <div style={{ fontSize: "0.6em", color: "var(--text-faint)" }}>Net</div>
                            <div style={{ fontSize: "1em", fontWeight: 700, color: financeSummary.net >= 0 ? "#22c55e" : "#f87171" }}>{fmtCzk(financeSummary.net)}</div>
                        </div>
                    </div>
                    {financeSummary.cluster.length > 0 && (
                        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                            {financeSummary.cluster.map((tx, i) => (
                                <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.78em" }}>
                                    <span style={{ color: "var(--text-muted)" }}>{tx.day}. {tx.name}</span>
                                    <span style={{ fontWeight: 600, color: tx.type === "income" ? "#22c55e" : "#f87171" }}>{tx.type === "income" ? "+" : "-"}{fmtCzk(tx.amount)}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

            </div>
        );
    }

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: "100%" }}>

            {/* ── Header ───────────────────────────────────────────────── */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                <div style={{ fontSize: "1.1em", fontWeight: 700, color: "var(--text-accent)", letterSpacing: "0.01em" }}>Codex Vitae</div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ fontSize: "0.88em", fontWeight: 600, padding: "3px 10px", background: "var(--background-secondary)", borderRadius: 20, border: "1px solid var(--background-modifier-border)" }}>
                        📅 {dateStr}
                    </div>
                    {weather && (
                        <div style={{ fontSize: "0.82em", color: "var(--text-muted)", padding: "3px 10px", background: "var(--background-secondary)", borderRadius: 20, border: "1px solid var(--background-modifier-border)" }}>
                            {weather.now} · {weather.place}
                        </div>
                    )}
                    <button onClick={() => setShowSettings(s => !s)} style={{ background: "transparent", border: "1px solid var(--background-modifier-border)", borderRadius: 6, padding: "3px 8px", cursor: "pointer", color: "var(--text-muted)", fontSize: "0.82em" }} title="Settings">⚙️</button>
                </div>
            </div>

            {/* ── Settings overlay ────────────────────────────────────── */}
            {showSettings && (
                <div style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center" }}
                    onClick={e => { if (e.target === e.currentTarget) setShowSettings(false); }}>
                    <div style={{ background: "var(--background-primary)", borderRadius: 12, border: "1px solid var(--background-modifier-border)", width: "min(860px, 92vw)", maxHeight: "85vh", display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: "0 24px 64px rgba(0,0,0,0.5)" }}>
                        {/* Header */}
                        <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--background-modifier-border)", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
                            <span style={{ fontWeight: 700, fontSize: "0.95em", letterSpacing: "0.01em" }}>⚙️ Dashboard Settings</span>
                            <button onClick={() => setShowSettings(false)} style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--text-muted)", fontSize: "1.3em", lineHeight: 1, padding: "0 4px" }}>✕</button>
                        </div>
                        {/* Body */}
                        <div style={{ padding: 24, overflowY: "auto", display: "grid", gridTemplateColumns: "1fr 1fr 1.6fr", gap: 28 }}>
                            {/* ── General ── */}
                            <div>
                                <div style={{ fontSize: "0.68em", color: "var(--interactive-accent)", textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 700, marginBottom: 14, paddingBottom: 6, borderBottom: "1px solid var(--background-modifier-border)" }}>General</div>
                                <div style={{ marginBottom: 14 }}>
                                    <div style={{ fontSize: "0.75em", color: "var(--text-muted)", marginBottom: 6 }}>Weather location</div>
                                    <input type="text" value={weatherLoc} onChange={e => { setWeatherLoc(e.target.value); localStorage.setItem("home:weather-loc", e.target.value); }}
                                        style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid var(--background-modifier-border)", background: "var(--background-secondary)", fontSize: "0.85em", width: "100%", boxSizing: "border-box" }} />
                                </div>
                            </div>
                            {/* ── Feeds ── */}
                            <div>
                                <div style={{ fontSize: "0.68em", color: "var(--interactive-accent)", textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 700, marginBottom: 14, paddingBottom: 6, borderBottom: "1px solid var(--background-modifier-border)" }}>Feeds</div>
                                <div style={{ marginBottom: 14 }}>
                                    <div style={{ fontSize: "0.75em", color: "var(--text-muted)", marginBottom: 6 }}>DEV.to tags (comma-separated)</div>
                                    <input type="text" value={devtoTagsDraft}
                                        onChange={e => setDevtoTagsDraft(e.target.value)}
                                        onBlur={e => {
                                            const ts = e.target.value.split(",").map(t => t.trim().toLowerCase()).filter(Boolean);
                                            setDevtoTags(ts); localStorage.setItem("home:devto-tags", JSON.stringify(ts));
                                        }}
                                        onKeyDown={e => { if (e.key === "Enter") { const ts = e.target.value.split(",").map(t => t.trim().toLowerCase()).filter(Boolean); setDevtoTags(ts); localStorage.setItem("home:devto-tags", JSON.stringify(ts)); e.target.blur(); } }}
                                        style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid var(--background-modifier-border)", background: "var(--background-secondary)", fontSize: "0.85em", width: "100%", boxSizing: "border-box" }} />
                                </div>
                                <div style={{ marginBottom: 14 }}>
                                    <div style={{ fontSize: "0.75em", color: "var(--text-muted)", marginBottom: 6 }}>Lobsters tags (comma-separated)</div>
                                    <input type="text" value={lobstersTagsDraft}
                                        onChange={e => setLobstersTagsDraft(e.target.value)}
                                        onBlur={e => {
                                            const ts = e.target.value.split(",").map(t => t.trim().toLowerCase()).filter(Boolean);
                                            setLobstersTags(ts); localStorage.setItem("home:lobsters-tags", JSON.stringify(ts));
                                        }}
                                        onKeyDown={e => { if (e.key === "Enter") { const ts = e.target.value.split(",").map(t => t.trim().toLowerCase()).filter(Boolean); setLobstersTags(ts); localStorage.setItem("home:lobsters-tags", JSON.stringify(ts)); e.target.blur(); } }}
                                        style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid var(--background-modifier-border)", background: "var(--background-secondary)", fontSize: "0.85em", width: "100%", boxSizing: "border-box" }} />
                                </div>
                            </div>
                            {/* ── RSS Feeds ── */}
                            <div>
                                <div style={{ fontSize: "0.68em", color: "var(--interactive-accent)", textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 700, marginBottom: 14, paddingBottom: 6, borderBottom: "1px solid var(--background-modifier-border)" }}>RSS Feeds</div>
                                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                    {rssFeeds.map((feedUrl, i) => (
                                        <div key={i} style={{ display: "flex", gap: 6, alignItems: "center" }}>
                                            <div style={{ flex: 1, fontSize: "0.78em", color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", padding: "5px 10px", background: "var(--background-secondary)", borderRadius: 5, border: "1px solid var(--background-modifier-border)" }} title={feedUrl}>{feedUrl}</div>
                                            <button onClick={() => { const u = rssFeeds.filter((_, j) => j !== i); setRssFeeds(u); localStorage.setItem("home:rss-feeds", JSON.stringify(u)); setNews(null); loadRssFeeds(true, u); }}
                                                style={{ flexShrink: 0, fontSize: "0.78em", padding: "3px 8px", borderRadius: 5, border: "none", background: "transparent", cursor: "pointer", color: "#f87171" }}>✕</button>
                                        </div>
                                    ))}
                                    <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                                        <input type="text" value={rssInput} onChange={e => setRssInput(e.target.value)} placeholder="https://example.com/feed/"
                                            onKeyDown={e => { if (e.key === "Enter") { const u = rssInput.trim(); if (!u) return; const updated = [...rssFeeds, u]; setRssFeeds(updated); setRssInput(""); localStorage.setItem("home:rss-feeds", JSON.stringify(updated)); setNews(null); loadRssFeeds(true, updated); } }}
                                            style={{ flex: 1, padding: "6px 10px", borderRadius: 6, border: "1px solid var(--background-modifier-border)", background: "var(--background-secondary)", fontSize: "0.85em" }} />
                                        <button onClick={() => { const u = rssInput.trim(); if (!u) return; const updated = [...rssFeeds, u]; setRssFeeds(updated); setRssInput(""); localStorage.setItem("home:rss-feeds", JSON.stringify(updated)); setNews(null); loadRssFeeds(true, updated); }}
                                            style={{ flexShrink: 0, fontSize: "0.85em", padding: "5px 14px", borderRadius: 6, border: "none", background: "var(--interactive-accent)", color: "white", cursor: "pointer" }}>+</button>
                                    </div>
                                    <button onClick={() => { setRssFeeds(DEFAULT_RSS_FEEDS); localStorage.setItem("home:rss-feeds", JSON.stringify(DEFAULT_RSS_FEEDS)); setNews(null); loadRssFeeds(true, DEFAULT_RSS_FEEDS); }}
                                        style={{ alignSelf: "flex-start", marginTop: 2, fontSize: "0.75em", padding: "4px 10px", borderRadius: 5, border: "1px solid var(--background-modifier-border)", background: "transparent", cursor: "pointer", color: "var(--text-muted)" }}>↺ Reset to defaults</button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Pillar cards ─────────────────────────────────────────── */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8 }}>
                {pillars.map(p => (
                    <div key={p.name} onClick={() => V.openNote(p.path)} style={{ cursor: "pointer", padding: "10px 12px", borderRadius: 10, background: "var(--background-secondary)", borderLeft: `3px solid ${p.color}`, display: "flex", flexDirection: "column", gap: 3 }}>
                        <div style={{ fontSize: "1.1em" }}>{p.icon}</div>
                        <div style={{ fontWeight: 600, fontSize: "0.88em" }}>{p.name}</div>
                        <div style={{ fontSize: "0.78em" }}>{p.kpi}</div>
                        <div style={{ fontSize: "0.68em", color: "var(--text-muted)" }}>{p.sub}</div>
                    </div>
                ))}
            </div>

            {/* ── Main row: Finance | Habits | Food | Active+LeetCode ──── */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 0.8fr 0.8fr 1fr", gap: 10 }}>

                {/* Finance — spans 2 rows */}
                <div style={{ background: "var(--background-secondary)", padding: 12, borderRadius: 10, gridRow: "span 2" }}>
                    <PanelHeader label={`Finances — ${financeSummary.month}`} onClick={() => V.openNote("Systems/Finances/Finances.md")} />
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 6, marginBottom: 8 }}>
                        <div><div style={{ fontSize: "0.62em", color: "var(--text-muted)" }}>Income</div><div style={{ fontWeight: 600, color: "#34d399", fontSize: "0.82em" }}>{fmtCzk(financeSummary.income)}</div></div>
                        <div><div style={{ fontSize: "0.62em", color: "var(--text-muted)" }}>Expenses</div><div style={{ fontWeight: 600, color: "#f87171", fontSize: "0.82em" }}>{fmtCzk(financeSummary.expenses)}</div></div>
                        <div><div style={{ fontSize: "0.62em", color: "var(--text-muted)" }}>Net</div><div style={{ fontWeight: 600, color: financeSummary.net >= 0 ? "#34d399" : "#f87171", fontSize: "0.82em" }}>{fmtCzk(financeSummary.net)}</div></div>
                    </div>
                    <div style={{ fontSize: "0.62em", color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 4 }}>Upcoming events</div>
                    {financeSummary.cluster.length > 0
                        ? financeSummary.cluster.map(tx => (
                            <div key={tx.name} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.76em", padding: "2px 0", borderBottom: "1px solid var(--background-modifier-border)" }}>
                                <span style={{ color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "64%" }}>{tx.day ? `${tx.day}. ` : ""}{tx.name}</span>
                                <span style={{ color: tx.type === "income" ? "#34d399" : "#f87171", flexShrink: 0 }}>{tx.type === "income" ? "+" : "−"}{fmtCzk(tx.amount)}</span>
                            </div>
                        ))
                        : <div style={{ fontSize: "0.75em", color: "var(--text-faint)" }}>None left this month 🎉</div>
                    }
                </div>

                {/* Habits — spans 2 rows */}
                <div style={{ gridRow: "span 2", minWidth: 0, background: "var(--background-secondary)", padding: 12, borderRadius: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, minHeight: "24px" }}>
                        <div style={{ fontSize: "0.75em", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", cursor: "pointer" }} onClick={() => V.openNote("Systems/Habits/Habits.md")}>Habits</div>
                        <div style={{ fontSize: "0.7em" }}>
                            <SearchableSelect
                                value={selectedHabit}
                                options={[{ value: "__all__", label: `All (${habitsData.totalHabits})` }, ...habitsData.habitFiles.map(f => ({ value: f.path, label: f.basename }))]}
                                onValueChange={v => setSelectedHabit(v)}
                            />
                        </div>
                    </div>
                    {/* This week */}
                    <div style={{ marginBottom: 6 }}>
                        <div style={{ fontSize: "0.6em", color: "var(--text-faint)", marginBottom: 3 }}>This week</div>
                        <div style={{ display: "flex", gap: 3 }}>
                            {habitsData.weekDays.map((day, i) => {
                                const count = selectedHabit === "__all__" ? habitsData.weekCountsAgg[day] ?? 0 : (habitLogSet?.has(day) ? 1 : 0);
                                const total = selectedHabit === "__all__" ? habitsData.totalHabits : 1;
                                const isToday = day === todayStr;
                                const isFuture = day > todayStr;
                                return (
                                    <div key={day} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                                        <div style={{ fontSize: "0.58em", color: isToday ? "var(--text-accent)" : "var(--text-faint)", fontWeight: isToday ? 700 : 400 }}>{weekdayLabels[i]}</div>
                                         <div onClick={() => selectedHabit !== "__all__" ? toggleHabitDay(selectedHabit, day) : V.openNote("Systems/Habits/Habits.md")} style={{ width: "100%", aspectRatio: "1", borderRadius: 3, cursor: "pointer", background: isFuture ? "transparent" : heatColor(count, total, selectedHabit !== "__all__"), border: isFuture ? "1px solid var(--background-modifier-border)" : "none", outline: isToday ? "2px solid var(--text-accent)" : "none", outlineOffset: 1 }} title={`${day}: ${count}/${total}`} />
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                    {/* 28-day grid */}
                    <div>
                        <div style={{ fontSize: "0.6em", color: "var(--text-faint)", marginBottom: 3 }}>Last 28 days</div>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 3 }}>
                            {habitsData.days28.map(day => {
                                const count = selectedHabit === "__all__" ? habitsData.dayCountsAgg[day] ?? 0 : (habitLogSet?.has(day) ? 1 : 0);
                                const total = selectedHabit === "__all__" ? habitsData.totalHabits : 1;
                                const isToday = day === todayStr;
                                const dayNum = parseInt(day.slice(8));
                                const weekLetters = ["S","M","T","W","T","F","S"];
                                const dayLetter = weekLetters[new Date(day).getDay()];
                                return (
                                    <div key={day} title={`${day}: ${count}/${total}`}
                                        onClick={() => selectedHabit !== "__all__" ? toggleHabitDay(selectedHabit, day) : V.openNote("Systems/Habits/Habits.md")}
                                        style={{ borderRadius: 4, background: heatColor(count, total, selectedHabit !== "__all__"), outline: isToday ? "2px solid var(--text-accent)" : "none", outlineOffset: 1, textAlign: "center", fontSize: "0.58em", lineHeight: 1.1, cursor: "pointer", color: count > 0 ? "rgba(255,255,255,0.8)" : "var(--text-faint)", padding: "3px 2px" }}>
                                        <div>{dayNum}</div>
                                        <div style={{ fontSize: "0.8em", opacity: 0.7 }}>{dayLetter}</div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* Food Today — spans 2 rows */}
                {foodData ? (
                <div style={{ gridRow: "span 2", minWidth: 0, background: "var(--background-secondary)", padding: 12, borderRadius: 10, display: "flex", flexDirection: "column" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, minHeight: "24px" }}>
                        <div style={{ fontSize: "0.75em", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", cursor: "pointer" }} onClick={() => V.openNote("Systems/Food/Food.md")}>Food Today</div>
                        <button onClick={clearFood} title="Clear all" style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--text-faint)", fontSize: "0.82em", padding: "0 2px" }}>🗑</button>
                    </div>
                    {/* Add row */}
                    <div style={{ display: "flex", gap: 4, marginBottom: 10, fontSize: "0.72em", alignItems: "center" }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <SearchableSelect
                                value={foodPicked}
                                options={[{ value: "", label: "Pick food…" }, ...foodData.foodOptions]}
                                onValueChange={v => setFoodPicked(v)}
                                style={{ width: "100%" }}
                            />
                        </div>
                        <input type="number" value={foodAmt} onChange={e => setFoodAmt(e.target.value)} placeholder="1" min="0.1" step="0.5"
                            style={{ width: 44, fontSize: "1em", padding: "3px 4px", borderRadius: 4, border: "1px solid var(--background-modifier-border)", background: "var(--background-primary)", textAlign: "center" }} />
                        <button onClick={addFood} disabled={!foodPicked || foodSaving}
                            style={{ fontSize: "1em", padding: "3px 10px", borderRadius: 4, border: "none", background: "#16a34a", color: "#fff", cursor: "pointer", opacity: (!foodPicked || foodSaving) ? 0.5 : 1 }}>+</button>
                    </div>
                    {/* Macro bars */}
                    <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                        <MacroBar label="Calories" val={Math.round(foodData.tot.kcal)} goal={foodData.goals.kcal} color="#f59e0b" />
                        <MacroBar label="Protein" val={r1(foodData.tot.protein)} goal={foodData.goals.protein} color="#34d399" />
                        <MacroBar label="Carbs" val={r1(foodData.tot.carbs)} goal={foodData.goals.carbs} color="#60a5fa" />
                        <MacroBar label="Fat" val={r1(foodData.tot.fat)} goal={foodData.goals.fat} color="#f87171" />
                        <MacroBar label="Fiber" val={r1(foodData.tot.fiber)} goal={foodData.goals.fiber} color="#a78bfa" />
                    </div>
                    <div style={{ fontSize: "0.62em", color: "var(--text-faint)", marginTop: 6, textAlign: "right" }}>{foodData.rows.length} item{foodData.rows.length !== 1 ? "s" : ""} logged</div>
                </div>
                ) : (
                <div style={{ gridRow: "span 2", minWidth: 0, background: "var(--background-secondary)", padding: 12, borderRadius: 10, fontSize: "0.76em", color: "var(--text-faint)" }}>Food.md not found</div>
                )}

                {/* Active Projects */}
                <div style={{ background: "var(--background-secondary)", padding: 12, borderRadius: 10, minHeight: 80 }}>
                        <PanelHeader label="Active Projects" onClick={() => V.openNote("Systems/Projects/Projects.md")} />
                        {activeProjects.length === 0
                            ? <div style={{ fontSize: "0.8em", color: "var(--text-faint)" }}>No active projects 🎉</div>
                            : <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                                {activeProjects.map(p => (
                                    <div key={p.path} onClick={() => V.openNote(p.path)} style={{ cursor: "pointer", padding: "5px 8px", borderRadius: 6, borderLeft: "2px solid #fbbf24", background: "var(--background-primary)" }}
                                        onMouseEnter={e => e.currentTarget.style.background = "var(--background-modifier-hover)"}
                                        onMouseLeave={e => e.currentTarget.style.background = "var(--background-primary)"}>
                                        <div style={{ fontSize: "0.82em", fontWeight: 500 }}>{p.name}</div>
                                        {p.sub && <div style={{ fontSize: "0.68em", color: "var(--text-muted)" }}>{p.sub}</div>}
                                    </div>
                                ))}
                            </div>
                        }
                    </div>

                    {/* LeetCode */}
                    <div style={{ background: "var(--background-secondary)", padding: 12, borderRadius: 10 }}>
                        <PanelHeader label="LeetCode" onClick={() => V.openNote("Systems/Leetcode/Leetcode.md")} />
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 4, marginBottom: 8 }}>
                            <div><div style={{ fontSize: "0.6em", color: "#34d399" }}>Easy</div><div style={{ fontWeight: 600, fontSize: "0.82em", color: "#34d399" }}>{leetcodeStats.easy}</div></div>
                            <div><div style={{ fontSize: "0.6em", color: "#fbbf24" }}>Med</div><div style={{ fontWeight: 600, fontSize: "0.82em", color: "#fbbf24" }}>{leetcodeStats.medium}</div></div>
                            <div><div style={{ fontSize: "0.6em", color: "#f87171" }}>Hard</div><div style={{ fontWeight: 600, fontSize: "0.82em", color: "#f87171" }}>{leetcodeStats.hard}</div></div>
                        </div>
                        <div style={{ fontSize: "0.66em", color: "var(--text-faint)", marginBottom: 6 }}>{leetcodeStats.solved}/{leetcodeStats.total} solved</div>
                        {leetcodeStats.challenge && (
                            <div onClick={() => V.openNote(leetcodeStats.challenge.path)} style={{ cursor: "pointer", padding: "5px 8px", borderRadius: 6, borderLeft: `2px solid ${leetcodeStats.challenge.difficulty?.toLowerCase() === "easy" ? "#34d399" : leetcodeStats.challenge.difficulty?.toLowerCase() === "hard" ? "#f87171" : "#fbbf24"}`, background: "var(--background-primary)", fontSize: "0.78em" }}>
                                <div style={{ fontWeight: 500 }}>{leetcodeStats.challenge.name}</div>
                                <div style={{ fontSize: "0.8em", color: "var(--text-faint)" }}>Try this next</div>
                            </div>
                        )}
                        {!leetcodeStats.challenge && leetcodeStats.total > 0 && <div style={{ fontSize: "0.76em", color: "#34d399" }}>All solved! 🏆</div>}
                        {leetcodeStats.total === 0 && <div style={{ fontSize: "0.76em", color: "var(--text-faint)" }}>No problems yet</div>}
                        {leetcodeDaily && (
                            <a href={leetcodeDaily.url} target="_blank" rel="noopener" style={{ display: "block", marginTop: 8, padding: "5px 8px", borderRadius: 6, background: "var(--background-primary)", borderLeft: `2px solid ${leetcodeDaily.difficulty === "Easy" ? "#34d399" : leetcodeDaily.difficulty === "Hard" ? "#f87171" : "#fbbf24"}`, fontSize: "0.78em", color: "var(--text-normal)", textDecoration: "none" }}>
                                <div style={{ fontWeight: 500 }}>📅 {leetcodeDaily.title}</div>
                                <div style={{ fontSize: "0.8em", color: "var(--text-faint)" }}>Daily challenge</div>
                            </a>
                        )}
                    </div>
            </div>

            {/* ── Two-column body ───────────────────────────────────────── */}
            <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: 12 }}>

                {/* Left: recently edited + notes */}
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>

                    {/* Recently edited — compact */}
                    <div style={{ background: "var(--background-secondary)", padding: "10px 12px", borderRadius: 10 }}>
                        <PanelHeader label="Recently edited" />
                        <div style={{ display: "flex", flexDirection: "column" }}>
                            {recent.map(f => (
                                <div key={f.path} onClick={() => V.openNote(f.path)} style={{ cursor: "pointer", padding: "3px 6px", borderRadius: 5, display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10 }}
                                    onMouseEnter={e => e.currentTarget.style.background = "var(--background-modifier-hover)"}
                                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                                    <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: "0.86em" }}>{f.basename}</div>
                                    <div style={{ fontSize: "0.66em", color: "var(--text-faint)", flexShrink: 0 }}>{f.path.split("/").slice(0, -1).join(" / ")}</div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Discovery Queue — Rediscover + Attention side by side */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                        {/* Rediscover queue */}
                        <div style={{ background: "var(--background-secondary)", padding: 10, borderRadius: 10 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, minHeight: "24px" }}>
                                <div style={{ fontSize: "0.75em", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>🎲 Rediscover</div>
                                {discoveryQueue.random.length > 1 && (
                                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                        <button onClick={() => setDiscoverIdx(i => (i - 1 + discoveryQueue.random.length) % discoveryQueue.random.length)} style={{ background: "transparent", border: "1px solid var(--background-modifier-border)", borderRadius: 4, padding: "0 5px", cursor: "pointer", color: "var(--text-muted)", fontSize: "0.7em" }}>‹</button>
                                        <span style={{ fontSize: "0.65em", color: "var(--text-faint)" }}>{discoverIdx + 1}/{discoveryQueue.random.length}</span>
                                        <button onClick={() => setDiscoverIdx(i => (i + 1) % discoveryQueue.random.length)} style={{ background: "transparent", border: "1px solid var(--background-modifier-border)", borderRadius: 4, padding: "0 5px", cursor: "pointer", color: "var(--text-muted)", fontSize: "0.7em" }}>›</button>
                                    </div>
                                )}
                            </div>
                            {discoveryQueue.random[discoverIdx]
                                ? <div onClick={() => V.openNote(discoveryQueue.random[discoverIdx].path)} style={{ cursor: "pointer" }}
                                      onMouseEnter={e => e.currentTarget.style.opacity = "0.75"}
                                      onMouseLeave={e => e.currentTarget.style.opacity = "1"}>
                                    <div style={{ fontWeight: 500, fontSize: "0.86em" }}>{discoveryQueue.random[discoverIdx].basename}</div>
                                    <div style={{ fontSize: "0.68em", color: "var(--text-faint)", marginTop: 2 }}>{discoveryQueue.random[discoverIdx].path.split("/").slice(0,-1).join(" / ")}</div>
                                  </div>
                                : <div style={{ fontSize: "0.76em", color: "var(--text-faint)" }}>No notes yet</div>
                            }
                        </div>
                        {/* Needs Attention queue (vault-wide lint) */}
                        <div style={{ background: "var(--background-secondary)", padding: 10, borderRadius: 10, borderLeft: attentionQueue.length > 0 ? "2px solid #fbbf24" : "2px solid var(--background-modifier-border)" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, minHeight: "24px" }}>
                                <div style={{ fontSize: "0.75em", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>⚠️ Needs Attention</div>
                                {attentionQueue.length > 1 && (
                                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                        <button onClick={() => setAttentionIdx(i => (i - 1 + attentionQueue.length) % attentionQueue.length)} style={{ background: "transparent", border: "1px solid var(--background-modifier-border)", borderRadius: 4, padding: "0 5px", cursor: "pointer", color: "var(--text-muted)", fontSize: "0.7em" }}>‹</button>
                                        <span style={{ fontSize: "0.65em", color: "var(--text-faint)" }}>{(attentionIdx % attentionQueue.length) + 1}/{attentionQueue.length}</span>
                                        <button onClick={() => setAttentionIdx(i => (i + 1) % attentionQueue.length)} style={{ background: "transparent", border: "1px solid var(--background-modifier-border)", borderRadius: 4, padding: "0 5px", cursor: "pointer", color: "var(--text-muted)", fontSize: "0.7em" }}>›</button>
                                    </div>
                                )}
                            </div>
                            {attentionQueue[attentionIdx % Math.max(1, attentionQueue.length)]
                                ? (() => {
                                    const item = attentionQueue[attentionIdx % attentionQueue.length];
                                    const sevColor = item.severity === "high" ? "#ef4444" : item.severity === "medium" ? "#fbbf24" : "var(--text-muted)";
                                    return (
                                        <div onClick={() => V.openNote(item.path)} style={{ cursor: "pointer" }}
                                              onMouseEnter={e => e.currentTarget.style.opacity = "0.75"}
                                              onMouseLeave={e => e.currentTarget.style.opacity = "1"}>
                                            <div style={{ fontWeight: 500, fontSize: "0.86em" }}>{item.name}</div>
                                            <div style={{ fontSize: "0.68em", color: sevColor, marginTop: 2 }}>
                                                {item.pillar} · {item.issue}{item.count > 1 ? ` (+${item.count - 1} more)` : ""}
                                            </div>
                                        </div>
                                    );
                                })()
                                : <div style={{ fontSize: "0.76em", color: "var(--text-faint)" }}>All clean ✅</div>
                            }
                        </div>
                    </div>
                </div>

                {/* Right sidebar: Quote + On This Day */}
                <div style={{ display: "flex", flexDirection: "column", gap: 10, height: 295, alignSelf: "start" }}>
                    {quote && (
                        <div style={{ background: "var(--background-secondary)", padding: 10, borderRadius: 10, display: "flex", flexDirection: "column", height: 140, overflow: "hidden" }}>
                            <PanelHeader label="Quote of the day" onRefresh={() => loadQuote(true)} />
                            <div style={{ overflowY: "auto", minHeight: 0 }}>
                                <div style={{ fontStyle: "italic", fontSize: "0.84em", lineHeight: 1.5 }}>"{quote.content}"</div>
                                <div style={{ fontSize: "0.7em", color: "var(--text-muted)", marginTop: 4, textAlign: "right" }}>— {quote.author}</div>
                            </div>
                        </div>
                    )}

                    {onThisDay && (
                        <div style={{ background: "var(--background-secondary)", padding: 10, borderRadius: 10, display: "flex", flexDirection: "column", flexGrow: 1, overflow: "hidden", minHeight: 0 }}>
                            <PanelHeader label="On this day" onRefresh={() => loadOnThisDay(true)} />
                            <div style={{ display: "flex", flexDirection: "column", gap: 10, flexGrow: 1, overflowY: "auto", minHeight: 0 }}>
                                {onThisDay.map((e, i) => (
                                    <div key={i} style={{ fontSize: "0.82em", lineHeight: 1.4 }}>
                                        <span style={{ color: "var(--text-accent)", fontWeight: 700, marginRight: 6, fontSize: "0.88em" }}>{e.year}</span>
                                        {e.url
                                            ? <a href={e.url} target="_blank" rel="noopener" style={{ color: "var(--text-normal)", textDecoration: "none" }}>{e.text}</a>
                                            : <span>{e.text}</span>
                                        }
                                    </div>
                                ))}
                            </div>
                            <div style={{ fontSize: "0.66em", color: "var(--text-faint)", marginTop: 6, flexShrink: 0 }}>
                                Wikipedia · {new Date().toLocaleDateString(undefined, { month: "long", day: "numeric" })}
                            </div>
                        </div>
                    )}

                </div>
            </div>

            {/* ── Feeds row: HN | DEV.to | Lobsters | Tech News ─────────────── */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 10, gridAutoRows: "415px" }}>

                {/* Hacker News */}
                <div style={{ background: "var(--background-secondary)", padding: "10px 12px", borderRadius: 10, display: "flex", flexDirection: "column", overflow: "hidden", minHeight: 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, minHeight: "24px" }}>
                        <div style={{ fontSize: "0.75em", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>🟠 Hacker News</div>
                        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                            <select value={hnCategory} onChange={e => { setHnCategory(e.target.value); setHn(null); loadHN(e.target.value); }}
                                style={{ fontSize: "0.7em", padding: "1px 4px", borderRadius: 4, border: "1px solid var(--background-modifier-border)", background: "var(--background-primary)", color: "var(--text-muted)", cursor: "pointer", width: "80px" }}>
                                {[["top","Top"],["ask","Ask"],["show","Show"],["best","Best"]].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                            </select>
                            <button onClick={() => { setHn(null); loadHN(hnCategory, true); }} title="Refresh" style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--text-faint)", fontSize: "0.9em", padding: "0 2px", lineHeight: 1 }}>⟳</button>
                        </div>
                    </div>
                    {hn?.length > 0
                        ? <div style={{ display: "flex", flexDirection: "column", gap: 6, flexGrow: 1, minHeight: 0, overflowY: "auto" }}>
                            {hn.map(s => (
                                <a key={s.title} href={s.url} target="_blank" rel="noopener" style={{ textDecoration: "none", color: "var(--text-normal)", flexShrink: 0 }}>
                                    <div style={{ fontSize: "0.82em", lineHeight: 1.35, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{s.title}</div>
                                    <div style={{ fontSize: "0.66em", color: "var(--text-faint)" }}>▲ {s.score} · 💬 {s.comments}</div>
                                </a>
                            ))}
                        </div>
                        : <div style={{ fontSize: "0.78em", color: "var(--text-faint)" }}>Loading…</div>
                    }
                </div>

                {/* DEV.to */}
                <div style={{ background: "var(--background-secondary)", padding: "10px 12px", borderRadius: 10, display: "flex", flexDirection: "column", overflow: "hidden", minHeight: 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, minHeight: "24px" }}>
                        <div style={{ fontSize: "0.75em", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>🦩 DEV.to</div>
                        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                            <select value={devtoTag} onChange={e => { setDevtoTag(e.target.value); localStorage.setItem("home:devto-tag", e.target.value); setDevto(null); loadDevto(e.target.value); }}
                                style={{ fontSize: "0.7em", padding: "1px 4px", borderRadius: 4, border: "1px solid var(--background-modifier-border)", background: "var(--background-primary)", color: "var(--text-muted)", cursor: "pointer", width: "80px" }}>
                                {devtoTags.map(tag => <option key={tag} value={tag}>#{tag}</option>)}
                            </select>
                            <button onClick={() => { setDevto(null); loadDevto(devtoTag, true); }} title="Refresh" style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--text-faint)", fontSize: "0.9em", padding: "0 2px", lineHeight: 1 }}>⟳</button>
                        </div>
                    </div>
                    {devto?.length > 0
                        ? <div style={{ display: "flex", flexDirection: "column", gap: 6, flexGrow: 1, minHeight: 0, overflowY: "auto" }}>
                            {devto.map(a => (
                                <a key={a.url} href={a.url} target="_blank" rel="noopener" style={{ textDecoration: "none", color: "var(--text-normal)", flexShrink: 0 }}>
                                    <div style={{ fontSize: "0.82em", lineHeight: 1.3, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{a.title}</div>
                                    <div style={{ fontSize: "0.66em", color: "var(--text-faint)" }}>{a.author} · {a.minutes} min · ❤ {a.reactions}</div>
                                </a>
                            ))}
                        </div>
                        : <div style={{ fontSize: "0.78em", color: "var(--text-faint)" }}>Loading…</div>
                    }
                </div>

                {/* Lobsters */}
                <div style={{ background: "var(--background-secondary)", padding: "10px 12px", borderRadius: 10, display: "flex", flexDirection: "column", overflow: "hidden", minHeight: 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, minHeight: "24px" }}>
                        <div style={{ fontSize: "0.75em", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>🦞 Lobsters</div>
                        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                            <select value={lobstersTag} onChange={e => { setLobstersTag(e.target.value); localStorage.setItem("home:lobsters-tag", e.target.value); setLobsters(null); loadLobsters(false, e.target.value); }}
                                style={{ fontSize: "0.7em", padding: "1px 4px", borderRadius: 4, border: "1px solid var(--background-modifier-border)", background: "var(--background-primary)", color: "var(--text-muted)", cursor: "pointer", width: "80px" }}>
                                {["hottest", ...lobstersTags].map(t => <option key={t} value={t}>{t === "hottest" ? "Hottest" : t}</option>)}
                            </select>
                            <button onClick={() => { setLobsters(null); loadLobsters(true, lobstersTag); }} title="Refresh" style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--text-faint)", fontSize: "0.9em", padding: "0 2px", lineHeight: 1 }}>⟳</button>
                        </div>
                    </div>
                    {lobsters?.length > 0
                        ? <div style={{ display: "flex", flexDirection: "column", gap: 6, flexGrow: 1, minHeight: 0, overflowY: "auto" }}>
                            {lobsters.map(s => (
                                <a key={s.url} href={s.url} target="_blank" rel="noopener" style={{ textDecoration: "none", color: "var(--text-normal)", flexShrink: 0 }}>
                                    <div style={{ fontSize: "0.82em", lineHeight: 1.35, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{s.title}</div>
                                    <div style={{ fontSize: "0.66em", color: "var(--text-faint)" }}>▲ {s.score} · 💬 {s.comments}{s.tags?.length ? " · " + s.tags.map(t => "#" + t).join(" ") : ""}</div>
                                </a>
                            ))}
                          </div>
                        : <div style={{ fontSize: "0.78em", color: "var(--text-faint)" }}>Loading…</div>
                    }
                </div>

                {/* RSS Tech News */}
                <div style={{ background: "var(--background-secondary)", padding: "10px 12px", borderRadius: 10, display: "flex", flexDirection: "column", overflow: "hidden", minHeight: 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, minHeight: "24px" }}>
                        <div style={{ fontSize: "0.75em", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>📰 Tech News</div>
                        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                            {Array.isArray(news) && news.length > 0 && (() => {
                                const sources = ["All", ...new Set(news.map(a => a.source).filter(Boolean))];
                                const selStyle = { fontSize: "0.7em", padding: "1px 4px", borderRadius: 4, border: "1px solid var(--background-modifier-border)", background: "var(--background-primary)", color: "var(--text-muted)", cursor: "pointer", width: "80px" };
                                return sources.length > 2
                                    ? <select value={newsSourceFilter} onChange={e => setNewsSourceFilter(e.target.value)} style={selStyle}>
                                        {sources.map(s => <option key={s} value={s}>{s}</option>)}
                                      </select>
                                    : null;
                            })()}
                            <button onClick={() => { setNews(null); setNewsSourceFilter("All"); setNewsCatFilter("All"); loadRssFeeds(true); }} title="Refresh" style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--text-faint)", fontSize: "0.9em", padding: "0 2px", lineHeight: 1 }}>⟳</button>
                        </div>
                    </div>
                    {Array.isArray(news) && news.length > 0
                        ? (() => {
                            // When filtered to a specific source/category, show all matching articles
                            // When showing "All", apply a soft balance (max 4 per source) to avoid one feed dominating
                            let filtered = news.filter(a =>
                                (newsSourceFilter === "All" || a.source === newsSourceFilter) &&
                                (newsCatFilter    === "All" || (a.categories ?? []).includes(newsCatFilter))
                            );
                            if (newsSourceFilter === "All" && newsCatFilter === "All") {
                                const counts = {};
                                filtered = filtered.filter(a => {
                                    counts[a.source] = (counts[a.source] ?? 0) + 1;
                                    return counts[a.source] <= 4;
                                });
                            }
                            return <div style={{ display: "flex", flexDirection: "column", gap: 6, flexGrow: 1, minHeight: 0, overflowY: "auto" }}>
                                {filtered.map(a => (
                                    <a key={a.url} href={a.url} target="_blank" rel="noopener" style={{ textDecoration: "none", color: "var(--text-normal)", flexShrink: 0 }}>
                                        <div style={{ fontSize: "0.82em", lineHeight: 1.35, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{a.title}</div>
                                        <div style={{ fontSize: "0.66em", color: "var(--text-faint)" }}>{a.source}{a.ago ? " · " + a.ago + " ago" : ""}</div>
                                    </a>
                                ))}
                              </div>;
                          })()
                        : news?.error
                          ? <div style={{ fontSize: "0.76em", color: "#f87171" }}>{news.error}</div>
                          : !news
                            ? <div style={{ fontSize: "0.78em", color: "var(--text-faint)" }}>Loading…</div>
                            : <div style={{ fontSize: "0.78em", color: "var(--text-faint)" }}>No articles found</div>
                    }
                </div>

            </div>
            {/* ── Quick capture ────────────────────────────────────────── */}
            <div style={{ display: "flex", gap: 8, padding: "8px 12px", background: "var(--background-secondary)", borderRadius: 10, alignItems: "center", position: "sticky", bottom: 0 }}>
                <span>📥</span>
                <input type="text" value={captureText} onChange={e => setCaptureText(e.target.value)} onKeyDown={e => { if (e.key === "Enter") quickCapture(); }}
                    placeholder="Quick capture to Inbox… (Enter to save)"
                    style={{ flex: 1, padding: "5px 10px", borderRadius: 6, border: "1px solid var(--background-modifier-border)", background: "var(--background-primary)", color: "var(--text-normal)", fontSize: "0.9em" }} />
                <button onClick={quickCapture} disabled={capturing || !captureText.trim()}
                    style={{ padding: "5px 12px", borderRadius: 6, border: "1px solid var(--background-modifier-border)", background: "var(--interactive-accent)", color: "white", cursor: "pointer", opacity: capturing || !captureText.trim() ? 0.5 : 1, fontSize: "0.9em" }}>
                    {capturing ? "Saving…" : "Capture"}
                </button>
            </div>
        </div>
    );
};
```
