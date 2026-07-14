import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { inspectorComponent } from 'inspector-ng';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, inspectorComponent],
  template: `
    <header class="shell-header">
      <strong>Inspector federation demo</strong>
      <nav>
        <a routerLink="/" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }">Home</a>
        <a routerLink="/workflow" routerLinkActive="active">Workflow</a>
        <a routerLink="/summary" routerLinkActive="active">Summary</a>
      </nav>
    </header>

    <main class="shell-main"><router-outlet /></main>
    <inspector-overlay [persistOnReload]="true" />
  `,
  styles: [
    `
      :host { display: block; min-height: 100vh; font-family: system-ui, sans-serif; }
      .shell-header { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 12px 16px; border-bottom: 1px solid #ddd; background: #f8f8f8; }
      nav { display: flex; gap: 12px; }
      nav a { color: #0645ad; text-decoration: none; }
      nav a.active { font-weight: 700; text-decoration: underline; }
      .shell-main { padding: 16px; }
    `,
  ],
})
export class AppComponent {}
