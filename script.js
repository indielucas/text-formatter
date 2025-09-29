class TextFormatter {
    constructor() {
        this.editor = null;
        this.history = [];
        this.historyIndex = -1;
        this.maxHistorySize = 50;
        this.init();
    }

    init() {
        this.loadHistory();
        this.initMonacoEditor();
        this.bindEvents();
        this.updateUndoRedoButtons();
    }

    initMonacoEditor() {
        require.config({ paths: { vs: 'https://unpkg.com/monaco-editor@0.45.0/min/vs' } });
        require(['vs/editor/editor.main'], () => {
            this.editor = monaco.editor.create(document.getElementById('editor'), {
                value: 'Start typing your text here...\n\nUse the buttons above to format your text.\n\nFeatures:\n- Add line numbers\n- Remove empty lines\n- Convert case\n- And much more!',
                language: 'plaintext',
                theme: 'vs',
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
                automaticLayout: true,
                glyphMargin: false,
                folding: false,
                lineDecorationsWidth: 0,
                lineNumbersMinChars: 3,
                renderLineHighlight: 'line',
                contextmenu: true,
                mouseWheelZoom: true,
                smoothScrolling: true,
                cursorBlinking: 'blink',
                cursorSmoothCaretAnimation: true,
                renderWhitespace: 'selection',
                bracketPairColorization: {
                    enabled: true
                }
            });

            this.editor.onDidChangeModelContent(() => {
                this.updatePreview();
            });

            // Add context menu options
            this.editor.addAction({
                id: 'format-text',
                label: 'Format Text',
                contextMenuGroupId: 'modification',
                run: () => {
                    this.formatSelectedText();
                }
            });

            this.updatePreview();
            this.saveToHistory(this.editor.getValue());
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

        // Editor toolbar buttons
        document.getElementById('bold').addEventListener('click', () => this.wrapSelectedText('**', '**'));
        document.getElementById('italic').addEventListener('click', () => this.wrapSelectedText('*', '*'));
        document.getElementById('underline').addEventListener('click', () => this.wrapSelectedText('<u>', '</u>'));
        document.getElementById('strikethrough').addEventListener('click', () => this.wrapSelectedText('~~', '~~'));

        // History buttons
        document.getElementById('undo').addEventListener('click', () => this.undo());
        document.getElementById('redo').addEventListener('click', () => this.redo());

        // Copy button
        document.getElementById('copyPreview').addEventListener('click', () => this.copyPreview());
    }

    updatePreview() {
        if (!this.editor) return;
        const text = this.editor.getValue();
        document.getElementById('preview').textContent = text;
    }

    saveToHistory(text) {
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
        if (this.historyIndex > 0) {
            this.historyIndex--;
            this.editor.setValue(this.history[this.historyIndex]);
            this.updateUndoRedoButtons();
        }
    }

    redo() {
        if (this.historyIndex < this.history.length - 1) {
            this.historyIndex++;
            this.editor.setValue(this.history[this.historyIndex]);
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

    formatText(formatter) {
        const currentText = this.editor.getValue();
        const newText = formatter(currentText);
        this.editor.setValue(newText);
        this.saveToHistory(newText);
    }

    addLineNumbers() {
        this.formatText((text) => {
            const lines = text.split('\n');
            return lines.map((line, index) => `${index + 1}. ${line}`).join('\n');
        });
    }

    removeEmptyLines() {
        this.formatText((text) => {
            return text.split('\n').filter(line => line.trim() !== '').join('\n');
        });
    }

    joinLines() {
        this.formatText((text) => {
            return text.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
        });
    }

    removeWhitespace() {
        this.formatText((text) => {
            return text.replace(/\s+/g, ' ').trim();
        });
    }

    removeEmoji() {
        this.formatText((text) => {
            // Remove emojis using regex
            return text.replace(/[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu, '');
        });
    }

    addDate() {
        const currentText = this.editor.getValue();
        const date = new Date().toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        const newText = currentText + '\n\n' + date;
        this.editor.setValue(newText);
        this.saveToHistory(newText);
    }

    toUpperCase() {
        this.formatText((text) => text.toUpperCase());
    }

    toLowerCase() {
        this.formatText((text) => text.toLowerCase());
    }

    toSentenceCase() {
        this.formatText((text) => {
            return text.toLowerCase().replace(/(^\w|\.\s+\w)/g, (match) => match.toUpperCase());
        });
    }

    toTitleCase() {
        this.formatText((text) => {
            return text.toLowerCase().replace(/\b\w/g, (match) => match.toUpperCase());
        });
    }

    async copyPreview() {
        const text = document.getElementById('preview').textContent;
        try {
            await navigator.clipboard.writeText(text);
            const button = document.getElementById('copyPreview');
            const originalText = button.textContent;
            button.textContent = '✅ Copied!';
            button.classList.add('bg-green-600');
            button.classList.remove('bg-primary', 'hover:bg-secondary');

            setTimeout(() => {
                button.textContent = originalText;
                button.classList.remove('bg-green-600');
                button.classList.add('bg-primary', 'hover:bg-secondary');
            }, 2000);
        } catch (err) {
            console.error('Failed to copy text: ', err);
            alert('Failed to copy text. Please try again.');
        }
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
}

// Initialize the text formatter when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new TextFormatter();
});