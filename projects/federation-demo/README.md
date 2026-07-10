# Native Federation checkpoint demo

Runnable demo for exercising the combined `inspector-ng` inspection and checkpoint toolbar across a Native Federation host and remotes. The toolbar is visible on page load; its power button disables it completely, and **M** enables it again.

The shell and remote adapter bridges use the production API from `inspector-ng`. The path-mapped `@inspector-ng/checkpoints` package remains only as the demo's shared workflow-domain state package.

## Apps

| App        | Role     | Port | Routes                          |
|------------|----------|------|---------------------------------|
| `shell`    | Host     | 4200 | `/`, `/workflow`, `/summary`    |
| `workflow` | Remote   | 4201 | exposes `./Routes`, `./CheckpointAdapters` |
| `summary`  | Remote   | 4202 | exposes `./Routes`, `./CheckpointAdapters` |

### inspector-ng surface

- `provideInspectorCheckpoints()` — **shell only**
- `InspectorCheckpointRegistry` — created by the shell, passed into remotes
- `createBehaviorSubjectCheckpointAdapter(id, subject)`
- `<inspector-overlay [persistOnReload]="true">` combining inspection, guides, typography, and checkpoint controls

### Design rules

- Only the **shell** calls `provideInspectorCheckpoints()`.
- Remotes export `registerInspectorCheckpointAdapters(registry)` and must **not** create a registry.
- Shell remote bridge loads adapters for scopes `workflow` and `summary`.
- On restore: **load remote adapters → restore state → navigate** to the saved URL.
- Shared deps: `inspector-ng` and `@inspector-ng/checkpoints` are federation singletons with strict compatible versions.
- No HTTP interception, request recording, or API replay.

## Install

From the workspace root:

```bash
pnpm install --no-frozen-lockfile
```

Build the local `inspector-ng` library (shared singleton):

```bash
pnpm exec ng build inspector-ng
```

## Start (three terminals)

```bash
# Terminal 1 — workflow remote
pnpm exec ng serve workflow

# Terminal 2 — summary remote
pnpm exec ng serve summary

# Terminal 3 — shell host (after remotes are up)
pnpm exec ng serve shell
```

Or use the convenience scripts:

```bash
pnpm run demo:federation:workflow   # :4201
pnpm run demo:federation:summary    # :4202
pnpm run demo:federation:shell      # :4200
```

Open **http://localhost:4200**.

## Manual test flow

1. Start shell + both remotes (commands above).
2. Open **http://localhost:4200/workflow**.
3. Complete the two-step form (name, account type, amount, terms).
4. Click **Continue to summary** (lands on `/summary`).
5. Open checkpoints in the compact inspector toolbar and select **Save current**.
6. Change form values (go back to `/workflow`) **or** refresh the page.
7. Open the checkpoint **List**, click **Restore**.
8. Confirm:
   - shell navigates to **`/summary`**
   - summary shows the **original** form values

## Tests

```bash
# Build inspector-ng first (path mapping)
pnpm exec ng build inspector-ng

# Shell (+ checkpoint-api unit/integration specs)
pnpm exec ng test shell --no-watch --browsers=ChromeHeadless

# Workflow remote
pnpm exec ng test workflow --no-watch --browsers=ChromeHeadless

# Summary remote
pnpm exec ng test summary --no-watch --browsers=ChromeHeadless

# All federation demo tests
pnpm run test:federation
```

### What the tests cover

| Assertion | Where |
|-----------|--------|
| Adapter IDs are namespaced (`workflow:application`) | checkpoint-api, workflow, shell |
| Remote adapters load **before** restore | shell bridge + checkpoint service |
| State restores **before** Router navigation | shell integration + checkpoint service |
| Summary displays saved values after restore | summary component + shell integration |

## Architecture sketch

```
shell (provideInspectorCheckpoints)
  ├── <inspector-overlay persistOnReload>
  ├── remote-checkpoint-bridge
  │     ├── loadRemoteModule('workflow', './CheckpointAdapters')
  │     └── loadRemoteModule('summary', './CheckpointAdapters')
  ├── /workflow → HomeComponent
  ├── /workflow → loadChildren workflow ./Routes
  └── /summary  → loadChildren summary ./Routes

workflow remote
  └── registerInspectorCheckpointAdapters(registry)
        └── createBehaviorSubjectCheckpointAdapter('workflow:application', subject)

summary remote
  └── registerInspectorCheckpointAdapters(registry)
        └── same shared BehaviorSubject under 'workflow:application'
```

Restore sequence:

1. `loadRemoteCheckpointAdapters(registry, snapshot.remoteScopes)`
2. `registry.restoreAll(snapshot.states)`
3. `router.navigateByUrl(snapshot.url)`
