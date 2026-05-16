// Gemini API client for Oraculum.
// Loaded with: const G = await dc.require("Systems/Oraculum/Modules/GeminiClient.js");
//
// API key is stored in localStorage under "oraculum:gemini-api-key".
// The Oraculum chat UI handles first-run key setup — no manual DevTools needed.
// Note: Obsidian's secretStorage is plugin-only and not accessible from Datacore JSX.
//
// Uses Gemini API NATIVE function calling (per Google docs for Gemma 4 on Gemini API).
// CRITICAL: Schema types MUST be UPPERCASE ("OBJECT", "STRING", "NUMBER", "BOOLEAN", "ARRAY").
// CRITICAL: Do NOT send `toolConfig` — Gemma 4 does not support it and returns 500 if present.

// ─── Model configuration ────────────────────────────────────────────────────
// "gemma-4-26b-a4b-it" → MoE, 1.5K req/day free tier (recommended default)
// "gemma-4-31b-it"     → dense, stronger reasoning, same quota tier
const MODEL = "gemma-4-26b-a4b-it";

const MODELS = [
    { id: "gemma-4-26b-a4b-it", label: "Gemma 4 26B MoE",  quota: "1.5K/day" },
    { id: "gemma-4-31b-it",     label: "Gemma 4 31B",       quota: "1.5K/day" },
    { id: "gemma-3-27b-it",     label: "Gemma 3 27B",       quota: "15K/day"  },
    { id: "gemma-3-12b-it",     label: "Gemma 3 12B",       quota: "15K/day"  },
];

const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

// ─── Key + model storage (localStorage) ──────────────────────────────────────
const LS_KEY       = "oraculum:gemini-api-key";
const LS_MODEL_KEY = "oraculum:model";

function getApiKey()    { return localStorage.getItem(LS_KEY) || null; }
function saveApiKey(k)  { localStorage.setItem(LS_KEY, k.trim()); }
function clearApiKey()  { localStorage.removeItem(LS_KEY); }

function getModel()    { return localStorage.getItem(LS_MODEL_KEY) || MODEL; }
function setModel(id)  { localStorage.setItem(LS_MODEL_KEY, id); }

// ─── HTTP helper ─────────────────────────────────────────────────────────────
// Uses requestUrl (Obsidian's Node-side CORS bypass) when available,
// falls back to fetch. Both support POST with a JSON body.

async function _post(url, bodyObj, signal) {
    const bodyStr = JSON.stringify(bodyObj);
    if (typeof requestUrl !== "undefined") {
        // requestUrl doesn't support AbortSignal; check before calling.
        if (signal?.aborted) throw new DOMException("Stopped by user.", "AbortError");
        const r = await requestUrl({
            url,
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: bodyStr,
            throw: false,
        });
        if (signal?.aborted) throw new DOMException("Stopped by user.", "AbortError");
        return { ok: r.status < 400, status: r.status, text: r.text };
    }
    const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: bodyStr,
        signal,
    });
    const text = await res.text();
    return { ok: res.ok, status: res.status, text };
}

// ─── Core request ────────────────────────────────────────────────────────────

/**
 * Send a single generateContent request to the Gemini API.
 * Retries up to 3 times on 500 (transient Google server errors) with exponential backoff.
 * @param {Array<{role:string, parts:any[]}>} contents
 * @param {Array<object>} toolDeclarations  Native function declarations (uppercase types).
 * @param {string} systemInstruction
 * @returns {Promise<object>} Raw API response.
 */
async function generateContent(contents, toolDeclarations, systemInstruction, signal) {
    const apiKey = getApiKey();
    if (!apiKey) throw new Error("__NO_KEY__");

    const body = {
        systemInstruction: systemInstruction
            ? { parts: [{ text: systemInstruction }] }
            : undefined,
        tools: toolDeclarations?.length
            ? [{ functionDeclarations: toolDeclarations }]
            : undefined,
        contents,
    };

    const url = `${API_BASE}/${getModel()}:generateContent?key=${apiKey}`;

    let lastStatus, lastText;

    // Retry policy:
    //   500 → transient Google server error → up to 3 retries with exponential backoff (1.5s, 3s, 6s)
    //   429 → rate limit hit              → up to 3 retries with exponential backoff (5s, 10s, 20s)
    const delays500 = [1500, 3000, 6000];
    const delays429 = [5000, 10000, 20000];
    let attempt500 = 0;
    let attempt429 = 0;

    while (true) {
        if (signal?.aborted) throw new DOMException("Stopped by user.", "AbortError");

        ({ ok: _, status: lastStatus, text: lastText } = await _post(url, body, signal));

        if (lastStatus === 500 && attempt500 < delays500.length) {
            const wait = delays500[attempt500++];
            await new Promise(r => setTimeout(r, wait));
            continue;
        }

        if (lastStatus === 429 && attempt429 < delays429.length) {
            const wait = delays429[attempt429++];
            await new Promise(r => setTimeout(r, wait));
            continue; // retry
        }

        break;
    }

    if (lastStatus >= 400) {
        throw new Error(`Gemini API error ${lastStatus}: ${lastText}`);
    }

    try { return JSON.parse(lastText); }
    catch (_) { throw new Error(`Gemini API returned non-JSON (${lastStatus}): ${lastText.slice(0, 200)}`); }
}

// ─── Agentic loop ────────────────────────────────────────────────────────────

/**
 * Run a full agentic turn using Gemini's native function calling.
 * Loops up to 25 rounds: send → execute any functionCall parts → feed back.
 * Terminates when the model produces no functionCall parts.
 *
 * @param {Array}    messages          Current conversation history.
 * @param {Array}    toolDeclarations  Tool schemas (uppercase types).
 * @param {string}   systemInstruction System prompt.
 * @param {Function} executeTool       async (name, args) => result object
 * @param {Function} [onToolCall]      Optional UI callback (name, args, result).
 * @returns {Promise<{messages: Array, reply: string}>}
 */
async function runTurn(messages, toolDeclarations, systemInstruction, executeTool, onToolCall, signal) {
    let conv = [...messages];

    for (let round = 0; round < 25; round++) {
        if (signal?.aborted) throw new DOMException("Stopped by user.", "AbortError");

        const response = await generateContent(conv, toolDeclarations, systemInstruction, signal);

        const candidate = response.candidates?.[0];
        if (!candidate) throw new Error("Empty response from Gemini API.");

        const parts = candidate.content?.parts ?? [];
        const calls = parts.filter(p => p.functionCall);

        // Terminal: no tool calls → final text reply.
        // NOTE: Do NOT use finishReason as a terminal signal — it's "STOP" even mid-tool-loop.
        if (calls.length === 0) {
            // Separate thinking parts (thought:true) from the actual reply text.
            // Gemma 4 returns chain-of-thought in parts marked {thought:true, text:"..."}.
            const thinkParts = parts.filter(p => p.thought && p.text);
            const replyParts = parts.filter(p => !p.thought);
            const thinking   = thinkParts.map(p => p.text ?? "").join("").trim() || null;
            const text       = replyParts.map(p => p.text ?? "").join("").trim();

            // Guard: model put its entire response inside the thinking block and produced
            // no visible text. Re-prompt once with an explicit reminder.
            if (!text && thinking) {
                conv.push({ role: "model", parts: [{ text: "" }] });
                conv.push(userMessage(
                    "[system] Your last reply was empty — you wrote your response inside your " +
                    "thinking block but never actually responded to the user. Please write your " +
                    "response now as normal text."
                ));
                const retryResp  = await generateContent(conv, toolDeclarations, systemInstruction, signal);
                const retryParts = retryResp.candidates?.[0]?.content?.parts ?? [];
                const retryReply = retryParts.filter(p => !p.thought).map(p => p.text ?? "").join("").trim();
                const retryThink = retryParts.filter(p => p.thought && p.text).map(p => p.text ?? "").join("").trim() || null;
                conv.push({ role: "model", parts: [{ text: retryReply }] });
                return { messages: conv, reply: retryReply || "(no reply)", thinking: retryThink ?? thinking };
            }

            conv.push({ role: "model", parts: [{ text }] });
            return { messages: conv, reply: text, thinking };
        }

        // Record the model's tool-call turn (preserve all parts incl. any text)
        conv.push({ role: "model", parts });

        // Execute every functionCall part and gather responses
        const toolResponseParts = [];
        for (const part of calls) {
            const { name, args } = part.functionCall;
            const result = await executeTool(name, args ?? {});
            if (onToolCall) onToolCall(name, args, result);
            toolResponseParts.push({
                functionResponse: { name, response: result },
            });
        }

        // Tool results go back as role:"tool"
        conv.push({ role: "tool", parts: toolResponseParts });
    }

    throw new Error("Oraculum reached the tool-call limit (25 rounds) without a final reply.");
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function userMessage(text) {
    return { role: "user", parts: [{ text }] };
}

return { MODEL, MODELS, getModel, setModel, generateContent, runTurn, userMessage, getApiKey, saveApiKey, clearApiKey, post: _post };
