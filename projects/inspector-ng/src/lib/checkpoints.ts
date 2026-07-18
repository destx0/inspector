import {
  EnvironmentProviders,
  Inject,
  Injectable,
  InjectionToken,
  Optional,
  PLATFORM_ID,
  makeEnvironmentProviders,
  signal,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import {
  Action,
  ActionReducer,
  META_REDUCERS,
  Store,
} from '@ngrx/store';
import { firstValueFrom, take } from 'rxjs';

export interface InspectorCheckpointRecord {
  version: 1;
  id: string;
  name: string;
  route: string;
  createdAt: string;
  lastUsedAt?: string;
  state: unknown;
}

interface RestoreCheckpointAction extends Action {
  type: typeof RESTORE_CHECKPOINT;
  state: unknown;
}

const RESTORE_CHECKPOINT = '[Inspector Checkpoints] Restore';
const DATABASE_NAME = 'inspector-ng';
const DATABASE_VERSION = 1;
const STORE_NAME = 'checkpoints';
const RESTORE_SETTLE_DELAY_MS = 100;

export const INSPECTOR_CHECKPOINT_REPOSITORY =
  new InjectionToken<InspectorCheckpointRepository>('INSPECTOR_CHECKPOINT_REPOSITORY');

export function inspectorCheckpointMetaReducer<T>(
  reducer: ActionReducer<T>,
): ActionReducer<T> {
  return (state, action) => {
    if (action.type === RESTORE_CHECKPOINT) {
      return (action as RestoreCheckpointAction).state as T;
    }
    return reducer(state, action);
  };
}

export abstract class InspectorCheckpointRepository {
  abstract list(): Promise<InspectorCheckpointRecord[]>;
  abstract put(checkpoint: InspectorCheckpointRecord): Promise<void>;
  abstract delete(id: string): Promise<void>;
}

@Injectable()
export class IndexedDbCheckpointRepository extends InspectorCheckpointRepository {
  private databasePromise: Promise<IDBDatabase> | null = null;

  constructor(@Inject(PLATFORM_ID) private readonly platformId: object) {
    super();
  }

  async list(): Promise<InspectorCheckpointRecord[]> {
    const database = await this.database();
    const values = await this.request<unknown[]>(
      database.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).getAll(),
    );
    return values
      .filter(isCheckpointRecord)
      .sort(recentActivityFirst);
  }

  async put(checkpoint: InspectorCheckpointRecord): Promise<void> {
    const database = await this.database();
    await this.transactionComplete(database, 'readwrite', (store) => store.put(checkpoint));
  }

  async delete(id: string): Promise<void> {
    const database = await this.database();
    await this.transactionComplete(database, 'readwrite', (store) => store.delete(id));
  }

  private database(): Promise<IDBDatabase> {
    if (!isPlatformBrowser(this.platformId) || typeof indexedDB === 'undefined') {
      return Promise.reject(new Error('Checkpoints are only available in a browser with IndexedDB.'));
    }
    if (this.databasePromise) return this.databasePromise;

    let rejected = false;
    const databasePromise = new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
      request.onupgradeneeded = () => {
        const database = request.result;
        if (database.objectStoreNames.contains(STORE_NAME)) return;
        const store = database.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('createdAt', 'createdAt');
      };
      request.onsuccess = () => {
        if (rejected) {
          request.result.close();
          return;
        }
        request.result.onversionchange = () => request.result.close();
        resolve(request.result);
      };
      request.onerror = () => {
        rejected = true;
        reject(request.error ?? new Error('IndexedDB could not be opened.'));
      };
      request.onblocked = () => {
        rejected = true;
        reject(new Error('IndexedDB is blocked by another open tab.'));
      };
    });
    this.databasePromise = databasePromise;
    void databasePromise.catch(() => {
      if (this.databasePromise === databasePromise) {
        this.databasePromise = null;
      }
    });
    return databasePromise;
  }

  private request<T>(request: IDBRequest<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed.'));
    });
  }

  private transactionComplete(
    database: IDBDatabase,
    mode: IDBTransactionMode,
    operation: (store: IDBObjectStore) => IDBRequest,
  ): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, mode);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB transaction failed.'));
      transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB transaction was aborted.'));
      operation(transaction.objectStore(STORE_NAME));
    });
  }
}

@Injectable()
export class InspectorCheckpointService {
  readonly checkpoints = signal<InspectorCheckpointRecord[]>([]);
  readonly loading = signal(false);
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);

  constructor(
    @Inject(INSPECTOR_CHECKPOINT_REPOSITORY)
    private readonly repository: InspectorCheckpointRepository,
    @Optional() @Inject(Store) private readonly store: Store | null,
    @Optional() @Inject(Router) private readonly router: Router | null,
    @Inject(PLATFORM_ID) private readonly platformId: object,
  ) {}

  async load(): Promise<void> {
    this.error.set(null);
    this.loading.set(true);
    try {
      this.checkpoints.set((await this.repository.list()).sort(recentActivityFirst));
    } catch (error) {
      this.error.set(this.messageFor(error, 'Saved checkpoints could not be loaded. Try reloading the page.'));
    } finally {
      this.loading.set(false);
    }
  }

  async save(): Promise<InspectorCheckpointRecord | null> {
    this.error.set(null);
    if (!this.store) {
      this.error.set(this.missingStoreMessage());
      return null;
    }

    this.busy.set(true);
    try {
      const currentState = await firstValueFrom(this.store.pipe(take(1)));
      const state = cloneJson(currentState);
      const persisted = await this.repository.list();
      const route = this.currentRoute();
      const pathname = this.currentPathname();
      const checkpoint: InspectorCheckpointRecord = {
        version: 1,
        id: createCheckpointId(),
        name: nextAutomaticName(pathname, persisted.map(({ name }) => name)),
        route,
        createdAt: new Date().toISOString(),
        state,
      };
      await this.repository.put(checkpoint);
      this.checkpoints.set([checkpoint, ...persisted].sort(recentActivityFirst));
      return checkpoint;
    } catch (error) {
      this.error.set(this.storageMessage(error, 'The checkpoint could not be saved.'));
      return null;
    } finally {
      this.busy.set(false);
    }
  }

  async restore(id: string): Promise<boolean> {
    this.error.set(null);
    if (!this.store) {
      this.error.set(this.missingStoreMessage());
      return false;
    }
    this.busy.set(true);
    try {
      const checkpoints = await this.repository.list();
      const checkpoint = checkpoints.find((item) => item.id === id);
      if (!checkpoint) throw new Error('Checkpoint not found. It may have been deleted in another tab.');
      const state = cloneJson(
        checkpoint.state,
        `“${checkpoint.name}” could not be decoded. Delete it and save a new checkpoint.`,
      );
      this.restoreState(state);
      if (
        this.router &&
        this.router.url !== checkpoint.route &&
        !await this.router.navigateByUrl(checkpoint.route)
      ) {
        throw new Error(`The state was restored, but navigation to “${checkpoint.route}” was cancelled.`);
      }
      await delay(RESTORE_SETTLE_DELAY_MS);
      this.restoreState(state);
      const recentlyUsedCheckpoint = {
        ...checkpoint,
        lastUsedAt: new Date().toISOString(),
      };
      await this.repository.put(recentlyUsedCheckpoint);
      this.checkpoints.set(
        checkpoints
          .map((item) => item.id === id ? recentlyUsedCheckpoint : item)
          .sort(recentActivityFirst),
      );
      return true;
    } catch (error) {
      this.error.set(this.messageFor(error, 'The checkpoint could not be restored. Delete it and save a new one.'));
      return false;
    } finally {
      this.busy.set(false);
    }
  }

  async rename(id: string, name: string): Promise<boolean> {
    this.error.set(null);
    const nextName = name.trim();
    if (!nextName) {
      this.error.set('Please enter a checkpoint name.');
      return false;
    }

    this.busy.set(true);
    try {
      const checkpoints = await this.repository.list();
      if (checkpoints.some((item) => item.id !== id && item.name.toLocaleLowerCase() === nextName.toLocaleLowerCase())) {
        throw new Error(`A checkpoint named “${nextName}” already exists. Choose a different name.`);
      }
      const checkpoint = checkpoints.find((item) => item.id === id);
      if (!checkpoint) throw new Error('Checkpoint not found. It may have been deleted in another tab.');
      await this.repository.put({ ...checkpoint, name: nextName });
      this.checkpoints.set(
        checkpoints.map((item) => item.id === id ? { ...item, name: nextName } : item).sort(recentActivityFirst),
      );
      return true;
    } catch (error) {
      this.error.set(this.storageMessage(error, 'The checkpoint could not be renamed.'));
      return false;
    } finally {
      this.busy.set(false);
    }
  }

  async delete(id: string): Promise<boolean> {
    this.error.set(null);
    this.busy.set(true);
    try {
      await this.repository.delete(id);
      this.checkpoints.set(this.checkpoints().filter((item) => item.id !== id));
      return true;
    } catch (error) {
      this.error.set(this.storageMessage(error, 'The checkpoint could not be deleted.'));
      return false;
    } finally {
      this.busy.set(false);
    }
  }

  clearError(): void {
    this.error.set(null);
  }

  private restoreState(state: unknown): void {
    this.store?.dispatch({ type: RESTORE_CHECKPOINT, state } as RestoreCheckpointAction);
  }

  private currentRoute(): string {
    if (!isPlatformBrowser(this.platformId)) return '/';
    return `${this.currentPathname()}${window.location.search}${window.location.hash}`;
  }

  private currentPathname(): string {
    if (!isPlatformBrowser(this.platformId)) return '/';
    return window.location.pathname || '/';
  }

  private missingStoreMessage(): string {
    return 'The NgRx root store is unavailable. Check that provideInspectorCheckpoints() is registered after provideStore().';
  }

  private storageMessage(error: unknown, fallback: string): string {
    if (isQuotaError(error)) {
      return 'Browser storage is full. Delete old checkpoints, then try saving again.';
    }
    return this.messageFor(error, fallback);
  }

  private messageFor(error: unknown, fallback: string): string {
    return error instanceof Error && error.message ? error.message : fallback;
  }
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export function provideInspectorCheckpoints(): EnvironmentProviders {
  return makeEnvironmentProviders([
    IndexedDbCheckpointRepository,
    {
      provide: INSPECTOR_CHECKPOINT_REPOSITORY,
      useExisting: IndexedDbCheckpointRepository,
    },
    InspectorCheckpointService,
    {
      provide: META_REDUCERS,
      multi: true,
      useValue: inspectorCheckpointMetaReducer,
    },
  ]);
}

export function nextAutomaticName(route: string, names: string[]): string {
  const used = new Set(names.map((name) => name.toLocaleLowerCase()));
  if (!used.has(route.toLocaleLowerCase())) return route;
  for (let suffix = 2; ; suffix += 1) {
    const candidate = `${route} ${suffix}`;
    if (!used.has(candidate.toLocaleLowerCase())) return candidate;
  }
}

function cloneJson(
  value: unknown,
  failureMessage = 'The NgRx root state is not JSON-serializable. Remove circular or unsupported values and try again.',
): unknown {
  try {
    const serialized = JSON.stringify(value);
    if (serialized === undefined) throw new Error();
    return JSON.parse(serialized) as unknown;
  } catch {
    throw new Error(failureMessage);
  }
}

function createCheckpointId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `checkpoint-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function isQuotaError(error: unknown): boolean {
  return error instanceof DOMException && (
    error.name === 'QuotaExceededError' || error.name === 'NS_ERROR_DOM_QUOTA_REACHED'
  );
}

export function checkpointActivityAt(checkpoint: InspectorCheckpointRecord): string {
  return checkpoint.lastUsedAt && checkpoint.lastUsedAt > checkpoint.createdAt
    ? checkpoint.lastUsedAt
    : checkpoint.createdAt;
}

export function recentActivityFirst(
  a: InspectorCheckpointRecord,
  b: InspectorCheckpointRecord,
): number {
  return checkpointActivityAt(b).localeCompare(checkpointActivityAt(a)) ||
    b.createdAt.localeCompare(a.createdAt) ||
    b.id.localeCompare(a.id);
}

function isCheckpointRecord(value: unknown): value is InspectorCheckpointRecord {
  if (!value || typeof value !== 'object') return false;
  const checkpoint = value as Partial<InspectorCheckpointRecord>;
  return checkpoint.version === 1 &&
    typeof checkpoint.id === 'string' &&
    typeof checkpoint.name === 'string' &&
    typeof checkpoint.route === 'string' &&
    typeof checkpoint.createdAt === 'string' &&
    (checkpoint.lastUsedAt === undefined || typeof checkpoint.lastUsedAt === 'string') &&
    'state' in checkpoint;
}
