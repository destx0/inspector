import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import {
  createBehaviorSubjectCheckpointAdapter,
  InspectorCheckpointRegistry,
  provideInspectorCheckpoints,
} from 'inspector-ng';
import {
  EMPTY_WORKFLOW_APPLICATION,
  WORKFLOW_APPLICATION_CHECKPOINT_ID,
  WorkflowApplicationState,
  workflowApplicationSubject,
} from '@inspector-ng/checkpoints';

@Component({ standalone: true, template: 'summary' })
class SummaryStubComponent {}

describe('checkpoint restore → summary values', () => {
  beforeEach(() => {
    localStorage.clear();
    workflowApplicationSubject.next({ ...EMPTY_WORKFLOW_APPLICATION });
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'summary', component: SummaryStubComponent },
          { path: 'workflow', component: SummaryStubComponent },
        ]),
        provideInspectorCheckpoints(),
      ],
    });
  });

  it('loads the remote, restores state, then navigates', async () => {
    const registry = TestBed.inject(InspectorCheckpointRegistry);
    const router = TestBed.inject(Router);
    const order: string[] = [];
    const saved: WorkflowApplicationState = {
      customerName: 'Grace Hopper',
      accountType: 'checking',
      amount: 2500,
      acceptedTerms: true,
    };

    await router.navigateByUrl('/summary');
    workflowApplicationSubject.next(saved);
    const workflowAdapter = createBehaviorSubjectCheckpointAdapter(
      WORKFLOW_APPLICATION_CHECKPOINT_ID,
      workflowApplicationSubject,
    );
    registry.register({
      ...workflowAdapter,
      restore: (value) => {
        order.push('restore-state');
        return workflowAdapter.restore(value);
      },
    });
    registry.registerRemoteScope('workflow', () => {
      order.push('load:workflow');
    });
    const checkpoint = await registry.save('happy path');

    workflowApplicationSubject.next({ ...EMPTY_WORKFLOW_APPLICATION });
    spyOn(router, 'navigateByUrl').and.callFake(async (url) => {
      order.push(`navigate:${url}`);
      return true;
    });
    await registry.restore(checkpoint!.id);

    expect(order).toEqual([
      'load:workflow',
      'restore-state',
      'navigate:/summary',
    ]);
    expect(workflowApplicationSubject.value).toEqual(saved);
  });

  it('keeps adapter ids namespaced under workflow:application', () => {
    const subject = new BehaviorSubject({ x: 1 });
    const adapter = createBehaviorSubjectCheckpointAdapter(
      WORKFLOW_APPLICATION_CHECKPOINT_ID,
      subject,
    );
    expect(adapter.id).toBe('workflow:application');
  });
});
