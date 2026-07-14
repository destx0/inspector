import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Store } from '@ngrx/store';
import {
  isWorkflowApplicationEmpty,
  workflowFeature,
} from '@inspector-ng/federation-demo-state';

@Component({
  selector: 'app-summary-view',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <section class="page">
      <h1>Application summary</h1>
      <p class="hint">Reads the shared NgRx <code>workflow</code> feature.</p>

      @if (isEmpty(state())) {
        <div class="empty" data-testid="summary-empty">
          <p>No workflow state yet.</p>
          <p>Complete the form under Workflow, or restore a checkpoint with Ctrl/Cmd+Shift+P.</p>
          <a routerLink="/workflow">Go to workflow</a>
        </div>
      } @else {
        <dl data-testid="summary-values">
          <div><dt>Customer name</dt><dd data-testid="summary-customer-name">{{ state().customerName }}</dd></div>
          <div><dt>Account type</dt><dd data-testid="summary-account-type">{{ state().accountType }}</dd></div>
          <div><dt>Amount</dt><dd data-testid="summary-amount">{{ state().amount }}</dd></div>
          <div><dt>Accepted terms</dt><dd data-testid="summary-accepted-terms">{{ state().acceptedTerms }}</dd></div>
        </dl>
      }
    </section>
  `,
  styles: [
    `
      .page { max-width: 480px; font: 15px/1.5 system-ui, sans-serif; }
      .hint { color: #555; }
      .empty { padding: 16px; border: 1px dashed #999; border-radius: 6px; background: #fafafa; }
      dl { display: grid; gap: 10px; margin: 0; }
      dl > div { display: grid; grid-template-columns: 140px 1fr; gap: 8px; padding: 8px 0; border-bottom: 1px solid #eee; }
      dt { color: #555; font-weight: 600; }
      dd { margin: 0; }
      code { font-size: 12px; }
    `,
  ],
})
export class SummaryViewComponent {
  private readonly store = inject(Store);
  readonly state = this.store.selectSignal(workflowFeature.selectWorkflowState);
  readonly isEmpty = isWorkflowApplicationEmpty;
}
