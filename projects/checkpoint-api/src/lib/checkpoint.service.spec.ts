import { TestBed } from '@angular/core/testing';
import { BehaviorSubject } from 'rxjs';
import { createBehaviorSubjectCheckpointAdapter } from './behavior-subject-adapter';
import {
  INSPECTOR_CHECKPOINT_STORAGE_KEY,
  InspectorCheckpointService,
} from './checkpoint.service';
import { provideInspectorCheckpoints } from './provide-inspector-checkpoints';
import { InspectorCheckpointRegistry } from './registry';

describe('InspectorCheckpointService restore order', () => {
  const storageKey = 'test.inspector.checkpoints';

  beforeEach(() => {
    localStorage.removeItem(storageKey);
    TestBed.configureTestingModule({
      providers: [
        provideInspectorCheckpoints({ storageKey }),
        {
          provide: INSPECTOR_CHECKPOINT_STORAGE_KEY,
          useValue: storageKey,
        },
      ],
    });
  });

  afterEach(() => {
    localStorage.removeItem(storageKey);
  });

  it('loads remote adapters before restoring state, and restores state before navigation', async () => {
    const registry = TestBed.inject(InspectorCheckpointRegistry);
    const service = TestBed.inject(InspectorCheckpointService);

    const subject = new BehaviorSubject({ customerName: '' });
    const order: string[] = [];

    const snapshot = {
      id: 'cp-1',
      name: 'Demo',
      createdAt: new Date().toISOString(),
      url: '/summary',
      remoteScopes: ['workflow', 'summary'],
      states: {
        'workflow:application': { customerName: 'Ada Lovelace' },
      },
    };

    await service.restore(snapshot, {
      loadRemoteScopes: async (scopes) => {
        order.push(`load:${scopes.join(',')}`);
        expect(subject.getValue().customerName).toBe('');
        registry.register(
          createBehaviorSubjectCheckpointAdapter(
            'workflow:application',
            subject
          ),
          { remoteScope: 'workflow' }
        );
        order.push('adapters-registered');
      },
      navigate: (url) => {
        order.push(`navigate:${url}`);
        expect(subject.getValue().customerName).toBe('Ada Lovelace');
        return true;
      },
    });

    expect(order).toEqual([
      'load:workflow,summary',
      'adapters-registered',
      'navigate:/summary',
    ]);
    expect(subject.getValue().customerName).toBe('Ada Lovelace');
  });
});
