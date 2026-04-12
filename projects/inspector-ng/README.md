# inspector-ng

On-screen inspection tools for Angular. Measure spacing, inspect typography, place guides — without leaving the browser.

## Inspiration

This project is inspired by [mesurer](https://github.com/ibelick/mesurer) by [ibelick](https://github.com/ibelick) — a lightweight measurement and alignment overlay for React apps. **inspector-ng** brings the same concept to the Angular ecosystem, reimagined with Angular's standalone components, signal-based reactivity, and `OnPush` change detection.

Inspired by [ibelick](https://github.com/ibelick)'s original design.
## Installation

```bash
npm install inspector-ng
```

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
  [persistOnReload]="true"
  [hoverHighlightEnabled]="true"
></inspector-overlay>
```

### Step 3: Press `M` to toggle the inspector

That's it. Press **`M`** in your browser to open the inspector toolbar. No further configuration is required.

## Configuration

### Inputs

| Input | Type | Default | Description |
|---|---|---|---|
| `persistOnReload` | `boolean` | `false` | Persist inspector state (guides, settings) to localStorage across page reloads |
| `hoverHighlightEnabled` | `boolean` | `true` | Show a highlight rectangle when hovering over elements |
| `highlightColor` | `string` | `"#4f8cff"` | Accent color for element selection highlights |
| `guideColor` | `string` | `"#ff7a00"` | Color for alignment guides |

### Example with all options

```html
<inspector-overlay
  [persistOnReload]="true"
  [hoverHighlightEnabled]="true"
  highlightColor="#10b981"
  guideColor="#f59e0b"
></inspector-overlay>
```

## Keyboard Shortcuts

| Key | Action |
|---|---|
| `M` | Toggle inspector on/off |
| `S` | Select mode — click elements to inspect their bounds, padding, margin, and styles |
| `G` | Guides mode — place alignment guides on the page |
| `H` / `V` | Toggle guide orientation (horizontal / vertical) |
| `Alt` (hold) | Measure pixel distance between the selected element and the hovered element |
| `Esc` | Clear selection, deselect guides, reset state |
| `Ctrl/Cmd + Z` | Undo last guide change |
| `Ctrl/Cmd + Shift + Z` | Redo guide change |
| `Backspace` / `Delete` | Delete the selected guide |

## Features

- **Element Inspection** — Click any element to see its bounding box, padding, margin, font size, line height, color, and more.
- **Typography Overlay** — Annotate all visible text blocks with their computed typography styles.
- **Alignment Guides** — Place draggable vertical/horizontal guides with snap-to behavior.
- **Distance Measurement** — Hold `Alt` to measure pixel distance between two elements.
- **Gap Detection** — Detects and displays flex/grid gap values.
- **Undo/Redo** — Full history for guide operations.
- **State Persistence** — Optionally saves and restores state across page reloads.
- **SSR-Safe** — Uses `isPlatformBrowser` to avoid running on the server.


## Compatibility

| Dependency | Version |
|---|---|
| `@angular/core` | `^17.3.0` |
| `@angular/common` | `^17.3.0` |

Built as a standalone component with signal-based reactivity and `OnPush` change detection.

## License

MIT
