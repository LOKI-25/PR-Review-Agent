import json
import logging
from shared.gemini_client import call_gemini
from shared.dynamo_client import update_run_status, update_run_review

logger = logging.getLogger()
logger.setLevel(logging.INFO)

SYSTEM_PROMPT = """You are a Lead AI Reviewer. You are given JSON findings from 3 AI agents (Security, Quality, Logic).
Combine them into a single, well-structured Markdown comment for GitHub.
Use headings, bullet points, and code snippets where appropriate.
Keep it professional and concise.
If there are no findings at all, return a friendly message stating the PR looks good.
Return ONLY the raw Markdown text (do not wrap in JSON)."""


def handler(event: dict, context) -> dict:
    """Combine three agent outputs into a single review via Gemini."""
    logger.info("Event received: %s", json.dumps(event))

    try:
        return process(event)
    except Exception as exc:
        logger.error("Error: %s", str(exc))
        raise


def process(event: dict) -> dict:
    run_id = event["runId"]
    pr_url = event["prUrl"]
    
    update_run_status(run_id, "SUMMARIZING")
    
    # Step Functions Parallel state outputs an array to agentResults
    agent_results = event.get("agentResults", [])
    findings_json = json.dumps(agent_results, indent=2)
    
    markdown_review = call_gemini(SYSTEM_PROMPT, f"Agent Findings:\n\n{findings_json}", expect_json=False)
    update_run_review(run_id, markdown_review)
    
    return {
        "runId": run_id,
        "prUrl": pr_url,
        "finalReview": markdown_review
    }
