# inspector-ng

`inspector-ng` is a developer overlay for Angular applications. It helps you inspect element sizes and styles, measure spacing, view typography, and place alignment guides directly in the browser.

Press **M** to turn the inspector on or off.

## Requirements

- Node.js 18 or newer
- pnpm
- Angular 17.3

## Run this repository locally

```bash
git clone https://github.com/destx0/inspector.git
cd inspector
pnpm install
pnpm start
```

Open `http://localhost:4200`.

`pnpm start` builds the library first and then starts the demo application. Changes to the demo reload normally. If you change the library source, restart the command or run the library watcher in another terminal:

```bash
pnpm ng build inspector-ng --watch --configuration development
```

Useful commands:

```bash
pnpm build                         # build the library and demo
pnpm ng build inspector-ng         # build only the publishable library
pnpm ng test inspector-ng --watch=false
pnpm test                          # run all workspace tests in watch mode
```

The packaged library is written to `dist/inspector-ng`.

## Use it in a real Angular project

Install it in an Angular 17 application:

```bash
npm install inspector-ng
```

### Standalone application

Import the standalone component in your root component:

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

Add the overlay once, near the end of the root template:

```html
<router-outlet></router-outlet>

<inspector-overlay
  [persistOnReload]="true"
  [hoverHighlightEnabled]="true"
></inspector-overlay>
```

Start the application, open it in a browser, and press **M**.

### NgModule application

The component is standalone, so add it to `imports`, not `declarations`:

```ts
import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { inspectorComponent } from 'inspector-ng';
import { AppComponent } from './app.component';

@NgModule({
  declarations: [AppComponent],
  imports: [BrowserModule, inspectorComponent],
  bootstrap: [AppComponent],
})
export class AppModule {}
```

Then add `<inspector-overlay />` to `app.component.html`.

### Try a local package before publishing

From this repository:

```bash
pnpm ng build inspector-ng
npm pack ./dist/inspector-ng
```

The second command creates a file such as `inspector-ng-0.0.8.tgz`. Install that file in another Angular project:

```bash
npm install /absolute/path/to/inspector-ng-0.0.8.tgz
```

This tests the same package contents users receive from npm.

## Configuration

| Input | Type | Default | Purpose |
|---|---|---:|---|
| `persistOnReload` | `boolean` | `false` | Save guides and inspector settings in `localStorage` |
| `hoverHighlightEnabled` | `boolean` | `true` | Highlight the element under the pointer |
| `highlightColor` | `string` | `#4f8cff` | Selection highlight color |
| `guideColor` | `string` | `#ff7a00` | Alignment guide color |

Example:

```html
<inspector-overlay
  [persistOnReload]="true"
  [hoverHighlightEnabled]="true"
  highlightColor="#10b981"
  guideColor="#f59e0b"
/>
```

## Keyboard shortcuts

| Key | Action |
|---|---|
| `M` | Turn the inspector on or off |
| `S` | Select and inspect an element |
| `G` | Enter guide mode |
| `H` / `V` | Use horizontal or vertical guides |
| Hold `Alt` | Measure the distance between selected and hovered elements |
| `Esc` | Clear the current selection |
| `Ctrl/Cmd + Z` | Undo a guide change |
| `Ctrl/Cmd + Shift + Z` | Redo a guide change |
| `Backspace` / `Delete` | Delete the selected guide |
| `Ctrl/Cmd + Shift + P` | Find and restore a saved NgRx checkpoint (when checkpoint providers are installed) |

## Optional NgRx checkpoints

Install `@ngrx/store`, then provide one root Store followed by the checkpoint provider:

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

The Inspector toolbar now shows one Save checkpoint button. Saving captures a JSON-serializable clone of the current NgRx root state and gives it a route-based name such as `/summary 2`. Press `Ctrl/Cmd+Shift+P` anywhere in the application—even when an input is focused or the Inspector rail is disabled—to fuzzy-search, restore, rename, or delete saved checkpoints.

Checkpoints live in the `inspector-ng` IndexedDB database for the current browser origin. Browser storage needs no permission prompt, has no fixed or configurable filesystem path, is not shared across origins, and is kept until the user deletes it or clears site data. Existing `inspector-checkpoints-v1` localStorage records are not migrated.

Only the current NgRx root state and route are captured. Restore replaces the Store state first, then navigates through Angular Router to the saved route. It does not replay actions, restore component-local state, replay HTTP calls, or change backend data. Redux DevTools observes restore as a normal `[Inspector Checkpoints] Restore` action. Its native Import/Export files remain separate from the searchable Inspector catalog.

## Publish to npm

You need an npm account with permission to publish the `inspector-ng` package.

1. Log in and confirm the account:

   ```bash
   npm login
   npm whoami
   ```

2. Update `version` in `projects/inspector-ng/package.json`. npm will reject a version that has already been published.

3. Build and test:

   ```bash
   pnpm ng test inspector-ng --watch=false
   pnpm ng build inspector-ng
   ```

4. Inspect exactly what will be published:

   ```bash
   cd dist/inspector-ng
   npm pack --dry-run
   ```

5. Publish from the package output directory:

   ```bash
   npm publish --access public
   ```

6. Verify the published version:

   ```bash
   npm view inspector-ng version
   ```

For later releases, increase the version again, rebuild, and repeat the publish steps. Do not run `npm publish` from the repository root; the root package is the private workspace, not the library package.

## Features

- Element bounds, margin, padding, gap, and computed-style inspection
- Typography annotations
- Horizontal and vertical alignment guides
- Pixel-distance measurement
- Guide undo and redo
- Optional browser persistence
- Angular SSR-safe browser checks

## License

MIT

Inspired by [mesurer](https://github.com/ibelick/mesurer) by [ibelick](https://github.com/ibelick).
