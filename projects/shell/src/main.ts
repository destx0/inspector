import { initFederation } from '@angular-architects/native-federation';
import { installInspectorReduxDevToolsHook } from 'inspector-ng';

installInspectorReduxDevToolsHook();

initFederation('/assets/federation.manifest.json')
  .catch(err => console.error(err))
  .then(_ => import('./bootstrap'))
  .catch(err => console.error(err));
