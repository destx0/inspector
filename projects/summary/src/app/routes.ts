import { Routes } from '@angular/router';
import { SummaryViewComponent } from './summary-view.component';

/** Exposed to the shell for lazy Native Federation routing. */
export const SUMMARY_ROUTES: Routes = [
  { path: '', component: SummaryViewComponent },
];
