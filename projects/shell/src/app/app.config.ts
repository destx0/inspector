import { ApplicationConfig } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideState, provideStore } from '@ngrx/store';
import { provideStoreDevtools } from '@ngrx/store-devtools';
import { provideInspectorCheckpoints } from 'inspector-ng';
import { workflowFeature } from '@inspector-ng/federation-demo-state';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideStore(),
    provideState(workflowFeature),
    provideInspectorCheckpoints(),
    provideStoreDevtools({
      name: 'inspector-ng federation demo',
      maxAge: 25,
      connectInZone: true,
      features: { export: true, import: true },
    }),
  ],
};
