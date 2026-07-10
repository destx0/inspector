import { Inject, Injectable, InjectionToken, Optional } from '@angular/core';
import { InspectorCheckpointRegistry } from './registry';
import { CheckpointSnapshot } from './types';

export const INSPECTOR_CHECKPOINT_STORAGE_KEY = new InjectionToken<string>(
  'INSPECTOR_CHECKPOINT_STORAGE_KEY'
);

export const DEFAULT_CHECKPOINT_STORAGE_KEY = 'inspector-ng.checkpoints';

export interface CheckpointRestoreHooks {
  /**
   * Load and register adapters for every remote scope referenced by the snapshot.
   * Must complete before state is restored.
   */
  loadRemoteScopes: (scopes: string[]) => Promise<void>;
  /**
   * Navigate to the snapshot URL after state has been restored.
   */
  navigate: (url: string) => Promise<boolean | void> | boolean | void;
}

@Injectable()
export class InspectorCheckpointService {
  private readonly storageKey: string;

  constructor(
    private readonly registry: InspectorCheckpointRegistry,
    @Optional()
    @Inject(INSPECTOR_CHECKPOINT_STORAGE_KEY)
    storageKey?: string | null
  ) {
    this.storageKey = storageKey ?? DEFAULT_CHECKPOINT_STORAGE_KEY;
  }

  getRegistry(): InspectorCheckpointRegistry {
    return this.registry;
  }

  list(): CheckpointSnapshot[] {
    return this.readStorage();
  }

  save(name: string, url: string, extraScopes: string[] = []): CheckpointSnapshot {
    const states = this.registry.captureAll();
    const scopes = new Set<string>([
      ...this.registry.getRemoteScopes(),
      ...extraScopes,
      ...scopesFromAdapterIds(Object.keys(states)),
      ...scopesFromUrl(url),
    ]);

    const snapshot: CheckpointSnapshot = {
      id: createCheckpointId(),
      name: name.trim() || `Checkpoint ${new Date().toLocaleString()}`,
      createdAt: new Date().toISOString(),
      url,
      remoteScopes: [...scopes],
      states,
    };

    const all = this.readStorage();
    all.unshift(snapshot);
    this.writeStorage(all);
    return snapshot;
  }

  delete(id: string): void {
    this.writeStorage(this.readStorage().filter((s) => s.id !== id));
  }

  getById(id: string): CheckpointSnapshot | undefined {
    return this.readStorage().find((s) => s.id === id);
  }

  /**
   * Restore order (required by the federation demo):
   * 1) load remote adapters for every scope in the snapshot
   * 2) restore adapter state
   * 3) navigate to the saved URL
   */
  async restore(
    snapshotOrId: CheckpointSnapshot | string,
    hooks: CheckpointRestoreHooks
  ): Promise<CheckpointSnapshot> {
    const snapshot =
      typeof snapshotOrId === 'string'
        ? this.getById(snapshotOrId)
        : snapshotOrId;

    if (!snapshot) {
      throw new Error(`Checkpoint not found: ${String(snapshotOrId)}`);
    }

    await hooks.loadRemoteScopes(snapshot.remoteScopes);
    this.registry.restoreAll(snapshot.states);
    await hooks.navigate(snapshot.url);
    return snapshot;
  }

  private readStorage(): CheckpointSnapshot[] {
    if (typeof localStorage === 'undefined') {
      return [];
    }
    try {
      const raw = localStorage.getItem(this.storageKey);
      if (!raw) {
        return [];
      }
      const parsed = JSON.parse(raw) as CheckpointSnapshot[];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  private writeStorage(snapshots: CheckpointSnapshot[]): void {
    if (typeof localStorage === 'undefined') {
      return;
    }
    localStorage.setItem(this.storageKey, JSON.stringify(snapshots));
  }
}

function createCheckpointId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `cp_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function scopesFromAdapterIds(ids: string[]): string[] {
  const scopes = new Set<string>();
  for (const id of ids) {
    const scope = id.split(':')[0];
    if (scope) {
      scopes.add(scope);
    }
  }
  return [...scopes];
}

export function scopesFromUrl(url: string): string[] {
  const path = url.split('?')[0].split('#')[0];
  if (path.startsWith('/workflow')) {
    return ['workflow'];
  }
  if (path.startsWith('/summary')) {
    return ['summary', 'workflow'];
  }
  return [];
}
