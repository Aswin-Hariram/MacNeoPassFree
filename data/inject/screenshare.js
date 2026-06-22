// Mac detection - only declare if not already declared
let isMac;
if (typeof isMac === 'undefined') {
    isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0 || 
            navigator.userAgent.toUpperCase().indexOf('MAC') >= 0;
}

// Lists of events to intercept
const windowEvents = [
    "blur", 
    "focus", 
    "beforeunload", 
    "pagehide", 
    "unload", 
    "popstate", 
    "resize", 
    "pagehide", 
    'lostpointercapture', 
    "fullscreenchange", 
    "visibilitychange"
];

const documentEvents = [
    "paste", 
    "onpaste", 
    "visibilitychange", 
    "webkitvisibilitychange"
];

// Store original property descriptors for restoration
const originalVisibilityState = Object.getOwnPropertyDescriptor(document, 'visibilityState');
const originalWebkitVisibilityState = Object.getOwnPropertyDescriptor(document, "webkitVisibilityState");
const originalHidden = Object.getOwnPropertyDescriptor(document, "hidden");

// Event handler to prevent default behavior
const eventHandler = (event) => {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
};

// Main function to bypass browser restrictions
function bypassRestrictions() {
    // Aggressively block beforeunload popup
    const blockBeforeUnload = (e) => {
        e.stopPropagation();
        e.stopImmediatePropagation();
        delete e['returnValue'];
    };
    
    // Add our handler with highest priority (capture phase)
    window.addEventListener('beforeunload', blockBeforeUnload, true);
    
    // Override addEventListener to block beforeunload handlers
    const originalAddEventListener = EventTarget.prototype.addEventListener;
    EventTarget.prototype.addEventListener = function(type, listener, options) {
        if (type === 'beforeunload') {
            return; // Completely ignore beforeunload listeners
        }
        return originalAddEventListener.call(this, type, listener, options);
    };
    
    // Override onbeforeunload property setter
    Object.defineProperty(window, 'onbeforeunload', {
        set: function(val) {
            // Silently ignore attempts to set onbeforeunload
        },
        get: function() {
            return null;
        },
        configurable: false
    });
    
    // Prevent window events from firing
    windowEvents.forEach(eventName => {
        // Skip unload and beforeunload events
        if (eventName !== 'unload' && eventName !== 'beforeunload') {
            window.addEventListener(eventName, eventHandler, true);
        }
    });

    // Prevent document events from firing
    documentEvents.forEach(eventName => {
        document.addEventListener(eventName, eventHandler, true);
    });

    // Override visibility state properties
    Object.defineProperty(document, "visibilityState", {
        get: () => "visible",
        configurable: true
    });

    Object.defineProperty(document, 'webkitVisibilityState', {
        get: () => "visible",
        configurable: true
    });

    Object.defineProperty(document, "hidden", {
        get: () => false,
        configurable: true
    });
}

// Function to spoof screen recording behavior
function spoofScreenRecording() {
    const originalGetDisplayMedia = navigator.mediaDevices.getDisplayMedia;
    
    // Store original method reference
    if (!navigator.mediaDevices.__originalGetDisplayMedia) {
        navigator.mediaDevices.__originalGetDisplayMedia = originalGetDisplayMedia;
    }
    
    navigator.mediaDevices.getDisplayMedia = async function(constraints) {
        // Will be handled by combined popup
        return new Promise((resolve, reject) => {
            showPopup(resolve, reject, constraints, originalGetDisplayMedia);
        });
    };
}

function showPopup(resolve, reject, constraints, originalGetDisplayMedia) {
    // Create container with xAI theme
    const gradientContainer = document.createElement('div');
    gradientContainer.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        padding: 0;
        background: #111111;
        z-index: 999999;
        animation: fadeIn 0.3s ease-in;
        border: 1px solid rgba(255, 255, 255, 0.1);
    `;
    
    // Main toast content
    const toast = document.createElement('div');
    toast.style.cssText = `
        position: relative;
        background-color: #111111;
        backdrop-filter: blur(8px);
        color: #f2f2f2;
        padding: 24px;
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
        min-width: 400px;
        border: 1px solid rgba(255, 255, 255, 0.1);
        transition: background-color 0.2s;
    `;

    // Animation styles
    const style = document.createElement('style');
    style.textContent = `
        @keyframes fadeIn {
            from { opacity: 0; transform: translate(-50%, -45%); }
            to { opacity: 1; transform: translate(-50%, -50%); }
        }
        @keyframes fadeOut {
            from { opacity: 1; transform: translate(-50%, -50%); }
            to { opacity: 0; transform: translate(-50%, -45%); }
        }
    `;
    document.head.appendChild(style);

    // Add content
    toast.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; padding-bottom: 12px; border-bottom: 1px solid rgba(255, 255, 255, 0.1);">
            <div style="display: flex; align-items: center; gap: 8px;">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path fill-rule="evenodd" clip-rule="evenodd" d="M4.6109 4.68601C4.72546 4.54406 4.90822 4.47575 5.0878 4.50778L16.575 6.55656C16.6715 6.57377 16.7608 6.61896 16.8318 6.68651L19.3446 9.07676C19.5379 9.26064 19.5528 9.5639 19.3784 9.76583L11.122 19.3268C11.0084 19.4583 10.8347 19.5214 10.6632 19.4935C10.4917 19.4656 10.347 19.3506 10.281 19.1898L4.53742 5.18979C4.46819 5.02103 4.49635 4.82796 4.6109 4.68601ZM6.19646 6.59904L10.4853 17.053L11.2894 10.6786L6.19646 6.59904ZM12.2688 10.9045L11.4468 17.4207L17.7491 10.1226L12.2688 10.9045ZM17.9075 9.08986L13.7298 9.68594L16.4453 7.69901L17.9075 9.08986ZM15.2483 7.33573L6.84451 5.83688L11.8343 9.83381L15.2483 7.33573Z" fill="#ffffff"/>
                </svg>
                <span style="font-size: 16px; font-weight: 500; color: #ffffff; letter-spacing: -0.02em;">macneopassfree</span>
            </div>
            <span class="close-btn" style="cursor: pointer; font-size: 20px; color: rgba(255, 255, 255, 0.4); transition: color 0.2s; line-height: 1; padding: 4px 8px;">×</span>
        </div>
        <div style="text-align: left; color: #ffffff; font-weight: 500; margin-bottom: 16px; font-size: 10px; text-transform: uppercase; letter-spacing: 0.1em;">
            Fullscreen Screenshare Bypassed
        </div>
        <div style="margin-bottom: 24px; color: rgba(255, 255, 255, 0.6); padding: 16px; background: rgba(255, 255, 255, 0.02); border: 1px solid rgba(255, 255, 255, 0.1);">
            <div style="font-size: 13px; line-height: 1.6;">
                Now you can share <span style="color: #ffffff; font-weight: 500;">only the tab</span> or <span style="color: #ffffff; font-weight: 500;">only the Chrome window</span><br>
                instead of the entire screen.
            </div>
        </div>
        <div style="display: flex; justify-content: center; gap: 10px;">
            <button class="ok-btn" style="padding: 14px 28px; border: none; background: #ffffff; color: #111111; cursor: pointer; font-weight: 600; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; transition: all 0.2s; font-family: inherit;">
                Proceed
            </button>
        </div>
    `;

    // Add event listeners
    const closeBtn = toast.querySelector('.close-btn');
    const okBtn = toast.querySelector('.ok-btn');

    const cleanup = () => {
        gradientContainer.style.animation = 'fadeOut 0.3s ease-out';
        setTimeout(() => gradientContainer.remove(), 280);
    };

    closeBtn.onclick = () => {
        cleanup();
        reject(new Error('Screen share cancelled by user'));
    };

    okBtn.onclick = async () => {
        cleanup();
        try {
            // Continue with original screen sharing logic
            // Mac-specific constraints handling
            if (isMac) {
                constraints = {
                    video: {
                        displaySurface: "browser",
                        logicalSurface: true,
                        cursor: "always"
                    },
                    audio: false,
                    selfBrowserSurface: "include",
                    surfaceSwitching: "include",
                    systemAudio: "exclude"
                };
            } else {
                constraints = {
                    selfBrowserSurface: "include",
                    monitorTypeSurfaces: "exclude",
                    video: { displaySurface: "window" }
                };
            }
    
            const stream = await originalGetDisplayMedia.call(navigator.mediaDevices, constraints);
            const videoTrack = stream.getVideoTracks()[0];
            const originalGetSettings = videoTrack.getSettings.bind(videoTrack);
            videoTrack.getSettings = function() {
                const settings = originalGetSettings();
                settings.displaySurface = 'monitor';
                return settings;
            };
            resolve(stream);
        } catch (error) {
            reject(error);
        }
    };

    // Add hover effects
    okBtn.onmouseover = () => okBtn.style.opacity = '0.9';
    okBtn.onmouseout = () => okBtn.style.opacity = '1';
    closeBtn.onmouseover = () => closeBtn.style.color = 'white';
    closeBtn.onmouseout = () => closeBtn.style.color = 'rgba(255, 255, 255, 0.8)';

    gradientContainer.appendChild(toast);
    document.body.appendChild(gradientContainer);
}

// Initialize bypasses and observer
bypassRestrictions();
spoofScreenRecording();
