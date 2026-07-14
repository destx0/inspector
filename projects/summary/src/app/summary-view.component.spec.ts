import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Action, Store, provideState, provideStore } from '@ngrx/store';
import { provideInspectorCheckpoints } from 'inspector-ng';
import { workflowFeature } from '@inspector-ng/federation-demo-state';
import { SummaryViewComponent } from './summary-view.component';

describe('SummaryViewComponent', () => {
  let fixture: ComponentFixture<SummaryViewComponent>;
  let store: Store;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SummaryViewComponent],
      providers: [
        provideRouter([]),
        provideStore(),
        provideState(workflowFeature),
        provideInspectorCheckpoints(),
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(SummaryViewComponent);
    store = TestBed.inject(Store);
  });

  it('shows empty state when no workflow state exists', () => {
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-testid="summary-empty"]')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('[data-testid="summary-values"]')).toBeNull();
  });

  it('reacts to restored NgRx workflow values', () => {
    store.dispatch({
      type: '[Inspector Checkpoints] Restore',
      state: {
        workflow: {
          step: 2,
          customerName: 'Ada Lovelace',
          accountType: 'business',
          amount: 1200,
          acceptedTerms: true,
        },
      },
    } as Action);
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('[data-testid="summary-empty"]')).toBeNull();
    expect(el.querySelector('[data-testid="summary-customer-name"]')?.textContent).toContain('Ada Lovelace');
    expect(el.querySelector('[data-testid="summary-account-type"]')?.textContent).toContain('business');
    expect(el.querySelector('[data-testid="summary-amount"]')?.textContent).toContain('1200');
    expect(el.querySelector('[data-testid="summary-accepted-terms"]')?.textContent).toContain('true');
  });
});
