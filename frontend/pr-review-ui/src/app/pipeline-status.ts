export interface PipelineStep {
  status: string;
  label: string;
  description: string;
}

export const PIPELINE_STEPS: PipelineStep[] = [
  { status: 'STARTED', label: 'Queued', description: 'Run registered' },
  { status: 'FETCHING', label: 'Fetch PR', description: 'Pulling diff from GitHub' },
  { status: 'REVIEWING', label: 'AI Agents', description: 'Security, quality & logic' },
  { status: 'SUMMARIZING', label: 'Summarize', description: 'Merging agent findings' },
  { status: 'POSTING_COMMENT', label: 'GitHub', description: 'Posting review comment' },
  { status: 'AWAITING_APPROVAL', label: 'Approval', description: 'Waiting for human sign-off' },
  { status: 'APPROVED', label: 'Complete', description: 'Review approved' },
];

const STATUS_INDEX = new Map(PIPELINE_STEPS.map((step, index) => [step.status, index]));

export function getStepIndex(status: string): number {
  return STATUS_INDEX.get(status) ?? -1;
}

export function isTerminalStatus(status: string): boolean {
  return status === 'APPROVED' || status === 'REJECTED' || status === 'FAILED';
}

export function isFailureStatus(status: string): boolean {
  return status === 'REJECTED' || status === 'FAILED';
}

/** Poll while the pipeline is actively running; stop once waiting on a human or finished. */
export function shouldPollStatus(status: string): boolean {
  return (
    !isTerminalStatus(status) &&
    status !== 'AWAITING_APPROVAL'
  );
}

/** No DynamoDB update for this long while still "active" usually means Step Functions failed. */
export const STALE_RUN_MINUTES = 8;

export function isStaleActiveRun(status: string, updatedAt?: string): boolean {
  if (!updatedAt || !shouldPollStatus(status)) return false;
  const minutes = (Date.now() - new Date(updatedAt).getTime()) / 60000;
  return minutes >= STALE_RUN_MINUTES;
}

export function progressPercent(status: string): number {
  const index = getStepIndex(status);
  if (index < 0) {
    return isFailureStatus(status) ? 85 : 0;
  }
  const maxIndex = PIPELINE_STEPS.length - 1;
  return Math.round((index / maxIndex) * 100);
}

export function stepState(
  stepIndex: number,
  currentIndex: number,
  status: string,
): 'complete' | 'active' | 'upcoming' | 'failed' {
  if (isFailureStatus(status)) {
    if (stepIndex < currentIndex) return 'complete';
    if (stepIndex === currentIndex) return 'failed';
    return 'upcoming';
  }
  if (currentIndex < 0) return 'upcoming';
  if (stepIndex < currentIndex) return 'complete';
  if (stepIndex === currentIndex) return 'active';
  return 'upcoming';
}
