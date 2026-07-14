import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Store } from '@ngrx/store';
import {
  workflowActions,
  workflowFeature,
} from '@inspector-ng/federation-demo-state';

@Component({
  selector: 'app-workflow-form',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <section class="page">
      <h1>Customer application</h1>
      <p class="hint">Two-step form · NgRx feature <code>workflow</code></p>

      @if (state().step === 1) {
        <fieldset>
          <legend>Step 1 · Customer</legend>
          <label>
            Customer name
            <input
              name="customerName"
              [ngModel]="state().customerName"
              (ngModelChange)="changeCustomerName($event)"
              data-testid="customer-name"
            />
          </label>
          <label>
            Account type
            <select
              name="accountType"
              [ngModel]="state().accountType"
              (ngModelChange)="changeAccountType($event)"
              data-testid="account-type"
            >
              <option value="">Select…</option>
              <option value="checking">Checking</option>
              <option value="savings">Savings</option>
              <option value="business">Business</option>
            </select>
          </label>
          <button type="button" data-testid="step-next" (click)="changeStep(2)">Next</button>
        </fieldset>
      } @else {
        <fieldset>
          <legend>Step 2 · Amount &amp; terms</legend>
          <label>
            Amount
            <input
              type="number"
              name="amount"
              [ngModel]="state().amount"
              (ngModelChange)="changeAmount($event)"
              data-testid="amount"
            />
          </label>
          <label class="row">
            <input
              type="checkbox"
              name="acceptedTerms"
              [ngModel]="state().acceptedTerms"
              (ngModelChange)="changeAcceptedTerms($event)"
              data-testid="accepted-terms"
            />
            I accept the terms
          </label>
          <div class="actions">
            <button type="button" (click)="changeStep(1)">Back</button>
            <button type="button" data-testid="goto-summary" (click)="goToSummary()">
              Continue to summary
            </button>
          </div>
        </fieldset>
      }

      <p><a routerLink="/summary">Open summary</a></p>
    </section>
  `,
  styles: [
    `
      .page { max-width: 480px; font: 15px/1.5 system-ui, sans-serif; }
      .hint { color: #555; }
      fieldset { border: 1px solid #ccc; border-radius: 6px; padding: 12px; display: grid; gap: 10px; }
      label { display: grid; gap: 4px; }
      label.row { grid-template-columns: auto 1fr; align-items: center; gap: 8px; }
      input, select { padding: 6px 8px; border: 1px solid #bbb; border-radius: 4px; }
      .actions { display: flex; gap: 8px; }
      button { padding: 6px 12px; cursor: pointer; }
      code { font-size: 12px; }
    `,
  ],
})
export class WorkflowFormComponent {
  private readonly router = inject(Router);
  private readonly store = inject(Store);
  readonly state = this.store.selectSignal(workflowFeature.selectWorkflowState);

  changeStep(step: 1 | 2): void {
    this.store.dispatch(workflowActions.stepChanged({ step }));
  }

  changeCustomerName(customerName: string): void {
    this.store.dispatch(workflowActions.customerNameChanged({ customerName: customerName ?? '' }));
  }

  changeAccountType(accountType: string): void {
    this.store.dispatch(workflowActions.accountTypeChanged({ accountType: accountType ?? '' }));
  }

  changeAmount(rawAmount: number | string | null): void {
    const parsed = rawAmount === null || rawAmount === '' ? null : Number(rawAmount);
    this.store.dispatch(workflowActions.amountChanged({
      amount: parsed !== null && Number.isFinite(parsed) ? parsed : null,
    }));
  }

  changeAcceptedTerms(acceptedTerms: boolean): void {
    this.store.dispatch(workflowActions.acceptedTermsChanged({ acceptedTerms: !!acceptedTerms }));
  }

  goToSummary(): void {
    void this.router.navigateByUrl('/summary');
  }
}
