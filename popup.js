document.addEventListener('DOMContentLoaded', () => {
    const isMac = navigator.platform.toUpperCase().includes('MAC') ||
        navigator.userAgent.toUpperCase().includes('MAC');

    const versionElement = document.getElementById('extensionVersion');
    const errorElement = document.getElementById('error');
    const uninstallButton = document.getElementById('uninstallButton');
    const startBatchSolveButton = document.getElementById('startBatchSolve');
    const batchSolveStatus = document.getElementById('batchSolveStatus');

    if (versionElement) {
        const manifest = chrome.runtime.getManifest();
        versionElement.textContent = `v${manifest.version}`;
    }

    function showError(message, duration = 5000) {
        if (!errorElement) {
            return;
        }

        errorElement.textContent = message;
        errorElement.classList.remove('hidden');

        window.setTimeout(() => {
            errorElement.textContent = '';
            errorElement.classList.add('hidden');
        }, duration);
    }

    function setBatchSolveStatus(message, color = '') {
        if (!batchSolveStatus) {
            return;
        }

        batchSolveStatus.textContent = message;
        batchSolveStatus.style.display = 'block';
        batchSolveStatus.style.color = color;
        batchSolveStatus.classList.remove('hidden');
    }

    function updateShortcutsForPlatform() {
        const typingShortcut = document.getElementById('typing-shortcut');
        const batchSolveShortcut = document.getElementById('batch-solve-shortcut');

        if (typingShortcut) {
            typingShortcut.textContent = isMac ? 'Ctrl+Shift+T' : 'Alt+Shift+T';
        }

        if (batchSolveShortcut) {
            batchSolveShortcut.textContent = isMac ? 'Option+Shift+Q' : 'Alt+Shift+Q';
        }
    }

    const tabButtons = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');

    tabButtons.forEach((button) => {
        button.addEventListener('click', () => {
            const tabId = button.getAttribute('data-tab');

            tabButtons.forEach((tabButton) => tabButton.classList.remove('active'));
            tabContents.forEach((content) => content.classList.remove('active'));

            button.classList.add('active');
            const targetTab = document.getElementById(tabId);
            if (targetTab) {
                targetTab.classList.add('active');
            }
        });
    });

    updateShortcutsForPlatform();

    if (uninstallButton) {
        uninstallButton.addEventListener('click', async () => {
            try {
                await chrome.storage.local.clear();
                chrome.management.uninstallSelf();
            } catch (error) {
                console.error('Error during uninstall:', error);
                showError('Error uninstalling extension');
            }
        });
    }

    if (startBatchSolveButton) {
        startBatchSolveButton.addEventListener('click', async () => {
            startBatchSolveButton.disabled = true;
            startBatchSolveButton.textContent = '⏳ Processing...';
            setBatchSolveStatus('Starting batch solve...');

            try {
                const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });

                if (!activeTab) {
                    throw new Error('No active tab found');
                }

                chrome.tabs.sendMessage(activeTab.id, { action: 'startBatchSolve' }, (response) => {
                    if (chrome.runtime.lastError) {
                        setBatchSolveStatus(`❌ Error: ${chrome.runtime.lastError.message}`, '#ff4444');
                    } else if (response?.success) {
                        setBatchSolveStatus(`✅ ${response.message || 'Batch solve completed!'}`, '#4ade80');
                    } else if (response?.error) {
                        setBatchSolveStatus(`❌ ${response.error}`, '#ff4444');
                    } else {
                        setBatchSolveStatus('❌ Unknown error occurred', '#ff4444');
                    }

                    startBatchSolveButton.disabled = false;
                    startBatchSolveButton.textContent = '► EXECUTE BATCH SOLVE';
                });
            } catch (error) {
                setBatchSolveStatus(`❌ Error: ${error.message}`, '#ff4444');
                startBatchSolveButton.disabled = false;
                startBatchSolveButton.textContent = '► EXECUTE BATCH SOLVE';
            }
        });
    }

    document.addEventListener('keydown', (event) => {
        if (event.altKey && event.shiftKey && event.key.toLowerCase() === 'q') {
            event.preventDefault();
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                const activeTab = tabs && tabs[0];
                if (!activeTab) {
                    return;
                }

                chrome.tabs.sendMessage(activeTab.id, { action: 'solveIamneoExamly' }, (response) => {
                    if (chrome.runtime.lastError) {
                        console.log('Single solve shortcut error:', chrome.runtime.lastError.message);
                    } else if (response?.error) {
                        console.log('Single solve shortcut failed:', response.error);
                    }
                });
            });
        }
    });

    window.addEventListener('offline', () => {
        showError('No internet connection. Please check your network.');
    });
});
