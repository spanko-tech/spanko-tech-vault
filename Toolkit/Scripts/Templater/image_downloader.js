const path = require('path');
const fs = require('fs');

let templater = null;

const requestHeaders = {
  Accept: "*/*",
  "User-Agent": "obsidiam-image-downloader",
};

async function parseImages(templaterInstance, noteContent) {
    templater = templaterInstance;
    const currentNotePath = templater.config.target_file.path;
    const currentNoteFolder = path.dirname(currentNotePath);
    const vaultPath = templater.config.target_file.vault.adapter.basePath;
    
    // Create the Images folder path relative to the current note's folder
    const imageFolder = path.join(vaultPath, currentNoteFolder, "Images");

    fs.mkdirSync(imageFolder, { recursive: true });

    let newContent = noteContent;
    let links = Array.from(getImageLinks(newContent));
    for (const link of links) {
        console.info("Found image link: " + link[0]);
        const img_url = link.groups.url;
        
        const urlPath = new URL(img_url).pathname;
        const img_filename = `${path.basename(urlPath)}`;
        const img_path = path.resolve(imageFolder, img_filename);
        

        const success = await downloadImage(img_url, img_path);
        
        if (success) {
            const obsidianPath = `Images/${img_filename}`;
            newContent = newContent.replace(img_url, obsidianPath);
        }
    }

    return newContent;
}

function getVaultPath() {
    return templater.config.target_file.vault.adapter.basePath;
}

async function downloadImage(url, imagePath) {
    try {
        console.info("Downloading: " + url);
        console.info("Saving to: " + imagePath);
        
        const response = await templater.obsidian.requestUrl({
            url: url,
            method: "GET",
            headers: requestHeaders,
            responseType: 'arraybuffer',
        });

        console.info("Response type: " + typeof response);
        console.info("Response constructor: " + response.constructor.name);
        
        fs.writeFileSync(imagePath, Buffer.from(response.arrayBuffer), 'binary');
        console.info("Successfully downloaded: " + imagePath);
        
        // Check file size to verify it's not empty
        const stats = fs.statSync(imagePath);
        console.info("File size: " + stats.size + " bytes");
        
        if (stats.size === 0) {
            console.error("Downloaded file is empty!");
            return false;
        }
        
        return true;
        
    } catch (error) {
        console.error("Error downloading image: " + url, error);
        return false;
    }
}

function getImageLinks(noteContent) {
    const regex = /<img[^>]+src=["'](?<url>https?:\/\/[^"']+)["'][^>]*>/g;
    return noteContent.matchAll(regex);
}

module.exports = parseImages;