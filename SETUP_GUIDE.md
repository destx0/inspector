# New project setup

This guide adds the Inspector and NgRx checkpoints to a new standalone Angular 17 application. The shortest setup is three edits: install the packages, add one provider, and render one overlay component.

`inspector-ng` is an Angular library rendered inside the application, not a separately installed Chrome/Firefox extension.

To create a fresh compatible application:

```bash
npx @angular/cli@17 new checkpoint-demo --standalone --routing --style=css
cd checkpoint-demo
```

## 1. Install

For an existing Angular 17 application that already uses Angular Router and NgRx Store:

```bash
pnpm add inspector-ng@0.0.13
# or: npm install inspector-ng@0.0.13
```

For a new application without NgRx:

```bash
pnpm add inspector-ng@0.0.13 @ngrx/store@^17.2.0
# or: npm install inspector-ng@0.0.13 @ngrx/store@^17.2.0
```

Redux DevTools support is optional:

```bash
pnpm add @ngrx/store-devtools@^17.2.0
# or: npm install @ngrx/store-devtools@^17.2.0
```

To test an unpublished local build instead, run this in the Inspector repository:

```bash
pnpm ng build inspector-ng
npm pack ./dist/inspector-ng
```

Then install the generated tarball in the new application:

```bash
npm install /absolute/path/to/inspector-ng-0.0.13.tgz @ngrx/store@^17.2.0
```

## 2. Add the provider

Add `provideInspectorCheckpoints()` after the root Store in `src/app/app.config.ts`. Keep the application's existing routes and reducers.

```ts
import { ApplicationConfig } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideStore } from '@ngrx/store';
import { provideInspectorCheckpoints } from 'inspector-ng';

import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideStore(),
    provideInspectorCheckpoints(),
  ],
};
```

If the project already calls `provideRouter()` and `provideStore()`, do not add them again. Add only:

```ts
provideInspectorCheckpoints()
```

## 3. Add the overlay once

Import the standalone component in the root component:

```ts
import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { inspectorComponent } from 'inspector-ng';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, inspectorComponent],
  templateUrl: './app.component.html',
})
export class AppComponent {}
```

Render it once at the end of `src/app/app.component.html`:

```html
<router-outlet />
<inspector-overlay />
```

That is the complete checkpoint setup. No adapter, registry, service call, browser permission, Redux DevTools hook, or initialization code is required.

## Use checkpoints

1. Open any route in the application.
2. Open the command palette with `Ctrl/Cmd+Shift+P`, then choose Save. Saving is immediate and automatically named from the route, such as `/summary` or `/summary 2`.
3. Change application state or navigate elsewhere.
4. Press `Ctrl+Shift+P` on Windows/Linux or `Cmd+Shift+P` on macOS.
5. Type part of the checkpoint name and press `Enter`.

Restore replaces the complete NgRx root state first and then navigates through Angular Router to the saved route. The command palette works while an application input is focused and while the Inspector is disabled.

Command-palette navigation:

| Key | Action |
|---|---|
| `ArrowDown` / `ArrowUp` | Select a checkpoint or move between sections |
| `ArrowLeft` / `ArrowRight` | Select an Inspector action |
| `Enter` | Run the selected checkpoint or action |
| `Escape` | Close or cancel an inline action |

## Complete serializable state example

Checkpoint state must be JSON-serializable. The following small feature is safe to save and restore.

Create `src/app/workflow.state.ts`:

```ts
import { createActionGroup, createFeature, createReducer, on, props } from '@ngrx/store';

export interface WorkflowState {
  customerName: string;
  amount: number | null;
}

const initialState: WorkflowState = {
  customerName: '',
  amount: null,
};

export const workflowActions = createActionGroup({
  source: 'Workflow',
  events: {
    'Customer name changed': props<{ customerName: string }>(),
    'Amount changed': props<{ amount: number | null }>(),
  },
});

const reducer = createReducer(
  initialState,
  on(workflowActions.customerNameChanged, (state, { customerName }) => ({
    ...state,
    customerName,
  })),
  on(workflowActions.amountChanged, (state, { amount }) => ({
    ...state,
    amount,
  })),
);

export const workflowFeature = createFeature({
  name: 'workflow',
  reducer,
});
```

Register the feature in `app.config.ts`:

```ts
import { provideState, provideStore } from '@ngrx/store';
import { provideInspectorCheckpoints } from 'inspector-ng';
import { workflowFeature } from './workflow.state';

providers: [
  provideStore(),
  provideState(workflowFeature),
  provideInspectorCheckpoints(),
]
```

Dispatch updates from a component:

```ts
import { Component, inject } from '@angular/core';
import { Store } from '@ngrx/store';
import { workflowActions, workflowFeature } from './workflow.state';

@Component({
  selector: 'app-workflow',
  standalone: true,
  template: `
    <label>
      Customer name
      <input [value]="customerName()" (input)="updateName($event)" />
    </label>
  `,
})
export class WorkflowComponent {
  private readonly store = inject(Store);
  readonly customerName = this.store.selectSignal(workflowFeature.selectCustomerName);

  updateName(event: Event): void {
    const customerName = (event.target as HTMLInputElement).value;
    this.store.dispatch(workflowActions.customerNameChanged({ customerName }));
  }
}
```

Any mounted component selecting this feature updates immediately after restore.

## Optional Redux DevTools

Redux DevTools is not required for checkpoint persistence. To keep normal action inspection and native Import/Export, add this after the Store and checkpoint provider:

```ts
import { provideStoreDevtools } from '@ngrx/store-devtools';

providers: [
  provideStore(),
  provideInspectorCheckpoints(),
  provideStoreDevtools({
    name: 'my Angular application',
    maxAge: 25,
    connectInZone: true,
    features: {
      export: true,
      import: true,
    },
  }),
]
```

A restore appears in Redux DevTools as `[Inspector Checkpoints] Restore`. Redux DevTools export files are separate from the Inspector catalog and do not appear in fuzzy search.

## What is persisted

Each checkpoint stores:

- The current JSON-serializable NgRx root state.
- The current Angular route, including query string and hash.
- An automatic name and creation timestamp.

Records are stored per browser origin in IndexedDB database `inspector-ng`, object store `checkpoints`. IndexedDB requires no permission prompt and has no fixed or configurable operating-system path. Different ports and domains have separate catalogs. Records remain until individually deleted or site data is cleared; there is no automatic eviction.

Checkpoints do not capture HTTP requests, backend data, component-local state, DOM state, files, or NgRx action history. Existing `inspector-checkpoints-v1` localStorage data is not migrated.

## Optional Inspector inputs

```html
<inspector-overlay
  [hoverHighlightEnabled]="true"
  highlightColor="#4f8cff"
  guideColor="#ff7a00"
/>
```

## Troubleshooting

### The Save button is missing

Confirm that `provideInspectorCheckpoints()` is in the root `ApplicationConfig` and `<inspector-overlay />` is rendered once.

### The Store is unavailable

Register `provideInspectorCheckpoints()` after `provideStore()`.

### State restores but the page does not change

Confirm that the root application uses `provideRouter(routes)` and that the saved route still exists.

### Saving reports a serialization error

Remove circular values, class instances, DOM nodes, functions, `BigInt`, and other non-JSON values from Store state. Keep Store state as plain objects, arrays, strings, numbers, booleans, and `null`.

### A checkpoint is not visible on another development port

This is expected. IndexedDB storage is per origin, and the port is part of the origin.

### Clear all checkpoints

Open browser DevTools and remove **Application → IndexedDB → inspector-ng → checkpoints**, or clear the site's stored data.
