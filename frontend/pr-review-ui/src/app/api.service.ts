// Service to communicate with AWS API Gateway
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../environments/environment';

export interface RunStatus {
  runId: string;
  prUrl: string;
  status: string;
  securityFindings: Finding[];
  qualityFindings: Finding[];
  logicFindings: Finding[];
  finalReview: string;
  githubCommentUrl: string;
  approvedBy: string;
  rejectedReason: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface RunSummary {
  runId: string;
  prUrl: string;
  status: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Finding {
  issue: string;
  severity: string;
  file: string;
  line: string;
}

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly apiBase = environment.apiBaseUrl;

  constructor(private http: HttpClient) {}

  submitReview(prUrl: string): Observable<{ runId: string; message: string }> {
    return this.http.post<{ runId: string; message: string }>(
      `${this.apiBase}/review`,
      { prUrl }
    );
  }

  getRunStatus(runId: string): Observable<RunStatus> {
    return this.http.get<RunStatus>(`${this.apiBase}/review/${runId}`);
  }

  listRuns(): Observable<{ runs: RunSummary[] }> {
    return this.http.get<{ runs: RunSummary[] }>(`${this.apiBase}/runs`);
  }
}
