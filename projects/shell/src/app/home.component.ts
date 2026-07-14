import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterLink],
  template: `
    <section class="page">
      <h1>inspector-ng NgRx checkpoint demo</h1>
      <p>
        One shell-owned NgRx store flows through the workflow and summary remotes.
      </p>
      <ol>
        <li>Open <a routerLink="/workflow">/workflow</a> and complete the form.</li>
        <li>Continue to <a routerLink="/summary">/summary</a>.</li>
        <li>Open the Inspector command palette and choose Save.</li>
        <li>Change the values, then press <kbd>Ctrl/Cmd + Shift + P</kbd>.</li>
        <li>Fuzzy-search the saved name and press Enter to restore it.</li>
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
