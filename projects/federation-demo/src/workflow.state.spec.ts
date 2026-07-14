import { workflowActions, workflowFeature } from './workflow.state';

describe('workflow NgRx feature', () => {
  it('updates every serializable workflow field and resets', () => {
    let state = workflowFeature.reducer(undefined, { type: '@@init' });
    state = workflowFeature.reducer(state, workflowActions.stepChanged({ step: 2 }));
    state = workflowFeature.reducer(state, workflowActions.customerNameChanged({ customerName: 'Ada' }));
    state = workflowFeature.reducer(state, workflowActions.accountTypeChanged({ accountType: 'business' }));
    state = workflowFeature.reducer(state, workflowActions.amountChanged({ amount: 1200 }));
    state = workflowFeature.reducer(state, workflowActions.acceptedTermsChanged({ acceptedTerms: true }));

    expect(state).toEqual({
      step: 2,
      customerName: 'Ada',
      accountType: 'business',
      amount: 1200,
      acceptedTerms: true,
    });
    expect(workflowFeature.reducer(state, workflowActions.resetRequested())).toEqual({
      step: 1,
      customerName: '',
      accountType: '',
      amount: null,
      acceptedTerms: false,
    });
  });
});
