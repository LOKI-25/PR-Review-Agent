# Project: PR Review Multi-Agent System

## What we are building
A system where a developer drops a GitHub PR link into a web UI, and:
1. Three AI agents review the PR in parallel (security, quality, logic)
2. A summarizer agent combines the reviews into one GitHub comment
3. The comment is auto-posted to the PR
4. A human manager gets an email to approve or reject the review
5. The pipeline resumes or stops based on the human decision

The entire backend runs on AWS Lambda + Step Functions. The frontend is Angular. The LLM is Gemini 2.0 Flash (free tier). Total cost: $0/month.

---

## Tech stack — do not suggest alternatives

| Layer | Choice | Reason |
|---|---|---|
| Backend language | Python 3.12 | Developer knows Python, not TypeScript |
| LLM | Gemini 2.0 Flash via google-generativeai | Free: 1M tokens/day, developer has Google account |
| Orchestration | AWS Step Functions (Standard) | Handles parallel agents + human approval gate with task tokens |
| Compute | AWS Lambda (Python 3.12 runtime) | Free tier: 1M requests/month |
| Database | AWS DynamoDB | Free tier: 25GB, stores run state |
| API | AWS API Gateway (REST) | Free tier: 1M calls/month |
| Email | AWS SES | Free: 62K emails/month from Lambda |
| Secrets | AWS Secrets Manager | Stores GitHub token + Gemini key |
| Frontend | Angular 17 (TypeScript) | Developer knows Angular |
| Frontend hosting | Vercel (free hobby tier) | Zero cost |
| Fallback LLM | Kimi (api.moonshot.cn) | OpenAI-compatible, free credits, same code |

**Never suggest**: AWS Bedrock, OpenAI API, LangChain, CrewAI, Docker, ECS, RDS, or any paid service.

---

## Project folder structure

```
pr-review-agent/
├── .cursorrules               ← this file
├── .env.example               ← env var template (never commit .env)
├── requirements.txt           ← shared Python deps
│
├── backend/
│   ├── lambdas/
│   │   ├── trigger/
│   │   │   ├── handler.py     ← receives POST /review, starts Step Functions
│   │   │   └── requirements.txt
│   │   ├── fetch_pr/
│   │   │   ├── handler.py     ← calls GitHub API, returns PR diff
│   │   │   └── requirements.txt
│   │   ├── security_agent/
│   │   │   ├── handler.py     ← Gemini, security-only system prompt
│   │   │   └── requirements.txt
│   │   ├── quality_agent/
│   │   │   ├── handler.py     ← Gemini, code quality-only system prompt
│   │   │   └── requirements.txt
│   │   ├── logic_agent/
│   │   │   ├── handler.py     ← Gemini, bugs/logic-only system prompt
│   │   │   └── requirements.txt
│   │   ├── summarizer/
│   │   │   ├── handler.py     ← combines 3 agent outputs via Gemini
│   │   │   └── requirements.txt
│   │   ├── post_comment/
│   │   │   ├── handler.py     ← posts final review to GitHub PR
│   │   │   └── requirements.txt
│   │   ├── approval/
│   │   │   ├── handler.py     ← stores task token, sends SES email
│   │   │   └── requirements.txt
│   │   └── callback/
│   │       ├── handler.py     ← receives approve/reject, calls SendTaskSuccess/Failure
│   │       └── requirements.txt
│   │
│   ├── shared/
│   │   ├── gemini_client.py   ← shared Gemini wrapper used by all agent Lambdas
│   │   ├── dynamo_client.py   ← shared DynamoDB helper
│   │   └── github_client.py   ← shared GitHub API wrapper
│   │
│   └── step_functions/
│       └── state_machine.json ← Step Functions definition (deploy to AWS console)
│
└── frontend/
    └── pr-review-ui/          ← Angular app (ng new pr-review-ui)
        ├── src/app/
        │   ├── pages/
        │   │   ├── submit/    ← one input: PR URL + submit button
        │   │   └── review/    ← polls run status, shows agent results
        │   └── services/
        │       └── api.service.ts ← HttpClient calls to API Gateway
        └── vercel.json
```

---

## AWS DynamoDB schema

Table name: `pr-reviews`
Partition key: `runId` (String)

```python
# Example item written by trigger Lambda
{
    "runId": "run_20240614_abc123",      # generated UUID
    "prUrl": "https://github.com/...",
    "status": "STARTED",                 # STARTED | FETCHING | REVIEWING | SUMMARIZING | AWAITING_APPROVAL | APPROVED | REJECTED | FAILED
    "createdAt": "2024-06-14T10:00:00Z",
    "updatedAt": "2024-06-14T10:00:05Z",
    "securityFindings": [],              # filled after security agent runs
    "qualityFindings": [],               # filled after quality agent runs
    "logicFindings": [],                 # filled after logic agent runs
    "finalReview": "",                   # filled after summarizer runs
    "githubCommentUrl": "",              # filled after comment is posted
    "approvedBy": "",                    # filled on approval
    "rejectedReason": ""                 # filled on rejection
}
```

---

## Step Functions state machine

Save this as `backend/step_functions/state_machine.json`.
Replace `REGION`, `ACCOUNT_ID` with real values before deploying.

```json
{
  "Comment": "PR Review Multi-Agent Pipeline",
  "StartAt": "FetchPR",
  "States": {
    "FetchPR": {
      "Type": "Task",
      "Resource": "arn:aws:lambda:REGION:ACCOUNT_ID:function:fetch-pr",
      "ResultPath": "$.fetchResult",
      "Next": "ParallelReview",
      "Catch": [{ "ErrorEquals": ["States.ALL"], "Next": "Failed" }]
    },
    "ParallelReview": {
      "Type": "Parallel",
      "ResultPath": "$.agentResults",
      "Branches": [
        {
          "StartAt": "SecurityAgent",
          "States": {
            "SecurityAgent": {
              "Type": "Task",
              "Resource": "arn:aws:lambda:REGION:ACCOUNT_ID:function:security-agent",
              "End": true
            }
          }
        },
        {
          "StartAt": "QualityAgent",
          "States": {
            "QualityAgent": {
              "Type": "Task",
              "Resource": "arn:aws:lambda:REGION:ACCOUNT_ID:function:quality-agent",
              "End": true
            }
          }
        },
        {
          "StartAt": "LogicAgent",
          "States": {
            "LogicAgent": {
              "Type": "Task",
              "Resource": "arn:aws:lambda:REGION:ACCOUNT_ID:function:logic-agent",
              "End": true
            }
          }
        }
      ],
      "Next": "Summarize",
      "Catch": [{ "ErrorEquals": ["States.ALL"], "Next": "Failed" }]
    },
    "Summarize": {
      "Type": "Task",
      "Resource": "arn:aws:lambda:REGION:ACCOUNT_ID:function:summarizer",
      "ResultPath": "$.summaryResult",
      "Next": "PostComment",
      "Catch": [{ "ErrorEquals": ["States.ALL"], "Next": "Failed" }]
    },
    "PostComment": {
      "Type": "Task",
      "Resource": "arn:aws:lambda:REGION:ACCOUNT_ID:function:post-comment",
      "ResultPath": "$.commentResult",
      "Next": "WaitForApproval",
      "Catch": [{ "ErrorEquals": ["States.ALL"], "Next": "Failed" }]
    },
    "WaitForApproval": {
      "Type": "Task",
      "Resource": "arn:aws:states:::lambda:invoke.waitForTaskToken",
      "Parameters": {
        "FunctionName": "arn:aws:lambda:REGION:ACCOUNT_ID:function:approval",
        "Payload": {
          "taskToken.$": "$$.Task.Token",
          "runId.$": "$.runId",
          "prUrl.$": "$.prUrl"
        }
      },
      "ResultPath": "$.approvalResult",
      "Next": "CheckDecision",
      "Catch": [{ "ErrorEquals": ["States.ALL"], "Next": "Failed" }]
    },
    "CheckDecision": {
      "Type": "Choice",
      "Choices": [
        {
          "Variable": "$.approvalResult.decision",
          "StringEquals": "approved",
          "Next": "Approved"
        }
      ],
      "Default": "Rejected"
    },
    "Approved": {
      "Type": "Succeed"
    },
    "Rejected": {
      "Type": "Fail",
      "Error": "ReviewRejected",
      "Cause": "Human reviewer rejected the PR review"
    },
    "Failed": {
      "Type": "Fail",
      "Error": "PipelineFailed",
      "Cause": "An agent or step encountered an error"
    }
  }
}
```

---

## Lambda handler patterns

### Standard Lambda pattern (use for ALL Lambdas)

```python
import json
import logging
import boto3
import os

logger = logging.getLogger()
logger.setLevel(logging.INFO)

dynamodb = boto3.resource("dynamodb")
table = dynamodb.Table("pr-reviews")

def handler(event: dict, context) -> dict:
    logger.info("Event received: %s", json.dumps(event))
    
    try:
        result = process(event)
        return result
    except Exception as e:
        logger.error("Error: %s", str(e))
        raise  # let Step Functions catch it

def process(event: dict) -> dict:
    # actual logic here
    pass
```

### Gemini client pattern (shared/gemini_client.py)

```python
import google.generativeai as genai
import json
import os
import boto3

def get_gemini_key() -> str:
    client = boto3.client("secretsmanager")
    secret = client.get_secret_value(SecretId="pr-review/gemini-key")
    return secret["SecretString"]

def call_gemini(system_prompt: str, user_content: str, expect_json: bool = True) -> dict | str:
    genai.configure(api_key=get_gemini_key())
    model = genai.GenerativeModel(
        model_name="gemini-2.0-flash",
        system_instruction=system_prompt
    )
    response = model.generate_content(user_content)
    text = response.text.strip()
    
    if expect_json:
        # strip markdown fences if present
        if text.startswith("```"):
            text = text.split("```")[1]
            if text.startswith("json"):
                text = text[4:]
        return json.loads(text.strip())
    return text
```

### Agent Lambda pattern (same for security, quality, logic — only prompt changes)

```python
# security_agent/handler.py
import json
from shared.gemini_client import call_gemini
from shared.dynamo_client import update_run_status

SYSTEM_PROMPT = """You are a security code reviewer.
Analyse ONLY for security vulnerabilities: SQL injection, 
hardcoded secrets, XSS, insecure dependencies, broken auth, 
exposed sensitive data.
Return ONLY valid JSON with no extra text:
{"findings": [{"issue": "description", "severity": "high|medium|low", "file": "filename", "line": "line number or range"}]}
If no issues found, return: {"findings": []}"""

def handler(event: dict, context) -> dict:
    run_id = event["runId"]
    diff = event["fetchResult"]["diff"]
    
    update_run_status(run_id, "REVIEWING_SECURITY")
    result = call_gemini(SYSTEM_PROMPT, f"Review this PR diff:\n\n{diff}")
    
    return {
        "agent": "security",
        "runId": run_id,
        "findings": result["findings"]
    }
```

---

## Environment variables

```bash
# .env.example — copy to .env locally, set in Lambda config on AWS
GEMINI_API_KEY=your_gemini_key_here
GITHUB_TOKEN=your_github_personal_access_token
SES_SENDER_EMAIL=bot@yourdomain.com
APPROVER_EMAIL=manager@yourdomain.com
DYNAMODB_TABLE=pr-reviews
STATE_MACHINE_ARN=arn:aws:states:REGION:ACCOUNT_ID:stateMachine:pr-review-pipeline
API_BASE_URL=https://your-api-id.execute-api.REGION.amazonaws.com/prod
```

---

## Angular frontend — 2 pages only

### Page 1: Submit (`/submit`)
- Single text input for GitHub PR URL
- Submit button calls `POST /review` on API Gateway
- On success, navigates to `/review/{runId}`

### Page 2: Review detail (`/review/:runId`)
- Polls `GET /review/{runId}` every 5 seconds using `setInterval`
- Shows: status badge, security findings, quality findings, logic findings, final review text
- No approve/reject buttons in UI (approval happens via email link)
- Stop polling when status is APPROVED, REJECTED, or FAILED

### API Service pattern

```typescript
// services/api.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

const API_BASE = 'https://your-api-id.execute-api.REGION.amazonaws.com/prod';

@Injectable({ providedIn: 'root' })
export class ApiService {
  constructor(private http: HttpClient) {}

  submitReview(prUrl: string): Observable<{ runId: string }> {
    return this.http.post<{ runId: string }>(`${API_BASE}/review`, { prUrl });
  }

  getRunStatus(runId: string): Observable<any> {
    return this.http.get(`${API_BASE}/review/${runId}`);
  }
}
```

---

## Build order — follow this sequence

1. **Local Gemini test** — prove the LLM works before touching AWS
2. **DynamoDB table** — create in AWS console, test with boto3 locally
3. **fetch_pr Lambda** — GitHub API integration, test with a real PR URL
4. **One agent Lambda** — security_agent first, test standalone
5. **Step Functions state machine** — paste JSON in console, wire the 2 Lambdas
6. **Other two agents** — copy security_agent, change prompt only
7. **Summarizer Lambda** — receives array of 3 agent outputs
8. **post_comment Lambda** — GitHub API, posts review as PR comment
9. **Approval Lambda + callback Lambda** — SES email + task token pattern
10. **API Gateway** — POST /review, GET /review/{runId}
11. **trigger Lambda** — ties API Gateway to Step Functions
12. **Angular UI** — submit page + review detail page
13. **Vercel deploy** — push Angular build to Vercel

---

## Key rules for code generation

- Every Lambda must have its own `requirements.txt`
- Always use `logger.info()` not `print()` in Lambdas
- Always read secrets from AWS Secrets Manager, never hardcode
- Step Functions passes state between Lambdas — always include `runId` in every Lambda's return value
- The `Parallel` state sends an array to the next state — the Summarizer receives `event` as a list of 3 dicts
- The `waitForTaskToken` pattern requires the Lambda to NOT return anything — it just sends the email and exits. Step Functions waits until SendTaskSuccess or SendTaskFailure is called externally.
- DynamoDB updates should happen at the start of each Lambda (update status = IN_PROGRESS) and at the end (update status = DONE)
- All Gemini responses should be wrapped in try/except json.loads with a fallback

---

## What this is NOT

- Not a code generation pipeline (we do not generate code, only review it)
- Not using AWS Bedrock (too expensive)
- Not using LangChain or any agent framework (pure Python + boto3)
- Not using Docker or containers (plain Lambda zip deployments)
- Not deploying with CDK yet (AWS Console first, CDK later when needed for clients)
