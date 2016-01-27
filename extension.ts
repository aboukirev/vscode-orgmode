import {window, workspace, commands, Disposable, ExtensionContext, TextDocument, TextLine, Range, Position} from 'vscode';

export function activate(ctx: ExtensionContext) {

    console.log('Congratulations, your extension "OrgMode" is now active!');
    
    let orgmode = new OrgMode();

	ctx.subscriptions.push(commands.registerCommand('orgmode.navigate', () => {
		orgmode.navigate();
	}));

	ctx.subscriptions.push(commands.registerCommand('orgmode.expand', () => {
		orgmode.expand();
	}));
    
    ctx.subscriptions.push(orgmode);
}

export class OrgMode {
    private editor = window.activeTextEditor;
    private doc = this.editor.document;

    public navigate() {
        // TODO: Is language check even necessary if language is part of activation event for the extension?
        if (this.doc.languageId === 'orgmode') {
            const selection = this.editor.selection;
            let checkbox = this.findCheckbox(this.doc.lineAt(selection.active.line), selection.active);
            if (checkbox) {
                this.toggleCheckbox(checkbox);
                return;
            } 
            // TODO: Test for summary [/] element and calculate values.
            // TODO: Test for reference {} or {{}} element and navigate.
            // TODO: Test for link element [[]] and open browser with the specified link.

            // Fallback to just editing text, i.e. process `enter` key.
            // TODO: Figure out keybinding and process the key depending on what default keybinding it has.
            this.editor.edit((editBuilder) => {
                // The following will translate to proper line ending automatically.
                editBuilder.insert(selection.active, '\n');
            });
        }
    }
    
    // Find first checkbox pattern on the specified line.
    // If not found or position is provided and does not end up on the found checkbox return null.
    private findCheckbox(line: TextLine, position: Position): Range {
        let re = new RegExp(`(\\[[xX ]\\])\\s?`);
        let match = re.exec(line.text);
        if (match) {
            let range = new Range(new Position(line.lineNumber, match.index + 1), new Position(line.lineNumber, match.index + 2));
            if (position && range.contains(position))
                return range;
        }
        return null;
    }
    
    // Perform the toggle.  'x' or 'X' becomes blank and blank becomes 'X'.
    private toggleCheckbox(checkbox: Range) {
        this.editor.edit((editBuilder) => {
            editBuilder.replace(checkbox, (this.doc.getText(checkbox) == ' ') ? 'X' : ' ');
        });
        // TODO: Update any summaries up-level and down-level.
    }
    
    public expand() {
        let doc = this.editor.document;
        if (doc.languageId === 'orgmode') {
            console.log('Expanding...');
        }
    }
    
    public dispose() {
        // Nothing to do yet.
    }
}