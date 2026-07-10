import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterLink],
  template: `
    <section class="page">
      <h1>inspector-ng checkpoint federation demo</h1>
      <p>
        Shell hosts checkpoints. Workflow and summary remotes register adapters
        against the shell registry.
      </p>
      <ol>
        <li>Open <a routerLink="/workflow">/workflow</a> and complete the form.</li>
        <li>Continue to <a routerLink="/summary">/summary</a>.</li>
        <li>Save a checkpoint from the inspector toolbar (bottom-right).</li>
        <li>Change values or refresh, then restore the checkpoint.</li>
        <li>Confirm navigation to /summary with the original form values.</li>
      </ol>
    </section>
  `,
  styles: [
    `
      .page {
        max-width: 640px;
        font: 15px/1.5 system-ui, sans-serif;
      }
      ol {
        padding-left: 1.2rem;
      }
    `,
  ],
})
export class HomeComponent {}
