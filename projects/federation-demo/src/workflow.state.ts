import { createActionGroup, createFeature, createReducer, emptyProps, on, props } from '@ngrx/store';

export interface WorkflowApplicationState {
  step: 1 | 2;
  customerName: string;
  accountType: string;
  amount: number | null;
  acceptedTerms: boolean;
}

export const EMPTY_WORKFLOW_APPLICATION: WorkflowApplicationState = {
  step: 1,
  customerName: '',
  accountType: '',
  amount: null,
  acceptedTerms: false,
};

export const workflowActions = createActionGroup({
  source: 'Workflow form',
  events: {
    'Step changed': props<{ step: 1 | 2 }>(),
    'Customer name changed': props<{ customerName: string }>(),
    'Account type changed': props<{ accountType: string }>(),
    'Amount changed': props<{ amount: number | null }>(),
    'Accepted terms changed': props<{ acceptedTerms: boolean }>(),
    'Reset requested': emptyProps(),
  },
});

const workflowReducer = createReducer(
  EMPTY_WORKFLOW_APPLICATION,
  on(workflowActions.stepChanged, (state, { step }) => ({ ...state, step })),
  on(workflowActions.customerNameChanged, (state, { customerName }) => ({ ...state, customerName })),
  on(workflowActions.accountTypeChanged, (state, { accountType }) => ({ ...state, accountType })),
  on(workflowActions.amountChanged, (state, { amount }) => ({ ...state, amount })),
  on(workflowActions.acceptedTermsChanged, (state, { acceptedTerms }) => ({ ...state, acceptedTerms })),
  on(workflowActions.resetRequested, () => EMPTY_WORKFLOW_APPLICATION),
);

export const workflowFeature = createFeature({
  name: 'workflow',
  reducer: workflowReducer,
});

export function isWorkflowApplicationEmpty(state: WorkflowApplicationState): boolean {
  return state.customerName === '' &&
    state.accountType === '' &&
    state.amount === null &&
    state.acceptedTerms === false;
}
