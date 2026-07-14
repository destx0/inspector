import { ApplicationConfig } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideStore } from '@ngrx/store';
import { provideStoreDevtools } from '@ngrx/store-devtools';
import { provideInspectorCheckpoints } from 'inspector-ng';

import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideStore(),
    provideInspectorCheckpoints(),
    provideStoreDevtools({
      name: 'inspector-ng demo',
      maxAge: 25,
      connectInZone: true,
      features: { export: true, import: true },
    }),
  ]
};
