document.addEventListener("DOMContentLoaded", async function () {
    let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (tab && tab.url.includes("youtube.com/watch")) {
        document.getElementById("video-url").value = tab.url;
    } else {
        document.getElementById("video-url").value = "Open a YouTube video";
    }

    // document.getElementById("summarize-btn").addEventListener("click", () => {
    //     document.getElementById("loading-spinner").style.display = "block";
    //     setTimeout(()=>{
    //         document.getElementById("loading-spinner").style.display = "none";
    //         alert("Summary feature coming soon!");
    //     }, 1000);
    // });
});

document.addEventListener("DOMContentLoaded", async function () {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab.url.includes("youtube.com/watch")) {
        document.getElementById("summary-result").innerText = "Please open a YouTube video first";
        return;
    }

    // Load previous summary for this video if it exists
    const videoId = new URLSearchParams(new URL(tab.url).search).get('v');
    const previousData = await chrome.storage.local.get(videoId);
    if (previousData[videoId]) {
        document.getElementById("summary-result").innerText = previousData[videoId];
        console.log("📝 Loaded previous summary for video:", videoId);
    }

    document.getElementById("summarize-btn").addEventListener("click", async () => {
        try {
            const loadingSpinner = document.getElementById("loading-spinner");
            const summaryResult = document.getElementById("summary-result");
            const summarizeBtn = document.getElementById("summarize-btn");
            
            // Update button state
            summarizeBtn.disabled = true;
            summarizeBtn.textContent = "Summarizing...";
            loadingSpinner.style.display = "block";
            summaryResult.innerText = "";

            // First inject the content script
            await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                files: ['content.js']
            });

            // Wait a bit for the script to initialize
            await new Promise(resolve => setTimeout(resolve, 1000));

            // Get transcript
            const transcriptResponse = await new Promise((resolve, reject) => {
                chrome.tabs.sendMessage(tab.id, { action: "getTranscript" }, (response) => {
                    if (chrome.runtime.lastError) {
                        reject(new Error(chrome.runtime.lastError.message));
                    } else {
                        resolve(response);
                    }
                });
            });

            if (transcriptResponse.error) {
                document.getElementById("summary-result").innerHTML = 
                    `<div class="error-message">
                        ${transcriptResponse.error}<br>
                        Please make sure:
                        <ul>
                            <li>The video has captions/subtitles available</li>
                            <li>You're on a YouTube video page</li>
                            <li>The video has finished loading</li>
                        </ul>
                    </div>`;
                return;
            }

            if (!transcriptResponse || !transcriptResponse.transcript) {
                throw new Error("No transcript available");
            }

            console.log("📝 Full Transcript:", transcriptResponse.transcript);
            console.log("Transcript length:", transcriptResponse.transcript.length, "characters");

            // Call Gemini API
            const summary = await summarizeText(transcriptResponse.transcript);
            
            console.log("✨ Generated Summary:", summary);
            console.log("Summary length:", summary.length, "characters");
            
            // Save summary to Chrome storage
            await chrome.storage.local.set({
                [videoId]: summary
            });
            
            // Update the summary with some formatting
            summaryResult.innerHTML = summary
                .split('\n\n')
                .map(paragraph => `<p>${paragraph}</p>`)
                .join('');

        } catch (error) {
            console.error("Error:", error);
            document.getElementById("summary-result").innerHTML = 
                `<div class="error-message">❌ Error: ${error.message}</div>`;
        } finally {
            document.getElementById("loading-spinner").style.display = "none";
            const summarizeBtn = document.getElementById("summarize-btn");
            summarizeBtn.disabled = false;
            summarizeBtn.textContent = "Summarize Video";
        }
    });
});

async function summarizeText(text) {
    try {
        console.log("Starting summarization with Gemini...");
        const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
        
        const maxLength = 30000; // Gemini can handle longer texts
        const truncatedText = text.length > maxLength ? text.substring(0, maxLength) : text;

        console.log("📊 Text length being sent to API:", truncatedText.length, "characters");

        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    contents: [{
                        parts: [{
                            text: `Please provide a concise summary of this YouTube video transcript in 3-4 paragraphs:\n\n${truncatedText}`
                        }]
                    }],
                    generationConfig: {
                        temperature: 0.7,
                        topK: 40,
                        topP: 0.95,
                        maxOutputTokens: 1024,
                    }
                })
            }
        );

        if (!response.ok) {
            const errorData = await response.text();
            console.error("❌ API Error Response:", errorData);
            throw new Error(errorData || 'API request failed');
        }

        const result = await response.json();
        console.log("📥 Raw Gemini API Response:", result);

        if (result.candidates && result.candidates[0].content.parts[0].text) {
            return result.candidates[0].content.parts[0].text;
        } else {
            throw new Error("Invalid response format from Gemini API");
        }

    } catch (error) {
        console.error("❌ Summarization error:", error);
        throw new Error(`Failed to generate summary: ${error.message}`);
    }
}
