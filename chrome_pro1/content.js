

// Function to get video transcript
async function getTranscript() {
    try {
        console.log("Attempting to fetch transcript...");

        // Locate the "More actions" button
        const moreActionsButton = document.querySelector(`
            button[aria-label="More actions"],
            button.ytp-button[aria-label="More actions"],
            .ytp-more-button,
            .ytp-button[aria-label="More"],
            ytd-button-renderer#button-shape button[aria-label="More actions"]
        `);

        if (!moreActionsButton) {
            console.warn("More actions button not found. Trying alternative method...");
            const menuButton = document.querySelector(`
                ytd-menu-renderer[class="style-scope ytd-watch-metadata"] button,
                yt-button-shape button[aria-label="More actions"]
            `);
            if (menuButton) {
                menuButton.dispatchEvent(new Event("click", { bubbles: true }));
            } else {
                return "Cannot find menu button";
            }
        } else {
            moreActionsButton.dispatchEvent(new Event("click", { bubbles: true }));
        }

        await new Promise(resolve => setTimeout(resolve, 1200));

        // Find the "Show transcript" button
        let menuItems = Array.from(document.querySelectorAll(`
            ytd-menu-service-item-renderer,
            tp-yt-paper-item,
            ytd-menu-item-renderer
        `));

        const transcriptButton = menuItems.find(item => {
            const text = (item.textContent || item.innerText || '').toLowerCase();
            return text.includes('transcript') || text.includes('show transcript');
        });

        if (!transcriptButton) {
            const allButtons = Array.from(document.querySelectorAll('button, [role="menuitem"]'));
            const altTranscriptButton = allButtons.find(button => {
                const text = (button.textContent || button.innerText || '').toLowerCase();
                return text.includes('transcript') || text.includes('show transcript');
            });

            if (altTranscriptButton) {
                altTranscriptButton.dispatchEvent(new Event("click", { bubbles: true }));
            } else {
                return "No transcript option available - Please ensure the video has transcripts enabled";
            }
        } else {
            transcriptButton.dispatchEvent(new Event("click", { bubbles: true }));
        }

        console.log("Transcript button clicked, waiting for transcript to appear...");

        // Wait for transcript to load
        await new Promise(resolve => setTimeout(resolve, 1500));

        // Get transcript text
        const transcriptContainer = document.querySelector("ytd-transcript-renderer");
        if (transcriptContainer) {
            const texts = transcriptContainer.querySelectorAll("yt-formatted-string");
            const transcript = Array.from(texts).map(t => t.innerText).join(" ");
            return transcript.trim() || "Transcript is empty.";
        }

        return "No transcript available.";
    } catch (error) {
        console.error("Error fetching transcript:", error);
        return `Error: ${error.message}`;
    }
}

// Listen for messages from popup.js
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "getTranscript") {
        getTranscript().then(transcript => {
            sendResponse({ transcript });
        });
        return true; // Required for async response
    }
});

