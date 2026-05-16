// Systems/Oraculum/Modules/Cache.js
// TTL-based localStorage cache shared by Tools.js (transcripts, social metadata)
// and Research.js (Gemini 2.5 Flash grounded responses).
//
// Loaded with: const C = await dc.require("Systems/Oraculum/Modules/Cache.js");
//
// Why localStorage and not the vault: cache entries can grow large and we
// don't want them syncing across devices or polluting the vault. Persistent
// research RESULTS live in vault JSON (Research.js); only transient API
// responses live here.

const PREFIX = "oraculum:cache:";

const TTL = {
    TRANSCRIPT_MS: 30 * 24 * 60 * 60 * 1000,
    DEFAULT_MS:     7 * 24 * 60 * 60 * 1000,
    RESEARCH_MS:   30 * 24 * 60 * 60 * 1000,
    METADATA_MS:    7 * 24 * 60 * 60 * 1000,
};

function get(key, ttl = TTL.DEFAULT_MS) {
    if (typeof localStorage === "undefined") return null;
    try {
        const raw = localStorage.getItem(PREFIX + key);
        if (!raw) return null;
        const { cachedAt, data } = JSON.parse(raw);
        if (Date.now() - new Date(cachedAt).getTime() > ttl) {
            localStorage.removeItem(PREFIX + key);
            return null;
        }
        return data;
    } catch { return null; }
}

function set(key, data) {
    if (typeof localStorage === "undefined") return;
    try {
        localStorage.setItem(PREFIX + key, JSON.stringify({
            cachedAt: new Date().toISOString(),
            data,
        }));
    } catch (e) {
        console.warn("Oraculum cache write failed:", e);
        // Best-effort eviction: if we hit quota, dump the oldest cache entries
        if (e?.name === "QuotaExceededError") {
            try { evictOldest(20); localStorage.setItem(PREFIX + key, JSON.stringify({ cachedAt: new Date().toISOString(), data })); } catch {}
        }
    }
}

function remove(key) {
    if (typeof localStorage === "undefined") return;
    try { localStorage.removeItem(PREFIX + key); } catch {}
}

function clearAll(filter) {
    if (typeof localStorage === "undefined") return 0;
    let removed = 0;
    for (let i = localStorage.length - 1; i >= 0; i--) {
        const k = localStorage.key(i);
        if (k && k.startsWith(PREFIX) && (!filter || k.includes(filter))) {
            localStorage.removeItem(k);
            removed++;
        }
    }
    return removed;
}

function evictOldest(n) {
    if (typeof localStorage === "undefined") return;
    const entries = [];
    for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (!k || !k.startsWith(PREFIX)) continue;
        try {
            const v = JSON.parse(localStorage.getItem(k));
            entries.push({ k, ts: new Date(v.cachedAt).getTime() });
        } catch { localStorage.removeItem(k); }
    }
    entries.sort((a, b) => a.ts - b.ts);
    for (const e of entries.slice(0, n)) localStorage.removeItem(e.k);
}

function stats() {
    if (typeof localStorage === "undefined") return { count: 0, bytes: 0 };
    let count = 0, bytes = 0;
    for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (!k || !k.startsWith(PREFIX)) continue;
        count++;
        bytes += (localStorage.getItem(k) ?? "").length;
    }
    return { count, bytes };
}

return { get, set, remove, clearAll, stats, TTL };
