import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Store, provideState, provideStore } from '@ngrx/store';
import { workflowActions, workflowFeature } from '@inspector-ng/federation-demo-state';

import { WorkflowFormComponent } from './workflow-form.component';

describe('WorkflowFormComponent', () => {
  it('dispatches typed NgRx actions for every workflow field', async () => {
    await TestBed.configureTestingModule({
      imports: [WorkflowFormComponent],
      providers: [provideRouter([]), provideStore(), provideState(workflowFeature)],
    }).compileComponents();
    const fixture = TestBed.createComponent(WorkflowFormComponent);
    const component = fixture.componentInstance;
    const dispatch = spyOn(TestBed.inject(Store), 'dispatch').and.callThrough();

    component.changeCustomerName('Ada');
    component.changeAccountType('business');
    component.changeStep(2);
    component.changeAmount('1200');
    component.changeAcceptedTerms(true);
    fixture.detectChanges();

    expect(dispatch).toHaveBeenCalledWith(workflowActions.customerNameChanged({ customerName: 'Ada' }));
    expect(dispatch).toHaveBeenCalledWith(workflowActions.accountTypeChanged({ accountType: 'business' }));
    expect(dispatch).toHaveBeenCalledWith(workflowActions.stepChanged({ step: 2 }));
    expect(dispatch).toHaveBeenCalledWith(workflowActions.amountChanged({ amount: 1200 }));
    expect(dispatch).toHaveBeenCalledWith(workflowActions.acceptedTermsChanged({ acceptedTerms: true }));
    expect(component.state()).toEqual({
      step: 2,
      customerName: 'Ada',
      accountType: 'business',
      amount: 1200,
      acceptedTerms: true,
    });
  });
});
