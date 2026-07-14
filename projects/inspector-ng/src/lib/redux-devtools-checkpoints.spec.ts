import {
  createReduxDevToolsApplicationCheckpointAdapter,
  installInspectorReduxDevToolsHook,
} from './redux-devtools-checkpoints';

describe('Redux DevTools application checkpoints', () => {
  let listeners: Array<(message: unknown) => void>;
  let connection: {
    init: jasmine.Spy;
    send: jasmine.Spy;
    subscribe: jasmine.Spy;
    unsubscribe: jasmine.Spy;
  };

  beforeEach(() => {
    listeners = [];
    connection = {
      init: jasmine.createSpy('init'),
      send: jasmine.createSpy('send'),
      subscribe: jasmine.createSpy('subscribe').and.callFake((listener) => {
        listeners.push(listener);
        return () => undefined;
      }),
      unsubscribe: jasmine.createSpy('unsubscribe'),
    };
    delete window.__INSPECTOR_REDUX_DEVTOOLS_CHECKPOINTS__;
    window.__REDUX_DEVTOOLS_EXTENSION__ = {
      connect: jasmine.createSpy('connect').and.returnValue(connection),
    };
  });

  afterEach(() => {
    delete window.__INSPECTOR_REDUX_DEVTOOLS_CHECKPOINTS__;
    delete window.__REDUX_DEVTOOLS_EXTENSION__;
  });

  it('captures all stores in one application adapter', async () => {
    expect(installInspectorReduxDevToolsHook()).toBeTrue();
    const workflow = window.__REDUX_DEVTOOLS_EXTENSION__!.connect({ name: 'workflow' });
    const payments = window.__REDUX_DEVTOOLS_EXTENSION__!.connect({ name: 'payments' });
    workflow.init({ step: 2 });
    payments.send({ type: 'UPDATED' }, { amount: 500 });

    const captured = await createReduxDevToolsApplicationCheckpointAdapter().capture();
    expect(captured as unknown).toEqual({
      workflow: { step: 2 },
      payments: { amount: 500 },
    });
  });

  it('restores a store through its existing DevTools subscriber', async () => {
    installInspectorReduxDevToolsHook();
    const store = window.__REDUX_DEVTOOLS_EXTENSION__!.connect({ name: 'workflow' });
    store.init({ step: 1 });
    const listener = jasmine.createSpy('listener');
    store.subscribe(listener);

    await createReduxDevToolsApplicationCheckpointAdapter().restore({
      workflow: { step: 4 },
    });

    expect(listener).toHaveBeenCalledWith({
      type: 'DISPATCH',
      payload: { type: 'JUMP_TO_STATE' },
      state: JSON.stringify({ step: 4 }),
    });
  });
});
