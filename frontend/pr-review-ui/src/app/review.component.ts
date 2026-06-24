import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';
import { ApiService, Finding, RunStatus } from './api.service';
import { PipelineProgressComponent } from './pipeline-progress.component';
import { MarkdownPipe } from './markdown.pipe';
import { isTerminalStatus, isStaleActiveRun, shouldPollStatus, STALE_RUN_MINUTES } from './pipeline-status';

@Component({
  selector: 'app-review',
  standalone: true,
  imports: [CommonModule, PipelineProgressComponent, MarkdownPipe],
  template: `
    <div class="page" *ngIf="runData; else loading">
      <header class="hero">
        <div>
          <p class="eyebrow">PR Review Run</p>
          <h1>{{ shortRunId }}</h1>
        </div>
        <span class="status-pill" [class]="runData.status">{{ runData.status }}</span>
      </header>

      <app-pipeline-progress [status]="runData.status" />

      <section class="alert stale" *ngIf="staleWarning">
        No progress for {{ staleRunMinutes }}+ minutes. The pipeline may have failed in AWS
        (for example LLM quota limits). Refresh the page or check Step Functions.
      </section>

      <section class="alert failed" *ngIf="runData.status === 'FAILED'">
        Pipeline failed{{ runData.rejectedReason ? ': ' + runData.rejectedReason : '' }}
      </section>

      <section class="meta-card">
        <div class="meta-row">
          <span class="meta-label">Pull request</span>
          <a class="meta-link" [href]="runData.prUrl" target="_blank" rel="noopener">
            {{ runData.prUrl }}
          </a>
        </div>
        <div class="meta-row" *ngIf="runData.githubCommentUrl">
          <span class="meta-label">GitHub comment</span>
          <a class="meta-link accent" [href]="runData.githubCommentUrl" target="_blank" rel="noopener">
            View posted review →
          </a>
        </div>
        <div class="meta-row" *ngIf="runData.approvedBy">
          <span class="meta-label">Approved by</span>
          <span>{{ runData.approvedBy }}</span>
        </div>
        <div class="meta-row rejected" *ngIf="runData.rejectedReason && runData.status !== 'FAILED'">
          <span class="meta-label">Rejection</span>
          <span>{{ runData.rejectedReason }}</span>
        </div>
      </section>

      <section class="findings-grid" *ngIf="hasFindings">
        <article class="finding-card security" *ngIf="runData.securityFindings?.length">
          <div class="card-head">
            <span class="card-icon">🛡️</span>
            <h3>Security</h3>
            <span class="count">{{ runData.securityFindings.length }}</span>
          </div>
          <ul>
            <li *ngFor="let f of runData.securityFindings" [class]="severityClass(f)">
              <span class="severity">{{ f.severity }}</span>
              <div>
                <p>{{ f.issue }}</p>
                <span class="location" *ngIf="f.file">{{ f.file }}<span *ngIf="f.line">:{{ f.line }}</span></span>
              </div>
            </li>
          </ul>
        </article>

        <article class="finding-card quality" *ngIf="runData.qualityFindings?.length">
          <div class="card-head">
            <span class="card-icon">✨</span>
            <h3>Quality</h3>
            <span class="count">{{ runData.qualityFindings.length }}</span>
          </div>
          <ul>
            <li *ngFor="let f of runData.qualityFindings" [class]="severityClass(f)">
              <span class="severity">{{ f.severity }}</span>
              <div>
                <p>{{ f.issue }}</p>
                <span class="location" *ngIf="f.file">{{ f.file }}<span *ngIf="f.line">:{{ f.line }}</span></span>
              </div>
            </li>
          </ul>
        </article>

        <article class="finding-card logic" *ngIf="runData.logicFindings?.length">
          <div class="card-head">
            <span class="card-icon">🧠</span>
            <h3>Logic</h3>
            <span class="count">{{ runData.logicFindings.length }}</span>
          </div>
          <ul>
            <li *ngFor="let f of runData.logicFindings" [class]="severityClass(f)">
              <span class="severity">{{ f.severity }}</span>
              <div>
                <p>{{ f.issue }}</p>
                <span class="location" *ngIf="f.file">{{ f.file }}<span *ngIf="f.line">:{{ f.line }}</span></span>
              </div>
            </li>
          </ul>
        </article>
      </section>

      <section class="review-card" *ngIf="runData.finalReview">
        <div class="review-card-head">
          <div class="avatar">AI</div>
          <div>
            <strong>PR Review Bot</strong>
            <span>automated review · rendered like GitHub</span>
          </div>
        </div>
        <div class="markdown-body" [innerHTML]="runData.finalReview | markdown"></div>
      </section>

      <p class="polling-hint" *ngIf="isPolling">
        <span class="live-dot"></span>
        Live updating every 5 seconds
      </p>
    </div>

    <ng-template #loading>
      <div class="page loading-state">
        <div class="spinner"></div>
        <p>Loading run data...</p>
      </div>
    </ng-template>
  `,
  styles: [`
    .page {
      max-width: 960px;
      margin: 0 auto;
      padding: 2rem 2rem 3rem;
    }
    .hero {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 1rem;
      margin-bottom: 1.5rem;
    }
    .eyebrow {
      margin: 0 0 0.35rem;
      font-size: 0.75rem;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: #64748b;
      font-weight: 600;
    }
    h1 {
      margin: 0;
      font-size: 1.5rem;
      font-family: 'JetBrains Mono', ui-monospace, monospace;
      color: #0f172a;
    }
    .status-pill {
      padding: 0.45rem 0.9rem;
      border-radius: 999px;
      font-size: 0.75rem;
      font-weight: 700;
      letter-spacing: 0.04em;
      white-space: nowrap;
    }
    .STARTED, .FETCHING { background: #e0f2fe; color: #0369a1; }
    .REVIEWING, .SUMMARIZING { background: #fef9c3; color: #a16207; }
    .POSTING_COMMENT { background: #dbeafe; color: #1d4ed8; }
    .AWAITING_APPROVAL { background: #ffedd5; color: #c2410c; }
    .APPROVED { background: #dcfce7; color: #15803d; }
    .FAILED, .REJECTED { background: #fee2e2; color: #b91c1c; }
    .meta-card {
      background: #fff;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 1rem 1.25rem;
      margin-bottom: 1.5rem;
      display: grid;
      gap: 0.75rem;
    }
    .meta-row {
      display: grid;
      grid-template-columns: 120px 1fr;
      gap: 0.75rem;
      align-items: baseline;
      font-size: 0.9rem;
    }
    .meta-label {
      color: #64748b;
      font-weight: 600;
      font-size: 0.8rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .meta-link {
      color: #2563eb;
      text-decoration: none;
      word-break: break-all;
    }
    .meta-link:hover { text-decoration: underline; }
    .meta-link.accent { font-weight: 600; }
    .meta-row.rejected { color: #b91c1c; }
    .alert {
      border-radius: 10px;
      padding: 0.9rem 1rem;
      margin-bottom: 1rem;
      font-size: 0.9rem;
      line-height: 1.45;
    }
    .alert.stale {
      background: #fff7ed;
      border: 1px solid #fdba74;
      color: #9a3412;
    }
    .alert.failed {
      background: #fef2f2;
      border: 1px solid #fecaca;
      color: #991b1b;
      font-weight: 500;
    }
    .findings-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
      gap: 1rem;
      margin-bottom: 1.5rem;
    }
    .finding-card {
      background: #fff;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 4px 16px rgba(15, 23, 42, 0.04);
    }
    .finding-card.security { border-top: 3px solid #ef4444; }
    .finding-card.quality { border-top: 3px solid #8b5cf6; }
    .finding-card.logic { border-top: 3px solid #0ea5e9; }
    .card-head {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.9rem 1rem;
      border-bottom: 1px solid #f1f5f9;
      background: #f8fafc;
    }
    .card-head h3 { margin: 0; flex: 1; font-size: 0.95rem; }
    .card-icon { font-size: 1rem; }
    .count {
      background: #e2e8f0;
      color: #475569;
      font-size: 0.75rem;
      font-weight: 700;
      padding: 0.15rem 0.5rem;
      border-radius: 999px;
    }
    .finding-card ul {
      list-style: none;
      margin: 0;
      padding: 0.75rem 1rem 1rem;
    }
    .finding-card li {
      display: flex;
      gap: 0.65rem;
      padding: 0.65rem 0;
      border-bottom: 1px solid #f1f5f9;
    }
    .finding-card li:last-child { border-bottom: none; }
    .finding-card li p { margin: 0 0 0.25rem; font-size: 0.88rem; line-height: 1.45; }
    .severity {
      font-size: 0.65rem;
      font-weight: 700;
      text-transform: uppercase;
      padding: 0.2rem 0.4rem;
      border-radius: 4px;
      height: fit-content;
      white-space: nowrap;
    }
    li.high .severity { background: #fee2e2; color: #b91c1c; }
    li.medium .severity { background: #ffedd5; color: #c2410c; }
    li.low .severity { background: #fef9c3; color: #a16207; }
    li.info .severity { background: #e0f2fe; color: #0369a1; }
    .location {
      font-size: 0.75rem;
      color: #64748b;
      font-family: 'JetBrains Mono', ui-monospace, monospace;
    }
    .review-card {
      background: #fff;
      border: 1px solid #d0d7de;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 8px 24px rgba(15, 23, 42, 0.06);
    }
    .review-card-head {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 1rem 1.25rem;
      background: #f6f8fa;
      border-bottom: 1px solid #d0d7de;
    }
    .avatar {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      background: linear-gradient(135deg, #6366f1, #8b5cf6);
      color: white;
      display: grid;
      place-items: center;
      font-size: 0.75rem;
      font-weight: 700;
    }
    .review-card-head strong { display: block; font-size: 0.95rem; color: #24292f; }
    .review-card-head span { font-size: 0.78rem; color: #656d76; }
    .polling-hint {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin-top: 1.5rem;
      font-size: 0.82rem;
      color: #64748b;
    }
    .live-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #22c55e;
      animation: pulse 1.4s ease-in-out infinite;
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.35; }
    }
    .loading-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 50vh;
      color: #64748b;
    }
    .spinner {
      width: 36px;
      height: 36px;
      border: 3px solid #e2e8f0;
      border-top-color: #6366f1;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      margin-bottom: 1rem;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    @media (max-width: 768px) {
      .page {
        padding: 1rem 1rem 2rem;
      }
      .hero {
        flex-direction: column;
        align-items: stretch;
        gap: 0.75rem;
      }
      h1 {
        font-size: 1.15rem;
        word-break: break-all;
      }
      .status-pill {
        align-self: flex-start;
        font-size: 0.7rem;
        white-space: normal;
      }
      .meta-row {
        grid-template-columns: 1fr;
        gap: 0.35rem;
      }
      .findings-grid {
        grid-template-columns: 1fr;
      }
      .finding-card li {
        flex-direction: column;
        gap: 0.4rem;
      }
      .review-card-head {
        padding: 0.85rem 1rem;
      }
      .markdown-body {
        padding: 1rem;
        font-size: 0.9rem;
        overflow-x: auto;
      }
      .alert {
        font-size: 0.85rem;
      }
    }
  `],
})
export class ReviewComponent implements OnInit, OnDestroy {
  runId = '';
  runData: RunStatus | null = null;
  pollingInterval: ReturnType<typeof setInterval> | null = null;
  staleWarning = false;
  readonly staleRunMinutes = STALE_RUN_MINUTES;
  private routeSub: Subscription | null = null;
  private fetchGeneration = 0;

  constructor(private route: ActivatedRoute, private apiService: ApiService) {}

  ngOnInit() {
    this.routeSub = this.route.paramMap.subscribe((params) => {
      this.loadRun(params.get('runId') || '');
    });
  }

  private loadRun(runId: string) {
    this.stopPolling();
    this.runId = runId;
    this.runData = null;
    this.staleWarning = false;
    this.fetchGeneration++;

    if (!runId) return;
    this.fetchStatus();
  }

  private startPolling() {
    if (this.pollingInterval) return;
    this.pollingInterval = setInterval(() => this.fetchStatus(), 5000);
  }

  private stopPolling() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
  }

  get shortRunId(): string {
    if (this.runId.length <= 12) return this.runId;
    return `${this.runId.slice(0, 8)}…${this.runId.slice(-4)}`;
  }

  get hasFindings(): boolean {
    if (!this.runData) return false;
    return !!(
      this.runData.securityFindings?.length ||
      this.runData.qualityFindings?.length ||
      this.runData.logicFindings?.length
    );
  }

  get isTerminal(): boolean {
    return this.runData ? isTerminalStatus(this.runData.status) : false;
  }

  get isPolling(): boolean {
    return this.pollingInterval !== null;
  }

  severityClass(finding: Finding): string {
    const severity = (finding.severity || 'info').toLowerCase();
    if (['high', 'critical'].includes(severity)) return 'high';
    if (['medium', 'moderate'].includes(severity)) return 'medium';
    if (severity === 'low') return 'low';
    return 'info';
  }

  fetchStatus() {
    if (!this.runId) return;
    const runId = this.runId;
    const generation = this.fetchGeneration;

    this.apiService.getRunStatus(runId).subscribe({
      next: (data) => {
        if (generation !== this.fetchGeneration || runId !== this.runId) return;

        this.runData = data;
        if (shouldPollStatus(data.status) && !isStaleActiveRun(data.status, data.updatedAt)) {
          this.startPolling();
        } else {
          this.stopPolling();
          if (isStaleActiveRun(data.status, data.updatedAt)) {
            this.staleWarning = true;
          }
        }
      },
      error: (err) => console.error('Error fetching status', err),
    });
  }

  ngOnDestroy() {
    this.routeSub?.unsubscribe();
    this.stopPolling();
  }
}
