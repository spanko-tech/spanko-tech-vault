// Systems/Oraculum/Modules/Settings.js
// Persists non-sensitive user settings to a vault file so they sync via Obsidian Sync.
// API keys are intentionally excluded — they stay in localStorage only.
//
// File: Systems/Oraculum/Data/settings.json
// Schema: { scraperLimit?: number, searchLimit?: number, excludedFolders?: string[] }

const SETTINGS_PATH = "Systems/Oraculum/Data/settings.json";

let _cache = null;

async function loadSettings() {
    if (_cache) return _cache;
    try {
        const raw = await dc.app.vault.adapter.read(SETTINGS_PATH);
        _cache = JSON.parse(raw);
    } catch {
        _cache = {};
    }
    return _cache;
}

async function updateSettings(patch) {
    const current = await loadSettings();
    _cache = { ...current, ...patch };
    // Ensure the Data folder exists
    const folder = dc.app.vault.getAbstractFileByPath("Systems/Oraculum/Data");
    if (!folder) await dc.app.vault.createFolder("Systems/Oraculum/Data").catch(() => {});
    await dc.app.vault.adapter.write(SETTINGS_PATH, JSON.stringify(_cache, null, 2));
}

return { loadSettings, updateSettings };
