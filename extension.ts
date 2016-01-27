import {window, workspace, commands, Disposable, ExtensionContext, TextDocument, Range, Position} from 'vscode';

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

    public navigate() {
        let doc = this.editor.document;
        // TODO: Is language check even necessary if language is part of activation event for the extension?
        if (doc.languageId === 'orgmode') {
            const selection = this.editor.selection;
            let line = selection.start.line;
            let text = doc.lineAt(line).text;
            // Perform multiple `exec`s until no match or current position falls within matched sub-group.
            // Important: keep global flag for multiple matches.  RegExp object will track position to search for the next match.
            let re = new RegExp(`(\\[[xX ]\\])\\s?`, 'g');
            let match = re.exec(text);
            let range = null;
            while (match !== null) {
                range = new Range(new Position(line, match.index + 1), new Position(line, match.index + 2));
                if (range.contains(selection)) {
                    // Perform the toggle.  'x' or 'X' becomes blank and blank becomes 'X'.
                    this.editor.edit((editBuilder) => {
                        editBuilder.replace(range, match[1].startsWith('[ ]') ? 'X' : ' ');
                    });
                    // TODO: Update any summaries up-level. 
                    return;
                }
                match = re.exec(text);
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