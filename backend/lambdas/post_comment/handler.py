import json
import logging
from shared.github_client import post_pr_comment
from shared.dynamo_client import update_run_status, update_comment_url

logger = logging.getLogger()
logger.setLevel(logging.INFO)


def handler(event: dict, context) -> dict:
    """Post final review as a GitHub PR comment."""
    logger.info("Event received: %s", json.dumps(event))

    try:
        return process(event)
    except Exception as exc:
        logger.error("Error: %s", str(exc))
        raise


def process(event: dict) -> dict:
    # Because of ResultPath: "$.summaryResult" in the State Machine,
    # the previous Lambda's output lives inside event["summaryResult"]
    summary = event.get("summaryResult", {})
    run_id = summary.get("runId", event.get("runId"))
    pr_url = summary.get("prUrl", event.get("prUrl"))
    final_review = summary.get("finalReview", "")
    
    update_run_status(run_id, "POSTING_COMMENT")
    
    comment_url = post_pr_comment(pr_url, final_review)
    update_comment_url(run_id, comment_url)

    return {
        "runId": run_id,
        "commentUrl": comment_url,
    }
