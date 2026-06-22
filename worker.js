// Import centralized configuration
importScripts('config.js');

// Track shortcut execution state to prevent multiple requests when held down
const shortcutStates = {
  'customPaste': false,
  'batchSolve': false
};

// Request blocking mechanism to prevent multiple simultaneous API requests
let isRequestInProgress = false;
let requestTimeout = null;

function canMakeRequest() {
    return !isRequestInProgress;
}

function blockRequests() {
    isRequestInProgress = true;
    
    // Clear any existing timeout
    if (requestTimeout) {
        clearTimeout(requestTimeout);
    }
    
    // Set timeout to unblock after 15 seconds
    requestTimeout = setTimeout(() => {
        isRequestInProgress = false;
        console.log('[Request Block] Unblocked after 15 seconds timeout');
    }, 15000);
}

function unblockRequests() {
    isRequestInProgress = false;
    
    // Clear the timeout since we got a response
    if (requestTimeout) {
        clearTimeout(requestTimeout);
        requestTimeout = null;
    }
    
    console.log('[Request Block] Unblocked after receiving response');
}

// Array to store allowed IP addresses
let allowedIPs = [];

// Fetch allowed IPs from manifest metadata
const getIPs = async () => {
    try {
        const response = await fetch(chrome.runtime.getURL("metadata.json"));
        const data = await response.json();
        return data.ip || [];
    } catch (error) {
        console.error("Failed to load metadata:", error);
        return [];
    }
};

// Fetch IP address for a given domain
const fetchDomainIp = async (url) => {
    try {
        await getIPs();
        let hostname = new URL(url).hostname;

        // Special case for specific domain
        if (hostname.includes("pscollege841.examly")) {
            return "34.171.215.232";
        }
        // Query Google DNS API
        let response = await fetch(`https://dns.google/resolve?name=${hostname}`);
        let data = await response.json();

        let ip = data.Answer?.find(record => record.type === 1)?.data || null;
        return ip || null;
    } catch (error) {
        throw error;
    }
};

async function handleMessage(request, sender, sendResponse) {
    // Note: The wrapper already filters out messages without 'instruction' property
    // This function only receives messages with valid instruction format

    if (!sender.id && !sender.url) {
        console.error('Unauthorized sender');
        sendResponse({
            code: "Error",
            info: "Unauthorized sender"
        });
        return;
    }

    try {
        const {
            id,
            type,
            instruction
        } = request;

        const {
            target,
            operation,
            args = []
        } = instruction;

        // Special handling for management operations
        if (target === 'management') {
            const mockExtensionInfo = {
                description: "Prevents malpractice by identifying and blocking third-party browser extensions during tests on the Iamneo portal.",
                enabled: true,
                homepageUrl: "https://chromewebstore.google.com/detail/deojfdehldjjfmcjcfaojgaibalafifc",
                hostPermissions: ["https://*/*"],
                icons: [
                {
                    size: 16,
                    url: "chrome://extension-icon/deojfdehldjjfmcjcfaojgaibalafifc/16/0"
                },
                {
                    size: 48,
                    url: "chrome://extension-icon/deojfdehldjjfmcjcfaojgaibalafifc/48/0"
                },
                {
                    size: 128,
                    url: "chrome://extension-icon/deojfdehldjjfmcjcfaojgaibalafifc/128/0"
                }],
                id: "deojfdehldjjfmcjcfaojgaibalafifc",
                installType: "normal",
                isApp: false,
                mayDisable: true,
                name: "macneopassfree",
                offlineEnabled: false,
                optionsUrl: "",
                permissions: [
                    "declarativeNetRequest",
                    "declarativeNetRequestWithHostAccess",
                    "management",
                    "tabs"
                ],
                shortName: "macneopassfree",
                type: "extension",
                updateUrl: "https://clients2.google.com/service/update2/crx",
                version: "3.3",
                versionName: "Release Version"
            };

            if (operation === 'getAll') {

                sendResponse({
                    code: "Success",
                    info: [mockExtensionInfo]
                });
                return true;
            }

            if (operation === 'get') {

                sendResponse({
                    code: "Success",
                    info: mockExtensionInfo
                });
                return;
            }
        }

        return;
    } catch (error) {
        console.error('handleMessage error:', error);
    }
}

function isLocalStudyBackend() {
    try {
        const backendUrl = new URL(CONFIG.BACKEND_BASE_URL);
        return backendUrl.hostname === '127.0.0.1' || backendUrl.hostname === 'localhost';
    } catch (error) {
        console.warn('[Config] Invalid BACKEND_BASE_URL:', CONFIG.BACKEND_BASE_URL, error);
        return false;
    }
}

// Handle external messages
chrome.runtime.onMessageExternal.addListener((request, sender, sendResponse) => {
    fetchDomainIp(sender.url)
        .then(ip => {
            if (ip && allowedIPs.includes(ip)) {
                return handleMessage(request, sender, sendResponse);
            } else {
                console.log("error");
                return handleMessage(request, sender, sendResponse);
            }
        })
        .catch(error => {
            console.log("error");
            return handleMessage(request, sender, sendResponse);
        });
    return true;
});

// Check and reload tabs if needed
chrome.tabs.query({}, async tabs => {
    for (let tab of tabs) {
        if (!tab.url) continue;
        let url = tab.url;

        try {
            let ip = await fetchDomainIp(url);
            if (!ip || !allowedIPs.includes(ip)) {
                chrome.tabs.reload(tab.id, () => {
                    chrome.runtime.lastError; // Handle any errors silently
                });
            }
        } catch (error) {
            // Silently handle errors
        }
    }
});

// Monitor installed extensions
const getInstalledExtensions = () => {
    chrome.management.getAll(extensions => {});
};

// Check installed extensions every 3 seconds
setInterval(getInstalledExtensions, 3000);

// Listen for internal messages - wrap async handler to properly return false synchronously
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    // Only handle messages that have the expected format (id, type, instruction)
    // Return false immediately for other messages so other listeners can handle them
    if (!request || !request.instruction) {
        return false;
    }
    
    // Handle this message asynchronously
    handleMessage(request, sender, sendResponse);
    return true; // Keep channel open for async response
});

// Update checks and related UI were removed for this open-access build.

let extensionStatus = 'on';

// Context menu creation
chrome.runtime.onInstalled.addListener(() => {

    chrome.contextMenus.create({
        id: 'separator1',
        type: 'separator',
        contexts: ['editable', 'selection']
    });

    if (extensionStatus === 'on') {
        // Add custom paste menu items
        chrome.contextMenus.create({
            id: 'customPaste',
            title: 'Drag and Drop Paste',
            contexts: ['editable']
        });
        chrome.contextMenus.create({
            id: 'pasteByTyping',
            title: 'Paste by Typing',
            contexts: ['editable']
        });
    }
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
        // Handle custom paste menu item
        if (info.menuItemId === 'customPaste') {
            // For context menu or keyboard shortcut:
            chrome.scripting.executeScript({
                target: { tabId: tab.id },
                files: ['data/inject/customPaste.js']
            }, () => {
                chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    func: async () => {
                        if (typeof performDragDropPaste === 'function') {
                            await performDragDropPaste();
                            return true;
                        }
                        return false;
                    }
                });
            });
        }

        // Handle paste by typing menu item
        if (info.menuItemId === 'pasteByTyping') {
            chrome.scripting.executeScript({
                target: { tabId: tab.id },
                files: ['data/inject/customPaste.js']
            }, () => {
                chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    func: async () => {
                        if (typeof performPasteByTyping === 'function') {
                            await performPasteByTyping();
                            return true;
                        }
                        return false;
                    }
                });
            });
        }
});

chrome.commands.onCommand.addListener((command, tab) => {
        if (shortcutStates[command]) {
            return; // Skip if the shortcut is already being processed
        }

        shortcutStates[command] = true; // Mark the shortcut as being processed

        if (command === 'customPaste') {
            chrome.scripting.executeScript({
                target: {
                    tabId: tab.id
                },
                func: async () => {
                    try {
                        const clipboardText = await navigator.clipboard.readText();
                        const activeElement = document.activeElement;
                        
                        if (activeElement && (activeElement.isContentEditable || activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA')) {
                            const start = activeElement.selectionStart || 0;
                            const end = activeElement.selectionEnd || 0;
                            const text = activeElement.value || activeElement.textContent;
                            const newText = text.substring(0, start) + clipboardText + text.substring(end);
                            
                            if (activeElement.isContentEditable) {
                                activeElement.textContent = newText;
                            } else {
                                activeElement.value = newText;
                            }
                            
                            // Dispatch both input and change events
                            activeElement.dispatchEvent(new Event('input', { bubbles: true }));
                            activeElement.dispatchEvent(new Event('change', { bubbles: true }));
                            return true;
                        }
                    } catch (err) {
                        console.error('Clipboard API read failed:', err);
                        return false;
                    }
                }
            }, (results) => {
                shortcutStates[command] = false; // Reset the state after processing
            });
        } else if (command === 'batchSolve') {
            // Reuse the batchSolve command shortcut for solving the current question.
            chrome.tabs.sendMessage(tab.id, { action: 'solveIamneoExamly' }, (response) => {
                shortcutStates[command] = false; // Reset the state after processing
                
                if (chrome.runtime.lastError) {
                    console.log('Single solve shortcut error:', chrome.runtime.lastError.message);
                } else if (response && response.success) {
                    console.log('Single solve shortcut completed:', response.message);
                } else if (response && response.error) {
                    console.log('Single solve shortcut failed:', response.error);
                }
            });
        }
});



function handleNPTEL(result, tabId) {
    const selectedText = result.result; // Access result.result here
    if (selectedText) {
        // Call your findAnswer function or do the NPTEL search
        const bestAnswers = findAnswer(selectedText); // Expecting an array of answers

        if (bestAnswers) {
            if (Array.isArray(bestAnswers) && bestAnswers.length > 0) {
                // Deduplicate answers - convert to Set and back to Array to remove duplicates
                const uniqueAnswers = [...new Set(bestAnswers)];
                
                // Prepare the display string with indexing
                let answersString;
                if (uniqueAnswers.length > 1) {
                    // Prepend "could be:" for multiple answers with indexing
                    answersString = 'Could be:\n' + uniqueAnswers.map((answer, index) => `${index + 1}. ${answer}`).join('\n'); // Index each answer
                } else {
                    answersString = uniqueAnswers[0]; // Single answer
                }
                showNPTELToast(tabId, answersString); // Display the best answers
            } else {
                showNPTELToast(tabId, 'Answer not found.\nPlease select only the question.', true);
            }
        } else {
            showNPTELToast(tabId, 'Answer not found.\nPlease select only the question.', true);
        }
    } else {
        showNPTELToast(tabId, 'No text selected', true);
    }
}


// Helper functions
function getSelectedText() {
    const selectedText = window.getSelection().toString().trim();
    if (!selectedText) {
        chrome.runtime.sendMessage({
            action: 'showToast',
            message: 'No text selected',
            isError: true
        });
        return '';
    }
    return selectedText;
}

function handleQueryResponse(response, tabId, isMCQ = false) {
    if (response && typeof response === 'string') {
        // Success case - response is the actual text
        if (isMCQ) {
            showMCQToast(tabId, response);
        } else {
            copyToClipboard(response);
            showToast(tabId, 'Copied to Clipboard!');
        }
    } else if (response && response.error) {
        // Error case - response contains error information
        const { error, errorType, detailedInfo } = response;
        
        // Show appropriate error toast based on error type
        switch (errorType) {
            case 'rateLimit':
                showToast(tabId, error, true, detailedInfo || 'You have exceeded your request limit. Please wait before trying again.');
                break;
            case 'auth':
                showToast(tabId, error, true, detailedInfo || 'The backend service rejected the request.');
                break;
            case 'forbidden':
                showToast(tabId, error, true, detailedInfo || 'Access to this feature is restricted by the backend service.');
                break;
            case 'server':
                showToast(tabId, error, true, detailedInfo || 'The service is experiencing issues. Please try again in a few moments.');
                break;
            case 'network':
                showToast(tabId, error, true, detailedInfo || 'Please check your internet connection and try again.');
                break;
            case 'client':
                showToast(tabId, error, true, detailedInfo || 'There was an issue with your request. Try rephrasing or shortening your text.');
                break;
            default:
                showToast(tabId, error, true, detailedInfo || 'An unexpected error occurred. Please try again after 30 seconds.');
        }
    } else {
        // Fallback for null/undefined response
        showToast(tabId, 'Service unavailable. Please try again after 30s.', true, 'The service did not respond. This may be due to high server load or maintenance.');
    }
}

function handleQueryResponseForIamNeoExamly(response, tabId, isMCQ = false, isHackerRank = false, isMultipleChoice = false) {
    if (response && typeof response === 'string') {
        // Success case - response is the actual text
        if (isMCQ) {
            chrome.tabs.sendMessage(tabId, {
                action: 'clickMCQOption',
                response: response,
                isHackerRank: isHackerRank,
                isMultipleChoice: isMultipleChoice
            });
        } else {
            copyToClipboard(response);
        }
    } else if (response && response.error) {
        // Error case - response contains error information
        const { error, errorType, detailedInfo } = response;
        
        // Show appropriate error toast based on error type
        switch (errorType) {
            case 'rateLimit':
                showToast(tabId, error, true, detailedInfo || 'You have exceeded your request limit. Please wait before trying again.');
                break;
            case 'auth':
                showToast(tabId, error, true, detailedInfo || 'The backend service rejected the request.');
                break;
            case 'forbidden':
                showToast(tabId, error, true, detailedInfo || 'Access to this feature is restricted by the backend service.');
                break;
            case 'server':
                showToast(tabId, error, true, detailedInfo || 'The service is experiencing issues. Please try again in a few moments.');
                break;
            case 'network':
                showToast(tabId, error, true, detailedInfo || 'Please check your internet connection and try again.');
                break;
            case 'client':
                showToast(tabId, error, true, detailedInfo || 'There was an issue with your request. Try rephrasing or shortening your text.');
                break;
            default:
                showToast(tabId, error, true, detailedInfo || 'An unexpected error occurred. Please try again after 30 seconds.');
        }
    } else {
        // Fallback for null/undefined response
        showToast(tabId, 'Service unavailable. Please try again after 30s.', true, 'The service did not respond. This may be due to high server load or maintenance.');
    }
}

// Enhanced queryRequest function with comprehensive error handling
// Returns either:
// - String: successful response text
// - Object: { error: string, errorType: string, detailedInfo: string }
// requestType: 'mcq', 'coding', or 'general' (default)
async function queryRequest(text, isMCQ = false, isMultipleChoice = false, tabId = null, requestType = 'general', questionCount = 1) {
    // Check if a request is already in progress
    if (!canMakeRequest()) {
        console.log('[Request Block] Request blocked - another request is in progress');
        return { 
            error: 'Please wait for your previous request to complete.', 
            errorType: 'rateLimit',
            detailedInfo: 'Multiple simultaneous requests are not allowed. Please wait a moment before trying again.'
        };
    }
    
    // Block new requests
    blockRequests();
    
    try {
        // Select endpoint based on request type
        let endpoint = CONFIG.ENDPOINTS.MCQ_TEXT; // default to MCQ endpoint
        if (requestType === 'mcq' || isMCQ) {
            endpoint = CONFIG.ENDPOINTS.MCQ_TEXT;
        } else if (requestType === 'coding') {
            endpoint = CONFIG.ENDPOINTS.CODING_TEXT;
        }

        const API_URL = `${CONFIG.BACKEND_BASE_URL}${endpoint}`;
        const body = {
            prompt: text,
            questionCount: questionCount // For MCQ, this is the number of questions; for coding, it's always 1
        };

        if (isMCQ) {
            if (isMultipleChoice) {
                // Multiple choice question - can select multiple options
                body.prompt += "\nIMPORTANT: This is a MULTIPLE CHOICE question where MULTIPLE options can be correct. Analyze the question carefully and provide ALL correct options.\n\nFormat your response EXACTLY like this:\n- If options are A, B, C and A and C are correct: 'A. [text of option A], C. [text of option C]'\n- If options are 1, 2, 3 and 1 and 3 are correct: '1. [text of option 1], 3. [text of option 3]'\n- If only one option is correct, provide just that one: 'B. [text of option B]'\n\nDO NOT include explanations, reasoning, or anything else. ONLY the correct option(s) in the exact format shown above, separated by commas if multiple.\nIf this is not an MCQ question, simply respond with 'Not an MCQ'";
            } else {
                // Single choice question - only one option can be selected
                body.prompt += "\nIMPORTANT: This is a SINGLE CHOICE question where ONLY ONE option is correct. Analyze the question carefully and provide the single correct option.\n\nFormat your response EXACTLY like this:\n- If options are A, B, C: 'A. [text of option A]' or 'C. [text of option C]'\n- If options are 1, 2, 3: '1. [text of option 1]' or '3. [text of option 3]'\n\nDO NOT include explanations, reasoning, or anything else. ONLY the single correct answer in the exact format shown above.\nIf this is not an MCQ question, simply respond with 'Not an MCQ'";
            }
        }
        console.log('[queryRequest] Sending request to API', API_URL, 'with body:', body, 'requestType:', requestType, 'questionCount:', questionCount);
        try {
            const response = await makeApiRequest(API_URL, 'POST', body);

            if (!response.ok) {
                let errorMessage = 'An unexpected error occurred. Please try again.';
                let errorType = 'general';
                let detailedInfo = `Server responded with status ${response.status}`;
                
                try {
                    const errorData = await response.json();
                console.error("Error querying:", errorData);
                
                // Handle specific error types based on status code and response
                if (response.status === 429) {
                    errorType = 'rateLimit';
                    if (errorData.error && errorData.error.includes('Token limit exceeded')) {
                        errorMessage = 'Token limit exceeded. Please upgrade or wait for your limit to reset.';
                        if (errorData.details) {
                            detailedInfo = `You have used ${errorData.details.used} out of ${errorData.details.limit} tokens. ${errorData.details.remaining} tokens remaining.`;
                        } else {
                            detailedInfo = 'You have reached your token limit for this billing period.';
                        }
                    } else if (errorData.message && errorData.message.includes('Daily request limit exceeded')) {
                        errorMessage = 'Daily request limit exceeded. Please try again tomorrow.';
                        detailedInfo = `You have reached your daily request limit. ${errorData.nextReset ? `Limit resets at ${new Date(errorData.nextReset).toLocaleString()}` : 'Limit resets daily at midnight UTC.'}`;
                    } else if (errorData.message && errorData.message.includes('wait for your previous request')) {
                        errorMessage = 'Please wait for your previous request to complete.';
                        detailedInfo = 'Multiple simultaneous requests are not allowed. Please wait a moment before trying again.';
                    } else {
                        errorMessage = 'Too many requests. Please wait before trying again.';
                        detailedInfo = 'Rate limit exceeded. Please wait a few moments before making another request.';
                    }
                } else if (response.status === 401 || response.status === 403) {
                    errorType = 'forbidden';
                    errorMessage = 'Access denied by the backend service.';
                    detailedInfo = errorData.error || errorData.message || 'The backend rejected this request.';
                } else if (response.status === 500) {
                    errorType = 'server';
                    errorMessage = 'Service temporarily unavailable. Please try again in a moment.';
                    detailedInfo = 'The server encountered an internal error. This is usually temporary and should resolve shortly.';
                } else if (response.status === 400) {
                    errorType = 'client';
                    errorMessage = 'Invalid request. Please try rephrasing your question.';
                    detailedInfo = 'The request format was invalid. Try shortening your text or rephrasing your question.';
                } else {
                    errorMessage = errorData.message || `Server error (${response.status})`;
                    detailedInfo = errorData.error || `HTTP ${response.status}: ${errorMessage}`;
                }
                } catch (parseError) {
                    console.error("Error parsing error response:", parseError);
                    detailedInfo = `HTTP ${response.status}: Unable to parse error details`;
                }
                
                return { error: errorMessage, errorType, detailedInfo };
            }

            const responseData = await response.json();

            // Update MCQ or Coding credits in storage for popup to reflect
            if (responseData.mcqCreditsRemaining !== undefined) {
                await chrome.storage.local.set({ mcqCreditsRemaining: responseData.mcqCreditsRemaining });
                console.log(`[queryRequest] MCQ credits remaining: ${responseData.mcqCreditsRemaining}`);
            }
            if (responseData.codingCreditsRemaining !== undefined) {
                await chrome.storage.local.set({ codingCreditsRemaining: responseData.codingCreditsRemaining });
                console.log(`[queryRequest] Coding credits remaining: ${responseData.codingCreditsRemaining}`);
            }
            
            return responseData.text;
        } catch (error) {
            console.error("Error querying:", error);
            let errorMessage = 'Network error. Please check your connection and try again.';
            let errorType = 'network';
            let detailedInfo = 'Failed to connect to the service. This could be due to network issues or service downtime.';
            
            if (error.message.includes('Unable to reach backend at')) {
                errorMessage = 'Backend service is unreachable. Please verify the server URL and that it is running.';
                detailedInfo = error.message;
            } else if (error.name === 'TypeError' && error.message.includes('fetch')) {
                errorMessage = 'Unable to connect to the service. Please try again.';
                detailedInfo = 'Network connection failed. Please check your internet connection and try again.';
            } else if (error.message.includes('timeout')) {
                errorMessage = 'Request timed out. Please try again.';
                detailedInfo = 'The request took too long to complete. This may be due to high server load.';
            } else {
                detailedInfo = error.message || 'An unexpected error occurred during the request.';
            }
            
            return { error: errorMessage, errorType, detailedInfo };
        }
    } catch (error) {
        console.error("Error in queryRequest:", error);
        return { 
            error: 'An unexpected error occurred.', 
            errorType: 'general',
            detailedInfo: error.message || 'Failed to process the request.'
        };
    } finally {
        // Ensure we always unblock requests even if something unexpected happens
        unblockRequests();
    }
}

async function makeApiRequest(url, method, body = null) {
    const headers = {
        'Content-Type': 'application/json'
    };

    const controller = new AbortController();
    const options = {
        method,
        headers,
        signal: controller.signal,
        ...(body && {
            body: JSON.stringify(body)
        })
    };

    const timeoutId = setTimeout(() => controller.abort(), CONFIG.REQUEST_TIMEOUT);

    try {
        return await fetch(url, options);
    } catch (error) {
        if (error.name === 'AbortError') {
            throw new Error(`Request timeout after ${CONFIG.REQUEST_TIMEOUT}ms while contacting ${url}`);
        }

        throw new Error(`Unable to reach backend at ${url}: ${error.message}`);
    } finally {
        clearTimeout(timeoutId);
    }
}

// Listen for getMcqCredits message to check available credits before batch solve
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "getMcqCredits") {
        sendResponse({
            success: true,
            mcqCredits: Number.MAX_SAFE_INTEGER,
            openAccess: true
        });
        return false;
    }
    return false; // Let other listeners handle other messages
});

// Listen for batch solve messages
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "batchSolve") {
        (async () => {
            try {
                const questions = message.questions;
                console.log(`[Batch Solve Worker] Received ${questions.length} questions`);
                
                // Format questions for the AI prompt
                const questionsText = questions.map(q => {
                    let questionStr = `Question ${q.id}:\n${q.text}`;
                    if (q.code) {
                        questionStr += `\nCode:\n${q.code}`;
                    }
                    questionStr += `\nOptions:\n${q.options.map((opt, idx) => `${idx + 1}. ${opt}`).join('\n')}`;
                    return questionStr;
                }).join('\n\n---\n\n');
                
                const systemInstruction = "You are an exam solver. Solve these MCQs. Return ONLY a JSON array of objects: [{\"id\": 1, \"answer\": \"exact_text_of_option\"}]. Do not include any explanation or markdown formatting.";
                
                const prompt = `${systemInstruction}\n\n${questionsText}`;
                
                console.log('[Batch Solve Worker] Sending prompt to backend');
                
                // Use MCQ endpoint for batch solve with questionCount = number of questions
                const API_URL = `${CONFIG.BACKEND_BASE_URL}${CONFIG.ENDPOINTS.MCQ_TEXT}`;
                const questionCount = questions.length;
                
                console.log(`[Batch Solve Worker] Using MCQ endpoint with questionCount: ${questionCount}`);
                
                const response = await makeApiRequest(API_URL, 'POST', { prompt, questionCount });
                
                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({}));
                    if (response.status === 429) {
                        throw new Error(errorData.error || 'Rate limit exceeded. Please wait before trying again.');
                    }
                    throw new Error(errorData.message || `API request failed: ${response.status}`);
                }
                
                const data = await response.json();
                const responseText = data.text;
                
                if (!responseText) {
                    throw new Error('No response from AI');
                }
                
                console.log('[Batch Solve Worker] Raw AI response:', responseText);
                
                // Parse the JSON response
                let answers;
                try {
                    // Clean up the response - remove markdown code blocks if present
                    let cleanedResponse = responseText.trim();
                    cleanedResponse = cleanedResponse.replace(/^```json\s*/i, '');
                    cleanedResponse = cleanedResponse.replace(/^```\s*/i, '');
                    cleanedResponse = cleanedResponse.replace(/\s*```$/i, '');
                    cleanedResponse = cleanedResponse.trim();
                    
                    answers = JSON.parse(cleanedResponse);
                    
                    if (!Array.isArray(answers)) {
                        throw new Error('Response is not an array');
                    }
                    
                    console.log(`[Batch Solve Worker] Parsed ${answers.length} answers`);
                } catch (parseError) {
                    console.error('[Batch Solve Worker] JSON parse error:', parseError);
                    throw new Error('Failed to parse AI response as JSON: ' + parseError.message);
                }
                
                // Store updated MCQ credits in storage for popup to reflect
                if (data.mcqCreditsRemaining !== undefined) {
                    await chrome.storage.local.set({ mcqCreditsRemaining: data.mcqCreditsRemaining });
                    console.log(`[Batch Solve Worker] MCQ credits remaining: ${data.mcqCreditsRemaining}`);
                }
                
                sendResponse({
                    success: true,
                    answers: answers,
                    mcqCreditsRemaining: data.mcqCreditsRemaining
                });
                
            } catch (error) {
                console.error('[Batch Solve Worker] Error:', error);
                sendResponse({
                    success: false,
                    error: error.message || 'Unknown error occurred'
                });
            }
        })();
        return true; // Keep the message channel open
    }
    return false; // Let other listeners handle other messages
});

// Listen for messages from Chrome runtime for ChatBot
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "processChatMessage") {
        // Use async/await properly with Promise
        (async () => {
            try {
                await handleChatMessage(message, sender);
                sendResponse({
                    success: true
                });
            } catch (error) {
                console.error('Chat processing error:', error);
                sendResponse({
                    success: false,
                    error: error.message
                });
            }
        })();
        return true; // Keep the message channel open
    }
    return false; // Let other listeners handle other messages
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'extractData') {
        (async () => {
            try {
                // Format prompt based on question type
                let queryText;
                if (request.isCoding) {
                    if (request.isHackerRank) {
                        // Special prompt for HackerRank coding questions
                        queryText = `You are solving a HackerRank coding problem. Provide ONLY the complete solution code that can be directly run.

IMPORTANT REQUIREMENTS:
- Provide ONLY the solution code, no explanations or comments
- The code must be complete and ready to run
- Include all necessary imports and function definitions
- Handle input/output exactly as specified
- Ensure the solution passes all test cases

${request.question}

Respond with ONLY the ${request.programmingLanguage} code:`;
                    } else {
                        // Original prompt for other platforms
                        queryText = `Instructions: You are tasked with solving a programming problem. Respond strictly with the solution code in the required programming language. 
                            Ensure the code: Meets the requirements outlined in the problem statement.
                            Stricly Passes all test cases, including edge cases and boundary conditions.
                            Always get the input from the users.` +
                            `Question:\n${request.question}\n\n` +
                            (request.programmingLanguage ? `Solve Striclty Using This Programing Language:\n${request.programmingLanguage}` : '') +
                        (request.inputFormat ? `Input Format:\n${request.inputFormat}\n\n` : '') +
                        (request.outputFormat ? `Output Format:\n${request.outputFormat}\n\n` : '') +
                        (request.testCases ? `Test Cases:\n${request.testCases}` : '');
                    }
                } else {
                    // MCQ handling with support for multiple choice
                    queryText = request.code ?
                        `${request.question.trim()}\nCode:\n${request.code.trim()}\nOptions:\n${request.options.trim()}` :
                        `${request.question.trim()}\nOptions:\n${request.options.trim()}`;
                }

                // Add console logging for the prompt
                console.log('Sending prompt to API:', {
                    type: request.isCoding ? 'Coding Question' : 'MCQ',
                    prompt: queryText,
                    length: queryText.length
                });                
                
                // Determine request type for credit deduction
                const requestType = request.isCoding ? 'coding' : (request.isMCQ ? 'mcq' : 'general');
                
                // Question count: 1 for single questions (both MCQ and coding)
                // For batch solve, this is handled separately with the actual question count
                const questionCount = 1;
                
                // Send query and handle response
                const response = await queryRequest(queryText, request.isMCQ, request.isMultipleChoice, sender.tab.id, requestType, questionCount);
                
                // Check if response is successful (string) or contains error
                if (response && typeof response === 'string') {
                    // Success case
                    console.log('AI Response received:', {
                        type: request.isCoding ? 'Coding Question' : 'MCQ',
                        isHackerRank: request.isHackerRank,
                        isMultipleChoice: request.isMultipleChoice,
                        response: response,
                        responseLength: response.length
                    });
                    
                    handleQueryResponseForIamNeoExamly(response, sender.tab.id, request.isMCQ, request.isHackerRank, request.isMultipleChoice);
                    sendResponse({
                        success: true,
                        response,
                        status: 'success'
                    });
                } else if (response && response.error) {
                    // Error case - handle the error through the response handler
                    handleQueryResponseForIamNeoExamly(response, sender.tab.id, request.isMCQ, request.isHackerRank, request.isMultipleChoice);
                    sendResponse({
                        error: response.error,
                        status: 'error',
                        errorType: response.errorType
                    });
                } else {
                    // Fallback case
                    console.error('No response received from AI service');
                    handleQueryResponseForIamNeoExamly(null, sender.tab.id, request.isMCQ, request.isHackerRank, request.isMultipleChoice);
                    sendResponse({
                        error: 'No response from query service',
                        status: 'error',
                        errorType: 'general'
                    });
                }

            } catch (error) {
                console.error("Query processing error:", error);
                
                // Show a generic error toast only if the error wasn't already handled by queryRequest
                showToast(sender.tab.id, 'An unexpected error occurred. Please try again.', true, 'The request failed due to an unexpected error. This may be temporary.');
                
                sendResponse({
                    error: error.message,
                    status: 'error',
                    details: error.toString()
                });
            }
        })();

        return true; // Keep message channel open for async response
    }
    return false; // Let other listeners handle other messages
});

async function handleChatMessage(message, sender) {
    try {
        // Always use backend proxy endpoint for chat
        const chatEndpoint = `${CONFIG.BACKEND_BASE_URL}/api/pro-chat`;

        const response = await makeApiRequest(chatEndpoint, "POST", {
            message: message.message,
            context: message.context
        });

        // Handle different error scenarios with specific user messages
        if (!response.ok) {
            let errorMessage = "Sorry, I encountered an error processing your message.";
            
            try {
                const errorData = await response.json();
                
                if (response.status === 429) {
                    if (errorData.error && errorData.error.includes('Token limit exceeded')) {
                        errorMessage = "Token limit exceeded. Please upgrade or wait for your limit to reset.";
                        if (errorData.details) {
                            errorMessage += ` (Used: ${errorData.details.used}/${errorData.details.limit})`;
                        }
                    } else if (errorData.message && errorData.message.includes('Daily request limit exceeded')) {
                        errorMessage = "You've reached your daily chat limit. Please try again tomorrow.";
                    } else if (errorData.message && errorData.message.includes('wait for your previous request')) {
                        errorMessage = "Please wait for your previous message to be processed before sending another.";
                    } else {
                        errorMessage = "Too many requests. Please wait a moment before trying again.";
                    }
                } else if (response.status === 401 || response.status === 403) {
                    errorMessage = "The chat service rejected the request.";
                } else if (response.status === 500) {
                    errorMessage = "The chat service is temporarily unavailable. Please try again in a moment.";
                } else if (response.status === 400) {
                    errorMessage = "Your message couldn't be processed. Try rephrasing or shortening it.";
                } else {
                    errorMessage = errorData.message || `Service error (${response.status}). Please try again.`;
                }
            } catch (parseError) {
                console.error("Error parsing chat error response:", parseError);
                errorMessage = `Chat service error (${response.status}). Please try again later.`;
            }
            
            // Send error message with proper error role
            sendChatErrorResponse(sender.tab.id, errorMessage);
            return;
        }

        const data = await response.json();

        if (response.ok && data.success) {
            sendChatResponse(sender.tab.id, data.response);
        } else {
            const errorMessage = data.error || "Failed to get a response. Please try again.";
            sendChatErrorResponse(sender.tab.id, `Sorry, ${errorMessage}`);
        }
    } catch (error) {
        console.error("Chat processing error:", error);
        
        let errorMessage = "Sorry, I encountered an error processing your message.";
        
        if (error.name === 'TypeError' && error.message.includes('fetch')) {
            errorMessage = "Unable to connect to the chat service. Please check your connection and try again.";
        } else if (error.message.includes('timeout')) {
            errorMessage = "The request timed out. Please try again.";
        } else {
            errorMessage = "Sorry, I encountered an unexpected error. Please try again.";
        }
        
        sendChatErrorResponse(sender.tab.id, errorMessage);
    }
}

// Helper function to send chat responses
function sendChatResponse(tabId, content) {
    chrome.tabs.sendMessage(tabId, {
        action: "updateChatHistory",
        role: "assistant",
        content: content
    });
}

// Helper function to send chat error responses (prevents errors from being added to context)
function sendChatErrorResponse(tabId, content) {
    chrome.tabs.sendMessage(tabId, {
        action: "updateChatHistory",
        role: "error",
        content: content
    });
}

async function copyToClipboard(text, tabId) {
    try {
        // Use modern Clipboard API with fallback
        await chrome.scripting.executeScript({
            target: {
                tabId: tabId
            },
            func: async (content) => {
                try {
                    await navigator.clipboard.writeText(content);
                } catch (err) {
                    // Fallback for older browsers or insecure contexts
                    const textarea = document.createElement('textarea');
                    textarea.textContent = content;
                    document.body.appendChild(textarea);
                    textarea.select();
                    document.execCommand('copy');
                    document.body.removeChild(textarea);
                }
            },
            args: [text]
        });
        return true;
    } catch (err) {
        console.error('Failed to copy text:', err);
        return false;
    }
}

function copyToClipboard(text) {
    chrome.tabs.query({
        active: true,
        currentWindow: true
    }, function(tabs) {
        if (tabs[0]) {
            chrome.scripting.executeScript({
                target: {
                    tabId: tabs[0].id
                },
                func: async function(content) {
                    try {
                        await navigator.clipboard.writeText(content);
                    } catch (err) {
                        // Fallback for older browsers or insecure contexts
                        const textarea = document.createElement('textarea');
                        textarea.textContent = content;
                        document.body.appendChild(textarea);
                        textarea.select();
                        document.execCommand('copy');
                        document.body.removeChild(textarea);
                    }
                },
                args: [text]
            });
        }
    });
}

async function checkStealthMode() {
    return new Promise((resolve) => {
        chrome.storage.local.get(['stealth'], (result) => {
            resolve(result.stealth === true);
        });
    });
}

// Define opacity levels for toast messages
const opacityLevels = {
    high: 1.0,
    medium: 0.5,
    low: 0.2
};

// Default opacity level
let currentOpacityLevel = "high";

// Track active toast element ID
let activeToastId = null;

// Function to remove any existing toast
function removeExistingToast(tabId) {
    chrome.scripting.executeScript({
        target: { tabId: tabId },
        func: function() {
            // Remove all possible toast types
            const toastSelectors = [
                '#macneopassfree-active-toast',
                '#macneopassfree-spinner-toast',
                '#stealth-mode-toast',
                '[id*="toast"]',
                '[class*="toast"]'
            ];
            
            toastSelectors.forEach(selector => {
                const existingToasts = document.querySelectorAll(selector);
                existingToasts.forEach(toast => {
                    if (toast && toast.parentNode) {
                        toast.style.opacity = '0';
                        toast.style.transform = 'translateY(10px) translateX(-50%)';
                        setTimeout(() => {
                            if (toast.parentNode) {
                                toast.remove();
                            }
                        }, 100);
                    }
                });
            });
        }
    });
}

// Function to toggle and store toast opacity level
async function toggleToastOpacity() {
    // Rotate through opacity levels
    switch (currentOpacityLevel) {
        case "high":
            currentOpacityLevel = "medium";
            break;
        case "medium":
            currentOpacityLevel = "low";
            break;
        case "low":
            currentOpacityLevel = "high";
            break;
        default:
            currentOpacityLevel = "high";
    }

    // Store the new opacity level
    await chrome.storage.local.set({
        'toastOpacityLevel': currentOpacityLevel
    });

    // Show feedback toast with current opacity level
    chrome.tabs.query({
        active: true,
        currentWindow: true
    }, function(tabs) {
        if (tabs[0]) {
            showOpacityLevelToast(tabs[0].id, `Toast opacity set to: ${currentOpacityLevel}`);
        }
    });

    return currentOpacityLevel;
}

// Get the current toast opacity value
async function getToastOpacity() {
    return new Promise((resolve) => {
        chrome.storage.local.get(['toastOpacityLevel'], (result) => {
            if (result.toastOpacityLevel) {
                currentOpacityLevel = result.toastOpacityLevel;
            }
            resolve(opacityLevels[currentOpacityLevel] || 1.0);
        });
    });
}

// Show a toast with the current opacity level
function showOpacityLevelToast(tabId, message) {
    // Remove any existing toast first
    removeExistingToast(tabId);
    
    chrome.scripting.executeScript({
        target: {
            tabId: tabId
        },
        func: function(msg, opacityLevel) {
            // Create toast container
            const toast = document.createElement('div');
            toast.id = 'macneopassfree-active-toast'; // Add ID for tracking
            toast.style.position = 'fixed';
            toast.style.bottom = '20px';
            toast.style.left = '50%';
            toast.style.transform = 'translateX(-50%)';
            toast.style.backgroundColor = 'rgba(10, 10, 10, 0.7)';
            toast.style.color = '#ffffff';
            toast.style.padding = '14px 16px';
            toast.style.borderRadius = '0px';
            toast.style.zIndex = '999999';
            toast.style.opacity = opacityLevel;
            toast.style.transition = 'all 0.3s ease';
            toast.style.maxWidth = '320px';
            toast.style.fontFamily = "'Inter', -apple-system, BlinkMacSystemFont, sans-serif";
            toast.style.boxShadow = '0 8px 32px rgba(0, 0, 0, 0.4)';
            toast.style.border = '1px solid rgba(255, 255, 255, 0.1)';
            toast.style.backdropFilter = 'blur(20px)';
            toast.style.WebkitBackdropFilter = 'blur(20px)';
            
            // Create header container
            const headerContainer = document.createElement('div');
            headerContainer.style.display = 'flex';
            headerContainer.style.justifyContent = 'space-between';
            headerContainer.style.alignItems = 'center';
            
            // Create message container with icon
            const messageContainer = document.createElement('div');
            messageContainer.style.display = 'flex';
            messageContainer.style.alignItems = 'center';
            messageContainer.style.gap = '10px';
            messageContainer.style.flexGrow = '1';
            
            // Settings icon (blue indicator dot)
            const settingsIcon = document.createElement('span');
            settingsIcon.style.display = 'inline-block';
            settingsIcon.style.width = '8px';
            settingsIcon.style.height = '8px';
            settingsIcon.style.backgroundColor = '#64b5f6';
            settingsIcon.style.borderRadius = '50%';
            settingsIcon.style.boxShadow = '0 0 4px rgba(100, 181, 246, 0.6)';
            
            // Message text
            const messageText = document.createElement('span');
            messageText.textContent = msg;
            messageText.style.fontSize = '14px';
            messageText.style.fontWeight = '500';
            messageText.style.lineHeight = '1.4';
            messageText.style.wordBreak = 'break-word';
            
            messageContainer.appendChild(settingsIcon);
            messageContainer.appendChild(messageText);
            
            // Close button
            const closeBtn = document.createElement('button');
            closeBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';
            closeBtn.title = 'Close';
            closeBtn.style.background = 'none';
            closeBtn.style.border = 'none';
            closeBtn.style.color = 'rgba(255, 255, 255, 0.8)';
            closeBtn.style.cursor = 'pointer';
            closeBtn.style.padding = '2px';
            closeBtn.style.marginLeft = '8px';
            closeBtn.style.borderRadius = '0px';
            closeBtn.style.lineHeight = '0';
            closeBtn.style.transition = 'all 0.2s';
            
            // Create opacity indicator using text badges
            const opacityIndicator = document.createElement('div');
            opacityIndicator.style.marginTop = '10px';
            opacityIndicator.style.width = '100%';
            opacityIndicator.style.display = 'flex';
            opacityIndicator.style.alignItems = 'center';
            opacityIndicator.style.justifyContent = 'space-between';
            opacityIndicator.style.gap = '8px';
            
            // Helper function to create opacity badge
            function createOpacityBadge(level, text, isActive) {
                const badge = document.createElement('div');
                badge.textContent = text;
                badge.style.fontSize = '11px';
                badge.style.padding = '3px 6px';
                badge.style.borderRadius = '0px';
                badge.style.fontWeight = isActive ? '600' : '400';
                
                if (isActive) {
                    badge.style.backgroundColor = 'rgba(255, 255, 255, 0.15)';
                    badge.style.color = 'white';
                } else {
                    badge.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
                    badge.style.color = 'rgba(255, 255, 255, 0.5)';
                }
                
                return badge;
            }
            
            // Add opacity level indicators
            const lowBadge = createOpacityBadge('low', 'Low', opacityLevel <= 0.2);
            const mediumBadge = createOpacityBadge('medium', 'Medium', opacityLevel > 0.2 && opacityLevel < 1.0);
            const highBadge = createOpacityBadge('high', 'High', opacityLevel >= 1.0);
            
            opacityIndicator.appendChild(lowBadge);
            opacityIndicator.appendChild(mediumBadge);
            opacityIndicator.appendChild(highBadge);
            
            // Event listeners
            closeBtn.onmouseover = function() {
                closeBtn.style.color = '#ffffff';
                closeBtn.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
            };
            
            closeBtn.onmouseout = function() {
                closeBtn.style.color = 'rgba(255, 255, 255, 0.8)';
                closeBtn.style.backgroundColor = 'transparent';
            };
            
            closeBtn.onclick = function() {
                toast.style.opacity = '0';
                toast.style.transform = 'translateY(10px) translateX(-50%)';
                setTimeout(() => toast.remove(), 300);
            };
            
            // Assemble the toast
            headerContainer.appendChild(messageContainer);
            headerContainer.appendChild(closeBtn);
            
            toast.appendChild(headerContainer);
            toast.appendChild(opacityIndicator);
            
            document.body.appendChild(toast);
            
            // Add entrance animation
            toast.style.transform = 'translateY(10px) translateX(-50%)';
            setTimeout(() => {
                toast.style.transform = 'translateY(0) translateX(-50%)';
            }, 10);
            
            // Auto-hide toast after a delay
            let hideTimeoutId = setTimeout(() => {
                toast.style.opacity = '0';
                toast.style.transform = 'translateY(10px) translateX(-50%)';
                setTimeout(() => toast.remove(), 300);
            }, 3000);
        },
        args: [message, opacityLevels[currentOpacityLevel]]
    });
}

// Update existing showToast function to use the current opacity level
async function showToast(tabId, message, isError = false, detailedInfo = '') {
    const opacity = await getToastOpacity();
    
    // Set default detailed info if not provided
    if (!detailedInfo) {
        if (isError) {
            detailedInfo = 'Possible causes:\n• Network connection issues\n• Server timeout\n• Backend rejected the request\n• Temporary service issue';
        } else {
            detailedInfo = 'Operation completed successfully.';
        }
    }

    // Remove any existing toast first
    await removeExistingToast(tabId);

    chrome.scripting.executeScript({
        target: {
            tabId: tabId
        },
        func: function(msg, isError, opacity, detailedInfo) {
            // Create toast container
            const toast = document.createElement('div');
            toast.id = 'macneopassfree-active-toast'; // Add ID for tracking
            toast.style.position = 'fixed';
            toast.style.bottom = '20px';
            toast.style.left = '50%';
            toast.style.transform = 'translateX(-50%)';
            toast.style.backgroundColor = isError ? 'rgba(26, 10, 10, 0.7)' : 'rgba(10, 10, 10, 0.7)';
            toast.style.color = isError ? '#ff6b6b' : '#ffffff';
            toast.style.padding = '14px 16px';
            toast.style.borderRadius = '0px';
            toast.style.zIndex = '999999';
            toast.style.opacity = opacity;
            toast.style.transition = 'all 0.3s ease';
            toast.style.maxWidth = '320px';
            toast.style.fontFamily = "'Inter', -apple-system, BlinkMacSystemFont, sans-serif";
            toast.style.boxShadow = '0 8px 32px rgba(0, 0, 0, 0.4)';
            toast.style.border = isError ? '1px solid rgba(255, 107, 107, 0.2)' : '1px solid rgba(255, 255, 255, 0.1)';
            toast.style.backdropFilter = 'blur(20px)';
            toast.style.WebkitBackdropFilter = 'blur(20px)';
            
            // Create header container
            const headerContainer = document.createElement('div');
            headerContainer.style.display = 'flex';
            headerContainer.style.justifyContent = 'space-between';
            headerContainer.style.alignItems = 'flex-start';
            
            // Create message container
            const messageContainer = document.createElement('div');
            messageContainer.style.flexGrow = '1';
            messageContainer.style.marginRight = '12px';
            
            // Add indicator dot
            const indicatorDot = document.createElement('span');
            indicatorDot.style.display = 'inline-block';
            indicatorDot.style.width = '8px';
            indicatorDot.style.height = '8px';
            indicatorDot.style.backgroundColor = isError ? '#ff6b6b' : '#4ade80';
            indicatorDot.style.borderRadius = '50%';
            indicatorDot.style.marginRight = '8px';
            indicatorDot.style.boxShadow = isError ? '0 0 4px rgba(255, 107, 107, 0.6)' : '0 0 4px rgba(74, 222, 128, 0.6)';
            
            // Add message text
            const messageText = document.createElement('span');
            messageText.textContent = msg;
            messageText.style.fontSize = '14px';
            messageText.style.fontWeight = '500';
            messageText.style.lineHeight = '1.4';
            messageText.style.wordBreak = 'break-word';
            
            // Combine dot and text
            const messageContent = document.createElement('div');
            messageContent.style.display = 'flex';
            messageContent.style.alignItems = 'center';
            messageContent.appendChild(indicatorDot);
            messageContent.appendChild(messageText);
            
            messageContainer.appendChild(messageContent);
            
            // Create buttons container
            const buttonsContainer = document.createElement('div');
            buttonsContainer.style.display = 'flex';
            buttonsContainer.style.alignItems = 'center';
            buttonsContainer.style.marginLeft = '8px';
            
            // Info button
            const infoBtn = document.createElement('button');
            infoBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>';
            infoBtn.title = 'Show more information';
            infoBtn.style.background = 'none';
            infoBtn.style.border = 'none';
            infoBtn.style.color = isError ? 'rgba(255, 107, 107, 0.8)' : 'rgba(255, 255, 255, 0.8)';
            infoBtn.style.cursor = 'pointer';
            infoBtn.style.padding = '2px';
            infoBtn.style.marginRight = '6px';
            infoBtn.style.borderRadius = '0px';
            infoBtn.style.lineHeight = '0';
            infoBtn.style.transition = 'all 0.2s';
            
            // Close button
            const closeBtn = document.createElement('button');
            closeBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';
            closeBtn.title = 'Close';
            closeBtn.style.background = 'none';
            closeBtn.style.border = 'none';
            closeBtn.style.color = isError ? 'rgba(255, 107, 107, 0.8)' : 'rgba(255, 255, 255, 0.8)';
            closeBtn.style.cursor = 'pointer';
            closeBtn.style.padding = '2px';
            closeBtn.style.borderRadius = '0px';
            closeBtn.style.lineHeight = '0';
            closeBtn.style.transition = 'all 0.2s';

            // Detailed info container (initially hidden)
            const detailedInfoContainer = document.createElement('div');
            detailedInfoContainer.style.marginTop = '12px';
            detailedInfoContainer.style.padding = '10px 12px';
            detailedInfoContainer.style.backgroundColor = isError ? 'rgba(255, 107, 107, 0.1)' : 'rgba(255, 255, 255, 0.1)';
            detailedInfoContainer.style.borderRadius = '0px';
            detailedInfoContainer.style.fontSize = '13px';
            detailedInfoContainer.style.display = 'none';
            detailedInfoContainer.style.maxHeight = '120px';
            detailedInfoContainer.style.overflow = 'auto';
            detailedInfoContainer.style.lineHeight = '1.4';
            detailedInfoContainer.style.color = isError ? 'rgba(255, 107, 107, 0.9)' : 'rgba(255, 255, 255, 0.9)';
            detailedInfoContainer.textContent = detailedInfo;

            // Add event listeners
            let expanded = false;
            let hideTimeoutId = null;
            
            infoBtn.onmouseover = function() {
                infoBtn.style.color = isError ? '#ff6b6b' : '#ffffff';
                infoBtn.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
            };
            
            infoBtn.onmouseout = function() {
                infoBtn.style.color = isError ? 'rgba(255, 107, 107, 0.8)' : 'rgba(255, 255, 255, 0.8)';
                infoBtn.style.backgroundColor = 'transparent';
            };
            
            closeBtn.onmouseover = function() {
                closeBtn.style.color = isError ? '#ff6b6b' : '#ffffff';
                closeBtn.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
            };
            
            closeBtn.onmouseout = function() {
                closeBtn.style.color = isError ? 'rgba(255, 107, 107, 0.8)' : 'rgba(255, 255, 255, 0.8)';
                closeBtn.style.backgroundColor = 'transparent';
            };
            
            infoBtn.onclick = function() {
                expanded = !expanded;
                detailedInfoContainer.style.display = expanded ? 'block' : 'none';
                infoBtn.innerHTML = expanded ? 
                    '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"></polyline></svg>' : 
                    '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>';
                
                // Clear the auto-hide timeout when info is expanded
                if (expanded) {
                    if (hideTimeoutId) {
                        clearTimeout(hideTimeoutId);
                        hideTimeoutId = null;
                    }
                } else {
                    // Restart the auto-hide timer when info is collapsed
                    hideTimeoutId = setTimeout(() => {
                        toast.style.opacity = '0';
                        toast.style.transform = 'translateY(10px) translateX(-50%)';
                        setTimeout(() => toast.remove(), 300);
                    }, 5000);
                }
            };
            
            closeBtn.onclick = function() {
                // Clear any existing timeout
                if (hideTimeoutId) {
                    clearTimeout(hideTimeoutId);
                    hideTimeoutId = null;
                }
                
                toast.style.opacity = '0';
                toast.style.transform = 'translateY(10px) translateX(-50%)';
                setTimeout(() => toast.remove(), 300);
            };

            // Assemble the toast
            buttonsContainer.appendChild(infoBtn);
            buttonsContainer.appendChild(closeBtn);
            headerContainer.appendChild(messageContainer);
            headerContainer.appendChild(buttonsContainer);
            
            toast.appendChild(headerContainer);
            toast.appendChild(detailedInfoContainer);
            
            document.body.appendChild(toast);

            // Add entrance animation
            toast.style.transform = 'translateY(10px) translateX(-50%)';
            setTimeout(() => {
                toast.style.transform = 'translateY(0) translateX(-50%)';
            }, 10);

            // Set initial auto-hide timeout
            hideTimeoutId = setTimeout(() => {
                toast.style.opacity = '0';
                toast.style.transform = 'translateY(10px) translateX(-50%)';
                setTimeout(() => toast.remove(), 300);
            }, 5000);
        },
        args: [message, isError, opacity, detailedInfo]
    });
}

// Show stealth mode toast notification
async function showStealthToast(tabId, message, stealthEnabled) {
    const opacity = await getToastOpacity();
    
    // Remove any existing toast first
    await removeExistingToast(tabId);

    chrome.scripting.executeScript({
        target: {
            tabId: tabId
        },
        func: function(msg, stealthEnabled, opacity) {
            // Create toast container
            const toast = document.createElement('div');
            toast.id = 'macneopassfree-active-toast'; // Use same ID for tracking
            
            // Set colors based on stealth mode state
            const textColor = stealthEnabled ? '#4ade80' : '#ff6b6b';
            
            toast.style.position = 'fixed';
            toast.style.bottom = '20px';
            toast.style.left = '50%';
            toast.style.transform = 'translateX(-50%)';
            toast.style.backgroundColor = 'rgba(10, 10, 10, 0.7)';
            toast.style.color = '#ffffff';
            toast.style.padding = '14px 16px';
            toast.style.borderRadius = '0px';
            toast.style.zIndex = '999999';
            toast.style.opacity = opacity;
            toast.style.transition = 'all 0.3s ease';
            toast.style.maxWidth = '480px';
            toast.style.fontFamily = "'Inter', -apple-system, BlinkMacSystemFont, sans-serif";
            toast.style.boxShadow = '0 8px 32px rgba(0, 0, 0, 0.4)';
            toast.style.border = '1px solid rgba(255, 255, 255, 0.1)';
            toast.style.backdropFilter = 'blur(20px)';
            toast.style.WebkitBackdropFilter = 'blur(20px)';
            
            // Create header container
            const headerContainer = document.createElement('div');
            headerContainer.style.display = 'flex';
            headerContainer.style.justifyContent = 'space-between';
            headerContainer.style.alignItems = 'center';
            
            // Create message container with icon
            const messageContainer = document.createElement('div');
            messageContainer.style.display = 'flex';
            messageContainer.style.alignItems = 'center';
            messageContainer.style.gap = '10px';
            messageContainer.style.flexGrow = '1';
            messageContainer.style.marginRight = '12px';
            
            // Add indicator dot
            const indicatorDot = document.createElement('span');
            indicatorDot.style.display = 'inline-block';
            indicatorDot.style.width = '8px';
            indicatorDot.style.height = '8px';
            indicatorDot.style.backgroundColor = textColor;
            indicatorDot.style.borderRadius = '50%';
            indicatorDot.style.boxShadow = `0 0 4px ${stealthEnabled ? 'rgba(74, 222, 128, 0.6)' : 'rgba(255, 107, 107, 0.6)'}`;
            
            // Message text
            const messageText = document.createElement('span');
            messageText.innerHTML = msg.replace(/\n/g, '<br>');
            messageText.style.fontSize = '14px';
            messageText.style.fontWeight = '500';
            messageText.style.lineHeight = '1.4';
            messageText.style.wordBreak = 'break-word';
            messageText.style.color = textColor;
            messageText.style.textAlign = 'center';
            messageText.style.flex = '1';
            
            messageContainer.appendChild(indicatorDot);
            messageContainer.appendChild(messageText);
            
            // Close button
            const closeBtn = document.createElement('button');
            closeBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';
            closeBtn.title = 'Close';
            closeBtn.style.background = 'none';
            closeBtn.style.border = 'none';
            closeBtn.style.color = 'rgba(255, 255, 255, 0.8)';
            closeBtn.style.cursor = 'pointer';
            closeBtn.style.padding = '2px';
            closeBtn.style.borderRadius = '0px';
            closeBtn.style.lineHeight = '0';
            closeBtn.style.transition = 'all 0.2s';
            
            // Event listeners
            closeBtn.onmouseover = function() {
                closeBtn.style.color = '#ffffff';
                closeBtn.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
            };
            
            closeBtn.onmouseout = function() {
                closeBtn.style.color = 'rgba(255, 255, 255, 0.8)';
                closeBtn.style.backgroundColor = 'transparent';
            };
            
            closeBtn.onclick = function() {
                toast.style.opacity = '0';
                toast.style.transform = 'translateY(10px) translateX(-50%)';
                setTimeout(() => toast.remove(), 300);
            };
            
            // Assemble the toast
            headerContainer.appendChild(messageContainer);
            headerContainer.appendChild(closeBtn);
            
            toast.appendChild(headerContainer);
            
            document.body.appendChild(toast);

            // Add entrance animation
            toast.style.transform = 'translateY(10px) translateX(-50%)';
            setTimeout(() => {
                toast.style.transform = 'translateY(0) translateX(-50%)';
            }, 10);

            // Auto-hide toast after 5 seconds
            setTimeout(() => {
                toast.style.opacity = '0';
                toast.style.transform = 'translateY(10px) translateX(-50%)';
                setTimeout(() => toast.remove(), 300);
            }, 5000);
        },
        args: [message, stealthEnabled, opacity]
    });

    // Update storage with new stealth mode state
    chrome.storage.local.set({ stealth: stealthEnabled });
}

// Add toast opacity toggle message listener
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'toggleToastOpacity') {
        toggleToastOpacity()
            .then(newLevel => {
                sendResponse({
                    success: true,
                    level: newLevel
                });
            })
            .catch(error => {
                console.error("Error toggling opacity:", error);
                sendResponse({
                    success: false,
                    error: error.toString()
                });
            });
        return true; // Keep the message channel open for async response
    }
    return false; // Let other listeners handle other messages
});

// Initialize opacity level from storage on startup
chrome.runtime.onStartup.addListener(() => {
    chrome.storage.local.get(['toastOpacityLevel'], (result) => {
        if (result.toastOpacityLevel) {
            currentOpacityLevel = result.toastOpacityLevel;
        }
    });
});

// Event listeners
chrome.tabs.onActivated.addListener((activeInfo) => {
    chrome.tabs.get(activeInfo.tabId, (tab) => {
        tabDetails = tab;
    });
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === "complete") {
        tabDetails = tab;
    }
});

chrome.windows.onFocusChanged.addListener((windowId) => {
    if (windowId === chrome.windows.WINDOW_ID_NONE) {
        return;
    }
    chrome.tabs.query({
        active: true,
        windowId: windowId
    }, (tabs) => {
        if (tabs.length > 0) {
            tabDetails = tabs[0];
        }
    });
});


chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    currentKey = message.key;
    if (message.action === "pageReloaded" || message.action === "windowFocus") {
        return false; // Let other listeners handle
    } else if (message.action === "openNewTab") {
        openNewMinimizedWindowWithUrl(message.url);
        return true;
    }
    if (message.action === 'showToast') {
        showToast(sender.tab.id, message.message, message.isError);
        return true;
    }
    if (message.action === 'showStealthToast') {
        showStealthToast(sender.tab.id, message.message, message.stealthEnabled);
        return true;
    }
    if (message.action === 'showMCQToast') {
        showMCQToast(sender.tab.id, message.message);
        return true;
    }
    return false; // Let other listeners handle unmatched messages
});

// Always-active integration
const log = (...args) => chrome.storage.local.get({
    log: false
}, prefs => prefs.log && console.log(...args));

const activate = () => {
    if (activate.busy) {
        return;
    }
    activate.busy = true;

    chrome.storage.local.get({
        enabled: true
    }, async prefs => {
        try {
            await chrome.scripting.unregisterContentScripts();

            if (prefs.enabled) {
                const props = {
                    'matches': ['*://*/*'],
                    'allFrames': true,
                    'matchOriginAsFallback': true,
                    'runAt': 'document_start'
                };
                await chrome.scripting.registerContentScripts([{
                    ...props,
                    'id': 'main',
                    'js': ['data/inject/main.js'],
                    'world': 'MAIN'
                }, {
                    ...props,
                    'id': 'isolated',
                    'js': ['data/inject/isolated.js'],
                    'world': 'ISOLATED'
                }]);
            }
        } catch (e) {
            chrome.action.setBadgeBackgroundColor({
                color: '#b16464'
            });
            chrome.action.setBadgeText({
                text: 'E'
            });
            chrome.action.setTitle({
                title: 'Blocker Registration Failed: ' + e.message
            });
            console.error('Blocker Registration Failed', e);
        }
        activate.busy = false;
    });
};

chrome.runtime.onStartup.addListener(activate);
chrome.runtime.onInstalled.addListener(activate);
chrome.storage.onChanged.addListener(ps => {
    if (ps.enabled) {
        activate();
    }
});

// Add new message listener for snippet processing
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'processSnippets') {
        const {
            snippets
        } = message;

        if (!snippets.header && !snippets.footer) {
            showToast(sender.tab.id, 'No snippets found', true);
            return true;
        }

        const combinedText = `// Header Snippet\n${snippets.header}\n\n// Footer Snippet\n${snippets.footer}`;

        // Use existing copyToClipboard function
        copyToClipboard(combinedText);
        showToast(sender.tab.id, 'Snippets copied to clipboard');
        return true;
    }
    return false;
});

// Add new message listener for coding question extraction
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'extractCodingQuestion') {
        const {
            data
        } = message;

        // Format the extracted data
        const formattedText = `Programming Language:
${data.programmingLanguage}

Question:
${data.question}

Input Format:
${data.inputFormat}

Output Format:
${data.outputFormat}

Sample Test Cases:
${data.testCases}`;

        // Copy to clipboard and show notification
        copyToClipboard(formattedText);
        showToast(sender.tab.id, 'Coding question details copied to clipboard');
        return true;
    }
    return false;
});

// Add new message listener for reset context (clear chat history)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'resetContext') {
        // Log the context reset for debugging
        console.log('Chat context reset requested from tab:', sender.tab?.id);
        
        // Optionally, you could clear any stored conversation context here
        // For now, just acknowledge the reset
        if (sendResponse) {
            sendResponse({ success: true, message: 'Context reset' });
        }
        return true;
    }
    return false;
});

// NPTEL Integration
function findAnswer(query) {
    const normalizedQuery = normalizeText(query); // Normalize the query
    const bestAnswers = []; // Array to store the best answers
    let smallestDistance = Infinity; // Track the smallest distance

    for (const item of dataset) {
        const normalizedQuestion = normalizeText(item.question); // Normalize the question
        const distance = levenshteinDistance(normalizedQuery, normalizedQuestion);

        // If the distance is within the threshold
        const threshold = 15; // Adjust this value based on your needs
        if (distance <= threshold) {
            if (distance < smallestDistance) {
                smallestDistance = distance; // Update smallest distance
                bestAnswers.length = 0; // Clear previous answers
                bestAnswers.push(item.answer); // Store the new best answer
            } else if (distance === smallestDistance) {
                bestAnswers.push(item.answer); // Add to the list of best answers
            }
        }
    }

    return bestAnswers.length > 0 ? bestAnswers : null; // Return the best answers or null if none found
}

// Function to calculate the Levenshtein distance
function levenshteinDistance(s1, s2) {
    const dp = Array(s1.length + 1).fill(null).map(() => Array(s2.length + 1).fill(0));

    for (let i = 0; i <= s1.length; i++) {
        for (let j = 0; j <= s2.length; j++) {
            if (i === 0) {
                dp[i][j] = j; // Deletions
            } else if (j === 0) {
                dp[i][j] = i; // Additions
            } else {
                dp[i][j] = Math.min(
                    dp[i - 1][j] + 1, // Deletion
                    dp[i][j - 1] + 1, // Insertion
                    dp[i - 1][j - 1] + (s1[i - 1] === s2[j - 1] ? 0 : 1) // Substitution
                );
            }
        }
    }
    return dp[s1.length][s2.length];
}

// Normalization function to clean up the text
function normalizeText(text) {
    return text
        .toLowerCase() // Convert to lowercase
        .replace(/[-]/g, ' ') // Replace dashes with spaces
        .replace(/[^\w\s]/g, '') // Remove all non-word characters (except whitespace)
        .trim(); // Trim leading and trailing spaces
}

// Load NPTEL dataset from JSON file
let dataset = [];
async function loadNptelDataset() {
    try {
        const response = await fetch(chrome.runtime.getURL('data/nptel.json'));
        dataset = await response.json();
        console.log(`NPTEL dataset loaded: ${dataset.length} questions`);
    } catch (error) {
        console.error('Failed to load NPTEL dataset:', error);
    }
}

// Load dataset on initialization
loadNptelDataset();

// Update showMCQToast to use the current opacity level and include info button
async function showMCQToast(tabId, message, detailedInfo = '') {
    const opacity = await getToastOpacity();
    
    // Set default detailed info if not provided
    if (!detailedInfo) {
        detailedInfo = 'This is the answer to the MCQ question based on analysis of the question content. If you received an incorrect answer, please try rephrasing your question or providing more context.';
    }

    // Remove any existing toast first
    await removeExistingToast(tabId);

    chrome.scripting.executeScript({
        target: {
            tabId: tabId
        },
        func: function(msg, opacity, detailedInfo) {
            // Check if this is "Not an MCQ" response
            const isNotMCQ = msg.toLowerCase().includes("not an mcq");
            
            // Create toast container
            const toast = document.createElement('div');
            toast.id = 'macneopassfree-active-toast'; // Add ID for tracking
            toast.style.position = 'fixed';
            toast.style.bottom = '20px';
            toast.style.left = '50%';
            toast.style.transform = 'translateX(-50%)';
            toast.style.backgroundColor = 'rgba(10, 10, 10, 0.7)';
            toast.style.color = '#ffffff';
            toast.style.padding = '14px 16px';
            toast.style.borderRadius = '0px';
            toast.style.zIndex = '999999';
            toast.style.opacity = opacity;
            toast.style.transition = 'all 0.3s ease';
            toast.style.maxWidth = '400px';
            toast.style.fontFamily = "'Inter', -apple-system, BlinkMacSystemFont, sans-serif";
            toast.style.boxShadow = '0 8px 32px rgba(0, 0, 0, 0.4)';
            toast.style.border = '1px solid rgba(255, 255, 255, 0.1)';
            toast.style.backdropFilter = 'blur(20px)';
            toast.style.WebkitBackdropFilter = 'blur(20px)';
            
            // Create header container
            const headerContainer = document.createElement('div');
            headerContainer.style.display = 'flex';
            headerContainer.style.justifyContent = 'space-between';
            headerContainer.style.alignItems = 'center';
            
            // Create answer container with formatted answer
            const answerContainer = document.createElement('div');
            answerContainer.style.display = 'flex';
            answerContainer.style.alignItems = 'center';
            answerContainer.style.flexGrow = '1';
            
            if (!isNotMCQ) {
                // Parse the message to separate option identifier from answer text
                let optionIdentifier, optionAnswer;
                
                // Handle different format patterns like "A. answer", "1. answer", "A answer", "1 answer"
                const match = msg.match(/^([A-Za-z0-9]+)\.?\s+(.+)$/);
                
                if (match) {
                    optionIdentifier = match[1].trim();
                    optionAnswer = match[2].trim();
                } else {
                    // Fallback if the pattern doesn't match
                    const parts = msg.split(' ');
                    optionIdentifier = parts[0].replace('.', '');
                    optionAnswer = parts.slice(1).join(' ');
                }
                
                // Determine if option is letter or number based
                const isLetter = /^[A-Za-z]$/.test(optionIdentifier);
                const optionColor = isLetter ? '#4285f4' : '#f4b400'; // Blue for letters, Yellow/Gold for numbers
                
                // Option indicator dot
                const optionDot = document.createElement('div');
                optionDot.style.width = '22px';
                optionDot.style.height = '22px';
                optionDot.style.backgroundColor = optionColor;
                optionDot.style.color = 'white';
                optionDot.style.borderRadius = '50%';
                optionDot.style.display = 'flex';
                optionDot.style.alignItems = 'center';
                optionDot.style.justifyContent = 'center';
                optionDot.style.marginRight = '10px';
                optionDot.style.fontWeight = 'bold';
                optionDot.style.fontSize = '12px';
                optionDot.style.boxShadow = `0 2px 4px ${optionColor}66`;
                optionDot.textContent = optionIdentifier.toUpperCase();
                
                // Answer text
                const answerText = document.createElement('span');
                answerText.textContent = optionAnswer;
                answerText.style.fontSize = '14px';
                answerText.style.fontWeight = '500';
                
                answerContainer.appendChild(optionDot);
                answerContainer.appendChild(answerText);
            } else {
                // For "Not an MCQ" response - no icon, just show the text
                const messageText = document.createElement('span');
                messageText.textContent = msg;
                messageText.style.fontSize = '14px';
                messageText.style.fontWeight = '500';
                
                answerContainer.appendChild(messageText);
            }
            
            // Create buttons container
            const buttonsContainer = document.createElement('div');
            buttonsContainer.style.display = 'flex';
            buttonsContainer.style.alignItems = 'center';
            buttonsContainer.style.marginLeft = '10px';
            
            // Info button
            const infoBtn = document.createElement('button');
            infoBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>';
            infoBtn.title = 'Show more information';
            infoBtn.style.background = 'none';
            infoBtn.style.border = 'none';
            infoBtn.style.color = 'rgba(255, 255, 255, 0.8)';
            infoBtn.style.cursor = 'pointer';
            infoBtn.style.padding = '2px';
            infoBtn.style.marginRight = '6px';
            infoBtn.style.borderRadius = '0px';
            infoBtn.style.lineHeight = '0';
            infoBtn.style.transition = 'all 0.2s';
            
            // Close button
            const closeBtn = document.createElement('button');
            closeBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';
            closeBtn.title = 'Close';
            closeBtn.style.background = 'none';
            closeBtn.style.border = 'none';
            closeBtn.style.color = 'rgba(255, 255, 255, 0.8)';
            closeBtn.style.cursor = 'pointer';
            closeBtn.style.padding = '2px';
            closeBtn.style.borderRadius = '0px';
            closeBtn.style.lineHeight = '0';
            closeBtn.style.transition = 'all 0.2s';
            
            // Detailed info container (initially hidden)
            const detailedInfoContainer = document.createElement('div');
            detailedInfoContainer.style.marginTop = '12px';
            detailedInfoContainer.style.padding = '10px 12px';
            detailedInfoContainer.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
            detailedInfoContainer.style.borderRadius = '0px';
            detailedInfoContainer.style.fontSize = '13px';
            detailedInfoContainer.style.display = 'none';
            detailedInfoContainer.style.maxHeight = '120px';
            detailedInfoContainer.style.overflow = 'auto';
            detailedInfoContainer.style.lineHeight = '1.4';
            detailedInfoContainer.style.color = 'rgba(255, 255, 255, 0.9)';
            detailedInfoContainer.textContent = isNotMCQ ? 
                'The selected text does not appear to be a multiple-choice question. Please try selecting a valid MCQ.' : 
                detailedInfo;
            
            // Add event listeners
            let expanded = false;
            let hideTimeoutId = null;
            
            infoBtn.onmouseover = function() {
                infoBtn.style.color = '#ffffff';
                infoBtn.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
            };
            
            infoBtn.onmouseout = function() {
                infoBtn.style.color = 'rgba(255, 255, 255, 0.8)';
                infoBtn.style.backgroundColor = 'transparent';
            };
            
            closeBtn.onmouseover = function() {
                closeBtn.style.color = '#ffffff';
                closeBtn.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
            };
            
            closeBtn.onmouseout = function() {
                closeBtn.style.color = 'rgba(255, 255, 255, 0.8)';
                closeBtn.style.backgroundColor = 'transparent';
            };
            
            infoBtn.onclick = function() {
                expanded = !expanded;
                detailedInfoContainer.style.display = expanded ? 'block' : 'none';
                infoBtn.innerHTML = expanded ? 
                    '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"></polyline></svg>' : 
                    '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>';
                
                // Clear the auto-hide timeout when info is expanded
                if (expanded) {
                    if (hideTimeoutId) {
                        clearTimeout(hideTimeoutId);
                        hideTimeoutId = null;
                    }
                } else {
                    // Restart the auto-hide timer when info is collapsed
                    hideTimeoutId = setTimeout(() => {
                        toast.style.opacity = '0';
                        toast.style.transform = 'translateY(10px) translateX(-50%)';
                        setTimeout(() => toast.remove(), 300);
                    }, 5000);
                }
            };
            
            closeBtn.onclick = function() {
                // Clear any existing timeout
                if (hideTimeoutId) {
                    clearTimeout(hideTimeoutId);
                    hideTimeoutId = null;
                }
                
                toast.style.opacity = '0';
                toast.style.transform = 'translateY(10px) translateX(-50%)';
                setTimeout(() => toast.remove(), 300);
            };
            
            // Assemble the toast
            buttonsContainer.appendChild(infoBtn);
            buttonsContainer.appendChild(closeBtn);
            headerContainer.appendChild(answerContainer);
            headerContainer.appendChild(buttonsContainer);
            
            toast.appendChild(headerContainer);
            toast.appendChild(detailedInfoContainer);
            
            document.body.appendChild(toast);
            
            // Add entrance animation
            toast.style.transform = 'translateY(10px) translateX(-50%)';
            setTimeout(() => {
                toast.style.transform = 'translateY(0) translateX(-50%)';
            }, 10);

            // Set initial auto-hide timeout
            hideTimeoutId = setTimeout(() => {
                toast.style.opacity = '0';
                toast.style.transform = 'translateY(10px) translateX(-50%)';
                setTimeout(() => toast.remove(), 300);
            }, 5000);
        },
        args: [message, opacity, detailedInfo]
    });
}

// Update showNPTELToast to use the current opacity level and include info button
async function showNPTELToast(tabId, message, isError = false, detailedInfo = '') {
    const opacity = await getToastOpacity();
    
    // Set default detailed info if not provided
    if (!detailedInfo) {
        if (isError) {
            detailedInfo = 'Possible issues with NPTEL search:\n• The question may not be in our database\n• Try selecting only the exact question text\n• The question might be newly added to NPTEL';
        } else {
            detailedInfo = 'This answer was found by matching your question with the NPTEL question database. The confidence level depends on how closely your selected text matches a known question.';
        }
    }

    // Remove any existing toast first
    await removeExistingToast(tabId);

    chrome.scripting.executeScript({
        target: {
            tabId: tabId
        },
        func: function(msg, isError, opacity, detailedInfo) {
            // Create toast container
            const toast = document.createElement('div');
            toast.id = 'macneopassfree-active-toast'; // Add ID for tracking
            toast.style.position = 'fixed';
            toast.style.bottom = '20px';
            toast.style.left = '50%';
            toast.style.transform = 'translateX(-50%)';
            toast.style.backgroundColor = isError ? 'rgba(26, 10, 10, 0.7)' : 'rgba(10, 10, 10, 0.7)';
            toast.style.color = isError ? '#ff6b6b' : '#ffffff';
            toast.style.padding = '14px 16px';
            toast.style.borderRadius = '0px';
            toast.style.zIndex = '999999';
            toast.style.opacity = opacity;
            toast.style.transition = 'all 0.3s ease';
            toast.style.maxWidth = '320px';
            toast.style.fontFamily = "'Inter', -apple-system, BlinkMacSystemFont, sans-serif";
            toast.style.boxShadow = '0 8px 32px rgba(0, 0, 0, 0.4)';
            toast.style.border = isError ? '1px solid rgba(255, 107, 107, 0.2)' : '1px solid rgba(255, 255, 255, 0.1)';
            toast.style.backdropFilter = 'blur(20px)';
            toast.style.WebkitBackdropFilter = 'blur(20px)';
            
            // Create header container
            const headerContainer = document.createElement('div');
            headerContainer.style.display = 'flex';
            headerContainer.style.justifyContent = 'space-between';
            headerContainer.style.alignItems = 'flex-start';
            
            // Create message container
            const messageContainer = document.createElement('div');
            messageContainer.style.flexGrow = '1';
            messageContainer.style.marginRight = '12px';
            
            // Add indicator dot
            const indicatorDot = document.createElement('span');
            indicatorDot.style.display = 'inline-block';
            indicatorDot.style.width = '8px';
            indicatorDot.style.height = '8px';
            indicatorDot.style.backgroundColor = isError ? '#ff6b6b' : '#4ade80';
            indicatorDot.style.borderRadius = '50%';
            indicatorDot.style.marginRight = '8px';
            indicatorDot.style.boxShadow = isError ? '0 0 4px rgba(255, 107, 107, 0.6)' : '0 0 4px rgba(74, 222, 128, 0.6)';
            
            // Add message text
            const messageText = document.createElement('span');
            messageText.innerHTML = msg.replace(/\n/g, '<br>'); // Use innerHTML to handle newlines
            messageText.style.fontSize = '14px';
            messageText.style.fontWeight = '500';
            messageText.style.lineHeight = '1.4';
            messageText.style.wordBreak = 'break-word';
            
            // Combine dot and text
            const messageContent = document.createElement('div');
            messageContent.style.display = 'flex';
            messageContent.style.alignItems = 'center';
            messageContent.appendChild(indicatorDot);
            messageContent.appendChild(messageText);
            
            messageContainer.appendChild(messageContent);
            
            // Create buttons container
            const buttonsContainer = document.createElement('div');
            buttonsContainer.style.display = 'flex';
            buttonsContainer.style.alignItems = 'center';
            buttonsContainer.style.marginLeft = '8px';
            
            // Info button
            const infoBtn = document.createElement('button');
            infoBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>';
            infoBtn.title = 'Show more information';
            infoBtn.style.background = 'none';
            infoBtn.style.border = 'none';
            infoBtn.style.color = isError ? 'rgba(255, 107, 107, 0.8)' : 'rgba(255, 255, 255, 0.8)';
            infoBtn.style.cursor = 'pointer';
            infoBtn.style.padding = '2px';
            infoBtn.style.marginRight = '6px';
            infoBtn.style.borderRadius = '0px';
            infoBtn.style.lineHeight = '0';
            infoBtn.style.transition = 'all 0.2s';
            
            // Close button
            const closeBtn = document.createElement('button');
            closeBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';
            closeBtn.title = 'Close';
            closeBtn.style.background = 'none';
            closeBtn.style.border = 'none';
            closeBtn.style.color = isError ? 'rgba(255, 107, 107, 0.8)' : 'rgba(255, 255, 255, 0.8)';
            closeBtn.style.cursor = 'pointer';
            closeBtn.style.padding = '2px';
            closeBtn.style.borderRadius = '0px';
            closeBtn.style.lineHeight = '0';
            closeBtn.style.transition = 'all 0.2s';

            // Detailed info container (initially hidden)
            const detailedInfoContainer = document.createElement('div');
            detailedInfoContainer.style.marginTop = '12px';
            detailedInfoContainer.style.padding = '10px 12px';
            detailedInfoContainer.style.backgroundColor = isError ? 'rgba(255, 107, 107, 0.1)' : 'rgba(255, 255, 255, 0.1)';
            detailedInfoContainer.style.borderRadius = '0px';
            detailedInfoContainer.style.fontSize = '13px';
            detailedInfoContainer.style.display = 'none';
            detailedInfoContainer.style.maxHeight = '120px';
            detailedInfoContainer.style.overflow = 'auto';
            detailedInfoContainer.style.lineHeight = '1.4';
            detailedInfoContainer.style.color = isError ? 'rgba(255, 107, 107, 0.9)' : 'rgba(255, 255, 255, 0.9)';
            detailedInfoContainer.textContent = detailedInfo;

            // Add event listeners
            let expanded = false;
            let hideTimeoutId = null;
            
            infoBtn.onmouseover = function() {
                infoBtn.style.color = isError ? '#ff6b6b' : '#ffffff';
                infoBtn.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
            };
            
            infoBtn.onmouseout = function() {
                infoBtn.style.color = isError ? 'rgba(255, 107, 107, 0.8)' : 'rgba(255, 255, 255, 0.8)';
                infoBtn.style.backgroundColor = 'transparent';
            };
            
            closeBtn.onmouseover = function() {
                closeBtn.style.color = isError ? '#ff6b6b' : '#ffffff';
                closeBtn.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
            };
            
            closeBtn.onmouseout = function() {
                closeBtn.style.color = isError ? 'rgba(255, 107, 107, 0.8)' : 'rgba(255, 255, 255, 0.8)';
                closeBtn.style.backgroundColor = 'transparent';
            };
            
            infoBtn.onclick = function() {
                expanded = !expanded;
                detailedInfoContainer.style.display = expanded ? 'block' : 'none';
                infoBtn.innerHTML = expanded ? 
                    '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"></polyline></svg>' : 
                    '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>';
                
                // Clear the auto-hide timeout when info is expanded
                if (expanded) {
                    if (hideTimeoutId) {
                        clearTimeout(hideTimeoutId);
                        hideTimeoutId = null;
                    }
                } else {
                    // Restart the auto-hide timer when info is collapsed
                    hideTimeoutId = setTimeout(() => {
                        toast.style.opacity = '0';
                        toast.style.transform = 'translateY(10px) translateX(-50%)';
                        setTimeout(() => toast.remove(), 300);
                    }, 5000);
                }
            };
            
            closeBtn.onclick = function() {
                // Clear any existing timeout
                if (hideTimeoutId) {
                    clearTimeout(hideTimeoutId);
                    hideTimeoutId = null;
                }
                
                toast.style.opacity = '0';
                toast.style.transform = 'translateY(10px) translateX(-50%)';
                setTimeout(() => toast.remove(), 300);
            };

            // Assemble the toast
            buttonsContainer.appendChild(infoBtn);
            buttonsContainer.appendChild(closeBtn);
            headerContainer.appendChild(messageContainer);
            headerContainer.appendChild(buttonsContainer);
            
            toast.appendChild(headerContainer);
            toast.appendChild(detailedInfoContainer);
            
            document.body.appendChild(toast);

            // Add entrance animation
            toast.style.transform = 'translateY(10px) translateX(-50%)';
            setTimeout(() => {
                toast.style.transform = 'translateY(0) translateX(-50%)';
            }, 10);

            // Set initial auto-hide timeout
            hideTimeoutId = setTimeout(() => {
                toast.style.opacity = '0';
                toast.style.transform = 'translateY(10px) translateX(-50%)';
                setTimeout(() => toast.remove(), 300);
            }, 5000);
        },
        args: [message, isError, opacity, detailedInfo]
    });
}
// Show a spinner toast while AI query is being processed
async function showSpinnerToast(tabId, message = 'Processing your request...') {
    const opacity = await getToastOpacity();
    
    // Remove any existing toast first
    await removeExistingToast(tabId);

    chrome.scripting.executeScript({
        target: {
            tabId: tabId
        },
        func: function(msg, opacity) {
            // Create toast container
            const toast = document.createElement('div');
            toast.id = 'macneopassfree-spinner-toast';
            toast.style.position = 'fixed';
            toast.style.bottom = '20px';
            toast.style.left = '50%';
            toast.style.transform = 'translateX(-50%)';
            toast.style.backgroundColor = 'rgba(10, 10, 10, 0.7)';
            toast.style.color = '#ffffff';
            toast.style.padding = '14px 16px';
            toast.style.borderRadius = '0px';
            toast.style.zIndex = '999999';
            toast.style.opacity = opacity;
            toast.style.transition = 'all 0.3s ease';
            toast.style.maxWidth = '320px';
            toast.style.fontFamily = "'Inter', -apple-system, BlinkMacSystemFont, sans-serif";
            toast.style.boxShadow = '0 8px 32px rgba(0, 0, 0, 0.4)';
            toast.style.border = '1px solid rgba(255, 255, 255, 0.1)';
            toast.style.backdropFilter = 'blur(20px)';
            toast.style.WebkitBackdropFilter = 'blur(20px)';
            
            // Create header container
            const headerContainer = document.createElement('div');
            headerContainer.style.display = 'flex';
            headerContainer.style.justifyContent = 'space-between';
            headerContainer.style.alignItems = 'center';
            
            // Create message container with spinner
            const messageContainer = document.createElement('div');
            messageContainer.style.display = 'flex';
            messageContainer.style.alignItems = 'center';
            messageContainer.style.gap = '10px';
            messageContainer.style.flexGrow = '1';
            
            // Spinner indicator (pulsing dot)
            const spinnerDot = document.createElement('span');
            spinnerDot.style.display = 'inline-block';
            spinnerDot.style.width = '8px';
            spinnerDot.style.height = '8px';
            spinnerDot.style.backgroundColor = '#64b5f6';
            spinnerDot.style.borderRadius = '50%';
            spinnerDot.style.boxShadow = '0 0 4px rgba(100, 181, 246, 0.6)';
            spinnerDot.style.animation = 'pulse 1.5s ease-in-out infinite';
            
            // Message text
            const messageText = document.createElement('span');
            messageText.textContent = msg;
            messageText.style.fontSize = '14px';
            messageText.style.fontWeight = '500';
            messageText.style.lineHeight = '1.4';
            messageText.style.wordBreak = 'break-word';
            
            messageContainer.appendChild(spinnerDot);
            messageContainer.appendChild(messageText);
            
            // Close button
            const closeBtn = document.createElement('button');
            closeBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';
            closeBtn.title = 'Close';
            closeBtn.style.background = 'none';
            closeBtn.style.border = 'none';
            closeBtn.style.color = 'rgba(255, 255, 255, 0.8)';
            closeBtn.style.cursor = 'pointer';
            closeBtn.style.padding = '2px';
            closeBtn.style.marginLeft = '8px';
            closeBtn.style.borderRadius = '0px';
            closeBtn.style.lineHeight = '0';
            closeBtn.style.transition = 'all 0.2s';
            
            // Add CSS animation keyframes
            const style = document.createElement('style');
            style.textContent = `
                @keyframes pulse {
                    0%, 100% { 
                        opacity: 1;
                        transform: scale(1);
                    }
                    50% { 
                        opacity: 0.5;
                        transform: scale(1.2);
                    }
                }
            `;
            document.head.appendChild(style);
            
            // Event listeners
            closeBtn.onmouseover = function() {
                closeBtn.style.color = '#ffffff';
                closeBtn.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
            };
            
            closeBtn.onmouseout = function() {
                closeBtn.style.color = 'rgba(255, 255, 255, 0.8)';
                closeBtn.style.backgroundColor = 'transparent';
            };
            
            closeBtn.onclick = function() {
                toast.style.opacity = '0';
                toast.style.transform = 'translateY(10px) translateX(-50%)';
                setTimeout(() => toast.remove(), 300);
            };
            
            // Assemble and append
            headerContainer.appendChild(messageContainer);
            headerContainer.appendChild(closeBtn);
            toast.appendChild(headerContainer);
            
            document.body.appendChild(toast);
            
            // Add entrance animation
            toast.style.transform = 'translateY(10px) translateX(-50%)';
            setTimeout(() => {
                toast.style.transform = 'translateY(0) translateX(-50%)';
            }, 10);
        },
        args: [message, opacity]
    });
}
