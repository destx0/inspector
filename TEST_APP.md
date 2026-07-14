# Native Federation checkpoint test app

The workspace includes a shell and two Angular Native Federation remotes for exercising one shared NgRx root Store.

| Application | Address | Purpose |
|---|---|---|
| Shell | http://localhost:4200 | Owns the root Store, checkpoint provider, routing, and Inspector |
| Workflow remote | http://localhost:4201 | Dispatches typed workflow actions |
| Summary remote | http://localhost:4202 | Selects and displays workflow state |

## Start

Install dependencies, then start each app in a separate terminal:

```bash
pnpm install --no-frozen-lockfile
pnpm run demo:federation:workflow
pnpm run demo:federation:summary
pnpm run demo:federation:shell
```

Start the shell after both remotes report ready, then open `http://localhost:4200/workflow`.

## Manual checkpoint test

1. Complete customer name, account type, amount, and terms, then continue to summary.
2. Use the compact Save checkpoint toolbar button. There is no naming dialog.
3. Return to the workflow and change the values.
4. Press `Ctrl/Cmd+Shift+P`, select the saved checkpoint using fuzzy search, and press `Enter`.
5. Confirm that the original values return and the shell navigates to the route where the checkpoint was saved.
6. Reload the shell and confirm the checkpoint still appears in the command bar.

Checkpoint records live per origin in IndexedDB database `inspector-ng`, store `checkpoints`. This requires no permission prompt and has no fixed or configurable filesystem path. Clear them from browser DevTools under **Application → IndexedDB → inspector-ng → checkpoints**, or delete individual records from the command bar.

Only JSON-serializable NgRx root state and the current route are captured. Restore applies state and then navigates through Angular Router. HTTP traffic, backend data, component-local state, and NgRx action history remain outside checkpoint scope. Native Redux DevTools Import/Export files do not appear in the searchable catalog, and legacy localStorage records are not migrated.

## Tests and builds

```bash
CHROME_BIN=/usr/bin/chromium pnpm run test:federation

pnpm exec ng build inspector-ng
pnpm exec ng build shell --configuration production
pnpm exec ng build workflow --configuration production
pnpm exec ng build summary --configuration production
```

Set `CHROME_BIN` to the installed Chrome or Chromium executable when Karma cannot locate it automatically.
