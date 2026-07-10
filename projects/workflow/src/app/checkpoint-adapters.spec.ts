import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import {
  InspectorCheckpointRegistry,
  provideInspectorCheckpoints,
} from 'inspector-ng';
import {
  WORKFLOW_APPLICATION_CHECKPOINT_ID,
  workflowApplicationSubject,
  EMPTY_WORKFLOW_APPLICATION,
} from '@inspector-ng/checkpoints';
import { registerInspectorCheckpointAdapters } from './checkpoint-adapters';

describe('workflow registerInspectorCheckpointAdapters', () => {
  beforeEach(() => {
    localStorage.clear();
    workflowApplicationSubject.next({ ...EMPTY_WORKFLOW_APPLICATION });
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideInspectorCheckpoints()],
    });
  });

  it('registers a namespaced workflow:application adapter', async () => {
    const registry = TestBed.inject(InspectorCheckpointRegistry);
    registerInspectorCheckpointAdapters(registry);

    workflowApplicationSubject.next({
      customerName: 'Test',
      accountType: 'checking',
      amount: 50,
      acceptedTerms: true,
    });

    const checkpoint = await registry.save();
    expect(checkpoint?.scopes).toContain('workflow');
    expect(checkpoint?.state[WORKFLOW_APPLICATION_CHECKPOINT_ID]).toEqual({
      customerName: 'Test',
      accountType: 'checking',
      amount: 50,
      acceptedTerms: true,
    });
  });
});
