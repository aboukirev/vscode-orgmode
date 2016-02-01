# vscode-orgmode
orgmode implementation for VSCode, along the lines of orgmode for SublimeText.

Learning VSCode extensions API and Typescript at the same time.  Basic syntax scopes/highlight works.  Toggling checkboxes and updating summaries in hierarchical lists works. References and external links are coming.

Make sure to `npm install` to pull all the required node modules.  Open folder in VSCode and hit F5 to get extension running in debug mode.  Select OrgMode language for the untitled document and start experimenting.

The orgmode activates on files with `.org` and `.tasks` extensions but you can also apply it manually.

NOTE: This does not comply with the official `org-mode` specification.  I got used to orgmode plugin for Sublime and wanted to transfer all my `org` files to `vscode` without any loss of functionality.  That also means external links will be incompatible with Markdown links.
I might consider changing this to be more Markdown compliant and/or official `org-mode` compliant once I feel I can pull it off.
 
