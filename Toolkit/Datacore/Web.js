// Toolkit/Datacore/Web.js
// Shared HTTP and web-scraping helpers for Datacore dashboards.
// Load with: const W = await dc.require("Toolkit/Datacore/Web.js");
//
// All functions work in both plugin contexts (where Obsidian's `requestUrl`
// is globally available) and in Datacore's VM (where it may not be).

/**
 * Fetch a URL and return { ok, status, text, json }.
 * Prefers Obsidian's requestUrl (bypasses CORS, runs on Electron's Node side)
 * over the browser fetch() API when available.
 */
async function httpGet(url) {
    if (typeof requestUrl !== "undefined") {
        const r = await requestUrl({ url });
        let json;
        try { json = JSON.parse(r.text); } catch (_) {}
        return { ok: r.status < 400, status: r.status, text: r.text, json };
    }
    const r = await fetch(url);
    const text = await r.text();
    let json;
    try { json = JSON.parse(text); } catch (_) {}
    return { ok: r.ok, status: r.status, text, json };
}

/**
 * JSON-aware HTTP helper. Supports GET/POST with JSON bodies and custom headers.
 * Returns { ok, status, data, error } where `data` is parsed JSON on success
 * and `error` is a human-readable string on failure (network, non-2xx, parse).
 *
 * @param {string} url
 * @param {object} opts  { method?, headers?, body?, throw? }
 *   - method:  HTTP method (default GET)
 *   - headers: extra headers (Content-Type defaults to application/json on POST/PUT)
 *   - body:    object — auto-stringified as JSON; or string — sent as-is
 *   - throw:   if true, throws on non-2xx instead of returning { error }
 */
async function httpJson(url, opts = {}) {
    const method  = (opts.method ?? "GET").toUpperCase();
    const hasBody = opts.body != null;
    const headers = {
        "Accept": "application/json",
        ...(hasBody && (method === "POST" || method === "PUT" || method === "PATCH")
            ? { "Content-Type": "application/json" }
            : {}),
        ...(opts.headers ?? {}),
    };
    const body = hasBody
        ? (typeof opts.body === "string" ? opts.body : JSON.stringify(opts.body))
        : undefined;

    let status, text;
    try {
        if (typeof requestUrl !== "undefined") {
            const r = await requestUrl({ url, method, headers, body, throw: false });
            status = r.status; text = r.text;
        } else {
            const r = await fetch(url, { method, headers, body });
            status = r.status; text = await r.text();
        }
    } catch (e) {
        const err = `Network error: ${e?.message ?? e}`;
        if (opts.throw) throw new Error(err);
        return { ok: false, status: 0, error: err };
    }

    let data;
    try { data = text ? JSON.parse(text) : null; } catch (_) { data = null; }

    if (status >= 400) {
        const msg = data?.error?.message ?? data?.message ?? data?.error ?? text?.slice(0, 200) ?? "unknown error";
        const err = `HTTP ${status}: ${msg}`;
        if (opts.throw) throw new Error(err);
        return { ok: false, status, data, error: err };
    }
    return { ok: true, status, data };
}

/**
 * Binary HTTP fetch. Returns { ok, status, bytes (Uint8Array), mimeType, error }.
 * Used for image/file downloads (e.g. Pollinations image generation).
 */
async function httpBinary(url, opts = {}) {
    const method  = (opts.method ?? "GET").toUpperCase();
    const headers = opts.headers ?? {};

    try {
        if (typeof requestUrl !== "undefined") {
            const r = await requestUrl({ url, method, headers, throw: false });
            if (r.status >= 400) {
                return { ok: false, status: r.status, error: `HTTP ${r.status}: ${r.text?.slice(0, 200) ?? ""}` };
            }
            const ab = r.arrayBuffer;
            const bytes = new Uint8Array(ab);
            const mimeType = r.headers?.["content-type"] ?? r.headers?.["Content-Type"] ?? "application/octet-stream";
            return { ok: true, status: r.status, bytes, mimeType };
        }
        const r = await fetch(url, { method, headers });
        if (!r.ok) {
            const text = await r.text().catch(() => "");
            return { ok: false, status: r.status, error: `HTTP ${r.status}: ${text.slice(0, 200)}` };
        }
        const ab = await r.arrayBuffer();
        const mimeType = r.headers.get("content-type") ?? "application/octet-stream";
        return { ok: true, status: r.status, bytes: new Uint8Array(ab), mimeType };
    } catch (e) {
        return { ok: false, status: 0, error: `Network error: ${e?.message ?? e}` };
    }
}

/**
 * Scrape a URL and return its plain-text content.
 *
 * Strategy:
 *   1. Direct fetch + DOMParser (works for static/SSR pages).
 *   2. If content is sparse (<200 chars), fall back to Jina Reader (r.jina.ai)
 *      which renders JS-heavy SPAs server-side and returns clean markdown.
 *
 * Returns:
 *   { url, title, description, content, char_count, truncated, method }
 *   or { error, url } on failure.
 *
 * @param {string} url     Target URL
 * @param {number} limit   Max characters to return (capped at 12000)
 */
async function fetchPageText(url, limit = 6000) {
    const cap = Math.min(limit, 12000);
    let directContent = "";
    let title = null;
    let description = null;

    // ── Step 1: direct fetch ─────────────────────────────────────────────────
    try {
        const res = await httpGet(url);
        if (res.ok && res.text) {
            const doc = new DOMParser().parseFromString(res.text, "text/html");

            // Strip chrome/noise elements
            for (const tag of ["script", "style", "nav", "header", "footer", "aside", "noscript", "svg", "iframe"]) {
                doc.querySelectorAll(tag).forEach(el => el.remove());
            }
            doc.querySelectorAll('[aria-hidden="true"], [hidden]').forEach(el => el.remove());

            // Prefer semantic content root
            const root = doc.querySelector("main, article, [role='main']") ?? doc.body;
            directContent = (root?.innerText ?? root?.textContent ?? "").replace(/\s{3,}/g, "\n\n").trim();

            title = doc.querySelector("title")?.textContent?.trim() ?? null;
            description = doc.querySelector('meta[name="description"]')?.getAttribute("content")
                       ?? doc.querySelector('meta[property="og:description"]')?.getAttribute("content")
                       ?? null;
        }
    } catch (_) {}

    // ── Step 2: Jina Reader fallback for JS-rendered pages ───────────────────
    if (directContent.length < 200) {
        try {
            const jinaRes = await httpGet(`https://r.jina.ai/${url}`);
            if (jinaRes.ok && jinaRes.text && jinaRes.text.trim().length > directContent.length) {
                const content = jinaRes.text.trim();
                return {
                    url,
                    title,
                    description,
                    content: content.slice(0, cap),
                    truncated: content.length > cap,
                    char_count: Math.min(content.length, cap),
                    method: "jina",
                };
            }
        } catch (_) {}
    }

    if (!directContent) {
        return { error: "Could not extract text. The site may require JavaScript rendering.", url };
    }

    return {
        url,
        title,
        description,
        content: directContent.slice(0, cap),
        truncated: directContent.length > cap,
        char_count: Math.min(directContent.length, cap),
        method: "direct",
    };
}

return { httpGet, httpJson, httpBinary, fetchPageText };
