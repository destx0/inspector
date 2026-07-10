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
    const withSummary = await registry.save();
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
