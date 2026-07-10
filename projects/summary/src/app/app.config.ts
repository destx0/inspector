import { ApplicationConfig } from '@angular/core';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';

/** Remotes must not call provideInspectorCheckpoints(). */
export const appConfig: ApplicationConfig = {
  providers: [provideRouter(routes)],
};
