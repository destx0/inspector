import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { Action, Store, provideStore } from '@ngrx/store';
import { firstValueFrom, take } from 'rxjs';

import {
  INSPECTOR_CHECKPOINT_REPOSITORY,
  IndexedDbCheckpointRepository,
  InspectorCheckpointRecord,
  InspectorCheckpointRepository,
  InspectorCheckpointService,
  inspectorCheckpointMetaReducer,
  nextAutomaticName,
  provideInspectorCheckpoints,
} from './checkpoints';

interface TestState {
  count: number;
  value?: unknown;
}

class MemoryCheckpointRepository extends InspectorCheckpointRepository {
  records: InspectorCheckpointRecord[] = [];
  failure: Error | null = null;

  async list(): Promise<InspectorCheckpointRecord[]> {
    if (this.failure) throw this.failure;
    return structuredClone(this.records);
  }

  async put(checkpoint: InspectorCheckpointRecord): Promise<void> {
    if (this.failure) throw this.failure;
    this.records = [checkpoint, ...this.records.filter(({ id }) => id !== checkpoint.id)];
  }

  async delete(id: string): Promise<void> {
    if (this.failure) throw this.failure;
    this.records = this.records.filter((checkpoint) => checkpoint.id !== id);
  }
}

function reducer(state: TestState = { count: 0 }, action: Action & { value?: unknown }): TestState {
  if (action.type === 'increment') return { ...state, count: state.count + 1 };
  if (action.type === 'set-value') return { ...state, value: action.value };
  return state;
}

describe('NgRx checkpoints', () => {
  let repository: MemoryCheckpointRepository;
  let service: InspectorCheckpointService;
  let store: Store<{ test: TestState }>;
  let router: jasmine.SpyObj<Router>;

  beforeEach(() => {
    repository = new MemoryCheckpointRepository();
    router = jasmine.createSpyObj<Router>('Router', ['navigateByUrl']);
    router.navigateByUrl.and.resolveTo(true);
    TestBed.configureTestingModule({
      providers: [
        provideStore({ test: reducer }),
        provideInspectorCheckpoints(),
        { provide: INSPECTOR_CHECKPOINT_REPOSITORY, useValue: repository },
        { provide: Router, useValue: router },
      ],
    });
    service = TestBed.inject(InspectorCheckpointService);
    store = TestBed.inject(Store);
  });

  it('captures JSON state and restores it through the root meta-reducer', async () => {
    store.dispatch({ type: 'increment' });
    const checkpoint = await service.save();
    store.dispatch({ type: 'increment' });

    expect((await firstValueFrom(store.pipe(take(1)))).test.count).toBe(2);
    expect(await service.restore(checkpoint!.id)).toBeTrue();
    expect((await firstValueFrom(store.pipe(take(1)))).test.count).toBe(1);
    expect(router.navigateByUrl).toHaveBeenCalledWith(checkpoint!.route);
  });

  it('navigates to the saved route after restoring the root state', async () => {
    repository.records = [{
      version: 1,
      id: 'summary',
      name: '/summary',
      route: '/summary?mode=review#details',
      createdAt: '2026-01-01T00:00:00.000Z',
      state: { test: { count: 7 } },
    }];

    expect(await service.restore('summary')).toBeTrue();
    expect((await firstValueFrom(store.pipe(take(1)))).test.count).toBe(7);
    expect(router.navigateByUrl).toHaveBeenCalledWith('/summary?mode=review#details');
  });

  it('rejects a root state that cannot be JSON serialized', async () => {
    const circular: { self?: unknown } = {};
    circular.self = circular;
    store.dispatch({ type: 'set-value', value: circular });

    expect(await service.save()).toBeNull();
    expect(service.error()).toContain('not JSON-serializable');
    expect(repository.records).toEqual([]);
  });

  it('renames uniquely and deletes without changing other records', async () => {
    const first = await service.save();
    const second = await service.save();

    expect(await service.rename(first!.id, 'Ready')).toBeTrue();
    expect(await service.rename(second!.id, 'ready')).toBeFalse();
    expect(service.error()).toContain('already exists');
    expect(await service.delete(first!.id)).toBeTrue();
    expect(repository.records.map(({ id }) => id)).toEqual([second!.id]);
  });

  it('reports repository failures without deleting existing data', async () => {
    repository.records = [{
      version: 1,
      id: 'kept',
      name: '/kept',
      route: '/kept',
      createdAt: '2026-01-01T00:00:00.000Z',
      state: { count: 1 },
    }];
    repository.failure = new Error('database unavailable');

    expect(await service.save()).toBeNull();
    expect(service.error()).toContain('database unavailable');
    expect(repository.records.length).toBe(1);
  });

  it('reports quota failures without evicting existing records', async () => {
    repository.records = [{
      version: 1,
      id: 'kept',
      name: '/kept',
      route: '/kept',
      createdAt: '2026-01-01T00:00:00.000Z',
      state: { count: 1 },
    }];
    repository.failure = new DOMException('full', 'QuotaExceededError');

    expect(await service.save()).toBeNull();
    expect(service.error()).toContain('Browser storage is full');
    expect(repository.records.map(({ id }) => id)).toEqual(['kept']);
  });

  it('loads records by their most recent save or restore activity', async () => {
    repository.records = [
      { version: 1, id: 'old', name: 'Old', route: '/', createdAt: '2026-01-01T00:00:00.000Z', lastUsedAt: '2026-01-03T00:00:00.000Z', state: {} },
      { version: 1, id: 'new', name: 'New', route: '/', createdAt: '2026-01-02T00:00:00.000Z', state: {} },
    ];

    await service.load();
    expect(service.checkpoints().map(({ id }) => id)).toEqual(['old', 'new']);
  });

  it('records a successful restore as the latest activity', async () => {
    repository.records = [
      { version: 1, id: 'older', name: 'Older', route: '/', createdAt: '2026-01-01T00:00:00.000Z', state: {} },
      { version: 1, id: 'newer', name: 'Newer', route: '/', createdAt: '2026-01-02T00:00:00.000Z', state: {} },
    ];

    await service.load();
    expect(await service.restore('older')).toBeTrue();

    expect(service.checkpoints().map(({ id }) => id)).toEqual(['older', 'newer']);
    expect(repository.records.find(({ id }) => id === 'older')?.lastUsedAt).toBeDefined();
  });
});

describe('checkpoint helpers', () => {
  it('allocates the first free route-based name case-insensitively', () => {
    expect(nextAutomaticName('/summary', ['/SUMMARY', '/summary 3'])).toBe('/summary 2');
  });

  it('replaces state only for the Inspector restore action', () => {
    const base = jasmine.createSpy('base').and.returnValue({ count: 2 });
    const wrapped = inspectorCheckpointMetaReducer(base);

    expect(wrapped({ count: 1 }, { type: 'ordinary' })).toEqual({ count: 2 });
    expect(wrapped({ count: 1 }, {
      type: '[Inspector Checkpoints] Restore',
      state: { count: 9 },
    } as Action)).toEqual({ count: 9 });
  });
});

describe('checkpoint provider without a root Store', () => {
  it('reports the provider ordering problem instead of throwing during injection', async () => {
    TestBed.configureTestingModule({ providers: [provideInspectorCheckpoints()] });
    const service = TestBed.inject(InspectorCheckpointService);

    expect(await service.save()).toBeNull();
    expect(service.error()).toContain('registered after provideStore()');
  });
});

describe('IndexedDbCheckpointRepository', () => {
  it('persists, lists, and deletes version-one records', async () => {
    const repository = new IndexedDbCheckpointRepository('browser' as unknown as object);
    const record: InspectorCheckpointRecord = {
      version: 1,
      id: `spec-${Date.now()}-${Math.random()}`,
      name: 'IndexedDB spec',
      route: '/',
      createdAt: new Date().toISOString(),
      state: { count: 7 },
    };

    await repository.put(record);
    const reloadedRepository = new IndexedDbCheckpointRepository('browser' as unknown as object);
    expect((await reloadedRepository.list()).some(({ id }) => id === record.id)).toBeTrue();
    await repository.delete(record.id);
    expect((await repository.list()).some(({ id }) => id === record.id)).toBeFalse();
  });
});
