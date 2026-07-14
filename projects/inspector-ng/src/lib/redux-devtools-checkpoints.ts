import type { InspectorCheckpointAdapter, InspectorCheckpointValue } from './checkpoints';

type DevToolsListener = (message: ReduxDevToolsMessage) => void;

interface ReduxDevToolsMessage {
  type: string;
  payload?: { type?: string };
  state?: string;
}

interface ReduxDevToolsConnection {
  init(state: unknown): void;
  send(action: unknown, state: unknown): void;
  subscribe(listener: DevToolsListener): (() => void) | void;
  unsubscribe?(): void;
  [key: string]: unknown;
}

interface ReduxDevToolsExtension {
  connect(options?: { name?: string; [key: string]: unknown }): ReduxDevToolsConnection;
  [key: string]: unknown;
}

interface TrackedStore {
  id: string;
  name: string;
  state?: InspectorCheckpointValue;
  listeners: Set<DevToolsListener>;
}

interface ReduxDevToolsCheckpointState {
  installed: boolean;
  stores: Map<string, TrackedStore>;
  nameCounts: Map<string, number>;
}

declare global {
  interface Window {
    __REDUX_DEVTOOLS_EXTENSION__?: ReduxDevToolsExtension;
    __INSPECTOR_REDUX_DEVTOOLS_CHECKPOINTS__?: ReduxDevToolsCheckpointState;
  }
}

function checkpointState(): ReduxDevToolsCheckpointState | null {
  if (typeof window === 'undefined') return null;
  return window.__INSPECTOR_REDUX_DEVTOOLS_CHECKPOINTS__ ??= {
    installed: false,
    stores: new Map(),
    nameCounts: new Map(),
  };
}

function serializable(value: unknown): InspectorCheckpointValue | undefined {
  try {
    const json = JSON.stringify(value);
    return json === undefined ? undefined : JSON.parse(json) as InspectorCheckpointValue;
  } catch {
    return undefined;
  }
}

/**
 * Installs the Redux DevTools connection hook. Call this before federation or
 * application bootstrap so connections created by every remote are observed.
 */
export function installInspectorReduxDevToolsHook(): boolean {
  const state = checkpointState();
  const extension = typeof window === 'undefined' ? undefined : window.__REDUX_DEVTOOLS_EXTENSION__;
  if (!state || !extension) return false;
  if (state.installed) return true;

  const originalConnect = extension.connect.bind(extension);
  extension.connect = (options = {}) => {
    const connection = originalConnect(options);
    const name = options.name?.trim() || 'Redux store';
    const occurrence = (state.nameCounts.get(name) ?? 0) + 1;
    state.nameCounts.set(name, occurrence);
    const id = occurrence === 1 ? name : `${name} #${occurrence}`;
    const tracked: TrackedStore = { id, name, listeners: new Set() };
    state.stores.set(id, tracked);

    const originalInit = connection.init.bind(connection);
    connection.init = (value: unknown) => {
      tracked.state = serializable(value);
      originalInit(value);
    };

    const originalSend = connection.send.bind(connection);
    connection.send = (action: unknown, value: unknown) => {
      tracked.state = serializable(value);
      originalSend(action, value);
    };

    const originalSubscribe = connection.subscribe.bind(connection);
    connection.subscribe = (listener: DevToolsListener) => {
      tracked.listeners.add(listener);
      const unsubscribe = originalSubscribe(listener);
      return () => {
        tracked.listeners.delete(listener);
        unsubscribe?.();
      };
    };

    if (connection.unsubscribe) {
      const originalUnsubscribe = connection.unsubscribe.bind(connection);
      connection.unsubscribe = () => {
        state.stores.delete(id);
        tracked.listeners.clear();
        originalUnsubscribe();
      };
    }

    return connection;
  };

  state.installed = true;
  return true;
}

/** One checkpoint adapter containing every Redux/NgRx DevTools store. */
export function createReduxDevToolsApplicationCheckpointAdapter(): InspectorCheckpointAdapter {
  return {
    id: 'application:redux-devtools',
    capture: () => {
      const state = checkpointState();
      const stores: Record<string, InspectorCheckpointValue> = {};
      for (const [id, store] of state?.stores ?? []) {
        if (store.state !== undefined) stores[id] = store.state;
      }
      return stores;
    },
    restore: (value) => {
      if (!value || Array.isArray(value) || typeof value !== 'object') return;
      const savedStores = value as Record<string, InspectorCheckpointValue>;
      const state = checkpointState();
      for (const [id, savedState] of Object.entries(savedStores)) {
        const store = state?.stores.get(id);
        if (!store) continue;
        store.state = serializable(savedState);
        const message: ReduxDevToolsMessage = {
          type: 'DISPATCH',
          payload: { type: 'JUMP_TO_STATE' },
          state: JSON.stringify(savedState),
        };
        for (const listener of store.listeners) listener(message);
      }
    },
  };
}
