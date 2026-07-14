# NgRx Native Federation checkpoint demo

This demo exercises one root NgRx Store across an Angular Native Federation shell and its workflow and summary remotes. The shell owns checkpoint persistence; federated components inherit that Store.

| App | Role | Port | Routes |
|---|---|---:|---|
| `shell` | Host and root Store owner | 4200 | `/`, `/workflow`, `/summary` |
| `workflow` | Remote | 4201 | exposes `./Routes` |
| `summary` | Remote | 4202 | exposes `./Routes` |

The neutral `@inspector-ng/federation-demo-state` alias contains the shared serializable workflow feature, typed actions, reducer, and selectors. Standalone remote configurations provide their own Store for development, while federated routes use the shell's Store.

## Start

From the workspace root:

```bash
pnpm install --no-frozen-lockfile
pnpm exec ng build inspector-ng
```

Then run the three applications in separate terminals:

```bash
pnpm run demo:federation:workflow
pnpm run demo:federation:summary
pnpm run demo:federation:shell
```

Open `http://localhost:4200/workflow`.

## Manual checkpoint flow

1. Complete both workflow steps and open the summary.
2. Open the command palette with `Ctrl/Cmd+Shift+P`, then choose Save. It saves immediately with a route-based name.
3. Return to the workflow and change the values.
4. Press `Ctrl/Cmd+Shift+P`, fuzzy-search the saved name, and press `Enter`.
5. Confirm that the restored NgRx state appears and the shell navigates back to the checkpoint route.
6. Reload the shell and reopen the command bar to confirm the catalog remains in IndexedDB.

The shortcut also works while an application input is focused and while the Inspector is disabled. `F2` renames the active checkpoint; `Delete` starts inline deletion confirmation.

## Storage and scope

The shell calls `provideStore()` followed by `provideInspectorCheckpoints()`. Checkpoints are stored in the current origin's IndexedDB database and require no permission prompt. Browser storage has no fixed filesystem path and each origin has a separate catalog. Restore applies root state and navigates to the saved route; backend data, HTTP activity, component-local state, and lifted action history remain outside its scope. Old localStorage checkpoints are not migrated.

NgRx Store DevTools uses the stable name `inspector-ng federation demo` and keeps native Import/Export enabled. Native DevTools files are separate from the searchable Inspector catalog.

## Tests and builds

```bash
CHROME_BIN=/usr/bin/chromium pnpm exec ng test shell --no-watch --browsers=ChromeHeadless
CHROME_BIN=/usr/bin/chromium pnpm exec ng test workflow --no-watch --browsers=ChromeHeadless
CHROME_BIN=/usr/bin/chromium pnpm exec ng test summary --no-watch --browsers=ChromeHeadless

pnpm exec ng build inspector-ng
pnpm exec ng build shell --configuration production
pnpm exec ng build workflow --configuration production
pnpm exec ng build summary --configuration production
```
