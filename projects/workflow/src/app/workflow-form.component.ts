import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import {
  WorkflowApplicationState,
  workflowApplicationSubject,
} from '@inspector-ng/checkpoints';

@Component({
  selector: 'app-workflow-form',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <section class="page">
      <h1>Customer application</h1>
      <p class="hint">Two-step form · state id <code>workflow:application</code></p>

      @if (step === 1) {
        <fieldset>
          <legend>Step 1 · Customer</legend>
          <label>
            Customer name
            <input
              name="customerName"
              [(ngModel)]="model.customerName"
              data-testid="customer-name"
              (ngModelChange)="persist()"
            />
          </label>
          <label>
            Account type
            <select
              name="accountType"
              [(ngModel)]="model.accountType"
              data-testid="account-type"
              (ngModelChange)="persist()"
            >
              <option value="">Select…</option>
              <option value="checking">Checking</option>
              <option value="savings">Savings</option>
              <option value="business">Business</option>
            </select>
          </label>
          <button type="button" data-testid="step-next" (click)="step = 2">
            Next
          </button>
        </fieldset>
      } @else {
        <fieldset>
          <legend>Step 2 · Amount &amp; terms</legend>
          <label>
            Amount
            <input
              type="number"
              name="amount"
              [(ngModel)]="model.amount"
              data-testid="amount"
              (ngModelChange)="persist()"
            />
          </label>
          <label class="row">
            <input
              type="checkbox"
              name="acceptedTerms"
              [(ngModel)]="model.acceptedTerms"
              data-testid="accepted-terms"
              (ngModelChange)="persist()"
            />
            I accept the terms
          </label>
          <div class="actions">
            <button type="button" (click)="step = 1">Back</button>
            <button
              type="button"
              data-testid="goto-summary"
              (click)="goToSummary()"
            >
              Continue to summary
            </button>
          </div>
        </fieldset>
      }

      <p>
        <a routerLink="/summary">Open summary</a>
      </p>
    </section>
  `,
  styles: [
    `
      .page {
        max-width: 480px;
        font: 15px/1.5 system-ui, sans-serif;
      }
      .hint {
        color: #555;
      }
      fieldset {
        border: 1px solid #ccc;
        border-radius: 6px;
        padding: 12px;
        display: grid;
        gap: 10px;
      }
      label {
        display: grid;
        gap: 4px;
      }
      label.row {
        grid-template-columns: auto 1fr;
        align-items: center;
        gap: 8px;
      }
      input,
      select {
        padding: 6px 8px;
        border: 1px solid #bbb;
        border-radius: 4px;
      }
      .actions {
        display: flex;
        gap: 8px;
      }
      button {
        padding: 6px 12px;
        cursor: pointer;
      }
      code {
        font-size: 12px;
      }
    `,
  ],
})
export class WorkflowFormComponent {
  private readonly router = inject(Router);

  step: 1 | 2 = 1;
  model: WorkflowApplicationState = {
    ...workflowApplicationSubject.getValue(),
  };

  persist(): void {
    const rawAmount = this.model.amount;
    const amount =
      rawAmount === null || rawAmount === undefined || (rawAmount as unknown) === ''
        ? null
        : Number(rawAmount);

    workflowApplicationSubject.next({
      customerName: this.model.customerName ?? '',
      accountType: this.model.accountType ?? '',
      amount: amount !== null && Number.isFinite(amount) ? amount : null,
      acceptedTerms: !!this.model.acceptedTerms,
    });
  }

  goToSummary(): void {
    this.persist();
    void this.router.navigateByUrl('/summary');
  }
}
