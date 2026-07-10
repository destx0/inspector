import { loadRemoteModule } from '@angular-architects/native-federation';
import { Routes } from '@angular/router';
import { HomeComponent } from './home.component';

export const routes: Routes = [
  { path: '', component: HomeComponent, pathMatch: 'full' },
  {
    path: 'workflow',
    loadChildren: () =>
      loadRemoteModule('workflow', './Routes').then(
        (m: { WORKFLOW_ROUTES: Routes }) => m.WORKFLOW_ROUTES
      ),
  },
  {
    path: 'summary',
    loadChildren: () =>
      loadRemoteModule('summary', './Routes').then(
        (m: { SUMMARY_ROUTES: Routes }) => m.SUMMARY_ROUTES
      ),
  },
  { path: '**', component: HomeComponent },
];
