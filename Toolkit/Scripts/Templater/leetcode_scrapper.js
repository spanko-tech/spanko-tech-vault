const path = require('path');
const fs = require('fs');

let templater = null;

const requestHeaders = {
  Accept: "*/*",
  "User-Agent": "leet-problem-scraper",
  "Content-Type": "application/json",
};

function extractProblemId(url) {
    const match = url.match(/leetcode\.com\/problems\/([^\/]+)/);
    return match ? match[1] : null;
}

function cleanUrl(url) {
    const titleSlug = extractProblemId(url);
    return `https://leetcode.com/problems/${titleSlug}/`;
}

function extractStudyPlan(url) {
    try {
        const u = new URL(url);
        return u.searchParams.get("envId") || null;
    } catch {
        return null;
    }
}

async function scrapLeetcodeProblem(templaterInstance, url)
{
    templater = templaterInstance;
    const problemId = extractProblemId(url);
    if (!problemId) {
        console.error("Invalid LeetCode URL");
        return;
    }
    const gqlBody = { 
        query: `query questionData($titleSlug: String!) {
            question(titleSlug: $titleSlug) {
                questionFrontendId
                title
                titleSlug
                content
                difficulty
                similarQuestions
                topicTags {
                    name
                }
                hints
                exampleTestcases
            }
        }`,
        variables: { titleSlug: problemId }
    };

    const requestContent = JSON.stringify(gqlBody);

    const response = await templater.obsidian.request({
        url: "https://leetcode.com/graphql",
        method: "POST",
        body: requestContent,
        headers: requestHeaders,
    });

    const problem = await JSON.parse(response);
    return problem.data.question;
}

module.exports = {
    cleanUrl: (url) => cleanUrl(url),
    extractStudyPlan: (url) => extractStudyPlan(url),
    scrapProblem: async (tp, url) => await scrapLeetcodeProblem(tp, url),
};