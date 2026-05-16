// Oraculum stylesheet — loaded via dc.require("Systems/Oraculum/Modules/Styles.js")
// Injected into the DOM by Oraculum.md using a versioned <style> tag.

return `
.oraculum-outer {
    display: flex;
    flex-direction: column;
}
.oraculum-wrap {
    display: flex;
    flex-direction: column;
    gap: 8px;
    font-family: var(--font-interface);
    /* JS sets explicit px height via wrapRef — fallback only */
    min-height: 500px;
}
/* History panel — grows to fill all space inside the wrap */
.oraculum-history {
    display: flex;
    flex-direction: column;
    gap: 6px;
    flex: 1;
    min-height: 200px;
    overflow-y: auto;
    overflow-x: hidden;
    padding: 12px 10px;
    border: 1px solid var(--background-modifier-border);
    border-radius: 10px;
    box-sizing: border-box;
}
/* Key setup full-screen card */
.oraculum-key-outer {
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 65vh;
    padding: 24px;
}
.oraculum-key-card {
    width: 100%;
    max-width: 460px;
    display: flex;
    flex-direction: column;
    gap: 22px;
    padding: 40px 44px;
    background: var(--background-secondary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 18px;
    box-sizing: border-box;
}
.oraculum-key-icon {
    font-size: 2.8em;
    text-align: center;
    line-height: 1;
}
.oraculum-key-title {
    font-size: 1.3em;
    font-weight: 700;
    text-align: center;
    color: var(--text-normal);
}
.oraculum-key-subtitle {
    color: var(--text-muted);
    font-size: 0.9em;
    line-height: 1.65;
    text-align: center;
}
.oraculum-key-field {
    display: flex;
    flex-direction: column;
    gap: 8px;
}
.oraculum-key-label {
    font-size: 0.82em;
    color: var(--text-muted);
    font-weight: 600;
    letter-spacing: 0.02em;
}
.oraculum-key-input {
    width: 100%;
    padding: 12px 16px;
    border-radius: 10px;
    border: 1px solid var(--background-modifier-border);
    background: var(--background-primary);
    color: var(--text-normal);
    font-size: 1em;
    font-family: var(--font-monospace);
    outline: none;
    box-sizing: border-box;
    transition: border-color 0.15s;
}
.oraculum-key-input:focus {
    border-color: var(--interactive-accent);
}
.oraculum-key-submit {
    width: 100%;
    padding: 13px;
    border-radius: 10px;
    background: var(--interactive-accent);
    color: var(--text-on-accent);
    border: none;
    cursor: pointer;
    font-size: 1em;
    font-weight: 600;
    letter-spacing: 0.02em;
    transition: opacity 0.15s;
}
.oraculum-key-submit:disabled { opacity: 0.45; cursor: default; }
.oraculum-key-hint {
    font-size: 0.78em;
    color: var(--text-muted);
    text-align: center;
    line-height: 1.5;
}
/* Base bubble */
.oraculum-bubble {
    padding: 10px 15px;
    border-radius: 16px;
    max-width: 84%;
    line-height: 1.6;
    font-size: 0.92em;
    overflow-wrap: break-word;
}
.oraculum-bubble.user {
    align-self: flex-end;
    background: var(--color-blue, #3a6ea5);
    color: #f0f4f8;
    white-space: pre-wrap;
    border-bottom-right-radius: 4px;
}
.oraculum-bubble.model {
    align-self: flex-start;
    background: var(--background-secondary);
    color: var(--text-normal);
    border-bottom-left-radius: 4px;
}
/* Model bubble wrapper — holds bubble + actions + change chips + suggestions */
.oraculum-model-wrap {
    display: flex;
    flex-direction: column;
    gap: 4px;
    align-self: flex-start;
    max-width: 88%;
}
.oraculum-model-wrap .oraculum-bubble.model { max-width: 100%; }
/* Actions row (copy / regen / timestamp) — visible on hover */
.oraculum-bubble-actions {
    display: flex;
    gap: 4px;
    align-items: center;
    opacity: 0;
    transition: opacity 0.15s;
    padding: 0 4px;
    min-height: 20px;
}
.oraculum-model-wrap:hover .oraculum-bubble-actions { opacity: 1; }
.oraculum-timestamp {
    color: var(--text-muted);
    font-size: 0.72em;
    margin-left: auto;
}
.oraculum-copy-btn, .oraculum-regen-btn {
    background: none;
    border: none;
    cursor: pointer;
    color: var(--text-muted);
    font-size: 0.82em;
    padding: 2px 6px;
    border-radius: 4px;
    line-height: 1;
}
.oraculum-copy-btn:hover, .oraculum-regen-btn:hover {
    background: var(--background-modifier-hover);
    color: var(--text-normal);
}
/* Changes panel */
.oraculum-changes-panel {
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
    align-items: center;
    padding: 5px 8px;
    background: var(--background-secondary);
    border-radius: 8px;
    font-size: 0.82em;
}
.oraculum-changes-label { color: var(--text-muted); margin-right: 2px; }
.oraculum-change-chip {
    background: var(--background-primary);
    color: var(--link-color);
    border: 1px solid var(--background-modifier-border);
    border-radius: 6px;
    padding: 2px 8px;
    cursor: pointer;
    font-size: 0.85em;
}
.oraculum-change-chip:hover { background: var(--background-modifier-hover); }
/* Markdown inside model bubbles */
.oraculum-bubble.model h1, .oraculum-bubble.model h2, .oraculum-bubble.model h3 {
    margin: 6px 0 2px;
    font-weight: 700;
}
.oraculum-bubble.model h1 { font-size: 1.1em; }
.oraculum-bubble.model h2 { font-size: 1.04em; }
.oraculum-bubble.model h3 { font-size: 0.98em; }
.oraculum-bubble.model ul { margin: 4px 0; padding-left: 20px; }
.oraculum-bubble.model li { margin: 2px 0; }
.oraculum-bubble.model p  { margin: 3px 0; }
.oraculum-bubble.model br { display: block; content: ""; margin: 2px 0; }
.oraculum-bubble.model hr { border: none; border-top: 1px solid var(--background-modifier-border); margin: 8px 0; }
.oraculum-bubble.model code {
    background: var(--background-secondary-alt, var(--background-primary-alt));
    border-radius: 3px;
    padding: 1px 4px;
    font-family: var(--font-monospace);
    font-size: 0.88em;
}
.oraculum-bubble.model strong { font-weight: 700; }
.oraculum-bubble.model em    { font-style: italic; }
.oraculum-bubble.model a { color: var(--link-color); text-decoration: underline; cursor: pointer; }
.oraculum-wikilink { color: var(--link-color) !important; text-decoration: underline; cursor: pointer; }
/* Tool notice */
.oraculum-bubble.tool-notice {
    align-self: flex-start;
    background: transparent;
    color: var(--text-muted);
    font-size: 0.82em;
    padding: 2px 14px;
    border-left: 2px solid var(--background-modifier-border);
    border-radius: 0;
    max-width: 92%;
}
/* Input row */
.oraculum-input-row {
    display: flex;
    gap: 8px;
    align-items: flex-end;
    flex-shrink: 0;
}
.oraculum-textarea {
    flex: 1;
    padding: 12px 16px;
    border-radius: 12px;
    border: 1px solid var(--background-modifier-border);
    background: var(--background-primary);
    color: var(--text-normal);
    font-size: 0.95em;
    font-family: var(--font-interface);
    outline: none;
    resize: none;
    min-height: 52px;
    max-height: 160px;
    overflow-y: auto;
    line-height: 1.5;
    box-sizing: border-box;
}
.oraculum-textarea:focus { border-color: var(--interactive-accent); }
/* Attach note row */
.oraculum-attach-row {
    display: flex;
    gap: 6px;
    align-items: center;
    font-size: 0.85em;
    padding: 2px 0;
}
.oraculum-attach-label { color: var(--text-muted); white-space: nowrap; }
.oraculum-attach-input {
    flex: 1;
    padding: 4px 8px;
    border-radius: 8px;
    border: 1px solid var(--interactive-accent);
    background: var(--background-primary);
    color: var(--text-normal);
    font-size: 0.88em;
    outline: none;
}
/* Send button */
.oraculum-send {
    padding: 12px 22px;
    border-radius: 12px;
    background: var(--interactive-accent);
    color: var(--text-on-accent);
    border: none;
    cursor: pointer;
    font-size: 0.95em;
    font-weight: 600;
    align-self: flex-end;
    flex-shrink: 0;
    transition: opacity 0.15s;
}
.oraculum-send:disabled { opacity: 0.45; cursor: default; }
.oraculum-stop {
    padding: 12px 18px;
    border-radius: 12px;
    background: var(--color-red, #c0392b);
    color: #fff;
    border: none;
    cursor: pointer;
    font-size: 0.9em;
    font-weight: 600;
    align-self: flex-end;
    flex-shrink: 0;
    transition: opacity 0.15s;
}
.oraculum-stop:hover { opacity: 0.85; }
/* Toolbar */
.oraculum-toolbar {
    display: flex;
    gap: 5px;
    align-items: center;
    flex-wrap: wrap;
    flex-shrink: 0;
}
.oraculum-model-select {
    flex: 1;
    min-width: 0;
    padding: 4px 8px;
    border-radius: 8px;
    border: 1px solid var(--background-modifier-border);
    background: var(--background-primary);
    color: var(--text-muted);
    font-size: 0.8em;
    cursor: pointer;
    outline: none;
}
.oraculum-icon-btn {
    padding: 6px 10px;
    border-radius: 8px;
    border: 1px solid var(--background-modifier-border);
    background: transparent;
    color: var(--text-muted);
    cursor: pointer;
    font-size: 0.82em;
    white-space: nowrap;
}
.oraculum-icon-btn:disabled { opacity: 0.4; cursor: default; }
/* Error */
.oraculum-error {
    color: var(--color-red);
    font-size: 0.85em;
    padding: 6px 10px;
    background: var(--background-secondary);
    border-radius: 8px;
    border-left: 3px solid var(--color-red);
}
/* Animated typing indicator */
@keyframes oraculum-dot-pulse {
    0%, 100% { opacity: 0.25; transform: scale(0.85); }
    50%       { opacity: 1;    transform: scale(1.1);  }
}
.oraculum-thinking {
    align-self: flex-start;
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 10px 14px;
}
.oraculum-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--text-muted);
    animation: oraculum-dot-pulse 1.2s ease-in-out infinite;
    display: inline-block;
}
.oraculum-dot:nth-child(2) { animation-delay: 0.2s; }
.oraculum-dot:nth-child(3) { animation-delay: 0.4s; }
/* Thinking disclosure */
.oraculum-thinking-details {
    margin-top: 2px;
    border: 1px solid var(--background-modifier-border);
    border-radius: 8px;
    overflow: hidden;
    max-width: 100%;
    background: var(--background-secondary);
}
.oraculum-thinking-summary {
    cursor: pointer;
    list-style: none;
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 7px 12px;
    font-size: 0.8em;
    font-weight: 500;
    color: var(--text-muted);
    background: var(--background-secondary);
    user-select: none;
    letter-spacing: 0.01em;
}
.oraculum-thinking-summary::-webkit-details-marker { display: none; }
.oraculum-thinking-summary:hover { color: var(--text-normal); }
.oraculum-thinking-details[open] .oraculum-thinking-summary {
    border-bottom: 1px solid var(--background-modifier-border);
}
.oraculum-thinking-body {
    padding: 10px 14px;
    font-size: 0.78em;
    color: var(--text-muted);
    white-space: pre-wrap;
    max-height: 400px;
    overflow-y: auto;
    background: var(--background-primary);
    line-height: 1.6;
}
/* ── Changelog section ── */
.oraculum-changelog {
    margin-top: 16px;
    border: 1px solid var(--background-modifier-border);
    border-radius: 10px;
    overflow: hidden;
    background: var(--background-primary);
}
.oraculum-changelog-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    background: var(--background-secondary);
    border-bottom: 1px solid var(--background-modifier-border);
    flex-wrap: wrap;
}
.oraculum-changelog-title {
    font-size: 0.85em;
    font-weight: 600;
    color: var(--text-muted);
    flex: 1;
    min-width: 80px;
}
.oraculum-changelog-filters {
    display: flex;
    gap: 4px;
}
.oraculum-filter-pill {
    padding: 3px 10px;
    border-radius: 100px;
    border: 1px solid var(--background-modifier-border);
    background: transparent;
    color: var(--text-muted);
    font-size: 0.78em;
    cursor: pointer;
    transition: background 0.12s;
}
.oraculum-filter-pill.active {
    background: var(--interactive-accent);
    color: var(--text-on-accent, #fff);
    border-color: transparent;
}
.oraculum-changelog-list {
    max-height: 320px;
    overflow-y: auto;
}
.oraculum-changelog-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 14px;
    border-bottom: 1px solid var(--background-modifier-border);
    cursor: pointer;
    font-size: 0.84em;
    transition: background 0.12s;
}
.oraculum-changelog-item:last-child { border-bottom: none; }
.oraculum-changelog-item:hover { background: var(--background-secondary); }
.oraculum-changelog-icon { font-size: 1em; flex-shrink: 0; }
.oraculum-changelog-note-title {
    flex: 1;
    color: var(--text-normal);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    display: block;
}
.oraculum-changelog-path {
    display: block;
    font-size: 0.75em;
    color: var(--text-faint);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}
.oraculum-changelog-time {
    color: var(--text-faint);
    font-size: 0.8em;
    flex-shrink: 0;
}
/* ── Inline Settings ── */
.oraset-panel {
    flex: 1;
    overflow-y: auto;
    padding: 0 2px 20px;
    display: flex;
    flex-direction: column;
    gap: 0;
}
.oraset-header {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 0 10px;
    border-bottom: 1px solid var(--background-modifier-border);
    margin-bottom: 0;
}
.oraset-title {
    font-size: 1.05rem;
    font-weight: 600;
    color: var(--text-normal);
    flex: 1;
}
.oraset-saved {
    font-size: 0.78rem;
    color: var(--color-green);
    background: color-mix(in srgb, var(--color-green) 15%, transparent);
    padding: 2px 10px;
    border-radius: 20px;
}
.oraset-tabs {
    display: flex;
    gap: 0;
    border-bottom: 1px solid var(--background-modifier-border);
    margin-bottom: 16px;
}
.oraset-tab {
    background: none;
    border: none;
    border-bottom: 2px solid transparent;
    padding: 8px 16px;
    font-size: 0.85rem;
    font-weight: 500;
    color: var(--text-muted);
    cursor: pointer;
    margin-bottom: -1px;
    transition: color 0.15s, border-color 0.15s;
}
.oraset-tab:hover { color: var(--text-normal); }
.oraset-tab.active {
    color: var(--interactive-accent);
    border-bottom-color: var(--interactive-accent);
}
.oraset-section {
    display: flex;
    flex-direction: column;
    gap: 10px;
}
.oraset-desc {
    font-size: 0.82rem;
    color: var(--text-muted);
    margin: 0;
    line-height: 1.5;
}
.oraset-textarea {
    width: 100%;
    min-height: 280px;
    resize: vertical;
    background: var(--background-primary-alt);
    border: 1px solid var(--background-modifier-border);
    border-radius: 8px;
    padding: 10px 12px;
    font-family: var(--font-monospace);
    font-size: 0.8rem;
    color: var(--text-normal);
    line-height: 1.5;
    box-sizing: border-box;
}
.oraset-textarea:focus { outline: none; border-color: var(--interactive-accent); }
.oraset-row { display: flex; gap: 8px; align-items: center; }
.oraset-btn {
    padding: 5px 14px;
    border-radius: 6px;
    border: 1px solid var(--background-modifier-border);
    background: var(--background-secondary);
    color: var(--text-normal);
    font-size: 0.82rem;
    cursor: pointer;
    transition: background 0.15s;
    white-space: nowrap;
}
.oraset-btn:hover { background: var(--background-modifier-hover); }
.oraset-btn.primary {
    background: var(--interactive-accent);
    color: var(--text-on-accent);
    border-color: var(--interactive-accent);
}
.oraset-btn.primary:hover { opacity: 0.88; }
.oraset-btn.danger {
    color: var(--color-red);
    border-color: color-mix(in srgb, var(--color-red) 35%, transparent);
}
.oraset-icon-btn {
    width: 26px;
    height: 26px;
    border-radius: 6px;
    border: 1px solid var(--background-modifier-border);
    background: var(--background-secondary);
    color: var(--text-muted);
    font-size: 0.72rem;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    transition: background 0.15s, color 0.15s;
}
.oraset-icon-btn:hover { background: var(--background-modifier-hover); color: var(--color-red); }
.oraset-search {
    width: 100%;
    background: var(--background-primary-alt);
    border: 1px solid var(--background-modifier-border);
    border-radius: 8px;
    padding: 7px 12px;
    font-size: 0.85rem;
    color: var(--text-normal);
    box-sizing: border-box;
}
.oraset-search:focus { outline: none; border-color: var(--interactive-accent); }
.oraset-tools { display: flex; flex-direction: column; gap: 6px; }
.oraset-tool-card {
    background: var(--background-primary-alt);
    border: 1px solid var(--background-modifier-border);
    border-radius: 8px;
    overflow: hidden;
}
.oraset-tool-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 9px 12px;
    cursor: pointer;
    user-select: none;
}
.oraset-tool-header:hover { background: var(--background-modifier-hover); }
.oraset-tool-name {
    font-family: var(--font-monospace);
    font-size: 0.82rem;
    font-weight: 600;
    color: var(--interactive-accent);
}
.oraset-tool-toggle { font-size: 0.65rem; color: var(--text-muted); }
.oraset-tool-desc {
    padding: 0 12px 8px;
    font-size: 0.8rem;
    color: var(--text-muted);
    line-height: 1.45;
}
.oraset-tool-params {
    border-top: 1px solid var(--background-modifier-border);
    padding: 8px 12px;
    display: flex;
    flex-direction: column;
    gap: 5px;
}
.oraset-params-title {
    font-size: 0.72rem;
    font-weight: 600;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-bottom: 2px;
}
.oraset-param-row {
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
    align-items: baseline;
    font-size: 0.78rem;
}
.oraset-param-name { font-family: var(--font-monospace); font-weight: 600; color: var(--text-normal); }
.oraset-param-type {
    font-family: var(--font-monospace);
    font-size: 0.72rem;
    color: var(--interactive-accent);
    background: color-mix(in srgb, var(--interactive-accent) 12%, transparent);
    padding: 0 5px;
    border-radius: 4px;
}
.oraset-param-req {
    font-size: 0.7rem;
    color: var(--color-orange);
    background: color-mix(in srgb, var(--color-orange) 12%, transparent);
    padding: 0 5px;
    border-radius: 4px;
}
.oraset-param-desc { color: var(--text-muted); flex: 1; min-width: 100%; }
.oraset-config-row {
    background: var(--background-primary-alt);
    border: 1px solid var(--background-modifier-border);
    border-radius: 8px;
    padding: 14px;
    display: flex;
    flex-direction: column;
    gap: 8px;
}
.oraset-label { font-weight: 600; font-size: 0.88rem; display: block; }
.oraset-number {
    width: 110px;
    background: var(--background-primary-alt);
    border: 1px solid var(--background-modifier-border);
    border-radius: 6px;
    padding: 5px 10px;
    font-size: 0.88rem;
    color: var(--text-normal);
}
.oraset-number:focus { outline: none; border-color: var(--interactive-accent); }
.oraset-key-val {
    font-family: var(--font-monospace);
    font-size: 0.8rem;
    color: var(--text-muted);
}
.oraset-filters { display: flex; flex-direction: column; gap: 6px; margin-bottom: 2px; }
.oraset-filter-row { display: flex; flex-wrap: wrap; align-items: center; gap: 4px; }
.oraset-filter-label {
    font-size: 0.72rem;
    font-weight: 600;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    min-width: 64px;
    flex-shrink: 0;
}
.oraset-filter-pill {
    padding: 2px 10px;
    border-radius: 20px;
    border: 1px solid var(--background-modifier-border);
    background: var(--background-secondary);
    color: var(--text-muted);
    font-size: 0.78rem;
    cursor: pointer;
    transition: background 0.12s, color 0.12s;
}
.oraset-filter-pill:hover { background: var(--background-modifier-hover); color: var(--text-normal); }
.oraset-filter-pill.active {
    background: var(--interactive-accent);
    color: var(--text-on-accent);
    border-color: var(--interactive-accent);
}
.oraset-tool-badge {
    font-size: 0.68rem;
    padding: 1px 6px;
    border-radius: 4px;
    font-weight: 500;
    white-space: nowrap;
}
/* system badges — one accent colour per pillar */
.oraset-tool-badge.sys-any      { background: color-mix(in srgb, var(--text-muted) 18%, transparent); color: var(--text-muted); }
.oraset-tool-badge.sys-anima    { background: color-mix(in srgb, var(--color-pink)   15%, transparent); color: var(--color-pink); }
.oraset-tool-badge.sys-cogito   { background: color-mix(in srgb, var(--color-blue)   15%, transparent); color: var(--color-blue); }
.oraset-tool-badge.sys-fabrica  { background: color-mix(in srgb, var(--color-orange) 15%, transparent); color: var(--color-orange); }
.oraset-tool-badge.sys-vault    { background: color-mix(in srgb, var(--color-green)  15%, transparent); color: var(--color-green); }
.oraset-tool-badge.sys-web      { background: color-mix(in srgb, var(--color-cyan)   15%, transparent); color: var(--color-cyan); }
.oraset-tool-badge.sys-oraculum { background: color-mix(in srgb, var(--color-purple) 15%, transparent); color: var(--color-purple); }
/* category badge */
.oraset-tool-badge.cat { background: color-mix(in srgb, var(--color-purple) 12%, transparent); color: var(--color-purple); }

/* ── Markdown: fenced code blocks ── */
.oraculum-bubble.model pre {
    background: var(--background-secondary-alt, var(--background-primary-alt));
    border: 1px solid var(--background-modifier-border);
    border-radius: 8px;
    padding: 10px 14px;
    overflow-x: auto;
    margin: 6px 0;
}
.oraculum-bubble.model pre code {
    background: none;
    border-radius: 0;
    padding: 0;
    font-size: 0.84em;
    line-height: 1.6;
    color: var(--text-normal);
}
/* ── Markdown: tables ── */
.oraculum-bubble.model table {
    border-collapse: collapse;
    width: 100%;
    font-size: 0.86em;
    margin: 6px 0;
}
.oraculum-bubble.model th,
.oraculum-bubble.model td {
    border: 1px solid var(--background-modifier-border);
    padding: 5px 10px;
    text-align: left;
}
.oraculum-bubble.model th {
    background: var(--background-secondary-alt, var(--background-primary-alt));
    font-weight: 600;
}
.oraculum-bubble.model tr:nth-child(even) td {
    background: color-mix(in srgb, var(--background-modifier-border) 20%, transparent);
}
/* ── Markdown: blockquotes ── */
.oraculum-bubble.model blockquote {
    border-left: 3px solid var(--interactive-accent);
    margin: 4px 0 4px 2px;
    padding: 2px 10px;
    color: var(--text-muted);
    background: color-mix(in srgb, var(--interactive-accent) 6%, transparent);
    border-radius: 0 6px 6px 0;
}
/* ── Markdown: ordered lists + strikethrough ── */
.oraculum-bubble.model ol { margin: 4px 0; padding-left: 20px; }
.oraculum-bubble.model del { text-decoration: line-through; opacity: 0.6; }

/* ── Collapsible tool-call groups (like thinking blocks) ── */
.oraculum-tool-group {
    border: 1px solid var(--background-modifier-border);
    border-radius: 8px;
    overflow: hidden;
    align-self: flex-start;
    max-width: 88%;
    width: 100%;
    margin: 2px 0;
    flex-shrink: 0; /* overflow:hidden sets min-size=0 in flex layout, causing collapse */
}
.oraculum-tool-group-summary {
    cursor: pointer;
    list-style: none;
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 5px 12px;
    min-height: 30px;
    font-size: 0.8em;
    font-weight: 500;
    color: var(--text-muted);
    background: var(--background-secondary);
    user-select: none;
    letter-spacing: 0.01em;
}
.oraculum-tool-group-summary::-webkit-details-marker { display: none; }
.oraculum-tool-group-summary:hover { color: var(--text-normal); }
.oraculum-tool-group[open] .oraculum-tool-group-summary,
.oraculum-tool-group.open .oraculum-tool-group-summary {
    border-bottom: 1px solid var(--background-modifier-border);
}
.oraculum-tool-group-body {
    display: none;
    flex-direction: column;
    background: var(--background-primary);
}
.oraculum-tool-group.open .oraculum-tool-group-body {
    display: flex;
}
.oraculum-tool-group-body .oraculum-bubble.tool-notice {
    border-left: none;
    border-bottom: 1px solid var(--background-modifier-border);
    padding: 4px 14px;
    max-width: 100%;
}
.oraculum-tool-group-body .oraculum-bubble.tool-notice:last-child { border-bottom: none; }

/* ── Context turns badge in toolbar ── */
.oraculum-ctx-badge {
    padding: 3px 8px;
    border-radius: 8px;
    font-size: 0.75em;
    font-weight: 600;
    font-family: var(--font-monospace);
    flex-shrink: 0;
    cursor: default;
    user-select: none;
}
.oraculum-ctx-badge.ctx-green  { background: color-mix(in srgb, var(--color-green)  15%, transparent); color: var(--color-green); }
.oraculum-ctx-badge.ctx-yellow { background: color-mix(in srgb, var(--color-yellow, #e5a00d) 15%, transparent); color: var(--color-yellow, #e5a00d); }
.oraculum-ctx-badge.ctx-red    { background: color-mix(in srgb, var(--color-red)    15%, transparent); color: var(--color-red); }

/* ── Skills assembled prompt preview ── */
.oraset-prompt-preview {
    background: var(--background-primary-alt);
    border: 1px solid var(--background-modifier-border);
    border-radius: 8px;
    padding: 12px 14px;
    font-family: var(--font-monospace);
    font-size: 0.74rem;
    color: var(--text-muted);
    line-height: 1.6;
    white-space: pre-wrap;
    max-height: 360px;
    overflow-y: auto;
    margin-top: 4px;
}

/* ═══════════════════════════════════════════════════════
   Oraculum v13 — native renderer, tool cards, settings nav
   ═══════════════════════════════════════════════════════ */

/* Native MarkdownRenderer container */
.oraculum-md { line-height: 1.55; }
.oraculum-md > :first-child { margin-top: 0; }
.oraculum-md > :last-child  { margin-bottom: 0; }
.oraculum-md p { margin: 0.5em 0; }
.oraculum-md pre { margin: 0.6em 0; border-radius: 6px; }
.oraculum-md code { font-size: 0.88em; }
.oraculum-md ul, .oraculum-md ol { margin: 0.4em 0; padding-left: 1.5em; }
.oraculum-md blockquote { margin: 0.5em 0; padding: 0.4em 0.9em; border-left: 3px solid var(--interactive-accent); background: var(--background-secondary); border-radius: 4px; }
.oraculum-md table { font-size: 0.86em; }
.oraculum-md .callout { margin: 0.6em 0; }

/* Collapsible Tool Call cards (chat surface) */
.oraculum-tool-card {
    background: var(--background-secondary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 8px;
    margin: 4px 0;
    overflow: hidden;
    transition: border-color 0.12s ease;
}
.oraculum-tool-card:hover { border-color: var(--interactive-accent); }
.oraculum-tool-card.err { border-color: var(--color-red); background: color-mix(in srgb, var(--color-red) 6%, var(--background-secondary)); }
.oraculum-tool-card-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 7px 10px;
    cursor: pointer;
    user-select: none;
    font-size: 0.84rem;
}
.oraculum-tool-card-ico { flex-shrink: 0; font-size: 0.95rem; }
.oraculum-tool-card-name {
    font-family: var(--font-monospace);
    font-weight: 600;
    color: var(--interactive-accent);
    flex-shrink: 0;
}
.oraculum-tool-card-summary {
    color: var(--text-muted);
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.oraculum-tool-card-chev {
    color: var(--text-faint);
    font-size: 0.7rem;
    flex-shrink: 0;
    transition: transform 0.15s ease;
}
.oraculum-tool-card[open] .oraculum-tool-card-chev { transform: rotate(180deg); }
.oraculum-tool-card-body {
    border-top: 1px solid var(--background-modifier-border);
    padding: 8px 10px;
    display: flex;
    flex-direction: column;
    gap: 8px;
}
.oraculum-tool-card-section { display: flex; flex-direction: column; gap: 3px; }
.oraculum-tool-card-label {
    font-size: 0.68rem;
    font-weight: 600;
    color: var(--text-faint);
    text-transform: uppercase;
    letter-spacing: 0.05em;
}
.oraculum-tool-card-pre {
    background: var(--background-primary-alt);
    border: 1px solid var(--background-modifier-border);
    border-radius: 6px;
    padding: 6px 8px;
    margin: 0;
    font-family: var(--font-monospace);
    font-size: 0.74rem;
    color: var(--text-normal);
    line-height: 1.45;
    max-height: 240px;
    overflow: auto;
    overscroll-behavior: contain;
    white-space: pre-wrap;
    word-break: break-word;
}

/* Tool group icon + meta (chat status panel) */
.oraculum-tool-group-icon { font-size: 0.95rem; margin-right: 4px; }
.oraculum-tool-group-meta { color: var(--text-faint); font-size: 0.72rem; margin-left: auto; }
.oraculum-tool-group-chev { font-size: 0.7rem; color: var(--text-faint); width: 10px; display: inline-block; }

/* ── Research panel ── */
.oraset-research          { display: flex; flex-direction: column; gap: 16px; }
.oraset-research-kpis     { display: flex; gap: 10px; flex-wrap: wrap; }
.oraset-research-kpi      { padding: 10px 14px; background: var(--background-secondary); border-radius: 8px; min-width: 100px; }
.oraset-research-kpi-k    { font-size: 0.72rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.04em; }
.oraset-research-kpi-v    { font-size: 1.15rem; font-weight: 600; }

.oraset-research-section-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; }
.oraset-research-h3       { margin: 0; font-size: 0.95rem; }
.oraset-research-actions  { display: flex; gap: 8px; }

.oraset-research-select   {
    background: var(--background-primary-alt);
    border: 1px solid var(--background-modifier-border);
    border-radius: 6px;
    padding: 4px 8px;
    font-size: 0.82rem;
    color: var(--text-normal);
    cursor: pointer;
}

.oraset-research-empty    {
    padding: 10px 12px;
    background: var(--background-secondary);
    border-radius: 8px;
    font-size: 0.82rem;
}

.oraset-research-list     { display: flex; flex-direction: column; gap: 6px; }

.oraset-research-queue-row {
    display: flex; align-items: flex-start; gap: 8px;
    padding: 8px 10px;
    background: var(--background-secondary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 8px;
}
.oraset-research-queue-body  { flex: 1; min-width: 0; }
.oraset-research-queue-topic { font-weight: 600; font-size: 0.88rem; margin-bottom: 2px; }
.oraset-research-queue-rat   { font-size: 0.78rem; color: var(--text-muted); }
.oraset-research-queue-time  { font-size: 0.72rem; color: var(--text-faint); }

.oraset-research-add-form {
    display: flex; flex-direction: column; gap: 6px;
    padding: 10px 12px;
    background: var(--background-primary-alt);
    border: 1px solid var(--background-modifier-border);
    border-radius: 8px;
}
.oraset-research-add-label {
    font-size: 0.78rem; font-weight: 600; color: var(--text-muted);
    text-transform: uppercase; letter-spacing: 0.04em;
}
.oraset-research-input {
    background: var(--background-primary-alt);
    border: 1px solid var(--background-modifier-border);
    border-radius: 6px;
    padding: 5px 10px;
    font-size: 0.85rem;
    color: var(--text-normal);
}
.oraset-research-input.muted { font-size: 0.82rem; color: var(--text-muted); }
.oraset-research-search {
    width: 100%;
    background: var(--background-primary-alt);
    border: 1px solid var(--background-modifier-border);
    border-radius: 8px;
    padding: 7px 12px;
    font-size: 0.85rem;
    color: var(--text-normal);
    box-sizing: border-box;
}

.oraset-research-result {
    background: var(--background-secondary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 8px;
    overflow: hidden;
}
.oraset-research-result-head {
    display: flex; align-items: center; justify-content: space-between;
    padding: 9px 12px;
    cursor: pointer; user-select: none;
}
.oraset-research-result-topic { font-weight: 600; font-size: 0.88rem; flex: 1; min-width: 0; }
.oraset-research-result-meta  { display: flex; gap: 6px; align-items: center; flex-shrink: 0; }
.oraset-research-result-depth {
    font-size: 0.68rem; padding: 1px 6px; border-radius: 4px; font-weight: 500;
    background: var(--background-modifier-border); color: var(--text-muted);
}
.oraset-research-result-date  { font-size: 0.72rem; color: var(--text-faint); }
.oraset-research-result-chev  { font-size: 0.65rem; color: var(--text-muted); margin-left: 4px; }
.oraset-research-result-body  {
    padding: 0 12px 12px;
    border-top: 1px solid var(--background-modifier-border);
}
.oraset-research-result-summary { margin: 8px 0; font-size: 0.84rem; line-height: 1.5; }
.oraset-research-finding        { margin-top: 6px; }
.oraset-research-finding-h      { font-size: 0.82rem; font-weight: 600; }
.oraset-research-finding-b      { font-size: 0.78rem; color: var(--text-muted); line-height: 1.5; }
.oraset-research-citations      { margin-top: 8px; font-size: 0.74rem; color: var(--text-faint); }
.oraset-research-citations a    { margin-right: 8px; }
.oraset-research-result-actions { display: flex; gap: 8px; margin-top: 10px; }


/* Two-tier settings nav */
.oraset-nav-top {
    display: flex;
    gap: 4px;
    margin-bottom: 8px;
    padding: 4px;
    background: var(--background-secondary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 8px;
}
.oraset-nav-top-btn {
    flex: 1;
    background: transparent;
    border: none;
    border-radius: 6px;
    padding: 6px 10px;
    font-size: 0.84rem;
    font-weight: 500;
    color: var(--text-muted);
    cursor: pointer;
    transition: background 0.12s, color 0.12s;
}
.oraset-nav-top-btn:hover { background: var(--background-modifier-hover); color: var(--text-normal); }
.oraset-nav-top-btn.active {
    background: var(--interactive-accent);
    color: var(--text-on-accent);
}

/* Tool registry tab — toggle switch */
.oraset-tool-card.is-disabled { opacity: 0.55; }
.oraset-tool-card.is-disabled .oraset-tool-name { text-decoration: line-through; }
.oraset-tool-switch {
    position: relative;
    display: inline-block;
    width: 32px;
    height: 18px;
    flex-shrink: 0;
    cursor: pointer;
}
.oraset-tool-switch input { opacity: 0; width: 0; height: 0; }
.oraset-tool-switch-track {
    position: absolute;
    inset: 0;
    background: var(--background-modifier-border);
    border-radius: 18px;
    transition: background 0.15s;
}
.oraset-tool-switch-track::before {
    content: "";
    position: absolute;
    top: 2px;
    left: 2px;
    width: 14px;
    height: 14px;
    background: var(--text-on-accent, white);
    border-radius: 50%;
    transition: transform 0.15s;
    box-shadow: 0 1px 2px rgba(0,0,0,0.25);
}
.oraset-tool-switch input:checked + .oraset-tool-switch-track { background: var(--interactive-accent); }
.oraset-tool-switch input:checked + .oraset-tool-switch-track::before { transform: translateX(14px); }
.oraset-tool-card { padding: 0; }
.oraset-tool-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 9px 12px;
    cursor: pointer;
    user-select: none;
}
.oraset-tool-name {
    font-family: var(--font-monospace);
    font-size: 0.82rem;
    font-weight: 600;
    color: var(--interactive-accent);
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
}
.oraset-tool-badges { display: flex; gap: 4px; align-items: center; flex-shrink: 0; }
.oraset-tool-badge {
    font-size: 0.68rem;
    padding: 1px 6px;
    border-radius: 4px;
    font-weight: 500;
    white-space: nowrap;
    background: var(--background-modifier-border);
    color: var(--text-muted);
}
.oraset-tool-badge.cat { background: color-mix(in srgb, var(--interactive-accent) 14%, transparent); color: var(--interactive-accent); }
.oraset-tool-toggle { font-size: 0.65rem; color: var(--text-muted); margin-left: 4px; }
.oraset-tool-desc { padding: 0 12px 10px 52px; font-size: 0.8rem; color: var(--text-muted); line-height: 1.45; }
.oraset-tool-params {
    border-top: 1px solid var(--background-modifier-border);
    padding: 8px 12px 10px 52px;
    display: flex;
    flex-direction: column;
    gap: 5px;
}
.oraset-params-title { font-size: 0.72rem; font-weight: 600; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 2px; }
.oraset-param-row { display: flex; flex-wrap: wrap; gap: 5px; align-items: baseline; font-size: 0.78rem; }
.oraset-param-name { font-family: var(--font-monospace); font-weight: 600; color: var(--text-normal); }
.oraset-param-type { font-family: var(--font-monospace); font-size: 0.72rem; color: var(--interactive-accent); background: color-mix(in srgb, var(--interactive-accent) 12%, transparent); padding: 0 5px; border-radius: 4px; }
.oraset-param-req { font-size: 0.7rem; color: var(--color-orange); background: color-mix(in srgb, var(--color-orange) 12%, transparent); padding: 0 5px; border-radius: 4px; }
.oraset-param-desc { color: var(--text-muted); flex: 1; min-width: 100%; }

.oraset-toolbar-row {
    display: flex;
    gap: 8px;
    align-items: center;
    flex-wrap: wrap;
    padding: 6px 0;
}
.oraset-meta { font-size: 0.78rem; color: var(--text-muted); flex: 1; }

.oraset-filters {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 10px 12px;
    background: var(--background-secondary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 8px;
}
.oraset-filter-row { display: flex; flex-wrap: wrap; align-items: center; gap: 4px; }
.oraset-filter-label { font-size: 0.72rem; font-weight: 600; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; min-width: 64px; flex-shrink: 0; }
.oraset-search {
    width: 100%;
    background: var(--background-primary-alt);
    border: 1px solid var(--background-modifier-border);
    border-radius: 8px;
    padding: 7px 12px;
    font-size: 0.85rem;
    color: var(--text-normal);
    box-sizing: border-box;
}
.oraset-tools { display: flex; flex-direction: column; gap: 6px; }

/* API Keys tab */
.oraset-key-row {
    background: var(--background-secondary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 8px;
    padding: 12px 14px;
    display: flex;
    flex-direction: column;
    gap: 6px;
}
.oraset-key-row-head {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
}
.oraset-key-row-label { font-weight: 600; font-size: 0.92rem; color: var(--text-normal); flex: 1; }
.oraset-key-status {
    font-size: 0.72rem;
    font-weight: 600;
    padding: 2px 8px;
    border-radius: 10px;
    white-space: nowrap;
}
.oraset-key-status.ok      { background: color-mix(in srgb, var(--color-green)  15%, transparent); color: var(--color-green); }
.oraset-key-status.missing { background: color-mix(in srgb, var(--color-red)    15%, transparent); color: var(--color-red); }
.oraset-key-status.off     { background: color-mix(in srgb, var(--text-muted)   12%, transparent); color: var(--text-muted); }
.oraset-key-docs { font-size: 0.78rem; color: var(--text-accent); text-decoration: none; }
.oraset-key-docs:hover { text-decoration: underline; }
.oraset-key-hint-line { font-size: 0.78rem; color: var(--text-faint); margin: 0; line-height: 1.5; }

/* Integrations grid */
.oraset-int-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
    gap: 10px;
}
.oraset-int-card {
    background: var(--background-secondary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 8px;
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    transition: border-color 0.12s;
}
.oraset-int-card:hover { border-color: var(--interactive-accent); }
.oraset-int-head { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.oraset-int-icon { font-size: 1.2rem; }
.oraset-int-label { font-weight: 600; font-size: 0.92rem; flex: 1; color: var(--text-normal); }
.oraset-int-summary { font-size: 0.8rem; color: var(--text-muted); margin: 0; line-height: 1.45; }
.oraset-int-tools { display: flex; flex-wrap: wrap; gap: 4px; }
.oraset-int-tool-chip {
    font-family: var(--font-monospace);
    font-size: 0.7rem;
    padding: 2px 7px;
    border-radius: 10px;
    background: color-mix(in srgb, var(--interactive-accent) 12%, transparent);
    color: var(--interactive-accent);
    cursor: pointer;
    transition: opacity 0.12s, background 0.12s;
}
.oraset-int-tool-chip:hover { background: color-mix(in srgb, var(--interactive-accent) 22%, transparent); }
.oraset-int-tool-chip.off {
    background: color-mix(in srgb, var(--text-muted) 10%, transparent);
    color: var(--text-faint);
    text-decoration: line-through;
}
.oraset-int-foot { display: flex; gap: 6px; align-items: center; margin-top: auto; padding-top: 4px; }
.oraset-int-docs { font-size: 0.78rem; color: var(--text-accent); text-decoration: none; flex: 1; }
.oraset-int-docs:hover { text-decoration: underline; }

/* Memory tab */
.oraset-memory-list { display: flex; flex-direction: column; gap: 4px; }
.oraset-memory-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 12px;
    background: var(--background-secondary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 6px;
    cursor: pointer;
    transition: background 0.12s, border-color 0.12s;
}
.oraset-memory-item:hover { background: var(--background-modifier-hover); border-color: var(--interactive-accent); }
.oraset-memory-icon { font-size: 1rem; flex-shrink: 0; }
.oraset-memory-title { flex: 1; font-size: 0.88rem; color: var(--text-normal); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.oraset-memory-time { font-size: 0.74rem; color: var(--text-faint); flex-shrink: 0; }

/* About tab */
.oraset-about-hero {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 14px 16px;
    background: var(--background-secondary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 10px;
}
.oraset-about-icon { font-size: 2.4rem; }
.oraset-about-name { font-size: 1.2rem; font-weight: 700; color: var(--text-normal); }
.oraset-about-tag { font-size: 0.78rem; color: var(--text-faint); font-family: var(--font-monospace); }
.oraset-about-stats {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(110px, 1fr));
    gap: 8px;
}
.oraset-about-stat {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 12px;
    background: var(--background-secondary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 8px;
}
.oraset-about-stat .n { font-size: 1.6rem; font-weight: 700; color: var(--interactive-accent); line-height: 1; }
.oraset-about-stat .l { font-size: 0.72rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; margin-top: 4px; }
`;
