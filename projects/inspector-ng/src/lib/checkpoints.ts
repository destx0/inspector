import { Injectable, Inject, PLATFORM_ID, Provider, computed, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { BehaviorSubject } from 'rxjs';

export type InspectorCheckpointValue =
  | string
  | number
  | boolean
  | null
  | InspectorCheckpointValue[]
  | { [key: string]: InspectorCheckpointValue };

export interface InspectorCheckpointAdapter {
  id: string;
  capture(): InspectorCheckpointValue | Promise<InspectorCheckpointValue>;
  restore(value: InspectorCheckpointValue): void | Promise<void>;
}

export interface InspectorCheckpoint {
  version: 1;
  id: string;
  name: string;
  url: string;
  createdAt: string;
  scopes: string[];
  state: Record<string, InspectorCheckpointValue>;
  sizeBytes: number;
}

export type InspectorCheckpointRemoteLoader = () => void | Promise<void>;

const STORAGE_KEY = 'inspector-checkpoints-v1';

@Injectable()
export class InspectorCheckpointRegistry {
  readonly checkpoints = signal<InspectorCheckpoint[]>([]);
  readonly isBusy = signal(false);
  readonly error = signal<string | null>(null);
  readonly warning = signal<string | null>(null);
  readonly totalBytes = computed(() =>
    this.checkpoints().reduce((total, checkpoint) => total + checkpoint.sizeBytes, 0),
  );

  private readonly adapters = new Map<string, InspectorCheckpointAdapter>();
  private readonly remoteLoaders = new Map<string, InspectorCheckpointRemoteLoader>();
  private readonly isBrowser: boolean;

  constructor(
    @Inject(PLATFORM_ID) platformId: object,
    @Inject(Router) private readonly router: Router,
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
    this.hydrate();
  }

  register(adapter: InspectorCheckpointAdapter): () => void {
    if (!adapter.id.includes(':')) {
      throw new Error('Checkpoint adapter IDs must be namespaced (for example, workflow:application).');
    }
    if (this.adapters.has(adapter.id)) {
      // Remote bridge loaders can run more than once across checkpoint restores.
      // Treat repeated registration as idempotent so a loaded remote stays usable.
      return () => undefined;
    }
    this.adapters.set(adapter.id, adapter);
    return () => this.adapters.delete(adapter.id);
  }

  registerRemoteScope(scope: string, loader: InspectorCheckpointRemoteLoader): () => void {
    this.remoteLoaders.set(scope, loader);
    return () => this.remoteLoaders.delete(scope);
  }

  async save(name?: string): Promise<InspectorCheckpoint | null> {
    this.error.set(null);
    if (!this.isBrowser) {
      this.error.set('Checkpoints are only available in a browser.');
      return null;
    }

    this.isBusy.set(true);
    try {
      const state: Record<string, InspectorCheckpointValue> = {};
      for (const adapter of this.adapters.values()) {
        state[adapter.id] = this.cloneValue(await adapter.capture(), adapter.id);
      }
      const createdAt = new Date().toISOString();
      const checkpoint: InspectorCheckpoint = {
        version: 1,
        id: this.createId(),
        name: name?.trim() || this.defaultName(createdAt),
        url: this.router.url,
        createdAt,
        scopes: this.getScopes(Object.keys(state)),
        state,
        sizeBytes: 0,
      };
      checkpoint.sizeBytes = this.sizeOf(checkpoint);
      this.persistWithEviction([checkpoint, ...this.checkpoints()]);
      return this.checkpoints().find((item) => item.id === checkpoint.id) ?? null;
    } catch (error) {
      this.error.set(this.messageFor(error, 'Unable to save checkpoint.'));
      return null;
    } finally {
      this.isBusy.set(false);
    }
  }

  async restore(id: string): Promise<boolean> {
    const checkpoint = this.checkpoints().find((item) => item.id === id);
    this.error.set(null);
    this.warning.set(null);
    if (!checkpoint) {
      this.error.set('Checkpoint not found.');
      return false;
    }

    this.isBusy.set(true);
    try {
      for (const scope of checkpoint.scopes) {
        const loader = this.remoteLoaders.get(scope);
        if (loader) {
          await loader();
        }
      }

      const missing: string[] = [];
      for (const [adapterId, value] of Object.entries(checkpoint.state)) {
        const adapter = this.adapters.get(adapterId);
        if (!adapter) {
          missing.push(adapterId);
          continue;
        }
        await adapter.restore(this.cloneValue(value, adapterId));
      }
      if (missing.length) {
        this.warning.set(`Skipped ${missing.length} unavailable adapter${missing.length === 1 ? '' : 's'}: ${missing.join(', ')}.`);
      }
      await this.router.navigateByUrl(checkpoint.url);
      return true;
    } catch (error) {
      this.error.set(this.messageFor(error, 'Unable to restore checkpoint.'));
      return false;
    } finally {
      this.isBusy.set(false);
    }
  }

  rename(id: string, name: string): void {
    const nextName = name.trim();
    if (!nextName) {
      this.error.set('A checkpoint name is required.');
      return;
    }
    this.error.set(null);
    const next = this.checkpoints().map((checkpoint) =>
      checkpoint.id === id ? { ...checkpoint, name: nextName } : checkpoint,
    );
    this.persistWithEviction(next);
  }

  delete(id: string): void {
    this.error.set(null);
    this.persistWithEviction(this.checkpoints().filter((checkpoint) => checkpoint.id !== id));
  }

  private hydrate(): void {
    if (!this.isBrowser) {
      return;
    }
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) return;
      this.checkpoints.set(parsed.filter(this.isCheckpoint).sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
    } catch {
      this.warning.set('Saved checkpoints could not be read and were ignored.');
    }
  }

  private persistWithEviction(checkpoints: InspectorCheckpoint[]): void {
    if (!this.isBrowser) return;
    let candidate = checkpoints;
    while (true) {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(candidate));
        this.checkpoints.set(candidate);
        return;
      } catch (error) {
        if (!this.isQuotaError(error) || candidate.length === 0) {
          throw error;
        }
        candidate = candidate.slice(0, -1);
        this.warning.set('Storage was full; the oldest checkpoint was removed.');
      }
    }
  }

  private cloneValue(value: unknown, adapterId: string): InspectorCheckpointValue {
    try {
      const serialized = JSON.stringify(value);
      if (serialized === undefined) throw new Error('undefined values are not supported');
      return JSON.parse(serialized) as InspectorCheckpointValue;
    } catch {
      throw new Error(`Adapter "${adapterId}" returned a value that cannot be JSON serialized.`);
    }
  }

  private getScopes(adapterIds: string[]): string[] {
    return [...new Set(adapterIds.map((id) => id.split(':', 1)[0]))];
  }

  private defaultName(createdAt: string): string {
    const route = this.router.url.split('?')[0].split('#')[0] || '/';
    return `${route} · ${new Date(createdAt).toLocaleString()}`;
  }

  private createId(): string {
    return `checkpoint-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }

  private sizeOf(checkpoint: InspectorCheckpoint): number {
    return new Blob([JSON.stringify(checkpoint)]).size;
  }

  private isQuotaError(error: unknown): boolean {
    return error instanceof DOMException && (
      error.name === 'QuotaExceededError' || error.name === 'NS_ERROR_DOM_QUOTA_REACHED'
    );
  }

  private messageFor(error: unknown, fallback: string): string {
    return error instanceof Error ? error.message : fallback;
  }

  private isCheckpoint = (value: unknown): value is InspectorCheckpoint => {
    if (!value || typeof value !== 'object') return false;
    const checkpoint = value as Partial<InspectorCheckpoint>;
    return checkpoint.version === 1 && typeof checkpoint.id === 'string' &&
      typeof checkpoint.name === 'string' && typeof checkpoint.url === 'string' &&
      typeof checkpoint.createdAt === 'string' && Array.isArray(checkpoint.scopes) &&
      !!checkpoint.state && typeof checkpoint.state === 'object' && typeof checkpoint.sizeBytes === 'number';
  };
}

export function provideInspectorCheckpoints(): Provider[] {
  return [InspectorCheckpointRegistry];
}

export function createBehaviorSubjectCheckpointAdapter<T>(
  id: string,
  subject: BehaviorSubject<T>,
): InspectorCheckpointAdapter {
  return {
    id,
    capture: () => subject.value as unknown as InspectorCheckpointValue,
    restore: (value) => subject.next(value as T),
  };
}
