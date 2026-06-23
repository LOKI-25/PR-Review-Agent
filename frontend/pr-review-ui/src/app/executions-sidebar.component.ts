import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { Subscription } from 'rxjs';
import { ApiService, RunSummary } from './api.service';
import { ExecutionsService } from './executions.service';

@Component({
  selector: 'app-executions-sidebar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  template: `
    <aside class="sidebar">
      <div class="sidebar-header">
        <h2>Executions</h2>
        <a routerLink="/submit" class="new-btn">+ New</a>
      </div>

      <p class="hint">All pipeline runs from DynamoDB</p>

      <div *ngIf="loading && !runs.length" class="loading">Loading...</div>
      <div *ngIf="error" class="error">{{ error }}</div>

      <ul class="run-list" *ngIf="runs.length">
        <li *ngFor="let run of runs">
          <a
            [routerLink]="['/review', run.runId]"
            routerLinkActive="active"
            class="run-item"
          >
            <span class="run-id">{{ run.runId }}</span>
            <span class="badge" [class]="run.status">{{ run.status }}</span>
            <span class="run-meta">{{ run.prUrl | slice:0:40 }}...</span>
            <span class="run-time">{{ run.createdAt | date:'short' }}</span>
          </a>
        </li>
      </ul>

      <p *ngIf="!loading && !runs.length && !error" class="empty">No runs yet</p>
    </aside>
  `,
  styles: [`
    .sidebar {
      width: 280px;
      min-width: 280px;
      height: 100vh;
      border-right: 1px solid #e2e8f0;
      background: #f8fafc;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      font-family: sans-serif;
    }
    .sidebar-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 1rem;
      border-bottom: 1px solid #e2e8f0;
    }
    .sidebar-header h2 { margin: 0; font-size: 1rem; }
    .new-btn {
      font-size: 0.8rem;
      padding: 0.35rem 0.6rem;
      background: #0f172a;
      color: white;
      text-decoration: none;
      border-radius: 4px;
    }
    .hint {
      margin: 0;
      padding: 0.5rem 1rem;
      font-size: 0.75rem;
      color: #64748b;
    }
    .run-list {
      list-style: none;
      margin: 0;
      padding: 0;
      overflow-y: auto;
      flex: 1;
    }
    .run-item {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
      padding: 0.75rem 1rem;
      text-decoration: none;
      color: inherit;
      border-bottom: 1px solid #e2e8f0;
    }
    .run-item:hover { background: #f1f5f9; }
    .run-item.active { background: #e0f2fe; border-left: 3px solid #0284c7; }
    .run-id { font-size: 0.8rem; font-weight: 600; font-family: monospace; }
    .run-meta { font-size: 0.7rem; color: #64748b; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .run-time { font-size: 0.7rem; color: #94a3b8; }
    .badge {
      align-self: flex-start;
      padding: 0.15rem 0.5rem;
      border-radius: 99px;
      font-size: 0.65rem;
      font-weight: bold;
    }
    .STARTED, .FETCHING { background: #e0f2fe; color: #0284c7; }
    .REVIEWING, .SUMMARIZING { background: #fef08a; color: #854d0e; }
    .AWAITING_APPROVAL { background: #fed7aa; color: #c2410c; }
    .APPROVED, .POSTING_COMMENT { background: #bbf7d0; color: #166534; }
    .FAILED, .REJECTED { background: #fecaca; color: #991b1b; }
    .loading, .empty, .error { padding: 1rem; font-size: 0.85rem; color: #64748b; }
    .error { color: #dc2626; }
  `]
})
export class ExecutionsSidebarComponent implements OnInit, OnDestroy {
  runs: RunSummary[] = [];
  loading = false;
  error = '';
  private pollInterval: ReturnType<typeof setInterval> | null = null;
  private subs = new Subscription();

  constructor(
    private api: ApiService,
    private executions: ExecutionsService,
    private router: Router,
  ) {}

  ngOnInit() {
    this.loadRuns();
    this.pollInterval = setInterval(() => this.loadRuns(true), 10000);
    this.subs.add(
      this.executions.refresh$.subscribe(() => this.loadRuns(true))
    );
  }

  loadRuns(silent = false) {
    if (!silent) this.loading = true;
    this.api.listRuns().subscribe({
      next: (res) => {
        this.runs = res.runs;
        this.loading = false;
        this.error = '';
      },
      error: () => {
        this.loading = false;
        this.error = 'Could not load runs. Add GET /runs in API Gateway.';
      },
    });
  }

  ngOnDestroy() {
    if (this.pollInterval) clearInterval(this.pollInterval);
    this.subs.unsubscribe();
  }
}
