// Form page to submit a new PR review
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ApiService } from './api.service';
import { ExecutionsService } from './executions.service';

@Component({
  selector: 'app-submit',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="container">
      <h1>AI PR Reviewer</h1>
      <p>Enter a GitHub PR URL to start the multi-agent review process.</p>
      
      <form (submit)="onSubmit($event)">
        <input 
          type="url" 
          [(ngModel)]="prUrl" 
          name="prUrl" 
          placeholder="https://github.com/owner/repo/pull/123" 
          required
          [disabled]="loading"
        />
        <button type="submit" [disabled]="!prUrl || loading">
          {{ loading ? 'Initializing Agents...' : 'Review PR' }}
        </button>
      </form>

      <div *ngIf="error" class="error">{{ error }}</div>
    </div>
  `,
  styles: [`
    .container { max-width: 600px; margin: 4rem auto; padding: 2rem; font-family: sans-serif; text-align: center; }
    input { width: 100%; padding: 0.75rem; margin-bottom: 1rem; border: 1px solid #ccc; border-radius: 4px; font-size: 1rem; }
    button { padding: 0.75rem 1.5rem; background: #000; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 1rem; width: 100%; }
    button:disabled { background: #ccc; cursor: not-allowed; }
    .error { color: #dc3545; margin-top: 1rem; font-weight: bold; }
  `]
})
export class SubmitComponent {
  prUrl = '';
  loading = false;
  error = '';

  constructor(
    private apiService: ApiService,
    private router: Router,
    private executions: ExecutionsService,
  ) {}

  onSubmit(event: Event) {
    event.preventDefault();
    this.loading = true;
    this.error = '';

    this.apiService.submitReview(this.prUrl).subscribe({
      next: (res) => {
        this.executions.notifyRefresh();
        this.router.navigate(['/review', res.runId]);
      },
      error: (err: any) => {
        this.error = 'Failed to start review. Check the console.';
        this.loading = false;
      }
    });
  }
}