import { ApplicationConfig } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideInspectorCheckpoints } from 'inspector-ng';

import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [provideRouter(routes), provideInspectorCheckpoints()]
};
