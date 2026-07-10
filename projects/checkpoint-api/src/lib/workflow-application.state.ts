import { BehaviorSubject } from 'rxjs';

/** Namespaced adapter id registered by workflow (and observed by summary). */
export const WORKFLOW_APPLICATION_CHECKPOINT_ID = 'workflow:application';

export interface WorkflowApplicationState {
  customerName: string;
  accountType: string;
  amount: number | null;
  acceptedTerms: boolean;
}

export const EMPTY_WORKFLOW_APPLICATION: WorkflowApplicationState = {
  customerName: '',
  accountType: '',
  amount: null,
  acceptedTerms: false,
};

/**
 * Shared application state for the federation demo.
 * Host and remotes must import this module so Native Federation shares one instance.
 */
export const workflowApplicationSubject =
  new BehaviorSubject<WorkflowApplicationState>({
    ...EMPTY_WORKFLOW_APPLICATION,
  });

export function isWorkflowApplicationEmpty(
  state: WorkflowApplicationState
): boolean {
  return (
    state.customerName === '' &&
    state.accountType === '' &&
    state.amount === null &&
    state.acceptedTerms === false
  );
}
