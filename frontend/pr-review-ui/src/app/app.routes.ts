import { Routes } from '@angular/router';
import { SubmitComponent } from './submit.component';
import { ReviewComponent } from './review.component';

export const routes: Routes = [
  { path: '', redirectTo: 'submit', pathMatch: 'full' },
  { path: 'submit', component: SubmitComponent },
  { path: 'review/:runId', component: ReviewComponent },
  { path: '**', redirectTo: 'submit' } // Catch-all fallback
];