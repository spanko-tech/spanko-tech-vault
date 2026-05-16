// GitHub repository scraper for the Resources system.
// Uses the public REST API (no auth needed for low-volume use).
// Returns the same shape every Resources scraper should return.

async function scrapGithub(tp, url) {
    const m = url.match(/github\.com\/([^\/\s]+)\/([^\/\s#?]+)/i);
    if (!m) throw new Error("Not a recognizable GitHub URL");
    const [, owner, rawRepo] = m;
    const repo = rawRepo.replace(/\.git$/, "");

    const apiUrl = `https://api.github.com/repos/${owner}/${repo}`;
    const response = await tp.obsidian.request({
        url: apiUrl,
        method: "GET",
        headers: {
            "Accept": "application/vnd.github+json",
            "User-Agent": "spanko-tech-vault-resources"
        }
    });
    const data = JSON.parse(response);

    const topics = Array.isArray(data.topics) ? data.topics : [];
    const license = data.license?.spdx_id || data.license?.name || "";

    return {
        name: data.name,
        category: guessCategory(data, topics),
        vendor: data.owner?.login ?? owner,
        source: data.html_url,
        license: license,
        preview: data.owner?.avatar_url ?? "",
        notes: data.description ?? "",
        use_cases: topics
    };
}

function guessCategory(data, topics) {
    const t = topics.map(x => x.toLowerCase());
    if (t.some(x => ["obsidian-plugin", "vscode-extension", "plugin"].includes(x))) return "Plugins";
    if (t.some(x => ["font", "typography"].includes(x))) return "Fonts";
    if (t.some(x => ["audio", "sound", "music"].includes(x))) return "Audio";
    if (t.some(x => ["3d", "models", "blender", "unity-asset"].includes(x))) return "3D Models";
    if (t.some(x => ["cli", "tool", "tools", "utility"].includes(x))) return "Tools";
    return "Code";
}

module.exports = async (tp, url) => await scrapGithub(tp, url);
