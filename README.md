# vscode-orgmode
orgmode implementation for VSCode, along the lines of orgmode for SublimeText.

Learning VSCode extensions API and Typescript at the same time.  

Make sure to `npm install` to pull all the required node modules.  Open folder in VSCode and hit F5 to get extension running in debug mode.  Select OrgMode language for the untitled document and start experimenting.

The orgmode activates on files with `.org` and `.tasks` extensions but you can also apply it manually.

At this point I decided to abandon this experiment.  I now have [vscode-checklist](https://github.com/aboukirev/vscode-checklist) project that satisfies my needs for check-lists.

## What already works
- Basic syntax highlight
- Checkboxes and summaries in hierarchical lists
- Jumping through internal references
- Hitting `Enter` on an external link logs to console (proof of concept) 

## Things I want to implement
- Some refactoring of the extension code: interfaces and structures, reusing active editor and document proper, etc.
- Add more snippets.
- For external links start browser with the specified URL (open/start/xdg-open depending on platform) or do something like `Open preview` for Markdown.
- Folding for headings of various levels. 

