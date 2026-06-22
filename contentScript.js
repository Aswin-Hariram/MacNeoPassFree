// Check if the chrome object is available (for compatibility)
if (typeof chrome === "undefined") {
  // Handle the case where chrome is not defined (like in Firefox)
}

// Always inject mock_code.js interceptor to handle extension detection (even when not logged in)
(function injectMockCode() {
  const mockScript = document.createElement('script');
  mockScript.src = chrome.runtime.getURL('data/inject/mock_code.js');
  mockScript.onload = function () {
      console.log('✅ Mock code interceptor loaded');
      this.remove(); // Clean up after execution
  };
  mockScript.onerror = function() {
      console.error('❌ Failed to load mock code interceptor');
  };
  // Inject as early as possible
  (document.head || document.documentElement).prepend(mockScript);
})();

// Inject exam.js (no login required)
const script = document.createElement('script');
script.src = chrome.runtime.getURL('data/inject/exam.js');
(document.head || document.documentElement).appendChild(script);

// Listen for window messages
window.addEventListener("message", function(event) {
  // Only process messages that:
  // 1. Come from the same window
  // 2. Are targeted for the extension
  if (event.data.target === "extension") {
      // Forward the message to the extension's background script
      chrome.runtime.sendMessage(event.data.message, response => {
          // Send the response back to the window
          window.postMessage({
              source: "extension",
              response: response
          }, "*");
      });
  }
});

window.addEventListener("message", function (event) {

  if (event.source === window && event.data.target === "extension") {

    browser.runtime.sendMessage(event.data.message, (response) => {

      window.postMessage({ source: "extension", response: response }, "*");
    });
  }
});

// Listen for the 'beforeunload' event to remove any injected elements
window.addEventListener("beforeunload", removeInjectedElement);

// Function to send a message to the website
function sendMessageToWebsite(messageData) {
  removeInjectedElement(); // Clean up any previous injected elements

  // Create a new span element with a unique ID
  const injectedElement = document.createElement("span");
  injectedElement.id = "x-template-base-" + messageData.currentKey; // Set a unique ID based on currentKey

  // Append the new element to the document body
  document.body.appendChild(injectedElement);
  console.log("message", messageData); // Log the message data

  // Send the message to the website
  window.postMessage(0, messageData.url); // 0 is the targetOrigin, meaning the same origin
}

// Function to remove injected elements from the DOM
function removeInjectedElement() {
  const injectedElement = document.querySelector("[id^='x-template-base-']"); // Select elements with ID starting with "x-template-base-"
  if (injectedElement) {
      injectedElement.remove(); // Remove the element if it exists
  }
}

