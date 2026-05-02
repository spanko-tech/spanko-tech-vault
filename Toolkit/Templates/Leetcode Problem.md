<%* 
let url = await tp.system.prompt("Paste the LeetCode problem URL:");
url = tp.user.leetcode_scrapper.cleanUrl(url);
let problem = await tp.user.leetcode_scrapper.scrapProblem(tp, url);
let problemRaw = problem;
let note_name = problem.questionFrontendId + " - " + problem.title;
note_name = note_name.replace(/[<>:"/\\|?*]/g, '');
let current_folder = tp.file.folder(true); // Get current folder
let folder_path = current_folder + "/" + note_name;

// Move the file first, then download images
await tp.file.move(folder_path + "/" + note_name);
problem.content = await tp.user.image_downloader(tp, problem.content);
problem.content = tp.obsidian.htmlToMarkdown(problem.content);
%>---
aliases: [LC-<% problem.questionFrontendId %>]
tags: [fabrica/leetcode, fabrica/leetcode/difficulty/<% problem.difficulty.toLowerCase() %> <%* problem.topicTags.forEach(tag => {const tagName = tag.name.toLowerCase().replace(/\s+/g, '-'); tR += `, fabrica/leetcode/topic/${tagName}`;}); %>]
link: <% url %>
id: <% problem.questionFrontendId %>
difficulty: <% problem.difficulty %>
status: To Do
topics: [<%* problem.topicTags.forEach(tag => {tR += `${tag.name}, `;}); %>]
---
# <% note_name %>
[View on LeetCode](<% url %>)

<% problem.content %>

## Hints
<%* 
if (problem.hints && Array.isArray(problem.hints) && problem.hints.length > 0) {
    problem.hints.forEach(hint => { 
        tR += `> [!hint]- Hint\n> ${hint}\n\n`;
    });
} else {
    tR += "No hints available.\n\n";
} 
_%>

## Similar Questions
<%* 
const DIFF_EMOJI = { Easy: "🟢", Medium: "🟡", Hard: "🔴" };
if (problem.similarQuestions) {
    try {
        const similarQuestions = JSON.parse(problem.similarQuestions);
        if (Array.isArray(similarQuestions) && similarQuestions.length > 0) {
            similarQuestions.forEach(question => { 
                const emoji = DIFF_EMOJI[question.difficulty] ?? "";
                tR += `- ${emoji} [${question.title}](https://leetcode.com/problems/${question.titleSlug}/)\n`;
            });
        } else {
            tR += "No similar questions available.\n\n";
        }
    } catch (error) {
        tR += "Error parsing similar questions.\n\n";
        console.error("Similar questions parse error:", error);
    }
} else {
    tR += "No similar questions available.\n\n";
} 
_%>

