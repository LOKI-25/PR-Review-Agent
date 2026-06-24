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
    <div class="page">
      <div class="card">
        <div class="badge">Multi-agent pipeline</div>
        <h1>AI PR Reviewer</h1>
        <p class="subtitle">
          Security, quality, and logic agents analyze your pull request — then a human approves before it ships.
        </p>

        <form (submit)="onSubmit($event)">
          <label for="prUrl">GitHub pull request URL</label>
          <input
            id="prUrl"
            type="url"
            [(ngModel)]="prUrl"
            name="prUrl"
            placeholder="https://github.com/owner/repo/pull/123"
            required
            [disabled]="loading"
          />
          <button type="submit" [disabled]="!prUrl || loading">
            <span class="btn-spinner" *ngIf="loading"></span>
            {{ loading ? 'Starting pipeline...' : 'Start review' }}
          </button>
        </form>

        <div *ngIf="error" class="error">{{ error }}</div>

        <ul class="features">
          <li>Parallel AI agents</li>
          <li>GitHub comment draft</li>
          <li>Email approval flow</li>
        </ul>
      </div>
    </div>
  `,
  styles: [`
    .page {
      min-height: 100%;
      display: grid;
      place-items: center;
      padding: 3rem 1.5rem;
      background:
        radial-gradient(circle at top right, rgba(99, 102, 241, 0.12), transparent 45%),
        radial-gradient(circle at bottom left, rgba(14, 165, 233, 0.1), transparent 40%);
    }
    .card {
      width: min(520px, 100%);
      background: #fff;
      border: 1px solid #e2e8f0;
      border-radius: 20px;
      padding: 2rem;
      box-shadow: 0 24px 48px rgba(15, 23, 42, 0.08);
    }
    .badge {
      display: inline-block;
      font-size: 0.72rem;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: #6366f1;
      background: #eef2ff;
      padding: 0.3rem 0.6rem;
      border-radius: 999px;
      margin-bottom: 0.75rem;
    }
    h1 {
      margin: 0 0 0.5rem;
      font-size: 1.85rem;
      letter-spacing: -0.02em;
    }
    .subtitle {
      margin: 0 0 1.5rem;
      color: #64748b;
      line-height: 1.5;
    }
    label {
      display: block;
      font-size: 0.82rem;
      font-weight: 600;
      margin-bottom: 0.4rem;
      color: #334155;
    }
    input {
      width: 100%;
      padding: 0.85rem 1rem;
      margin-bottom: 1rem;
      border: 1px solid #cbd5e1;
      border-radius: 10px;
      font-size: 0.95rem;
      transition: border-color 0.2s, box-shadow 0.2s;
    }
    input:focus {
      outline: none;
      border-color: #6366f1;
      box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.15);
    }
    button {
      width: 100%;
      padding: 0.9rem 1.25rem;
      background: linear-gradient(135deg, #4f46e5, #6366f1);
      color: white;
      border: none;
      border-radius: 10px;
      cursor: pointer;
      font-size: 1rem;
      font-weight: 600;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      transition: transform 0.15s, opacity 0.15s;
    }
    button:hover:not(:disabled) { transform: translateY(-1px); }
    button:disabled { opacity: 0.65; cursor: not-allowed; }
    .btn-spinner {
      width: 16px;
      height: 16px;
      border: 2px solid rgba(255,255,255,0.35);
      border-top-color: white;
      border-radius: 50%;
      animation: spin 0.7s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    .error {
      margin-top: 1rem;
      padding: 0.75rem 1rem;
      background: #fef2f2;
      color: #b91c1c;
      border-radius: 8px;
      font-size: 0.9rem;
      font-weight: 500;
    }
    .features {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
      list-style: none;
      margin: 1.5rem 0 0;
      padding: 0;
    }
    .features li {
      font-size: 0.78rem;
      color: #475569;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      padding: 0.35rem 0.65rem;
      border-radius: 999px;
    }
    @media (max-width: 768px) {
      .page {
        padding: 1.25rem 1rem;
        align-items: stretch;
      }
      .card {
        padding: 1.35rem 1.15rem;
        border-radius: 16px;
      }
      h1 {
        font-size: 1.5rem;
      }
      .subtitle {
        font-size: 0.92rem;
      }
      input {
        font-size: 16px;
      }
    }
  `],
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
      error: () => {
        this.error = 'Failed to start review. Check the API URL and try again.';
        this.loading = false;
      },
    });
  }
}
