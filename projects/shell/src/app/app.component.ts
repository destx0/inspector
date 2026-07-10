import { Component, OnInit, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import {
  InspectorCheckpointRegistry,
  inspectorComponent,
} from 'inspector-ng';
import { loadRemoteCheckpointAdapters } from './remote-checkpoint-bridge';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, inspectorComponent],
  template: `
    <header class="shell-header">
      <strong>Checkpoint shell</strong>
      <nav>
        <a routerLink="/" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }"
          >Home</a
        >
        <a routerLink="/workflow" routerLinkActive="active">Workflow</a>
        <a routerLink="/summary" routerLinkActive="active">Summary</a>
      </nav>
    </header>

    <main class="shell-main">
      <router-outlet />
    </main>

    <inspector-overlay
      [persistOnReload]="true"
    />
  `,
  styles: [
    `
      :host {
        display: block;
        min-height: 100vh;
        font-family: system-ui, sans-serif;
      }
      .shell-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        padding: 12px 16px;
        border-bottom: 1px solid #ddd;
        background: #f8f8f8;
      }
      nav {
        display: flex;
        gap: 12px;
      }
      nav a {
        color: #0645ad;
        text-decoration: none;
      }
      nav a.active {
        font-weight: 700;
        text-decoration: underline;
      }
      .shell-main {
        padding: 16px;
      }
    `,
  ],
})
export class AppComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly registry = inject(InspectorCheckpointRegistry);

  ngOnInit(): void {
    this.registry.registerRemoteScope('workflow', () =>
      loadRemoteCheckpointAdapters(this.registry, ['workflow'])
    );
    this.registry.registerRemoteScope('summary', () =>
      loadRemoteCheckpointAdapters(this.registry, ['summary'])
    );

    // Eagerly register adapters when navigating into remotes so save works
    // even before an explicit restore.
    this.router.events.subscribe(() => {
      void this.ensureAdaptersForCurrentUrl();
    });
  }

  private async ensureAdaptersForCurrentUrl(): Promise<void> {
    const url = this.router.url;
    const scopes: string[] = [];
    if (url.startsWith('/workflow')) {
      scopes.push('workflow');
    }
    if (url.startsWith('/summary')) {
      scopes.push('summary', 'workflow');
    }
    if (scopes.length) {
      await loadRemoteCheckpointAdapters(this.registry, scopes);
    }
  }
}
