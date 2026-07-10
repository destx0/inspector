import { Injectable } from '@angular/core';
import {
  CheckpointAdapter,
  RegisterAdapterOptions,
} from './types';

/**
 * Host-owned registry of checkpoint adapters.
 * Remotes must never create their own instance; the shell passes this in.
 */
@Injectable()
export class InspectorCheckpointRegistry {
  private readonly adapters = new Map<string, CheckpointAdapter>();
  private readonly remoteScopes = new Set<string>();

  register(
    adapter: CheckpointAdapter,
    options?: RegisterAdapterOptions
  ): void {
    this.adapters.set(adapter.id, adapter);
    if (options?.remoteScope) {
      this.remoteScopes.add(options.remoteScope);
    } else {
      const inferred = adapter.id.split(':')[0];
      if (inferred) {
        this.remoteScopes.add(inferred);
      }
    }
  }

  has(id: string): boolean {
    return this.adapters.has(id);
  }

  get(id: string): CheckpointAdapter | undefined {
    return this.adapters.get(id);
  }

  getAdapterIds(): string[] {
    return [...this.adapters.keys()];
  }

  getRemoteScopes(): string[] {
    return [...this.remoteScopes];
  }

  markRemoteScope(scope: string): void {
    this.remoteScopes.add(scope);
  }

  captureAll(): Record<string, unknown> {
    const states: Record<string, unknown> = {};
    for (const [id, adapter] of this.adapters) {
      states[id] = adapter.capture();
    }
    return states;
  }

  restoreAll(states: Record<string, unknown>): void {
    for (const [id, state] of Object.entries(states)) {
      const adapter = this.adapters.get(id);
      if (adapter) {
        adapter.restore(state);
      }
    }
  }
}
