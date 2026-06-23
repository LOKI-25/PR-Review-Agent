// Dashboard page to view the review status
import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { ApiService, RunStatus } from './api.service';

@Component({
  selector: 'app-review',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="container" *ngIf="runData">
      <div class="header">
        <h2>Run ID: {{ runId }}</h2>
        <span class="badge" [class]="runData.status">{{ runData.status }}</span>
      </div>

      <p><strong>Pull Request:</strong> <a [href]="runData.prUrl" target="_blank">{{ runData.prUrl }}</a></p>

      <p *ngIf="runData.githubCommentUrl">
        <strong>GitHub Comment:</strong>
        <a [href]="runData.githubCommentUrl" target="_blank">View on GitHub</a>
      </p>

      <section *ngIf="runData.securityFindings?.length">
        <h3>Security Findings</h3>
        <ul>
          <li *ngFor="let f of runData.securityFindings" [class]="f.severity">
            <strong>[{{ f.severity }}]</strong> {{ f.issue }}
            <span class="meta" *ngIf="f.file"> — {{ f.file }}<span *ngIf="f.line">:{{ f.line }}</span></span>
          </li>
        </ul>
      </section>

      <section *ngIf="runData.qualityFindings?.length">
        <h3>Quality Findings</h3>
        <ul>
          <li *ngFor="let f of runData.qualityFindings" [class]="f.severity">
            <strong>[{{ f.severity }}]</strong> {{ f.issue }}
            <span class="meta" *ngIf="f.file"> — {{ f.file }}<span *ngIf="f.line">:{{ f.line }}</span></span>
          </li>
        </ul>
      </section>

      <section *ngIf="runData.logicFindings?.length">
        <h3>Logic Findings</h3>
        <ul>
          <li *ngFor="let f of runData.logicFindings" [class]="f.severity">
            <strong>[{{ f.severity }}]</strong> {{ f.issue }}
            <span class="meta" *ngIf="f.file"> — {{ f.file }}<span *ngIf="f.line">:{{ f.line }}</span></span>
          </li>
        </ul>
      </section>

      <section *ngIf="runData.finalReview">
        <h3>Final Markdown Review</h3>
        <pre>{{ runData.finalReview }}</pre>
      </section>

      <p *ngIf="runData.approvedBy"><strong>Approved by:</strong> {{ runData.approvedBy }}</p>
      <p *ngIf="runData.rejectedReason" class="rejected"><strong>Rejection reason:</strong> {{ runData.rejectedReason }}</p>
    </div>
    <div class="container" *ngIf="!runData">
      <p>Loading run data...</p>
    </div>
  `,
  styles: [`
    .container { max-width: 800px; margin: 2rem auto; padding: 1rem 2rem; font-family: sans-serif; }
    .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #eee; padding-bottom: 1rem; }
    .badge { padding: 0.5rem 1rem; border-radius: 99px; font-weight: bold; font-size: 0.85rem; }
    .STARTED, .FETCHING { background: #e0f2fe; color: #0284c7; }
    .REVIEWING, .SUMMARIZING { background: #fef08a; color: #854d0e; }
    .AWAITING_APPROVAL { background: #fed7aa; color: #c2410c; }
    .APPROVED, .POSTING_COMMENT { background: #bbf7d0; color: #166534; }
    .FAILED, .REJECTED { background: #fecaca; color: #991b1b; }
    section { margin-top: 1.5rem; }
    ul { padding-left: 1.25rem; }
    li { margin-bottom: 0.5rem; }
    li.high { color: #991b1b; }
    li.medium { color: #c2410c; }
    li.low { color: #854d0e; }
    .meta { color: #64748b; font-size: 0.9rem; }
    pre { background: #f8fafc; padding: 1.5rem; white-space: pre-wrap; border-radius: 8px; border: 1px solid #e2e8f0; font-family: monospace; }
    .rejected { color: #991b1b; }
  `]
})
export class ReviewComponent implements OnInit, OnDestroy {
  runId = '';
  runData: RunStatus | null = null;
  pollingInterval: ReturnType<typeof setInterval> | null = null;

  constructor(private route: ActivatedRoute, private apiService: ApiService) {}

  ngOnInit() {
    this.runId = this.route.snapshot.paramMap.get('runId') || '';
    this.fetchStatus();
    this.pollingInterval = setInterval(() => this.fetchStatus(), 5000);
  }

  fetchStatus() {
    if (!this.runId) return;
    this.apiService.getRunStatus(this.runId).subscribe({
      next: (data) => {
        this.runData = data;
        const terminalStates = ['APPROVED', 'REJECTED', 'FAILED'];
        if (terminalStates.includes(data.status) && this.pollingInterval) {
          clearInterval(this.pollingInterval);
          this.pollingInterval = null;
        }
      },
      error: (err) => console.error('Error fetching status', err),
    });
  }

  ngOnDestroy() {
    if (this.pollingInterval) clearInterval(this.pollingInterval);
  }
}
