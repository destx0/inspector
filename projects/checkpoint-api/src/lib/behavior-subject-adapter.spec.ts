import { BehaviorSubject } from 'rxjs';
import { createBehaviorSubjectCheckpointAdapter } from './behavior-subject-adapter';
import { WORKFLOW_APPLICATION_CHECKPOINT_ID } from './workflow-application.state';

describe('createBehaviorSubjectCheckpointAdapter', () => {
  it('uses namespaced adapter ids', () => {
    const subject = new BehaviorSubject({ value: 1 });
    const adapter = createBehaviorSubjectCheckpointAdapter(
      WORKFLOW_APPLICATION_CHECKPOINT_ID,
      subject
    );

    expect(adapter.id).toBe('workflow:application');
    expect(adapter.id.includes(':')).toBeTrue();
    expect(adapter.id.startsWith('workflow:')).toBeTrue();
  });

  it('captures and restores subject values', () => {
    const subject = new BehaviorSubject({ name: 'Ada', amount: 10 });
    const adapter = createBehaviorSubjectCheckpointAdapter(
      'workflow:application',
      subject
    );

    const captured = adapter.capture();
    subject.next({ name: 'Grace', amount: 99 });
    adapter.restore(captured);

    expect(subject.getValue()).toEqual({ name: 'Ada', amount: 10 });
  });
});
