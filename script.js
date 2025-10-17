class TextFormatter {
    constructor() {
        this.editor = null;
        this.wysiwygEditor = null;
        this.currentEditor = 'monaco'; // 'monaco' or 'wysiwyg'
        this.history = [];
        this.historyIndex = -1;
        this.maxHistorySize = 50;
        this.currentTheme = 'light';
        this.findMatches = [];
        this.currentMatchIndex = -1;
        // Auto-save configuration
        this.autoSaveKey = 'textFormatter_editorContent';
        this.autoSaveDebounceTime = 500; // 500ms debounce
        this.autoSaveTimeout = null;
        this.isUndoRedoOperation = false; // Flag to prevent auto-save during undo/redo

        // Operation History configuration
        this.operationHistory = [];
        this.maxOperationHistory = 5;
        this.operationHistoryKey = 'textFormatter_operationHistory';
        this.isExecutingFromHistory = false; // Flag to prevent duplicate history entries

        this.initializeSettings();
        this.init();
    }

    initializeSettings() {
        // Load theme preference
        const savedTheme = localStorage.getItem('textFormatter_theme');
        const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        this.currentTheme = savedTheme || (systemPrefersDark ? 'dark' : 'light');

        // Apply theme
        this.applyTheme();
    }


    init() {
        this.loadHistory();
        this.loadOperationHistory();

        // Initialize Monaco editor with proper timing
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                setTimeout(() => this.initMonacoEditor(), 100);
            });
        } else {
            setTimeout(() => this.initMonacoEditor(), 100);
        }

        this.initWysiwygEditor();
        this.bindEvents();
        this.updateUndoRedoButtons();
    }

    initMonacoEditor() {
        // Enhanced Monaco Editor loading with better error handling
        const monacoScript = document.querySelector('script[src*="monaco-editor"]');

        if (!monacoScript) {
            console.error('Monaco Editor script not found');
            this.fallbackToTextarea();
            return;
        }

        // Wait for script to load if not already loaded
        if (typeof require === 'undefined') {
            setTimeout(() => this.initMonacoEditor(), 100);
            return;
        }

        // Configure require with fallback CDN
        require.config({
            paths: {
                vs: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.45.0/min/vs'
            },
            // Add timeout and error handling
            waitSeconds: 30
        });

        require(['vs/editor/editor.main'], () => {
            // Load cached content if available
            const cachedData = this.loadCachedContent();
            const initialValue = cachedData && cachedData.content ?
                cachedData.content :
                'Start typing your text here...\n\nUse the buttons above to format your text.';

            this.editor = monaco.editor.create(document.getElementById('monaco-editor'), {
                value: initialValue,
                language: 'plaintext',
                theme: this.currentTheme === 'dark' ? 'vs-dark' : 'vs',
                minimap: { enabled: false },
                wordWrap: 'on',
                automaticLayout: true,
                fontSize: 14,
                lineNumbers: 'on',
                scrollBeyondLastLine: false,
                selectOnLineNumbers: true,
                roundedSelection: false,
                readOnly: false,
                cursorStyle: 'line',
                glyphMargin: false,
                folding: false,
                lineDecorationsWidth: 10, // Add space between line numbers and content
                lineNumbersMinChars: 3,
                renderLineHighlight: 'line',
                contextmenu: true,
                mouseWheelZoom: true,
                smoothScrolling: true,
                cursorBlinking: 'blink',
                cursorSmoothCaretAnimation: false,
                renderWhitespace: 'selection',
                bracketPairColorization: {
                    enabled: true
                },
                padding: { top: 16, bottom: 16 },
                overviewRulerLanes: 0,
                hideCursorInOverviewRuler: true,
                overviewRulerBorder: false
            });

            this.editor.onDidChangeModelContent(() => {
                this.updatePreview();
                // Auto-save content changes (but not during undo/redo operations)
                if (!this.isUndoRedoOperation) {
                    const content = this.editor.getValue();
                    this.debouncedAutoSave(content);
                }
            });

            // Add keyboard shortcuts
            this.addKeyboardShortcuts();

            // Setup Monaco-specific shortcuts
            this.setupMonacoShortcuts();

            // Add context menu options
            this.editor.addAction({
                id: 'format-text',
                label: 'Format Text',
                contextMenuGroupId: 'modification',
                run: () => {
                    this.formatSelectedText();
                }
            });

            // Ensure editor resizes properly
            window.addEventListener('resize', () => {
                if (this.editor) {
                    this.editor.layout();
                }
            });

            // Clean initial content to remove any zero-width characters
            const cleanValue = this.cleanText(this.editor.getValue());
            this.editor.setValue(cleanValue);

            this.updatePreview();
            this.saveToHistory(this.editor.getValue());
        }, (error) => {
            console.error('Failed to load Monaco Editor:', error);
            this.fallbackToTextarea();
        });
    }

    fallbackToTextarea() {
        console.log('Using fallback textarea editor');
        const monacoContainer = document.getElementById('monaco-editor');

        // Load cached content if available
        const cachedData = this.loadCachedContent();
        const initialValue = cachedData && cachedData.content ?
            cachedData.content :
            'Start typing your text here...\n\nUse the buttons above to format your text.';

        // Create fallback textarea
        const textarea = document.createElement('textarea');
        textarea.id = 'fallback-editor';
        textarea.className = 'w-full h-full p-4 font-mono text-sm border-none outline-none resize-none';
        textarea.value = initialValue;
        textarea.style.backgroundColor = 'var(--background)';
        textarea.style.color = 'var(--foreground)';
        textarea.style.minHeight = '400px';

        // Replace Monaco container with textarea
        monacoContainer.innerHTML = '';
        monacoContainer.appendChild(textarea);

        // Set up textarea as the editor
        this.editor = {
            getValue: () => textarea.value,
            setValue: (value) => { textarea.value = value; },
            getSelection: () => ({
                startLineNumber: 1,
                startColumn: textarea.selectionStart + 1,
                endLineNumber: 1,
                endColumn: textarea.selectionEnd + 1
            }),
            executeEdits: (id, edits) => {
                if (edits && edits[0]) {
                    const start = textarea.selectionStart;
                    const end = textarea.selectionEnd;
                    const value = textarea.value;
                    textarea.value = value.substring(0, start) + edits[0].text + value.substring(end);
                }
            },
            focus: () => textarea.focus(),
            setPosition: () => {},
            layout: () => {},
            updateOptions: () => {},
            addAction: () => {},
            getModel: () => ({
                getPositionAt: (offset) => ({ lineNumber: 1, column: offset + 1 }),
                getValueInRange: (range) => {
                    if (range && range.startColumn && range.endColumn) {
                        return textarea.value.substring(range.startColumn - 1, range.endColumn - 1);
                    }
                    return '';
                }
            }),
            setSelection: () => {},
            revealRangeInCenter: () => {}
        };

        // Add event listeners
        textarea.addEventListener('input', () => {
            this.updatePreview();
            // Auto-save content changes (but not during undo/redo operations)
            if (!this.isUndoRedoOperation) {
                this.debouncedAutoSave(textarea.value);
            }
        });

        // Save initial state
        this.updatePreview();
        this.saveToHistory(textarea.value);
    }

    cleanText(text) {
        // Remove any zero-width characters that might cause cursor issues
        return text.replace(/[\u200B-\u200F\uFEFF]/g, '');
    }

    cleanHtmlForCopy(html) {
        // Clean HTML for copying to ensure it works well in Word and other applications
        let cleanHtml = html;

        // Replace <br> tags with proper line breaks for better compatibility
        cleanHtml = cleanHtml.replace(/<br\s*\/?>/gi, '\n');

        // Ensure code tags have proper styling for Word
        cleanHtml = cleanHtml.replace(/<code[^>]*>/gi, '<span style="font-family: monospace; background-color: #f1f1f1; padding: 2px 4px; border-radius: 3px;">');
        cleanHtml = cleanHtml.replace(/<\/code>/gi, '</span>');

        // Add basic styling to make it more compatible with Word
        const styledHtml = `
            <div style="font-family: Arial, sans-serif; font-size: 14px; line-height: 1.5;">
                ${cleanHtml}
            </div>
        `;

        return styledHtml;
    }

    initWysiwygEditor() {
        this.wysiwygEditor = document.getElementById('wysiwyg-editor');

        // Load cached content if available and in WYSIWYG mode
        const cachedData = this.loadCachedContent();
        const initialContent = cachedData && cachedData.content && cachedData.editor === 'wysiwyg' ?
            this.parseMarkdown(cachedData.content) :
            'Start typing your text here...<br><br>Use the buttons above to format your text.';

        // Set initial content
        this.wysiwygEditor.innerHTML = initialContent;

        // Add event listeners
        this.wysiwygEditor.addEventListener('input', () => {
            this.updatePreview();
            // Auto-save content changes (but not during undo/redo operations)
            if (!this.isUndoRedoOperation) {
                const content = this.htmlToMarkdown(this.wysiwygEditor.innerHTML);
                this.debouncedAutoSave(content);
            }
        });

        this.wysiwygEditor.addEventListener('keydown', (e) => {
            this.handleWysiwygKeydown(e);
        });

        // Prevent some default formatting to maintain consistency
        this.wysiwygEditor.addEventListener('paste', (e) => {
            e.preventDefault();
            const text = e.clipboardData.getData('text/plain');
            document.execCommand('insertText', false, text);
        });
    }

    handleWysiwygKeydown(e) {
        // Handle keyboard shortcuts for WYSIWYG editor
        if (e.metaKey || e.ctrlKey) {
            switch (e.key.toLowerCase()) {
                case 'z':
                    e.preventDefault();
                    if (e.shiftKey) {
                        this.redo();
                    } else {
                        this.undo();
                    }
                    break;
                case 'y':
                    e.preventDefault();
                    this.redo();
                    break;
                case 'b':
                    e.preventDefault();
                    this.applyWysiwygFormat('bold');
                    break;
                case 'i':
                    e.preventDefault();
                    this.applyWysiwygFormat('italic');
                    break;
                case 'u':
                    e.preventDefault();
                    this.applyWysiwygFormat('underline');
                    break;
                case 's':
                    if (e.shiftKey) {
                        e.preventDefault();
                        this.applyWysiwygFormat('strikethrough');
                    }
                    break;
                case '`':
                    e.preventDefault();
                    this.wrapWysiwygSelection('<code>', '</code>');
                    break;
                case 'c':
                    // Let default copy behavior work
                    break;
            }
        }
    }

    applyWysiwygFormat(command) {
        if (this.currentEditor === 'wysiwyg') {
            this.wysiwygEditor.focus();
            document.execCommand(command, false, null);
            this.saveToHistory(this.getCurrentEditorValue());
        }
    }

    wrapWysiwygSelection(startTag, endTag) {
        if (this.currentEditor === 'wysiwyg') {
            const selection = window.getSelection();
            if (selection.rangeCount > 0) {
                const range = selection.getRangeAt(0);
                const selectedText = range.toString();

                if (selectedText) {
                    const wrapper = document.createElement('span');
                    wrapper.innerHTML = startTag + selectedText + endTag;
                    range.deleteContents();
                    range.insertNode(wrapper);

                    // Clear selection
                    selection.removeAllRanges();
                    this.saveToHistory(this.getCurrentEditorValue());
                }
            }
        }
    }

    toggleEditor() {
        const monacoEditor = document.getElementById('monaco-editor');
        const wysiwygEditor = document.getElementById('wysiwyg-editor');
        const toggleButton = document.getElementById('toggleEditor');
        const previewColumn = document.getElementById('preview-column');
        const editorPreviewGrid = document.getElementById('editor-preview-grid');
        const copyDropdown = document.getElementById('copy-dropdown');

        if (this.currentEditor === 'monaco') {
            // Switch to WYSIWYG
            const markdownText = this.editor ? this.editor.getValue() : '';
            const htmlContent = this.parseMarkdown(markdownText);

            monacoEditor.style.display = 'none';
            wysiwygEditor.style.display = 'block';
            wysiwygEditor.innerHTML = htmlContent;

            // Hide preview column and make editor full width
            previewColumn.style.display = 'none';
            editorPreviewGrid.classList.remove('lg:grid-cols-2');
            editorPreviewGrid.classList.add('grid-cols-1');

            // Show WYSIWYG copy dropdown
            copyDropdown.style.display = 'inline-block';

            this.currentEditor = 'wysiwyg';
            toggleButton.innerHTML = '<i data-lucide=\"code\" class=\"w-3 h-3\"></i> Code';
            // Re-initialize Lucide icons for the updated button
            lucide.createIcons();
            toggleButton.title = 'Switch to Markdown editor';

            // Auto-save the current content
            const wysiwygContent = this.htmlToMarkdown(wysiwygEditor.innerHTML);
            this.debouncedAutoSave(wysiwygContent);
        } else {
            // Switch to Monaco
            const htmlContent = wysiwygEditor.innerHTML;
            const markdownText = this.htmlToMarkdown(htmlContent);

            wysiwygEditor.style.display = 'none';
            monacoEditor.style.display = 'block';

            if (this.editor) {
                this.editor.setValue(markdownText);
            }

            // Show preview column and restore grid layout
            previewColumn.style.display = 'flex';
            editorPreviewGrid.classList.remove('grid-cols-1');
            editorPreviewGrid.classList.add('lg:grid-cols-2');

            // Hide WYSIWYG copy dropdown
            copyDropdown.style.display = 'none';

            this.currentEditor = 'monaco';
            toggleButton.innerHTML = '<i data-lucide="edit" class="w-3 h-3"></i> WYSIWYG';
            // Re-initialize Lucide icons for the updated button
            lucide.createIcons();
            toggleButton.title = 'Switch to WYSIWYG editor';

            // Auto-save the current content
            if (this.editor) {
                this.debouncedAutoSave(this.editor.getValue());
            }
        }

        this.updatePreview();
    }

    htmlToMarkdown(html) {
        // Convert HTML back to Markdown
        let text = html;

        // Convert HTML tags back to Markdown
        text = text.replace(/<strong>(.*?)<\/strong>/g, '**$1**');
        text = text.replace(/<em>(.*?)<\/em>/g, '*$1*');
        text = text.replace(/<u>(.*?)<\/u>/g, '<u>$1</u>');
        text = text.replace(/<del>(.*?)<\/del>/g, '~~$1~~');
        text = text.replace(/<code[^>]*>(.*?)<\/code>/g, '`$1`');

        // Convert <br> back to newlines
        text = text.replace(/<br\s*\/?>/g, '\n');

        // Remove other HTML tags but keep content
        text = text.replace(/<[^>]+>/g, '');

        // Decode HTML entities
        const textarea = document.createElement('textarea');
        textarea.innerHTML = text;
        text = textarea.value;

        return text;
    }

    getCurrentEditorValue() {
        if (this.currentEditor === 'monaco') {
            return this.editor ? this.editor.getValue() : '';
        } else {
            return this.htmlToMarkdown(this.wysiwygEditor.innerHTML);
        }
    }

    setCurrentEditorValue(value) {
        if (this.currentEditor === 'monaco') {
            if (this.editor) {
                this.editor.setValue(value);
                // Auto-save when content is programmatically set (but not during undo/redo)
                if (!this.isUndoRedoOperation) {
                    this.debouncedAutoSave(value);
                }
            }
        } else {
            this.wysiwygEditor.innerHTML = this.parseMarkdown(value);
            // Auto-save when content is programmatically set (but not during undo/redo)
            if (!this.isUndoRedoOperation) {
                this.debouncedAutoSave(value);
            }
        }
    }

    addKeyboardShortcuts() {
        // Undo/Redo shortcuts
        this.editor.addAction({
            id: 'custom-undo',
            label: 'Undo',
            keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyZ],
            run: () => {
                this.undo();
                return null;
            }
        });

        this.editor.addAction({
            id: 'custom-redo',
            label: 'Redo',
            keybindings: [
                monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyZ, // Cmd+Shift+Z
                monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyY // Cmd+Y
            ],
            run: () => {
                this.redo();
                return null;
            }
        });

        // Text formatting shortcuts
        this.editor.addAction({
            id: 'format-bold',
            label: 'Bold',
            keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyB],
            run: () => {
                this.wrapSelectedText('**', '**');
                return null;
            }
        });

        this.editor.addAction({
            id: 'format-italic',
            label: 'Italic',
            keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyI],
            run: () => {
                this.wrapSelectedText('*', '*');
                return null;
            }
        });

        this.editor.addAction({
            id: 'format-underline',
            label: 'Underline',
            keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyU],
            run: () => {
                this.wrapSelectedText('<u>', '</u>');
                return null;
            }
        });

        this.editor.addAction({
            id: 'format-strikethrough',
            label: 'Strikethrough',
            keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyS],
            run: () => {
                this.wrapSelectedText('~~', '~~');
                return null;
            }
        });

        this.editor.addAction({
            id: 'format-code',
            label: 'Code',
            keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.Backquote],
            run: () => {
                this.wrapSelectedText('`', '`');
                return null;
            }
        });

        // Copy with Cmd+C / Ctrl+C
        this.editor.addAction({
            id: 'copy-formatted',
            label: 'Copy Formatted Text',
            keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyC],
            run: () => {
                const selection = this.editor.getSelection();
                const selectedText = this.editor.getModel().getValueInRange(selection);

                if (selectedText) {
                    // Copy selected text
                    navigator.clipboard.writeText(selectedText);
                } else {
                    // Copy all text if nothing is selected
                    navigator.clipboard.writeText(this.editor.getValue());
                }
                return null;
            }
        });
    }

    bindEvents() {
        // Format buttons
        document.getElementById('addLineNumbers').addEventListener('click', () => this.addLineNumbers());
        document.getElementById('removeEmptyLines').addEventListener('click', () => this.removeEmptyLines());
        document.getElementById('joinLines').addEventListener('click', () => this.joinLines());
        document.getElementById('removeWhitespace').addEventListener('click', () => this.removeWhitespace());
        document.getElementById('removeEmoji').addEventListener('click', () => this.removeEmoji());
        document.getElementById('addDate').addEventListener('click', () => this.addDate());
        document.getElementById('uppercase').addEventListener('click', () => this.toUpperCase());
        document.getElementById('lowercase').addEventListener('click', () => this.toLowerCase());
        document.getElementById('sentenceCase').addEventListener('click', () => this.toSentenceCase());
        document.getElementById('titleCase').addEventListener('click', () => this.toTitleCase());

        // New enhanced format buttons
        document.getElementById('removeHtmlTags').addEventListener('click', () => this.removeHtmlTags());
        document.getElementById('removeDuplicateLines').addEventListener('click', () => this.removeDuplicateLines());
        document.getElementById('sortLines').addEventListener('click', () => this.sortLines());
        document.getElementById('reverseText').addEventListener('click', () => this.reverseText());
        document.getElementById('urlEncode').addEventListener('click', () => this.urlEncode());
        document.getElementById('urlDecode').addEventListener('click', () => this.urlDecode());
        document.getElementById('base64Encode').addEventListener('click', () => this.base64Encode());
        document.getElementById('base64Decode').addEventListener('click', () => this.base64Decode());
        document.getElementById('formatJson').addEventListener('click', () => this.formatJson());
        document.getElementById('redditFormatter').addEventListener('click', () => this.redditFormatter());

        // Editor toggle button
        document.getElementById('toggleEditor').addEventListener('click', () => this.toggleEditor());

        // Clear editor button
        document.getElementById('clearEditor').addEventListener('click', () => this.clearEditor());

        // Editor toolbar buttons
        document.getElementById('bold').addEventListener('click', () => this.handleFormatButton('bold'));
        document.getElementById('italic').addEventListener('click', () => this.handleFormatButton('italic'));
        document.getElementById('underline').addEventListener('click', () => this.handleFormatButton('underline'));
        document.getElementById('strikethrough').addEventListener('click', () => this.handleFormatButton('strikethrough'));

        // History buttons
        document.getElementById('undo').addEventListener('click', () => this.undo());
        document.getElementById('redo').addEventListener('click', () => this.redo());

        // Copy buttons
        document.getElementById('copyPreview').addEventListener('click', () => this.copyPreview());
        document.getElementById('copyWysiwyg').addEventListener('click', () => this.toggleCopyMenu());
        document.getElementById('copyRichText').addEventListener('click', () => this.copyWysiwygRichText());
        document.getElementById('copyMarkdown').addEventListener('click', () => this.copyWysiwygMarkdown());

        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            const dropdown = document.getElementById('copy-dropdown');
            const menu = document.getElementById('copy-menu');
            if (!dropdown.contains(e.target)) {
                menu.style.display = 'none';
            }
        });

        // Theme toggle
        document.getElementById('theme-toggle').addEventListener('click', () => this.toggleTheme());


        // Shortcuts help (check if exists first)
        const shortcutsHelp = document.getElementById('shortcuts-help');
        if (shortcutsHelp) {
            shortcutsHelp.addEventListener('click', () => this.showShortcutsHelp());
        }
        const closeShortcutsModal = document.getElementById('close-shortcuts-modal');
        if (closeShortcutsModal) {
            closeShortcutsModal.addEventListener('click', () => this.hideShortcutsHelp());
        }

        // Find and Replace buttons
        document.getElementById('find-next').addEventListener('click', () => this.findNext());
        document.getElementById('replace-one').addEventListener('click', () => this.replaceOne());
        document.getElementById('replace-all').addEventListener('click', () => this.replaceAll());

        // Find input Enter key
        document.getElementById('find-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.performFind();
            }
        });

        // Replace input Enter key
        document.getElementById('replace-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.replaceOne();
            }
        });

        // Show/hide regex help
        document.getElementById('regex-mode').addEventListener('change', (e) => {
            const regexHelp = document.getElementById('regex-help');
            if (e.target.checked) {
                regexHelp.style.display = 'block';
            } else {
                regexHelp.style.display = 'none';
            }
        });

        // Operation History buttons
        document.getElementById('clear-history').addEventListener('click', () => this.clearOperationHistory());
        document.getElementById('execute-all-history').addEventListener('click', () => this.executeAllHistory());

        // Toggle Tools button
        document.getElementById('toggle-tools').addEventListener('click', () => this.toggleFormattingTools());

        // Setup advanced keyboard shortcuts
        this.setupAdvancedShortcuts();
    }

    handleFormatButton(format) {
        if (this.currentEditor === 'monaco') {
            switch (format) {
                case 'bold':
                    this.wrapSelectedText('**', '**');
                    break;
                case 'italic':
                    this.wrapSelectedText('*', '*');
                    break;
                case 'underline':
                    this.wrapSelectedText('<u>', '</u>');
                    break;
                case 'strikethrough':
                    this.wrapSelectedText('~~', '~~');
                    break;
            }
        } else {
            this.applyWysiwygFormat(format);
        }
    }

    updatePreview() {
        let text;
        if (this.currentEditor === 'monaco') {
            if (!this.editor) return;
            text = this.editor.getValue();
        } else {
            if (!this.wysiwygEditor) return;
            text = this.htmlToMarkdown(this.wysiwygEditor.innerHTML);
        }

        const formattedText = this.parseMarkdown(text);
        document.getElementById('preview').innerHTML = formattedText;

        // Update real-time word count
        this.updateWordCount(text);
    }

    parseMarkdown(text) {
        // Convert text to HTML with markdown formatting
        let html = text;

        // Escape HTML characters first
        html = html.replace(/&/g, '&amp;')
                   .replace(/</g, '&lt;')
                   .replace(/>/g, '&gt;');

        // Process in specific order to avoid conflicts

        // 1. Code first (protect content from other processing)
        html = html.replace(/`([^`]+)`/g, '<code style="background-color: #f1f1f1; padding: 2px 4px; border-radius: 3px; font-family: monospace;">$1</code>');

        // 2. Bold **text** (process before single *)
        html = html.replace(/\*\*([^*\n]+?)\*\*/g, '<strong>$1</strong>');

        // 3. Bold __text__ (process before single _)
        html = html.replace(/__([^_\n]+?)__/g, '<strong>$1</strong>');

        // 4. Strikethrough ~~text~~
        html = html.replace(/~~([^~\n]+?)~~/g, '<del>$1</del>');

        // 5. Underline <u>text</u>
        html = html.replace(/&lt;u&gt;(.*?)&lt;\/u&gt;/g, '<u>$1</u>');

        // 6. Italic *text* (single asterisk only, simple pattern)
        html = html.replace(/\*([^*\n<]+?)\*/g, function(match, content) {
            // Only replace if it's not part of a bold pattern
            return '<em>' + content + '</em>';
        });

        // 7. Italic _text_ (single underscore only, simple pattern)
        html = html.replace(/_([^_\n<]+?)_/g, function(match, content) {
            // Only replace if it's not part of a bold pattern
            return '<em>' + content + '</em>';
        });

        // Convert line breaks to <br>
        html = html.replace(/\n/g, '<br>');

        return html;
    }

    saveToHistory(text) {
        // Don't save to history during undo/redo operations or when executing from history
        if (this.isUndoRedoOperation || this.isExecutingFromHistory) {
            return;
        }

        // Remove any history after current index
        this.history = this.history.slice(0, this.historyIndex + 1);

        // Add new state
        this.history.push(text);

        // Limit history size
        if (this.history.length > this.maxHistorySize) {
            this.history.shift();
        } else {
            this.historyIndex++;
        }

        this.saveHistoryToStorage();
        this.updateUndoRedoButtons();
    }

    undo() {
        if (this.historyIndex > 0 && this.history.length > 0) {
            this.historyIndex--;
            this.isUndoRedoOperation = true;

            // Ensure we have a valid history entry
            if (this.history[this.historyIndex] !== undefined) {
                this.setCurrentEditorValue(this.history[this.historyIndex]);
            }

            this.isUndoRedoOperation = false;
            this.updateUndoRedoButtons();
        }
    }

    redo() {
        if (this.historyIndex < this.history.length - 1 && this.history.length > 0) {
            this.historyIndex++;
            this.isUndoRedoOperation = true;

            // Ensure we have a valid history entry
            if (this.history[this.historyIndex] !== undefined) {
                this.setCurrentEditorValue(this.history[this.historyIndex]);
            }

            this.isUndoRedoOperation = false;
            this.updateUndoRedoButtons();
        }
    }

    updateUndoRedoButtons() {
        const undoBtn = document.getElementById('undo');
        const redoBtn = document.getElementById('redo');

        undoBtn.disabled = this.historyIndex <= 0;
        redoBtn.disabled = this.historyIndex >= this.history.length - 1;
    }

    saveHistoryToStorage() {
        localStorage.setItem('textFormatterHistory', JSON.stringify({
            history: this.history,
            index: this.historyIndex
        }));
    }

    loadHistory() {
        const saved = localStorage.getItem('textFormatterHistory');
        if (saved) {
            try {
                const data = JSON.parse(saved);
                this.history = data.history || [];
                this.historyIndex = data.index || -1;
            } catch (e) {
                this.history = [];
                this.historyIndex = -1;
            }
        }
    }

    // Auto-save functionality
    saveContentToCache(content) {
        try {
            const saveData = {
                content: content,
                timestamp: Date.now(),
                editor: this.currentEditor
            };
            localStorage.setItem(this.autoSaveKey, JSON.stringify(saveData));
        } catch (e) {
            console.warn('Failed to save content to localStorage:', e);
        }
    }

    loadCachedContent() {
        try {
            const saved = localStorage.getItem(this.autoSaveKey);
            if (saved) {
                const data = JSON.parse(saved);
                return {
                    content: data.content || '',
                    timestamp: data.timestamp || 0,
                    editor: data.editor || 'monaco'
                };
            }
        } catch (e) {
            console.warn('Failed to load cached content:', e);
        }
        return null;
    }

    debouncedAutoSave(content) {
        // Clear existing timeout
        if (this.autoSaveTimeout) {
            clearTimeout(this.autoSaveTimeout);
        }

        // Set new timeout
        this.autoSaveTimeout = setTimeout(() => {
            this.saveContentToCache(content);
        }, this.autoSaveDebounceTime);
    }

    formatText(formatter) {
        const currentText = this.getCurrentEditorValue();

        // Save current state to history (before operation)
        this.saveToHistory(currentText);

        const newText = formatter(currentText);
        this.setCurrentEditorValue(newText);

        // Save the new state to history (after operation)
        this.saveToHistory(newText);
    }

    addLineNumbers() {
        this.formatText((text) => {
            const lines = text.split('\n');
            return lines.map((line, index) => `${index + 1}. ${line}`).join('\n');
        });
        this.addToOperationHistory('addLineNumbers', 'addLineNumbers');
    }

    removeEmptyLines() {
        this.formatText((text) => {
            return text.split('\n').filter(line => line.trim() !== '').join('\n');
        });
        this.addToOperationHistory('removeEmptyLines', 'removeEmptyLines');
    }

    joinLines() {
        this.formatText((text) => {
            return text.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
        });
        this.addToOperationHistory('joinLines', 'joinLines');
    }

    removeWhitespace() {
        this.formatText((text) => {
            return text.replace(/\s+/g, ' ').trim();
        });
        this.addToOperationHistory('removeWhitespace', 'removeWhitespace');
    }

    removeEmoji() {
        this.formatText((text) => {
            // Remove emojis using regex
            return text.replace(/[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu, '');
        });
        this.addToOperationHistory('removeEmoji', 'removeEmoji');
    }

    addDate() {
        const currentText = this.getCurrentEditorValue();

        // Save current state to history (before operation)
        this.saveToHistory(currentText);

        const date = new Date().toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        const newText = currentText + '\n\n' + date;
        this.setCurrentEditorValue(newText);

        // Save the new state to history (after operation)
        this.saveToHistory(newText);
        this.addToOperationHistory('addDate', 'addDate');
    }

    toUpperCase() {
        this.formatText((text) => text.toUpperCase());
        this.addToOperationHistory('uppercase', 'toUpperCase');
    }

    toLowerCase() {
        this.formatText((text) => text.toLowerCase());
        this.addToOperationHistory('lowercase', 'toLowerCase');
    }

    toSentenceCase() {
        this.formatText((text) => {
            return text.toLowerCase().replace(/(^\w|\.\s+\w)/g, (match) => match.toUpperCase());
        });
        this.addToOperationHistory('sentenceCase', 'toSentenceCase');
    }

    toTitleCase() {
        this.formatText((text) => {
            return text.toLowerCase().replace(/\b\w/g, (match) => match.toUpperCase());
        });
        this.addToOperationHistory('titleCase', 'toTitleCase');
    }

    // Enhanced formatting functions
    removeHtmlTags() {
        this.formatText((text) => {
            return text.replace(/<[^>]*>/g, '');
        });
        this.addToOperationHistory('removeHtmlTags', 'removeHtmlTags');
    }

    removeDuplicateLines() {
        this.formatText((text) => {
            const lines = text.split('\n');
            const uniqueLines = [...new Set(lines)];
            return uniqueLines.join('\n');
        });
        this.addToOperationHistory('removeDuplicateLines', 'removeDuplicateLines');
    }

    sortLines() {
        this.formatText((text) => {
            const lines = text.split('\n');
            return lines.sort().join('\n');
        });
        this.addToOperationHistory('sortLines', 'sortLines');
    }

    reverseText() {
        this.formatText((text) => {
            return text.split('\n').reverse().join('\n');
        });
        this.addToOperationHistory('reverseText', 'reverseText');
    }

    urlEncode() {
        this.formatText((text) => {
            try {
                return encodeURIComponent(text);
            } catch (e) {
                this.showToast('❌ URL encoding failed');
                return text;
            }
        });
        this.addToOperationHistory('urlEncode', 'urlEncode');
    }

    urlDecode() {
        this.formatText((text) => {
            try {
                return decodeURIComponent(text);
            } catch (e) {
                this.showToast('❌ URL decoding failed');
                return text;
            }
        });
        this.addToOperationHistory('urlDecode', 'urlDecode');
    }

    base64Encode() {
        this.formatText((text) => {
            try {
                return btoa(unescape(encodeURIComponent(text)));
            } catch (e) {
                this.showToast('❌ Base64 encoding failed');
                return text;
            }
        });
        this.addToOperationHistory('base64Encode', 'base64Encode');
    }

    base64Decode() {
        this.formatText((text) => {
            try {
                return decodeURIComponent(escape(atob(text)));
            } catch (e) {
                this.showToast('❌ Base64 decoding failed - invalid format');
                return text;
            }
        });
        this.addToOperationHistory('base64Decode', 'base64Decode');
    }

    updateWordCount(text) {
        const chars = text.length;
        const words = text.trim() ? text.trim().split(/\s+/).length : 0;

        // Update the display elements
        const charCountElement = document.getElementById('char-count');
        const wordCountElement = document.getElementById('word-count-num');

        if (charCountElement) {
            charCountElement.textContent = chars;
        }
        if (wordCountElement) {
            wordCountElement.textContent = words;
        }
    }

    showWordCount() {
        const text = this.getCurrentEditorValue();
        const chars = text.length;
        const charsNoSpaces = text.replace(/\s/g, '').length;
        const words = text.trim() ? text.trim().split(/\s+/).length : 0;
        const lines = text.split('\n').length;
        const paragraphs = text.trim() ? text.split(/\n\s*\n/).length : 0;

        const stats = `Text Statistics:\n\n` +
                     `Characters: ${chars}\n` +
                     `Characters (no spaces): ${charsNoSpaces}\n` +
                     `Words: ${words}\n` +
                     `Lines: ${lines}\n` +
                     `Paragraphs: ${paragraphs}`;

        this.showToast(stats, 5000);
    }

    formatJson() {
        this.formatText((text) => {
            try {
                const parsed = JSON.parse(text);
                return JSON.stringify(parsed, null, 2);
            } catch (e) {
                this.showToast('❌ Invalid JSON format');
                return text;
            }
        });
        this.addToOperationHistory('formatJson', 'formatJson');
    }

    redditFormatter() {
        this.formatText((text) => {
            let formattedText = text;

            // 1. Remove extra spaces (multiple spaces become single space)
            formattedText = formattedText.replace(/[ \t]+/g, ' ');

            // 2. Standardize line breaks (convert different line breaks to single \n)
            formattedText = formattedText.replace(/\r\n/g, '\n');
            formattedText = formattedText.replace(/\r/g, '\n');

            // 3. Remove multiple consecutive empty lines (keep max 1 empty line between content)
            formattedText = formattedText.replace(/\n{3,}/g, '\n\n');

            // 4. Fix punctuation spacing
            // Add space after periods, commas, colons, semicolons if missing
            formattedText = formattedText.replace(/([.,:;])([^\s\n])/g, '$1 $2');
            // Remove space before punctuation
            formattedText = formattedText.replace(/\s+([.,:;!?])/g, '$1');

            // 5. Fix quotes - convert to standard quotes
            formattedText = formattedText.replace(/[""]/g, '"');
            formattedText = formattedText.replace(/['']/g, "'");

            // 6. Trim whitespace at start and end of lines
            formattedText = formattedText.split('\n').map(line => line.trim()).join('\n');

            // 7. Remove leading and trailing empty lines
            formattedText = formattedText.replace(/^\n+/, '').replace(/\n+$/, '');

            // 8. Convert encoding issues common in Reddit
            formattedText = formattedText.replace(/â€™/g, "'");
            formattedText = formattedText.replace(/â€œ/g, '"');
            formattedText = formattedText.replace(/â€\u009d/g, '"');
            formattedText = formattedText.replace(/â€"/g, '—');
            formattedText = formattedText.replace(/â€¦/g, '...');

            this.showToast('✅ Reddit formatting applied!');
            return formattedText;
        });
        this.addToOperationHistory('redditFormatter', 'redditFormatter');
    }

    clearEditor() {
        const currentText = this.getCurrentEditorValue();

        // Save current state to history before clearing
        this.saveToHistory(currentText);

        // Clear the editor content
        this.setCurrentEditorValue('');

        // Save the cleared state to history
        this.saveToHistory('');

        // Show confirmation toast
        this.showToast('Editor cleared!');
    }

    async copyPreview() {
        // Copy the original text from current editor
        const text = this.getCurrentEditorValue();
        try {
            await navigator.clipboard.writeText(text);
            this.showToast('✅ Copied to clipboard!');
        } catch (err) {
            console.error('Failed to copy text: ', err);
            this.showToast('❌ Copy failed');
        }
    }

    toggleCopyMenu() {
        const menu = document.getElementById('copy-menu');
        menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
    }

    async copyWysiwygRichText() {
        if (this.currentEditor !== 'wysiwyg') {
            return this.copyPreview();
        }

        // Close the dropdown menu first
        const menu = document.getElementById('copy-menu');
        menu.style.display = 'none';

        try {
            // Get the HTML content from WYSIWYG editor and clean it for copying
            const htmlContent = this.cleanHtmlForCopy(this.wysiwygEditor.innerHTML);

            // Convert HTML to clean text for plain text fallback
            const plainText = this.htmlToMarkdown(this.wysiwygEditor.innerHTML);

            // Create a ClipboardItem with both HTML and plain text
            const clipboardItem = new ClipboardItem({
                'text/html': new Blob([htmlContent], { type: 'text/html' }),
                'text/plain': new Blob([plainText], { type: 'text/plain' })
            });

            await navigator.clipboard.write([clipboardItem]);

            this.showCopySuccess('Rich text copied!');
        } catch (err) {
            console.error('Rich text copy failed, falling back to plain text: ', err);

            // Fallback to plain text copy if rich text copy fails
            try {
                const plainText = this.htmlToMarkdown(this.wysiwygEditor.innerHTML);
                await navigator.clipboard.writeText(plainText);
                this.showCopySuccess('✅ Copied as text!');
            } catch (fallbackErr) {
                console.error('Failed to copy text: ', fallbackErr);
                alert('Failed to copy text. Please try again.');
            }
        }

        // Hide menu after copying
        document.getElementById('copy-menu').style.display = 'none';
    }

    async copyWysiwygMarkdown() {
        if (this.currentEditor !== 'wysiwyg') {
            return this.copyPreview();
        }

        // Close the dropdown menu first
        const menu = document.getElementById('copy-menu');
        menu.style.display = 'none';

        try {
            const plainText = this.htmlToMarkdown(this.wysiwygEditor.innerHTML);
            await navigator.clipboard.writeText(plainText);
            this.showCopySuccess('Markdown copied!');
        } catch (err) {
            console.error('Failed to copy markdown: ', err);
            alert('Failed to copy text. Please try again.');
        }

        // Hide menu after copying
        document.getElementById('copy-menu').style.display = 'none';
    }

    showCopySuccess(message) {
        // Show a simple toast notification instead of changing button state
        this.showToast(message);
    }

    showToast(message) {
        // Create or update toast notification
        let toast = document.getElementById('copy-toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'copy-toast';
            toast.className = 'fixed top-4 right-4 bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg z-50 transition-opacity duration-300';
            document.body.appendChild(toast);
        }

        toast.textContent = message;
        toast.style.opacity = '1';
        toast.style.display = 'block';

        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => {
                toast.style.display = 'none';
            }, 300);
        }, 2000);
    }

    wrapSelectedText(startWrapper, endWrapper) {
        if (!this.editor) return;

        const selection = this.editor.getSelection();
        const selectedText = this.editor.getModel().getValueInRange(selection);

        if (selectedText) {
            // If text is selected, wrap it
            const wrappedText = `${startWrapper}${selectedText}${endWrapper}`;
            this.editor.executeEdits('', [{
                range: selection,
                text: wrappedText
            }]);
        } else {
            // If no text is selected, insert wrapper at cursor position
            const position = this.editor.getPosition();
            const wrappedText = `${startWrapper}${endWrapper}`;
            this.editor.executeEdits('', [{
                range: new monaco.Range(position.lineNumber, position.column, position.lineNumber, position.column),
                text: wrappedText
            }]);

            // Move cursor between the wrappers
            const newPosition = new monaco.Position(position.lineNumber, position.column + startWrapper.length);
            this.editor.setPosition(newPosition);
        }

        this.editor.focus();
        this.saveToHistory(this.editor.getValue());
    }

    formatSelectedText() {
        if (!this.editor) return;

        const selection = this.editor.getSelection();
        const selectedText = this.editor.getModel().getValueInRange(selection);

        if (selectedText) {
            // Apply basic formatting to selected text
            const formattedText = selectedText.trim();
            this.editor.executeEdits('', [{
                range: selection,
                text: formattedText
            }]);

            this.saveToHistory(this.editor.getValue());
        }
    }

    getSelectedText() {
        if (!this.editor) return '';
        const selection = this.editor.getSelection();
        return this.editor.getModel().getValueInRange(selection);
    }

    replaceSelectedText(newText) {
        if (!this.editor) return;
        const selection = this.editor.getSelection();
        this.editor.executeEdits('', [{
            range: selection,
            text: newText
        }]);
        this.saveToHistory(this.editor.getValue());
    }

    // Theme Management
    applyTheme() {
        const htmlElement = document.documentElement;
        htmlElement.setAttribute('data-theme', this.currentTheme);

        const lightIcon = document.getElementById('theme-icon-light');
        const darkIcon = document.getElementById('theme-icon-dark');

        if (this.currentTheme === 'dark') {
            lightIcon?.classList.add('hidden');
            darkIcon?.classList.remove('hidden');
        } else {
            lightIcon?.classList.remove('hidden');
            darkIcon?.classList.add('hidden');
        }

        // Update Monaco editor theme
        if (this.editor) {
            // Use Monaco's built-in dark theme for better compatibility
            this.editor.updateOptions({
                theme: this.currentTheme === 'dark' ? 'vs-dark' : 'vs'
            });
        }

        // Save preference
        localStorage.setItem('textFormatter_theme', this.currentTheme);
    }

    toggleTheme() {
        this.currentTheme = this.currentTheme === 'light' ? 'dark' : 'light';
        this.applyTheme();
    }


    // Find and Replace functionality
    performFind() {
        const findText = document.getElementById('find-input').value;
        if (!findText) return;

        const isRegex = document.getElementById('regex-mode').checked;
        const caseSensitive = document.getElementById('case-sensitive').checked;
        const text = this.getCurrentEditorValue();

        this.findMatches = [];
        this.currentMatchIndex = -1;

        try {
            if (isRegex) {
                // Validate and create regex
                let regex;
                try {
                    const flags = caseSensitive ? 'g' : 'gi';
                    regex = new RegExp(findText, flags);
                } catch (regexError) {
                    this.showToast(`Invalid regex: ${regexError.message}`);
                    return;
                }

                let match;
                let attempts = 0;
                const maxAttempts = 10000; // Prevent infinite loops

                while ((match = regex.exec(text)) !== null && attempts < maxAttempts) {
                    this.findMatches.push({
                        start: match.index,
                        end: match.index + match[0].length,
                        text: match[0]
                    });

                    attempts++;

                    // Prevent infinite loop for zero-length matches
                    if (match[0].length === 0) {
                        regex.lastIndex++;
                        if (regex.lastIndex >= text.length) {
                            break;
                        }
                    }
                }

                if (attempts >= maxAttempts) {
                    this.showToast('Search stopped - too many matches (possible infinite loop)');
                }
            } else {
                // Simple text search with proper case handling
                const searchText = caseSensitive ? findText : findText.toLowerCase();
                const sourceText = caseSensitive ? text : text.toLowerCase();
                let startIndex = 0;

                while (true) {
                    const index = sourceText.indexOf(searchText, startIndex);
                    if (index === -1) break;

                    this.findMatches.push({
                        start: index,
                        end: index + findText.length,
                        text: text.substring(index, index + findText.length)
                    });
                    startIndex = index + 1; // Move to next position to find overlapping matches
                }
            }

            if (this.findMatches.length > 0) {
                this.currentMatchIndex = 0;
                this.highlightMatch(this.findMatches[0]);
                this.showToast(`Found ${this.findMatches.length} matches`);
            } else {
                this.showToast('No matches found');
            }
        } catch (error) {
            console.error('Find error:', error);
            this.showToast('Invalid regular expression');
        }
    }

    findNext() {
        if (this.findMatches.length === 0) {
            this.performFind();
            return;
        }

        this.currentMatchIndex = (this.currentMatchIndex + 1) % this.findMatches.length;
        this.highlightMatch(this.findMatches[this.currentMatchIndex]);
        this.showToast(`Match ${this.currentMatchIndex + 1} of ${this.findMatches.length}`);
    }

    replaceOne() {
        if (this.currentMatchIndex === -1 || this.findMatches.length === 0) {
            // If no match is selected, try to find first
            this.performFind();
            if (this.findMatches.length === 0) {
                this.showToast('No matches found');
                return;
            }
        }

        const replaceText = document.getElementById('replace-input').value;
        const match = this.findMatches[this.currentMatchIndex];

        if (this.currentEditor === 'monaco' && this.editor) {
            const model = this.editor.getModel();
            const startPos = model.getPositionAt(match.start);
            const endPos = model.getPositionAt(match.end);

            this.editor.executeEdits('replace', [{
                range: new monaco.Range(startPos.lineNumber, startPos.column, endPos.lineNumber, endPos.column),
                text: replaceText
            }]);

            this.saveToHistory(this.editor.getValue());
        } else if (this.currentEditor === 'wysiwyg' && this.wysiwygEditor) {
            const markdownContent = this.htmlToMarkdown(this.wysiwygEditor.innerHTML);
            const newContent = markdownContent.substring(0, match.start) + replaceText + markdownContent.substring(match.end);
            this.wysiwygEditor.innerHTML = this.parseMarkdown(newContent);
            this.saveToHistory(this.htmlToMarkdown(this.wysiwygEditor.innerHTML));
        }

        // Clear matches after replace to force re-search
        this.findMatches = [];
        this.currentMatchIndex = -1;
        this.showToast('Replaced 1 occurrence');
    }

    replaceAll() {
        const findText = document.getElementById('find-input').value;
        const replaceText = document.getElementById('replace-input').value;

        if (!findText) {
            this.showToast('Please enter text to find');
            return;
        }

        const isRegex = document.getElementById('regex-mode').checked;
        const caseSensitive = document.getElementById('case-sensitive').checked;
        let text = this.getCurrentEditorValue();
        let count = 0;

        try {
            if (isRegex) {
                // Validate regex first
                let regex;
                try {
                    const flags = caseSensitive ? 'g' : 'gi';
                    regex = new RegExp(findText, flags);
                } catch (regexError) {
                    this.showToast(`Invalid regex: ${regexError.message}`);
                    return;
                }

                const matches = text.match(regex);
                count = matches ? matches.length : 0;

                if (count > 0) {
                    text = text.replace(regex, replaceText);
                }
            } else {
                // For simple text replacement, use split and join for better performance
                if (caseSensitive) {
                    const parts = text.split(findText);
                    count = parts.length - 1;
                    text = parts.join(replaceText);
                } else {
                    // Case insensitive replacement requires more careful handling
                    const searchText = findText.toLowerCase();
                    const sourceText = text.toLowerCase();

                    let result = '';
                    let lastIndex = 0;
                    let index = 0;

                    while ((index = sourceText.indexOf(searchText, lastIndex)) !== -1) {
                        result += text.substring(lastIndex, index) + replaceText;
                        lastIndex = index + findText.length;
                        count++;
                    }
                    result += text.substring(lastIndex);
                    text = result;
                }
            }

            this.setCurrentEditorValue(text);
            this.saveToHistory(text);
            this.findMatches = [];
            this.currentMatchIndex = -1;
            this.showToast(`Replaced ${count} occurrences`);
        } catch (error) {
            console.error('Replace error:', error);
            this.showToast('Invalid regular expression');
        }
    }

    highlightMatch(match) {
        if (this.currentEditor === 'monaco' && this.editor) {
            const model = this.editor.getModel();
            const startPos = model.getPositionAt(match.start);
            const endPos = model.getPositionAt(match.end);

            this.editor.setSelection(new monaco.Range(startPos.lineNumber, startPos.column, endPos.lineNumber, endPos.column));
            this.editor.revealRangeInCenter(new monaco.Range(startPos.lineNumber, startPos.column, endPos.lineNumber, endPos.column));
        }
    }

    // Keyboard shortcuts management
    showShortcutsHelp() {
        const modal = document.getElementById('shortcuts-modal');
        modal.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    }

    hideShortcutsHelp() {
        const modal = document.getElementById('shortcuts-modal');
        modal.classList.add('hidden');
        document.body.style.overflow = '';
    }

    // Enhanced keyboard shortcuts
    setupAdvancedShortcuts() {
        // Global shortcuts
        document.addEventListener('keydown', (e) => {
            const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
            const ctrlKey = isMac ? e.metaKey : e.ctrlKey;

            if (ctrlKey) {
                switch (e.key) {
                    case '?':
                        e.preventDefault();
                        this.showShortcutsHelp();
                        break;
                    case 'f':
                        e.preventDefault();
                        document.getElementById('find-input').focus();
                        break;
                    case 'h':
                        e.preventDefault();
                        document.getElementById('find-input').focus();
                        break;
                    case 'e':
                        e.preventDefault();
                        this.toggleEditor();
                        break;
                }
            }

            if (e.key === 'Escape') {
                this.hideShortcutsHelp();
            }
        });
    }

    // Monaco-specific shortcuts (called after Monaco editor is initialized)
    setupMonacoShortcuts() {
        if (this.editor) {
            this.editor.addAction({
                id: 'delete-line',
                label: 'Delete Line',
                keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyD],
                run: () => {
                    this.editor.getAction('editor.action.deleteLines').run();
                }
            });

            this.editor.addAction({
                id: 'select-line',
                label: 'Select Line',
                keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyL],
                run: () => {
                    this.editor.getAction('expandLineSelection').run();
                }
            });

            this.editor.addAction({
                id: 'duplicate-line',
                label: 'Duplicate Line',
                keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyD],
                run: () => {
                    this.editor.getAction('editor.action.copyLinesDownAction').run();
                }
            });
        }
    }

    // Operation History Management Methods
    loadOperationHistory() {
        try {
            const saved = localStorage.getItem(this.operationHistoryKey);
            this.operationHistory = saved ? JSON.parse(saved) : [];
            this.renderOperationHistory();
        } catch (error) {
            console.warn('Failed to load operation history:', error);
            this.operationHistory = [];
        }
    }

    saveOperationHistory() {
        try {
            localStorage.setItem(this.operationHistoryKey, JSON.stringify(this.operationHistory));
        } catch (error) {
            console.warn('Failed to save operation history:', error);
        }
    }

    addToOperationHistory(operationName, operationFunction) {
        // Don't add to history if we're executing from history
        if (this.isExecutingFromHistory) {
            return;
        }

        // Remove if already exists (avoid duplicates)
        this.operationHistory = this.operationHistory.filter(op => op.name !== operationName);

        // Add to beginning of array
        this.operationHistory.unshift({
            name: operationName,
            function: operationFunction,
            timestamp: Date.now()
        });

        // Keep only the last maxOperationHistory items
        if (this.operationHistory.length > this.maxOperationHistory) {
            this.operationHistory = this.operationHistory.slice(0, this.maxOperationHistory);
        }

        this.saveOperationHistory();
        this.renderOperationHistory();
    }

    renderOperationHistory() {
        const container = document.getElementById('history-items');
        const placeholder = document.getElementById('history-placeholder');

        if (!container || !placeholder) return;

        // Clear existing items
        container.innerHTML = '';

        if (this.operationHistory.length === 0) {
            placeholder.style.display = 'block';
            container.classList.add('hidden');
            return;
        }

        placeholder.style.display = 'none';
        container.classList.remove('hidden');

        // Create history items
        this.operationHistory.forEach((operation, index) => {
            const item = document.createElement('div');
            item.className = 'history-item';
            item.innerHTML = `
                <span>${this.getOperationDisplayName(operation.name)}</span>
                <button class="history-item-delete" onclick="textFormatter.removeFromOperationHistory(${index})" title="Remove from history">
                    ×
                </button>
            `;

            // Add click handler for executing single operation
            item.addEventListener('click', (e) => {
                if (!e.target.classList.contains('history-item-delete')) {
                    this.executeOperation(operation);
                }
            });

            container.appendChild(item);
        });
    }

    getOperationDisplayName(operationName) {
        const displayNames = {
            'addLineNumbers': 'Line Numbers',
            'removeEmptyLines': 'Remove Empty',
            'joinLines': 'Join Lines',
            'removeWhitespace': 'Trim Space',
            'removeEmoji': 'Remove Emoji',
            'addDate': 'Add Date',
            'uppercase': 'UPPERCASE',
            'lowercase': 'lowercase',
            'sentenceCase': 'Sentence',
            'titleCase': 'Title Case',
            'removeHtmlTags': 'Strip HTML',
            'removeDuplicateLines': 'Remove Duplicates',
            'sortLines': 'Sort Lines',
            'reverseText': 'Reverse Text',
            'urlEncode': 'URL Encode',
            'urlDecode': 'URL Decode',
            'base64Encode': 'Base64 Encode',
            'base64Decode': 'Base64 Decode',
            'formatJson': 'Format JSON',
            'redditFormatter': 'Reddit Format'
        };

        return displayNames[operationName] || operationName;
    }

    executeOperation(operation) {
        if (typeof this[operation.function] === 'function') {
            this.isExecutingFromHistory = true; // Set flag to prevent adding to history again
            this[operation.function]();
            this.isExecutingFromHistory = false; // Reset flag
            this.showToast(`Executed: ${this.getOperationDisplayName(operation.name)}`);
        }
    }

    removeFromOperationHistory(index) {
        if (index >= 0 && index < this.operationHistory.length) {
            this.operationHistory.splice(index, 1);
            this.saveOperationHistory();
            this.renderOperationHistory();
            this.showToast('Operation removed from history');
        }
    }

    clearOperationHistory() {
        this.operationHistory = [];
        this.saveOperationHistory();
        this.renderOperationHistory();
        this.showToast('Operation history cleared');
    }

    executeAllHistory() {
        if (this.operationHistory.length === 0) {
            this.showToast('No operations in history');
            return;
        }

        const operations = [...this.operationHistory].reverse(); // Execute in the order they were added
        let executedCount = 0;

        operations.forEach((operation, index) => {
            setTimeout(() => {
                if (typeof this[operation.function] === 'function') {
                    this.isExecutingFromHistory = true; // Set flag to prevent adding to history again
                    this[operation.function]();
                    this.isExecutingFromHistory = false; // Reset flag
                    executedCount++;
                }

                // Show completion message after all operations
                if (index === operations.length - 1) {
                    this.showToast(`Executed ${executedCount} operations from history`);
                }
            }, index * 100); // Small delay between operations
        });
    }

    showToast(message) {
        // Create toast notification
        const toast = document.createElement('div');
        toast.className = 'toast bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg';
        toast.textContent = message;

        document.body.appendChild(toast);

        // Remove toast after 3 seconds
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 3000);
    }

    // Toggle Formatting Tools visibility
    toggleFormattingTools() {
        const grid = document.getElementById('formatting-tools-grid');
        const icon = document.getElementById('toggle-tools-icon');
        const text = document.getElementById('toggle-tools-text');

        if (!grid || !icon || !text) return;

        const isCollapsed = grid.style.maxHeight === '48px' || grid.style.maxHeight === '';

        if (isCollapsed) {
            // Expand
            grid.style.maxHeight = 'none';
            icon.setAttribute('data-lucide', 'chevron-up');
            text.textContent = 'Collapse';
        } else {
            // Collapse
            grid.style.maxHeight = '48px';
            icon.setAttribute('data-lucide', 'chevron-down');
            text.textContent = 'Expand';
        }

        // Re-initialize Lucide icons after changing the attribute
        lucide.createIcons();
    }
}

// Global reference for TextFormatter instance
let textFormatter;

// Initialize the text formatter when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    textFormatter = new TextFormatter();
});