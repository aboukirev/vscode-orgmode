import {window, workspace, commands, Disposable, ExtensionContext, TextDocument, TextLine, Range, Position, Selection, TextEditorEdit} from 'vscode';

export function activate(ctx: ExtensionContext) {
    let orgmode = new OrgMode();

	ctx.subscriptions.push(commands.registerCommand('orgmode.navigate', () => {
		orgmode.navigate();
	}));
}

// Construct a list of edits for a single checkbox toggle then execute all of them at once.  It's fast and can be undone in one step. 
interface IOrgmodeUpdate {
    range: Range;
    text: string;
}

interface IExternalLink {
    range: Range;
    url: string;
}

export class OrgMode {
    private _updates: IOrgmodeUpdate[] = [];

    public navigate() {
        let editor = window.activeTextEditor;
        let doc = editor.document;
        const selection = editor.selection;
        let line = doc.lineAt(selection.active.line);
        let checkbox = this.findCheckbox(line, selection.active);
        let summary = this.findSummary(line, selection.active);
        let extlink = this.findExternalLink(line, selection.active);
        let reference = this.findReference(line, selection.active);
        this._updates = [];
        if (checkbox) {
            let checked = doc.getText(checkbox) == ' ';
            let func = this.toggleCheckbox;
            this.toggleCheckbox(checkbox, line, checked);
            let parent = this.findParent(line);
            // Since the updates as a result of toggle have not happened yet in the editor, counting checked children is going to use old value of current checkbox.  Hence the adjustment.
            this.updateParent(parent, checked ? 1 : -1);
        } else if (summary) {
            this.updateParent(line, 0);
        } else if (extlink) {
            this.launchExternalLink(extlink);
            // No text change or movement in the editor.  Exit.
            return;
        } else if (reference) {
            this.jumpReference(reference);
            return;
        } else {
            // Fallback to just editing text, i.e. process `enter` key.
            // The following will translate to proper line ending automatically.
            this._updates.push({ range: new Range(selection.active, selection.active), text: '\n' });
        }
        
        // Apply updates accumulated thus far.
        let list = this._updates;
        editor.edit(function(edit) {
            for (let upd of list)
                edit.replace(upd.range, upd.text);
        }).then(() => {
            // Reset selection after applying operations.
            let selection = new Selection(editor.selection.active, editor.selection.active);
            editor.selections = [selection]; 
        });
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
    
    private findExternalLink(line: TextLine, position: Position): IExternalLink {
        let re = new RegExp(`\\[\\[(.+?)?\\]([^\\[\\]:\\n]*)\\]`);
        let match = re.exec(line.text);
        if (match) {
            let extlink = { 
                range: new Range(line.lineNumber, match.index + 2, line.lineNumber, match.index + match[0].length - 3),
                url: match[1]
            };
            if (!position) {
                return extlink;
            }
            if (extlink.range.contains(position)) {
                return extlink;
            }
        }
        return null;
    }
    
    private findReference(line: TextLine, position: Position): Range {
        let re = new RegExp(`\\{(\\d+|\\{(.+?)\\})\\}`, 'g');
        let text = line.text;
        let match = re.exec(text);
        while (match) {
            let range = new Range(line.lineNumber, match.index, line.lineNumber, match.index + match[0].length);
            if (!position) {
                return range;
            }
            if (range.contains(position)) {
                return range;
            }
            match = re.exec(text);
        }
        return null;
    }
    
    private jumpReference(reference: Range) {
        if (!reference) {
            return;
        }
        let editor = window.activeTextEditor;
        let token = editor.document.getText(reference);
        if (token.startsWith('{{')) {
            token = '* ' + token.substr(2, token.length - 4);
        }
        // The following is possibly duplicating the entire document text just for search purpose.
        let text = editor.document.getText();
        let offset = editor.document.offsetAt(editor.selection.active);
        let pos = text.indexOf(token, offset);
        // Retry from the start of the file if no found from the current position in the middle of the file.
        if (pos < 0 && offset > 0) {
            pos = text.indexOf(token, 0);
        }
        if (pos >= 0) {
            let active = editor.document.positionAt(pos + 1);
            let selection = new Selection(active, active);
            editor.selections = [selection]; 
            editor.revealRange(selection);
        }
    }
    
    private launchExternalLink(extlink: IExternalLink) {
        console.log(extlink.url);
    }
    
    // Perform the toggle.  'x' or 'X' becomes blank and blank becomes 'X'.
    private toggleCheckbox(checkbox: Range, line: TextLine, check: boolean): number {
        if (!checkbox) {
            return 0;
        }
        let editor = window.activeTextEditor;
        let doc = editor.document;
        let checked = doc.getText(checkbox) != ' ';
        if (checked == check) {
            return 0;  // Nothing to do.
        }
        this._updates.push({ range: checkbox, text: (check ? 'X' : ' ')});
        if (!line) {
            return check ? 1 : -1;
        }
        let children = this.findChildren(line);
        let child: TextLine = null;
        for (child of children) {
            this.toggleCheckbox(this.findCheckbox(child, null), child, check);
        }
        // If there is a summary on this line, update it to either [0/0] or [total/total] depending on value of 'check'.
        let total = check ? children.length : 0;
        let summary = this.findSummary(line, null);
        this.updateSummary(summary, total, total);
        return check ? 1 : -1;
    }
    
    // Update checkbox and summary on this line.  Adjust checked items count with an additional offset.  That accounts for 
    // a checkbox that has just been toggled but text in the editor has not been updated yet.
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
        let editor = window.activeTextEditor;
        let doc = editor.document;
        for (let child of children) {
            chk = this.findCheckbox(child, null);
            if (chk) {
                if (doc.getText(chk) != ' ') {
                    checked++;
                }
            }
        }
        let summary = this.findSummary(line, null);
        this.updateSummary(summary, checked, total);
        // If there is a checkbox on this line, update it depending on (checked == total).
        chk = this.findCheckbox(line, null);
        // Prevent propagation downstream by passing line = null.
        let delta = this.toggleCheckbox(chk, null, checked == total);
        // Recursively update parent nodes
        let parent = this.findParent(line);
        // Since the updates as a result of toggle have not happened yet in the editor, counting checked children is going to use old value of current checkbox.  Hence the adjustment.
        this.updateParent(parent, delta);
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
        let editor = window.activeTextEditor;
        let doc = editor.document;
        while (pindent >= indent) {
            lnum--;
            if (lnum < 0) {
                return null;
            }
            
            parent = doc.lineAt(lnum);
            pindent = this.getIndent(parent);
        }
        return parent;
    }
    
    // Find parent item by walking lines up to the start of the file looking for a smaller indentation.  Does not ignore blank lines (indentation 0).
    private findChildren(line: TextLine): TextLine[] {
        let children: TextLine[] = [];
        let lnum = line.lineNumber;
        let editor = window.activeTextEditor;
        let doc = editor.document;
        let lmax = doc.lineCount - 1; 
        let indent = this.getIndent(line);
        let child: TextLine = null;
        let cindent = indent;
        let next_indent = -1;
        while (lnum < lmax) {
            lnum++;
            child = doc.lineAt(lnum);
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
    
    public dispose() {
        // Nothing to do yet.
    }
}