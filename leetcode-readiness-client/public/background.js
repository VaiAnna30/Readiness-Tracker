// 1. GLOBAL CONFIGURATION: Set the side panel to open on icon click immediately
if (chrome.sidePanel) {
    chrome.sidePanel
      .setPanelBehavior({ openPanelOnActionClick: true })
      .catch((error) => console.error("Side Panel Error:", error));
}

// 2. EVENT LISTENER: Wait for the React app to ask for stats
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "fetchStats") {
        
        // The Upgraded GraphQL Query
        const query = `
            query getUserProfile($username: String!) {
                matchedUser(username: $username) {
                    submitStats: submitStatsGlobal {
                        acSubmissionNum {
                            difficulty
                            count
                        }
                    }
                    tagProblemCounts {
                        advanced { tagName problemsSolved }
                        intermediate { tagName problemsSolved }
                        fundamental { tagName problemsSolved }
                    }
                }
            }
        `;

        fetch('https://leetcode.com/graphql', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                query: query,
                variables: { username: request.username }
            })
        })
        .then(response => response.json())
        .then(data => {
            sendResponse({ success: true, data: data });
        })
        .catch(error => {
            sendResponse({ success: false, error: error.message });
        });

        // Required to tell Chrome we will send the response asynchronously
        return true; 
    }
});