import { Component, signal } from "@angular/core";
import { inspectorComponent } from "inspector-ng";
import { TextPressureComponent } from "./text-pressure.component";

@Component({
  selector: "app-root",
  standalone: true,
  imports: [inspectorComponent, TextPressureComponent],
  templateUrl: "./app.component.html",
  styleUrl: "./app.component.css",
})
export class AppComponent {
  copiedId = signal<string | null>(null);

  copy(text: string, id: string) {
    navigator.clipboard.writeText(text).then(() => {
      this.copiedId.set(id);
      setTimeout(() => this.copiedId.set(null), 1500);
    });
  }

  installCmd = `npm install inspector-ng`;

  tsCode = `import { Component } from '@angular/core';
import { inspectorComponent } from 'inspector-ng';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [inspectorComponent],
  templateUrl: './app.component.html',
})
export class AppComponent {}`;

  htmlCode = `<inspector-overlay
  [persistOnReload]="true"
  [hoverHighlightEnabled]="true"
></inspector-overlay>`;
}
