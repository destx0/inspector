import { Routes } from '@angular/router';
import { WorkflowFormComponent } from './workflow-form.component';

/** Exposed to the shell for lazy Native Federation routing. */
export const WORKFLOW_ROUTES: Routes = [
  { path: '', component: WorkflowFormComponent },
];
