# Native Federation checkpoint test app

This workspace includes a shell and two Angular Native Federation remotes for exercising the checkpoint flow.

| Application | Address | Purpose |
| --- | --- | --- |
| Shell | http://localhost:4200 | Hosts routing and the checkpoint toolbar |
| Workflow remote | http://localhost:4201 | Multi-step customer application form |
| Summary remote | http://localhost:4202 | Displays restored workflow state |

## Prerequisites

- Node.js version supported by Angular 17 (Node 18.13+ or Node 20).
- pnpm installed globally.
- Three available terminals.

Install workspace dependencies once:

```bash
pnpm install --no-frozen-lockfile
```

## Start the app

Start these commands in three separate terminals from the repository root:

```bash
# Terminal 1
pnpm run demo:federation:workflow
```

```bash
# Terminal 2
pnpm run demo:federation:summary
```

```bash
# Terminal 3 — start this after both remotes report that they are ready
pnpm run demo:federation:shell
```

The scripts build `inspector-ng` before serving each application. Open [the shell](http://localhost:4200) after all three servers are running.

## Manual checkpoint test

1. Open `http://localhost:4200/workflow`.
2. Complete both form steps: customer name, account type, amount, and terms acceptance.
3. Select **Continue to summary**. Confirm the summary displays your values.
4. The compact inspector toolbar is visible by default. Open its checkpoint control and save a checkpoint.
6. Go back to `/workflow` and change the form values, or refresh the browser.
7. Restore the saved checkpoint. If you disabled the inspector with its power button, press **M** to enable it again.
8. Confirm that the shell returns to `/summary` and the original values are displayed.

The expected restore sequence is: load remote checkpoint adapters → restore registered state → navigate to the saved URL.

## Clear saved checkpoints

The federation demo uses this browser local-storage key:

```text
inspector-ng.checkpoints.federation-demo
```

To reset the demo, open browser DevTools on `http://localhost:4200`, go to **Application** → **Local Storage**, and delete that key.

## Tests and builds

Build the library, shell, and regular demo:

```bash
pnpm exec ng build inspector-ng
pnpm exec ng build shell
pnpm exec ng build demo
```

Run the federation test suite:

```bash
pnpm run test:federation
```

This requires a Chrome/ChromeHeadless binary. If Karma reports `No binary for ChromeHeadless`, install Chrome or set `CHROME_BIN` to the browser executable before running the command.

## Demo architecture note

The shell uses the production `inspector-ng` overlay, checkpoint registry, and RxJS adapter. The path-mapped `@inspector-ng/checkpoints` package supplies only the demo's shared workflow-domain state. Only the shell provides the registry; remotes receive that instance and register namespaced adapters through it.
