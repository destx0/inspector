import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import {
  EMPTY_WORKFLOW_APPLICATION,
  workflowApplicationSubject,
} from '@inspector-ng/checkpoints';
import { SummaryViewComponent } from './summary-view.component';

describe('SummaryViewComponent', () => {
  let fixture: ComponentFixture<SummaryViewComponent>;

  beforeEach(async () => {
    workflowApplicationSubject.next({ ...EMPTY_WORKFLOW_APPLICATION });
    await TestBed.configureTestingModule({
      imports: [SummaryViewComponent],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(SummaryViewComponent);
  });

  afterEach(() => {
    workflowApplicationSubject.next({ ...EMPTY_WORKFLOW_APPLICATION });
  });

  it('shows empty state when no workflow state exists', () => {
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('[data-testid="summary-empty"]')).toBeTruthy();
    expect(el.querySelector('[data-testid="summary-values"]')).toBeNull();
  });

  it('displays saved workflow values after checkpoint restore', () => {
    workflowApplicationSubject.next({
      customerName: 'Ada Lovelace',
      accountType: 'business',
      amount: 1200,
      acceptedTerms: true,
    });
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('[data-testid="summary-empty"]')).toBeNull();
    expect(
      el.querySelector('[data-testid="summary-customer-name"]')?.textContent
    ).toContain('Ada Lovelace');
    expect(
      el.querySelector('[data-testid="summary-account-type"]')?.textContent
    ).toContain('business');
    expect(
      el.querySelector('[data-testid="summary-amount"]')?.textContent
    ).toContain('1200');
    expect(
      el.querySelector('[data-testid="summary-accepted-terms"]')?.textContent
    ).toContain('true');
  });
});
