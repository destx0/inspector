import { InspectorCheckpointRegistry } from 'inspector-ng';
import {
  getRemoteCheckpointBridgeScopes,
  loadRemoteCheckpointAdapters,
  resetRemoteCheckpointBridgeCache,
  setRemoteModuleLoaderForTests,
} from './remote-checkpoint-bridge';

describe('remote checkpoint bridge', () => {
  beforeEach(() => {
    resetRemoteCheckpointBridgeCache();
    setRemoteModuleLoaderForTests(null);
  });

  afterEach(() => {
    resetRemoteCheckpointBridgeCache();
    setRemoteModuleLoaderForTests(null);
  });

  it('knows workflow and summary scopes', () => {
    expect(getRemoteCheckpointBridgeScopes()).toEqual(['workflow', 'summary']);
  });

  it('loads remote adapters before callers restore state', async () => {
    const registry = {} as InspectorCheckpointRegistry;
    const order: string[] = [];

    setRemoteModuleLoaderForTests(async (remote) => {
      order.push(`load:${remote}`);
      return {
        registerInspectorCheckpointAdapters: () => {
          order.push(`register:${remote}`);
        },
      };
    });

    await loadRemoteCheckpointAdapters(registry, ['workflow', 'summary']);

    // Restore is only allowed after adapters load.
    order.push('restore-state');

    expect(order).toEqual([
      'load:workflow',
      'register:workflow',
      'load:summary',
      'register:summary',
      'restore-state',
    ]);
  });
});
