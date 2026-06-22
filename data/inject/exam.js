// Use shared isMac variable if it exists, otherwise declare it
if (typeof window.isMac === 'undefined') {
    window.isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0 || 
                   navigator.userAgent.toUpperCase().indexOf('MAC') >= 0;
}

// Auto-answering mechanism
(function () {
  let editor;
  let codeLines = [];
  let charIndex = 0;
  let lineIndex = 0;
  let typingMode = false; // false for instant typing, true for character-by-character
  let currentCode = ""; // Store the current question's complete code
  let isTyping = false; // Flag to track if currently typing
  let typingInitialized = false; // Flag to track if Cmd+Shift+T was pressed first
  let lastQuestionNumber = null; // Track the last question number to detect changes
  let typingIntervalId = null; // Interval ID for auto-typing
  let typingSpeed = 60; // Milliseconds between characters (adjust for faster/slower typing)

  // Function to detect question changes and reset typing state
  function checkForQuestionChange() {
    const questionElement = document.querySelector("#content-left > content-left > div > div.t-h-full > testtaking-question > div > div.t-flex.t-items-center.t-justify-between.t-whitespace-nowrap.t-px-10.t-py-8.lg\\:t-py-8.lg\\:t-px-20.t-bg-primary\\/\\[0\\.1\\].t-border-b.t-border-solid.t-border-b-neutral-2.t-min-h-\\[30px\\].lg\\:t-min-h-\\[35px\\].ng-star-inserted > div:nth-child(1) > div > div");
    
    if (questionElement) {
      const questionText = questionElement.textContent;
      const match = questionText.match(/Question No : (\d+) \/ \d+/);
      const currentQuestionNumber = match ? match[1] : null;
      
      // If question changed, reset typing state
      if (currentQuestionNumber && currentQuestionNumber !== lastQuestionNumber) {
        lastQuestionNumber = currentQuestionNumber;
        stopAutoTyping();
        isTyping = false;
        typingInitialized = false;
        
        // Also update editor reference when question changes
        const isCodingQuestion = document.querySelector("#programme-compile");
        if (isCodingQuestion) {
          const editorElement = document.querySelector("div[aria-labelledby=\"editor-answer\"]");
          if (editorElement) {
            editor = ace.edit(editorElement);
          }
        }
      }
    }
  }

  // Check for question changes periodically
  setInterval(checkForQuestionChange, 500);
  
  // Function to stop auto-typing
  function stopAutoTyping() {
    if (typingIntervalId) {
      clearInterval(typingIntervalId);
      typingIntervalId = null;
      console.log('[exam.js] Auto-typing stopped');
    }
  }
  
  // Function to start auto-typing with human-like speed
  function startAutoTyping() {
    if (typingIntervalId) {
      clearInterval(typingIntervalId);
    }
    
    console.log('[exam.js] Starting auto-typing...');
    isTyping = true;
    
    typingIntervalId = setInterval(() => {
      if (lineIndex < codeLines.length) {
        const currentLine = codeLines[lineIndex];

        // Skip comment lines
        if (currentLine.trim().startsWith("//")) {
          lineIndex++;
          charIndex = 0;
          return; // Continue to next iteration
        }

        if (charIndex < currentLine.length) {
          // Type one character
          editor.setValue(editor.getValue() + currentLine[charIndex]);
          editor.clearSelection();
          editor.navigateFileEnd();
          charIndex++;
        } else {
          // End of line, add newline
          editor.setValue(editor.getValue() + "\n");
          editor.clearSelection();
          editor.navigateFileEnd();
          lineIndex++;
          charIndex = 0;
        }
      } else {
        // Finished typing all code
        stopAutoTyping();
        typingMode = false;
        isTyping = false;
        typingInitialized = false;
        console.log('[exam.js] Auto-typing complete!');
      }
    }, typingSpeed);
  }
  
  // Function to type the next character (for manual mode / backspace reset)
  function typeNextCharacter() {
    if (lineIndex < codeLines.length) {
      const currentLine = codeLines[lineIndex];

      if (currentLine.trim().startsWith("//")) {
        lineIndex++;
        charIndex = 0;
        typeNextCharacter();
        return;
      }

      if (charIndex < currentLine.length) {
        editor.setValue(editor.getValue() + currentLine[charIndex]);
        editor.clearSelection(); // Clear selection
        editor.navigateFileEnd(); // Move cursor to end
        charIndex++;
      } else {
        editor.setValue(editor.getValue() + "\n");
        editor.clearSelection(); // Clear selection
        editor.navigateFileEnd(); // Move cursor to end
        lineIndex++;
        charIndex = 0;
      }
    } else {
      typingMode = false;
      isTyping = false;
      typingInitialized = false; // Reset initialization when typing is complete
    }
  }

  // Event listener for keyboard shortcuts
  document.addEventListener("keydown", function (event) {
    // Guard against undefined event.key (e.g., from browser autofill events)
    if (!event.key) {
      return;
    }
    
    // Always check for question changes before handling shortcuts
    checkForQuestionChange();
    
    // Handle backspace to restart typing from beginning (works when code is loaded)
    if (event.key === "Backspace" && typingInitialized && currentCode) {
      event.preventDefault(); // Prevent default backspace behavior
      event.stopPropagation();
      console.log('[exam.js] Backspace pressed - restarting from beginning');
      // Stop current typing and restart from beginning
      stopAutoTyping();
      editor.setValue("");
      editor.clearSelection();
      charIndex = 0;
      lineIndex = 0;
      startAutoTyping();
      return;
    }
    
    // Handle Escape to stop typing
    if (event.key === "Escape" && isTyping) {
      event.preventDefault();
      stopAutoTyping();
      isTyping = false;
      console.log('[exam.js] Typing stopped by user (Escape)');
      return;
    }
    
  // Alt + Shift + I for INSTANT paste (no human-like typing)
  const isAltShiftI = event.altKey && event.shiftKey && event.code === "KeyI";
  if (isAltShiftI && typingInitialized && currentCode) {
      event.preventDefault();
      event.stopPropagation();
      console.log('[exam.js] Instant paste triggered (Alt+Shift+I)');
      
      // Stop any ongoing typing
      stopAutoTyping();
      
      // Instantly paste the entire code
      editor.setValue(currentCode);
      editor.clearSelection();
      editor.navigateFileEnd();
      
      // Reset state
      isTyping = false;
      typingInitialized = false;
      console.log('[exam.js] Code instantly pasted!');
      return;
  }

  // Alt + Shift + T on all platforms (or Ctrl + Alt + T as alternative)
  // Primary: Alt + Shift + T - Human-like typing
  // Alternative: Ctrl + Alt + T (for systems where Alt+Shift+T conflicts)
  const isAltShiftT = event.altKey && event.shiftKey && event.code === "KeyT";
  const isCtrlAltT = event.ctrlKey && event.altKey && event.code === "KeyT" && !event.shiftKey;
  
  if (isAltShiftT || isCtrlAltT) {
      event.preventDefault();
      event.stopPropagation();
      console.log('[exam.js] Type coding shortcut triggered:', isAltShiftT ? 'Alt+Shift+T' : 'Ctrl+Alt+T');
      
      // If already auto-typing, pause it
      if (typingInitialized && isTyping && typingIntervalId) {
        stopAutoTyping();
        isTyping = false;
        console.log('[exam.js] Auto-typing paused');
        return;
      }
      
      // If typing was paused, resume it
      if (typingInitialized && !isTyping && currentCode && lineIndex < codeLines.length) {
        console.log('[exam.js] Resuming auto-typing...');
        startAutoTyping();
        return;
      }
      
      // Otherwise, initialize typing for the first time (fetch from AI)
      const isCodingQuestion = document.querySelector("#programme-compile");

      if (isCodingQuestion) {
        const questionElement = document.querySelector("#content-left > content-left > div > div.t-h-full > testtaking-question > div > div.t-flex.t-items-center.t-justify-between.t-whitespace-nowrap.t-px-10.t-py-8.lg\\:t-py-8.lg\\:t-px-20.t-bg-primary\\/\\[0\\.1\\].t-border-b.t-border-solid.t-border-b-neutral-2.t-min-h-\\[30px\\].lg\\:t-min-h-\\[35px\\].ng-star-inserted > div:nth-child(1) > div > div");

        if (questionElement) {
          const questionText = questionElement.textContent;
          const match = questionText.match(/Question No : (\d+) \/ \d+/);
          let questionNumber = match ? parseInt(match[1]) : null;

          if (questionNumber) {
            const editorElement = document.querySelector("div[aria-labelledby=\"editor-answer\"]");

            if (editorElement) {
              editor = ace.edit(editorElement);
              
              // Get answer from AI and type it (only on first press)
              async function getAnswerFromAI() {
                  try {
                    // Extract coding question details
                    const programmingLanguageElement = document.querySelector('span.inner-text');
                    const programmingLanguage = programmingLanguageElement ? programmingLanguageElement.innerText.trim() : 'Programming language not found.';

                    const questionDataElement = document.querySelector('div[aria-labelledby="question-data"]');
                    const questionData = questionDataElement ? questionDataElement.innerText.trim() : 'Question not found.';

                    const inputFormatElement = document.querySelector('div[aria-labelledby="input-format"]');
                    const inputFormatText = inputFormatElement ? inputFormatElement.innerText.trim() : '';

                    const outputFormatElement = document.querySelector('div[aria-labelledby="output-format"]');
                    const outputFormatText = outputFormatElement ? outputFormatElement.innerText.trim() : '';

                    // Extract sample test cases with robust fallback method
                    const testCases = [];
                    
                    // Try Method 1: Find test case containers with aria-labelledby="each-tc-card"
                    let containers = document.querySelectorAll('div[aria-labelledby="each-tc-card"]');
                    
                    if (containers.length > 0) {
                        console.log('[Test Cases] Method 1: Found', containers.length, 'test case containers');
                        containers.forEach((container) => {
                            const inputPre = container.querySelector('div[aria-labelledby="each-tc-input-container"] pre');
                            const outputPre = container.querySelector('div[aria-labelledby="each-tc-output-container"] pre');
                            
                            if (inputPre && outputPre) {
                                testCases.push({
                                    input: inputPre.textContent.trim(),
                                    output: outputPre.textContent.trim()
                                });
                            }
                        });
                    }
                    
                    // Try Method 2: Find by aria-labelledby="each-tc-container"
                    if (testCases.length === 0) {
                        console.log('[Test Cases] Method 1 failed. Trying Method 2...');
                        containers = document.querySelectorAll('[aria-labelledby="each-tc-container"]');
                        
                        if (containers.length > 0) {
                            console.log('[Test Cases] Method 2: Found', containers.length, 'test case containers');
                            containers.forEach((container) => {
                                const inputPre = container.querySelector('[aria-labelledby="each-tc-input"]');
                                const outputPre = container.querySelector('[aria-labelledby="each-tc-output"]');
                                
                                if (inputPre && outputPre) {
                                    testCases.push({
                                        input: inputPre.textContent.trim(),
                                        output: outputPre.textContent.trim()
                                    });
                                }
                            });
                        }
                    }
                    
                    // Try Method 3: Find pre elements with Input/Output labels
                    if (testCases.length === 0) {
                        console.log('[Test Cases] Method 2 failed. Trying Method 3...');
                        const allPres = document.querySelectorAll('pre');
                        const inputs = [];
                        const outputs = [];
                        
                        allPres.forEach(pre => {
                            const text = pre.textContent.trim();
                            const prevElement = pre.previousElementSibling;
                            
                            if (prevElement) {
                                const labelText = prevElement.textContent.toLowerCase();
                                if (labelText.includes('input') && !labelText.includes('output')) {
                                    inputs.push(text);
                                } else if (labelText.includes('output')) {
                                    outputs.push(text);
                                }
                            }
                        });
                        
                        console.log('[Test Cases] Method 3: Found', inputs.length, 'inputs and', outputs.length, 'outputs');
                        
                        // Pair inputs and outputs
                        for (let i = 0; i < Math.min(inputs.length, outputs.length); i++) {
                            testCases.push({
                                input: inputs[i],
                                output: outputs[i]
                            });
                        }
                    }
                    
                    
                    let testCasesText = '';
                    if (testCases.length > 0) {
                        testCases.forEach((testCase, index) => {
                            testCasesText += `Sample Test Case ${index + 1}:\nInput:\n${testCase.input}\nOutput:\n${testCase.output}\n\n`;
                        });
                        console.log('[Test Cases] Successfully extracted', testCases.length, 'test cases');
                    } else {
                        console.warn('[Test Cases] All methods failed. No test cases extracted.');
                        testCasesText = 'No test cases found. Please check the page structure.';
                    }

                    // Dispatch custom event to content.js to request AI answer
                    const requestEvent = new CustomEvent('NEOPASS_REQUEST_CODE_TYPED', {
                      detail: {
                        programmingLanguage: programmingLanguage,
                        question: questionData,
                        inputFormat: inputFormatText,
                        outputFormat: outputFormatText,
                        testCases: testCasesText
                      }
                    });
                    window.dispatchEvent(requestEvent);
                    
                    console.log('[exam.js] Dispatched NEOPASS_REQUEST_CODE_TYPED event');
                  } catch (error) {
                    console.error("Error getting answer from AI:", error);
                  }
                }
                getAnswerFromAI();
            }
          }
        }
      }
      return;
    }

    // Handle typing with just plain 'T' key after initialization (alternative method)
    if (event.key.toLowerCase() === "t" && typingInitialized && !event.ctrlKey && !event.altKey && !event.shiftKey && !event.metaKey) {
      if (isTyping) {
        event.preventDefault();
        typeNextCharacter();
      }
      return;
    }
  });

  // Listen for code insertion events from content.js (Alt+Shift+A)
  window.addEventListener('NEOPASS_INSERT_CODE', function(event) {
    const codeToInsert = event.detail?.code;
    if (!codeToInsert) return;
    
    console.log('[exam.js] Received code insertion request, length:', codeToInsert.length);
    
    const editorElement = document.querySelector('div[aria-labelledby="editor-answer"]');
    if (editorElement) {
      try {
        const editor = ace.edit(editorElement);
        editor.setValue(codeToInsert);
        editor.clearSelection();
        editor.navigateFileEnd();
        console.log('[exam.js] Code inserted successfully');
      } catch (error) {
        console.error('[exam.js] Error inserting code:', error);
      }
    } else {
      console.error('[exam.js] Editor element not found');
    }
  });

  // Listen for typed code response from content.js (Alt+Shift+T)
  window.addEventListener('NEOPASS_INSERT_CODE_TYPED', function(event) {
    const codeToType = event.detail?.code;
    if (!codeToType) return;
    
    console.log('[exam.js] Received typed code response, length:', codeToType.length);
    
    const editorElement = document.querySelector('div[aria-labelledby="editor-answer"]');
    if (editorElement) {
      try {
        editor = ace.edit(editorElement);
        
        // Prepare for typing
        currentCode = codeToType;
        editor.setValue("");
        editor.clearSelection();
        codeLines = currentCode.split("\n");
        charIndex = 0;
        lineIndex = 0;
        typingMode = true;
        isTyping = true;
        typingInitialized = true;
        
        // Start auto-typing (human-like speed)
        startAutoTyping();
        console.log('[exam.js] Started auto-typing code');
      } catch (error) {
        console.error('[exam.js] Error preparing to type code:', error);
      }
    } else {
      console.error('[exam.js] Editor element not found');
    }
  });
})();