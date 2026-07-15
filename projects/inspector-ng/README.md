# inspector-ng

Measure, inspect, and align Angular UIs on localhost.

## Inspiration

This project is inspired by [mesurer](https://github.com/ibelick/mesurer) by [ibelick](https://github.com/ibelick) — a lightweight measurement and alignment overlay for React apps. **inspector-ng** brings the same concept to the Angular ecosystem, reimagined with Angular's standalone components, signal-based reactivity, and `OnPush` change detection.

Inspired by [ibelick](https://github.com/ibelick)'s original design.

## Installation

```bash
npm install inspector-ng@0.0.13 @ngrx/store@^17.2.0
```

For a complete new-project walkthrough with copy-paste Store, Router, Redux DevTools, state, local-package, and troubleshooting examples, see the [setup guide](https://github.com/destx0/inspector/blob/main/SETUP_GUIDE.md).

## Getting Started

### Step 1: Import the component

Open your root component (e.g. `app.component.ts`) and import `inspectorComponent` from `inspector-ng`. Add it to the `imports` array:

```ts
import { Component } from '@angular/core';
import { inspectorComponent } from 'inspector-ng';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [inspectorComponent],   // <-- add this
  templateUrl: './app.component.html',
})
export class AppComponent {}
```

> **Using NgModules?** If your app uses `NgModule` (not standalone), add `inspectorComponent` to your module's `imports` array instead, then use the selector in any component template within that module.

### Step 2: Add the overlay to your template

Place `<inspector-overlay>` in your root template (e.g. `app.component.html`). It can go at the top or bottom — it renders as a fixed overlay on top of everything:

```html
<!-- Your existing app template -->
<router-outlet></router-outlet>

<!-- Inspector overlay -->
<inspector-overlay
  [hoverHighlightEnabled]="true"
></inspector-overlay>
```

### Step 3: Open the command palette

That's it. Press **`Ctrl/Cmd + Shift + P`** in your browser to open the Inspector command palette. No further configuration is required.

## Configuration

### Developer checkpoints

Add `@ngrx/store` and provide a single root Store before `provideInspectorCheckpoints()`:

```ts
import { ApplicationConfig } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideStore } from '@ngrx/store';
import { provideInspectorCheckpoints } from 'inspector-ng';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [provideRouter(routes), provideStore(), provideInspectorCheckpoints()],
};
```

Use the compact Save action in the command palette to capture the current JSON-serializable NgRx root state immediately. `Ctrl/Cmd+Shift+P` opens the fuzzy checkpoint finder. Rename and delete remain explicit buttons on each record.

Records are stored per origin in IndexedDB database `inspector-ng`, object store `checkpoints`. This needs no browser permission prompt and does not map to a visible or fixed OS path. Nothing is evicted automatically. Existing `inspector-checkpoints-v1` localStorage records are deliberately ignored.

A checkpoint contains the root Store value and current route. Restore dispatches `[Inspector Checkpoints] Restore`, then navigates through Angular Router to the saved route, so NgRx Store DevTools records the state change normally. It does not restore action history, component-local state, HTTP activity, or backend state. Native Redux DevTools Import/Export files remain separate and cannot be searched from the Inspector command bar.

### Inputs

| Input | Type | Default | Description |
|---|---|---|---|
| `hoverHighlightEnabled` | `boolean` | `true` | Show a highlight rectangle when hovering over elements |
| `highlightColor` | `string` | `"#4f8cff"` | Accent color for element selection highlights |
| `guideColor` | `string` | `"#ff7a00"` | Color for alignment guides |

### Example with all options

```html
<inspector-overlay
  [hoverHighlightEnabled]="true"
  highlightColor="#10b981"
  guideColor="#f59e0b"
></inspector-overlay>
```

## Keyboard Shortcuts

| Key | Action |
|---|---|
| `Ctrl/Cmd + Shift + P` | Open the Inspector command palette when configured |
| `Esc` | Clear selections, guides, and transient overlays |

## Features

- **Element Inspection** — Click any element to see its bounding box, padding, margin, font size, line height, color, and more.
- **Typography Overlay** — Annotate all visible text blocks with their computed typography styles.
- **Alignment Guides** — Place draggable vertical/horizontal guides with snap-to behavior.
- **Gap Detection** — Detects and displays flex/grid gap values.
- **State Persistence** — Optionally saves and restores state across page reloads.
- **SSR-Safe** — Uses `isPlatformBrowser` to avoid running on the server.


## Compatibility

| Dependency | Version |
|---|---|
| `@angular/core` | `^17.3.0` |
| `@angular/common` | `^17.3.0` |
| `@angular/router` | `^17.3.0` |
| `@ngrx/store` | `^17.2.0` (peer dependency used only for checkpoints) |

Built as a standalone component with signal-based reactivity and `OnPush` change detection.

## License

MIT
