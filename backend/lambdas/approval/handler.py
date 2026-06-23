import json
import logging
import os
import boto3
from urllib.parse import urlencode
from shared.dynamo_client import update_run_status

logger = logging.getLogger()
logger.setLevel(logging.INFO)

ses_client = boto3.client("ses")


def handler(event: dict, context) -> None:
    """Store task token and send SES approval email. Does not return — Step Functions waits."""
    logger.info("Event received: %s", json.dumps(event))

    try:
        process(event)
    except Exception as exc:
        logger.error("Error: %s", str(exc))
        raise


def process(event: dict) -> None:
    task_token = event["taskToken"]
    run_id = event["runId"]
    pr_url = event["prUrl"]
    comment_url = event.get("commentUrl", pr_url)

    update_run_status(run_id, "AWAITING_APPROVAL")

    sender_email = os.environ.get("SES_SENDER_EMAIL", "").strip()
    approver_email = os.environ.get("APPROVER_EMAIL", "").strip()
    api_base_url = os.environ.get("API_BASE_URL", "").strip()

    missing = [
        name for name, val in [
            ("SES_SENDER_EMAIL", sender_email),
            ("APPROVER_EMAIL", approver_email),
            ("API_BASE_URL", api_base_url),
        ]
        if not val
    ]
    if missing:
        raise ValueError(
            f"Missing Lambda env vars on approval function: {', '.join(missing)}"
        )

    subject = f"PR Review Approval Required: {run_id}"

    def _callback_url(decision: str) -> str:
        query = urlencode({
            "token": task_token,
            "decision": decision,
            "runId": run_id,
        })
        return f"{api_base_url.rstrip('/')}/callback?{query}"

    approve_url = _callback_url("approved")
    reject_url = _callback_url("rejected")

    body_text = f"""
The AI PR Review agents have finished reviewing the PR.
The review comment has been posted to GitHub: {comment_url}

Run ID: {run_id}
Pull Request: {pr_url}

Please review the posted comment and approve or reject this review.

Approve: {approve_url}
Reject:  {reject_url}
"""

    ses_client.send_email(
        Source=sender_email,
        Destination={"ToAddresses": [approver_email]},
        Message={
            "Subject": {"Data": subject},
            "Body": {"Text": {"Data": body_text}},
        },
    )

    logger.info("Approval email sent to %s for run %s", approver_email, run_id)
