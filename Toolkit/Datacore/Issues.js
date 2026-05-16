// Toolkit/Datacore/Issues.js
// Shared Issues path and file-move logic.
// Used by: Systems/Issues/Issues.md (dashboard) and Systems/Oraculum/Modules/Tools.js (AI tool)
//
// Keeping this in one place means a folder restructure or status name change
// only needs to be made here.

const ISSUE_ROOT = "Systems/Issues";

// Returns the destination folder path for an issue given project name and status.
//   status === "Archived"  →  Systems/Issues/Archived/{Project}/
//   anything else          →  Systems/Issues/{Project}/{Status}/
function issueDestFolder(project, status) {
    const cleanProj = _safeName(project) || "Unfiled";
    if (status === "Archived") return `${ISSUE_ROOT}/Archived/${cleanProj}`;
    return `${ISSUE_ROOT}/${cleanProj}/${status}`;
}

// Moves a vault file at oldPath to the correct issues folder for project+status.
// Creates the destination folder if it doesn't exist.
// Returns the final path (may equal oldPath if no move was needed).
async function moveIssueTo(oldPath, project, status) {
    const V = await dc.require("Toolkit/Datacore/Vault.js");
    const destFolder = issueDestFolder(project, status);
    await V.ensureFolder(destFolder);
    const fileName = oldPath.split("/").pop();
    const newPath = `${destFolder}/${fileName}`;
    if (oldPath !== newPath) {
        const file = dc.app.vault.getAbstractFileByPath(oldPath);
        if (file) try { await dc.app.fileManager.renameFile(file, newPath); } catch (_) {}
    }
    return newPath;
}

// Inlined so this module has no top-level dc.require dependency.
function _safeName(s) {
    return (s ?? "").replace(/[\\/:*?"<>|#^[\]]/g, "").trim();
}

return { ISSUE_ROOT, issueDestFolder, moveIssueTo };
