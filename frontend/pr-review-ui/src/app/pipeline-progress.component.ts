import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  PIPELINE_STEPS,
  getStepIndex,
  isFailureStatus,
  progressPercent,
  stepState,
} from './pipeline-status';

@Component({
  selector: 'app-pipeline-progress',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="pipeline" [class.failed]="isFailure">
      <div class="pipeline-header">
        <div>
          <p class="eyebrow">Pipeline progress</p>
          <h3>{{ headline }}</h3>
        </div>
        <div class="percent">{{ percent }}%</div>
      </div>

      <div class="track-wrap">
        <div class="track">
          <div
            class="fill"
            [class.failed]="isFailure"
            [style.width.%]="percent"
          ></div>
          <div class="shimmer" *ngIf="!isTerminal && !isFailure"></div>
        </div>

        <ol class="steps">
          <li
            *ngFor="let step of steps; let i = index"
            class="step"
            [class]="stateFor(i)"
          >
            <div class="node">
              <span class="icon" *ngIf="stateFor(i) === 'complete'">✓</span>
              <span class="icon" *ngIf="stateFor(i) === 'failed'">!</span>
              <span class="pulse" *ngIf="stateFor(i) === 'active'"></span>
              <span class="dot" *ngIf="stateFor(i) === 'upcoming'"></span>
            </div>
            <span class="label">{{ step.label }}</span>
          </li>
        </ol>
      </div>

      <p class="status-copy">{{ statusDescription }}</p>
    </div>
  `,
  styles: [`
    .pipeline {
      background: linear-gradient(135deg, #0f172a 0%, #1e293b 55%, #312e81 100%);
      border-radius: 16px;
      padding: 1.5rem 1.75rem 1.25rem;
      color: #f8fafc;
      box-shadow: 0 20px 40px rgba(15, 23, 42, 0.25);
      margin-bottom: 1.75rem;
    }
    .pipeline.failed {
      background: linear-gradient(135deg, #450a0a 0%, #7f1d1d 55%, #1e293b 100%);
    }
    .pipeline-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 1rem;
      margin-bottom: 1.25rem;
    }
    .eyebrow {
      margin: 0 0 0.25rem;
      font-size: 0.72rem;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: #94a3b8;
    }
    h3 {
      margin: 0;
      font-size: 1.15rem;
      font-weight: 600;
    }
    .percent {
      font-size: 1.5rem;
      font-weight: 700;
      font-variant-numeric: tabular-nums;
      color: #a5b4fc;
    }
    .failed .percent { color: #fca5a5; }
    .track-wrap { position: relative; padding-top: 0.25rem; }
    .track {
      position: relative;
      height: 6px;
      background: rgba(148, 163, 184, 0.25);
      border-radius: 999px;
      overflow: hidden;
    }
    .fill {
      position: absolute;
      inset: 0 auto 0 0;
      background: linear-gradient(90deg, #38bdf8, #818cf8, #a78bfa);
      border-radius: 999px;
      transition: width 0.8s cubic-bezier(0.4, 0, 0.2, 1);
    }
    .fill.failed {
      background: linear-gradient(90deg, #f87171, #ef4444);
    }
    .shimmer {
      position: absolute;
      inset: 0;
      background: linear-gradient(
        90deg,
        transparent 0%,
        rgba(255, 255, 255, 0.35) 50%,
        transparent 100%
      );
      animation: shimmer 1.8s infinite;
    }
    @keyframes shimmer {
      from { transform: translateX(-100%); }
      to { transform: translateX(100%); }
    }
    .steps {
      list-style: none;
      margin: 0.85rem 0 0;
      padding: 0;
      display: grid;
      grid-template-columns: repeat(7, 1fr);
      gap: 0.25rem;
    }
    .step {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.45rem;
      text-align: center;
    }
    .node {
      width: 28px;
      height: 28px;
      border-radius: 50%;
      display: grid;
      place-items: center;
      background: rgba(15, 23, 42, 0.55);
      border: 2px solid rgba(148, 163, 184, 0.45);
      position: relative;
      transition: all 0.35s ease;
    }
    .step.complete .node {
      background: #22c55e;
      border-color: #22c55e;
      color: white;
      font-size: 0.75rem;
      font-weight: 700;
    }
    .step.active .node {
      border-color: #38bdf8;
      box-shadow: 0 0 0 4px rgba(56, 189, 248, 0.25);
    }
    .step.failed .node {
      background: #ef4444;
      border-color: #ef4444;
      color: white;
      font-weight: 700;
    }
    .dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #64748b;
    }
    .pulse {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: #38bdf8;
      animation: pulse 1.4s ease-in-out infinite;
    }
    @keyframes pulse {
      0%, 100% { transform: scale(1); opacity: 1; }
      50% { transform: scale(1.35); opacity: 0.65; }
    }
    .label {
      font-size: 0.68rem;
      color: #94a3b8;
      line-height: 1.2;
      max-width: 4.5rem;
    }
    .step.complete .label,
    .step.active .label { color: #e2e8f0; font-weight: 600; }
    .step.failed .label { color: #fecaca; font-weight: 600; }
    .status-copy {
      margin: 1rem 0 0;
      font-size: 0.85rem;
      color: #cbd5e1;
    }
    @media (max-width: 900px) {
      .steps { grid-template-columns: repeat(4, 1fr); row-gap: 0.75rem; }
      .step:nth-child(n+5) { grid-column: span 1; }
    }
  `],
})
export class PipelineProgressComponent {
  @Input({ required: true }) status = 'STARTED';

  readonly steps = PIPELINE_STEPS;

  get currentIndex(): number {
    const index = getStepIndex(this.status);
    if (index >= 0) return index;
    if (this.status === 'REJECTED' || this.status === 'FAILED') {
      return 5;
    }
    return 0;
  }

  get percent(): number {
    return progressPercent(this.status);
  }

  get isFailure(): boolean {
    return isFailureStatus(this.status);
  }

  get isTerminal(): boolean {
    return this.status === 'APPROVED' || this.isFailure;
  }

  get headline(): string {
    if (this.status === 'APPROVED') return 'Review approved';
    if (this.status === 'REJECTED') return 'Review rejected';
    if (this.status === 'FAILED') return 'Pipeline failed';
    const step = this.steps[this.currentIndex];
    return step ? step.label : 'In progress';
  }

  get statusDescription(): string {
    if (this.status === 'APPROVED') {
      return 'All agents finished and a human approved the review.';
    }
    if (this.status === 'REJECTED') {
      return 'A reviewer rejected this review before it was finalized.';
    }
    if (this.status === 'FAILED') {
      return 'Something went wrong during the pipeline. Check AWS Step Functions logs.';
    }
    const step = this.steps[this.currentIndex];
    return step?.description ?? 'Processing...';
  }

  stateFor(index: number): string {
    return stepState(index, this.currentIndex, this.status);
  }
}
