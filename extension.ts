import {window, workspace, commands, Disposable, ExtensionContext, TextDocument, TextLine, Range, Position, TextEditorEdit} from 'vscode';

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

// TODO: Investigate if Thenable<> is needed.
// TODO: Construct interface for checkbox and summary and track range, line, and status in it for convenience.

// Construct a list of edits for a single checkbox toggle then execute all of them at once.  It's fast and can be undone in one step. 
interface IOrgmodeUpdate {
    range: Range;
    text: string;
}

export class OrgMode {
    private editor = window.activeTextEditor;
    private doc = this.editor.document;
    private _updates: IOrgmodeUpdate[] = [];

    public navigate() {
        // TODO: Is language check even necessary if language is part of activation event for the extension?
        if (this.doc.languageId === 'orgmode') {
            const selection = this.editor.selection;
            let line = this.doc.lineAt(selection.active.line);
            let checkbox = this.findCheckbox(line, selection.active);
            if (checkbox) {
                let checked = this.doc.getText(checkbox) == ' ';
                let func = this.toggleCheckbox;
                this._updates = [];
                this.toggleCheckbox(checkbox, line, checked);
                let parent = this.findParent(line);
                // Since the updates as a result of toggle have not happened yet in the editor, counting checked children is going to use old value of current checkbox.  Hence the adjustment.
                // TODO: Consider a different approach later.  I don't want to commit toggle edits before updating summary because it will split edit into multiple operations thus requiring multiple undo's to rollback.
                this.updateParent(parent, checked ? 1 : -1);
                let list = this._updates;
                this.editor.edit(function(edit) {
                    for (let upd of list)
                        edit.replace(upd.range, upd.text);
                });
                return;
            } 
            // Test for summary [/] element and update it.
            let summary = this.findSummary(line, selection.active);
            if (summary) {
                // TODO: Walk immediate children, calculate total number and a number of checked items.
                this.updateSummary(summary, 3, 12);
                return;
            }
            // TODO: Test for reference {} or {{}} element and navigate.
            // TODO: Test for link element [[]] and open browser with the specified link.

            // Fallback to just editing text, i.e. process `enter` key.
            // TODO: Figure out keybinding and process the key depending on what default keybinding it has.
            this.editor.edit(function(edit) {
                // The following will translate to proper line ending automatically.
                edit.insert(selection.active, '\n');
            });
        }
    }
    
    // Find first checkbox pattern on the specified line.
    // If not found or position is provided and does not end up on the found checkbox return null.
    private findCheckbox(line: TextLine, position: Position): Range {
        let re = new RegExp(`(\\[[xX ]\\])`);
        let match = re.exec(line.text);
        if (match) {
            let range = new Range(line.lineNumber, match.index + 1, line.lineNumber, match.index + 2);
            if (!position) {
                return range;
            }
            if (range.contains(position)) {
                return range;
            }
        }
        return null;
    }
    
    private findSummary(line: TextLine, position: Position): Range {
        let re = new RegExp(`(\\[\\d*/\\d*\\])`);
        let match = re.exec(line.text);
        if (match) {
            let range = new Range(line.lineNumber, match.index + 1, line.lineNumber, match.index + match[1].length - 1);
            if (!position) {
                return range;
            }
            if (range.contains(position)) {
                return range;
            }
        }
        return null;
    }
    
    // Perform the toggle.  'x' or 'X' becomes blank and blank becomes 'X'.
    private toggleCheckbox(checkbox: Range, line: TextLine, check: boolean) {
        if (!checkbox) {
            return;
        }
        let checked = this.doc.getText(checkbox) != ' ';
        if (checked == check) {
            return;  // Nothing to do.
        }
        this._updates.push({ range: checkbox, text: (check ? 'X' : ' ')});
        if (!line) {
            return;
        }
        let children = this.findChildren(line);
        let child: TextLine = null;
        for (child of children) {
            this.toggleCheckbox(this.findCheckbox(child, null), child, check);
        }
    }
    
    private updateParent(line: TextLine, adjust: number) {
        if (!line) {
            return;
        }
        let children = this.findChildren(line);
        let total = children.length;
        if (total == 0) {
            return;
        }
        let checked = adjust;
        let chk = null;
        for (let child of children) {
            chk = this.findCheckbox(child, null);
            if (chk) {
                if (this.doc.getText(chk) != ' ') {
                    checked++;
                }
            }
        }
        let summary = this.findSummary(line, null);
        this.updateSummary(summary, checked, total);
        // If there is a checkbox on this line, update it depending on (checked == total).
        chk = this.findCheckbox(line, null);
        // Prevent propagation downstream by passing line = null.
        this.toggleCheckbox(chk, null, checked == total);
    }
    
    private updateSummary(summary: Range, checked: number, total: number) {
        if (!summary) {
            return;
        }
        this._updates.push({ range: summary, text: (checked.toString() + '/' + total.toString())});
    }
    
    // Calculate and return indentation level of the line.  Used in traversing nested lists and locating parent item.
    private getIndent(line: TextLine): number {
        let re = new RegExp(`^(\\s*)\\S`);
        let match = re.exec(line.text);
        if (match) {
            // TODO: Convert tabs to spaces?
            return match[1].length;
        }
        return 0;
    }
    
    // Find parent item by walking lines up to the start of the file looking for a smaller indentation.  Does not ignore blank lines (indentation 0).
    private findParent(line: TextLine): TextLine {
        let lnum = line.lineNumber;
        let indent = this.getIndent(line);
        let parent = null;
        let pindent = indent;
        while (pindent >= indent) {
            lnum--;
            if (lnum < 0) {
                return null;
            }
            
            parent = this.doc.lineAt(lnum);
            pindent = this.getIndent(parent);
        }
        return parent;
    }
    
    // Find parent item by walking lines up to the start of the file looking for a smaller indentation.  Does not ignore blank lines (indentation 0).
    private findChildren(line: TextLine): TextLine[] {
        let children: TextLine[] = [];
        let lnum = line.lineNumber;
        let lmax = this.doc.lineCount - 1; 
        let indent = this.getIndent(line);
        let child: TextLine = null;
        let cindent = indent;
        let next_indent = -1;
        while (lnum < lmax) {
            lnum++;
            child = this.doc.lineAt(lnum);
            cindent = this.getIndent(child);
            if (cindent <= indent) {
                break;
            }
            if (next_indent < 0) {
                next_indent = cindent;
            }
            // TODO: Handle weird indentation like this:
            //     current
            //         child 1
            //       child 2
            //         child 3
            // Are all the above children considered siblings?
            if (cindent <= next_indent) {
                children.push(child);
            }
        }
        return children;
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