import { Router } from '@angular/router';
import { BehaviorSubject } from 'rxjs';

import {
  InspectorCheckpointRegistry,
  createBehaviorSubjectCheckpointAdapter,
} from './checkpoints';

describe('InspectorCheckpointRegistry', () => {
  let router: jasmine.SpyObj<Router>;
  let registry: InspectorCheckpointRegistry;

  beforeEach(() => {
    window.localStorage.clear();
    router = jasmine.createSpyObj<Router>('Router', ['navigateByUrl'], { url: '/summary?view=full' });
    router.navigateByUrl.and.resolveTo(true);
    registry = new InspectorCheckpointRegistry('browser' as unknown as object, router);
  });

  function registryFor(url: string): InspectorCheckpointRegistry {
    const routeRouter = jasmine.createSpyObj<Router>('Router', ['navigateByUrl'], { url });
    routeRouter.navigateByUrl.and.resolveTo(true);
    return new InspectorCheckpointRegistry('browser' as unknown as object, routeRouter);
  }

  it('uses the route path without its query as the automatic name', async () => {
    expect((await registry.save())?.name).toBe('/summary');
  });

  it('allocates sequential automatic names for repeated saves', async () => {
    await registry.save();
    await registry.save();
    await registry.save();

    expect(registry.checkpoints().map(({ name }) => name)).toEqual([
      '/summary 3', '/summary 2', '/summary',
    ]);
  });

  it('fills the next available numeric name without colliding with custom names', async () => {
    await registry.save('/summary');
    await registry.save('/summary 3');

    expect((await registry.save())?.name).toBe('/summary 2');
  });

  it('uses slash for the root route', async () => {
    expect((await registryFor('/?view=full#details').save())?.name).toBe('/');
  });

  it('excludes both hashes and queries from automatic names', async () => {
    expect((await registryFor('/orders/42?tab=all#details').save())?.name).toBe('/orders/42');
  });

  it('keeps explicitly supplied names and manual renames', async () => {
    const checkpoint = await registry.save('Summary ready');
    expect(checkpoint?.name).toBe('Summary ready');

    registry.rename(checkpoint!.id, 'Reviewed summary');
    expect(registry.checkpoints()[0].name).toBe('Reviewed summary');
  });

  it('normalizes legacy automatic names oldest-first and persists them', () => {
    const oldestAt = '2024-01-01T10:00:00.000Z';
    const newestAt = '2024-01-02T10:00:00.000Z';
    const legacy = (id: string, createdAt: string) => ({
      version: 1 as const,
      id,
      name: `/summary · ${new Date(createdAt).toLocaleString()}`,
      url: '/summary?view=full',
      createdAt,
      scopes: [],
      state: {},
      sizeBytes: 100,
    });
    window.localStorage.setItem('inspector-checkpoints-v1', JSON.stringify([
      legacy('newest', newestAt),
      { ...legacy('custom', '2024-01-03T10:00:00.000Z'), name: 'Release candidate' },
      legacy('oldest', oldestAt),
    ]));

    const hydrated = registryFor('/');

    expect(hydrated.checkpoints().map(({ name }) => name)).toEqual([
      'Release candidate', '/summary 2', '/summary',
    ]);
    const persisted = JSON.parse(window.localStorage.getItem('inspector-checkpoints-v1')!);
    expect(persisted.map(({ name }: { name: string }) => name)).toEqual([
      'Release candidate', '/summary 2', '/summary',
    ]);
  });

  it('requires namespaced adapter IDs', () => {
    expect(() => registry.register({
      id: 'application',
      capture: () => null,
      restore: () => undefined,
    })).toThrowError(/namespaced/);
  });

  it('allows a remote bridge to register an adapter repeatedly', () => {
    const adapter = {
      id: 'workflow:application',
      capture: () => null,
      restore: () => undefined,
    };
    registry.register(adapter);

    expect(() => registry.register(adapter)).not.toThrow();
  });

  it('restores state before navigating', async () => {
    const order: string[] = [];
    registry.register({
      id: 'workflow:application',
      capture: () => ({ customerName: 'Ada' }),
      restore: () => {
        order.push('restore');
      },
    });
    router.navigateByUrl.and.callFake(async () => {
      order.push('navigate');
      return true;
    });

    const checkpoint = await registry.save('Summary ready');
    await registry.restore(checkpoint!.id);

    expect(order).toEqual(['restore', 'navigate']);
    expect(router.navigateByUrl).toHaveBeenCalledWith('/summary?view=full');
  });

  it('loads a remote scope before restoring its adapter', async () => {
    const state = new BehaviorSubject({ customerName: 'Before' });
    registry.register(createBehaviorSubjectCheckpointAdapter('workflow:application', state));
    const checkpoint = await registry.save();
    state.next({ customerName: 'Changed' });

    const unregister = registry.register({
      id: 'summary:filters',
      capture: () => ({ compact: false }),
      restore: () => undefined,
    });
    state.next({ customerName: 'Before' });
    const withSummary = await registry.save();
    state.next({ customerName: 'Changed' });
    unregister();
    let loaderCalled = false;
    registry.registerRemoteScope('summary', () => {
      loaderCalled = true;
      registry.register({
        id: 'summary:filters',
        capture: () => ({ compact: false }),
        restore: () => undefined,
      });
    });

    await registry.restore(withSummary!.id);

    expect(checkpoint).not.toBeNull();
    expect(loaderCalled).toBeTrue();
    expect(state.value).toEqual({ customerName: 'Before' });
  });

  it('persists BehaviorSubject values through the helper', async () => {
    const state = new BehaviorSubject({ amount: 2500, acceptedTerms: true });
    registry.register(createBehaviorSubjectCheckpointAdapter('workflow:application', state));

    const checkpoint = await registry.save();
    state.next({ amount: 0, acceptedTerms: false });
    await registry.restore(checkpoint!.id);

    expect(state.value).toEqual({ amount: 2500, acceptedTerms: true });
  });

  it('skips unavailable adapters and reports a warning', async () => {
    const unregister = registry.register({
      id: 'workflow:application',
      capture: () => ({ customerName: 'Ada' }),
      restore: () => undefined,
    });
    const checkpoint = await registry.save();
    unregister();

    await registry.restore(checkpoint!.id);

    expect(registry.warning()).toContain('workflow:application');
    expect(router.navigateByUrl).toHaveBeenCalled();
  });

  it('evicts the oldest checkpoint when storage is full', async () => {
    registry.register({
      id: 'workflow:application',
      capture: () => ({ customerName: 'Ada' }),
      restore: () => undefined,
    });
    const first = await registry.save('First');
    const realSetItem = window.localStorage.setItem.bind(window.localStorage);
    spyOn(window.localStorage, 'setItem').and.callFake((key: string, value: string) => {
      if (JSON.parse(value).length > 1) {
        throw new DOMException('Storage full', 'QuotaExceededError');
      }
      realSetItem(key, value);
    });

    const second = await registry.save('Second');

    expect(registry.checkpoints().map((checkpoint) => checkpoint.id)).toEqual([second!.id]);
    expect(registry.checkpoints().map((checkpoint) => checkpoint.id)).not.toContain(first!.id);
    expect(registry.warning()).toContain('oldest checkpoint');
  });
});
