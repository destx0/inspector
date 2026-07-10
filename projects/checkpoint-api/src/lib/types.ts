/**
 * Demo stand-in for the future inspector-ng checkpoint API surface.
 * Do not treat this package as the production library implementation.
 */

export interface CheckpointAdapter<T = unknown> {
  readonly id: string;
  capture(): T;
  restore(state: T): void;
}

export interface CheckpointSnapshot {
  id: string;
  name: string;
  createdAt: string;
  /** Router URL to restore after state is applied. */
  url: string;
  /** Remote federation scopes that must be loaded before restore. */
  remoteScopes: string[];
  /** Adapter id → captured state. */
  states: Record<string, unknown>;
}

export interface RegisterAdapterOptions {
  /** Remote scope that owns this adapter (e.g. "workflow"). */
  remoteScope?: string;
}

export interface ProvideInspectorCheckpointsConfig {
  /** localStorage key used when persistence is enabled. Default: inspector-ng.checkpoints */
  storageKey?: string;
}
