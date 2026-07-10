import { loadRemoteModule } from '@angular-architects/native-federation';
import { InspectorCheckpointRegistry } from 'inspector-ng';

export type CheckpointAdapterRegistrar = (
  registry: InspectorCheckpointRegistry
) => void;

export type RemoteModuleLoader = (
  remoteName: string,
  exposedModule: string
) => Promise<{ registerInspectorCheckpointAdapters: CheckpointAdapterRegistrar }>;

/**
 * Maps remote federation scopes to their checkpoint adapter registration entry.
 * The shell always injects its own InspectorCheckpointRegistry instance.
 */
const REMOTE_EXPOSED_MODULE = './CheckpointAdapters';

const REMOTE_SCOPES = ['workflow', 'summary'] as const;

const defaultLoader: RemoteModuleLoader = (remoteName, exposedModule) =>
  loadRemoteModule(remoteName, exposedModule) as Promise<{
    registerInspectorCheckpointAdapters: CheckpointAdapterRegistrar;
  }>;

let moduleLoader: RemoteModuleLoader = defaultLoader;
const loadedScopes = new Set<string>();

/** Test-only: swap the federation loader. Pass null to restore the default. */
export function setRemoteModuleLoaderForTests(
  loader: RemoteModuleLoader | null
): void {
  moduleLoader = loader ?? defaultLoader;
}

/**
 * Loads and registers checkpoint adapters for the given remote scopes.
 * Safe to call multiple times; already-loaded scopes are skipped.
 */
export async function loadRemoteCheckpointAdapters(
  registry: InspectorCheckpointRegistry,
  scopes: string[]
): Promise<void> {
  const unique = [...new Set(scopes.filter(Boolean))];

  for (const scope of unique) {
    if (!REMOTE_SCOPES.includes(scope as (typeof REMOTE_SCOPES)[number])) {
      continue;
    }

    if (loadedScopes.has(scope)) {
      continue;
    }

    const remoteModule = await moduleLoader(scope, REMOTE_EXPOSED_MODULE);
    remoteModule.registerInspectorCheckpointAdapters(registry);
    loadedScopes.add(scope);
  }
}

/** Test helper: resets the in-memory loaded-scope cache. */
export function resetRemoteCheckpointBridgeCache(): void {
  loadedScopes.clear();
}

export function getRemoteCheckpointBridgeScopes(): string[] {
  return [...REMOTE_SCOPES];
}
