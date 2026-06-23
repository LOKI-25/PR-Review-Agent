import json
import logging
import os
import boto3
from urllib.parse import unquote
from botocore.exceptions import ClientError
from shared.dynamo_client import update_run_approval, update_run_rejection

logger = logging.getLogger()
logger.setLevel(logging.INFO)

sfn_client = boto3.client("stepfunctions")
CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "text/html",
}


def handler(event: dict, context) -> dict:
    """Handle approve/reject callback and call SendTaskSuccess or SendTaskFailure."""
    logger.info("Event received: %s", json.dumps(event))

    try:
        return process(event)
    except Exception as exc:
        logger.error("Error: %s", str(exc))
        return {
            "statusCode": 500,
            "headers": CORS_HEADERS,
            "body": _html_page("Error", f"Something went wrong: {exc}", False),
        }


def process(event: dict) -> dict:
    params = event.get("queryStringParameters") or {}
    task_token = params.get("token")
    decision = params.get("decision")
    run_id = params.get("runId", "")

    if task_token:
        # API Gateway decodes once; unquote handles any remaining encoding
        task_token = unquote(task_token)

    if not task_token or decision not in ("approved", "rejected"):
        return {
            "statusCode": 400,
            "headers": CORS_HEADERS,
            "body": _html_page("Invalid Request", "Missing or invalid token/decision.", False),
        }

    approver = os.environ.get("APPROVER_EMAIL", "email-link")

    try:
        if decision == "approved":
            sfn_client.send_task_success(
                taskToken=task_token,
                output=json.dumps({"decision": "approved"}),
            )
            if run_id:
                update_run_approval(run_id, approver)
            return {
                "statusCode": 200,
                "headers": CORS_HEADERS,
                "body": _html_page(
                    "Review Approved",
                    "The PR review has been approved. The pipeline will complete shortly.",
                    True,
                ),
            }

        sfn_client.send_task_failure(
            taskToken=task_token,
            error="ReviewRejected",
            cause="Human reviewer rejected the PR review",
        )
        if run_id:
            update_run_rejection(run_id, "Rejected via approval email link")

        return {
            "statusCode": 200,
            "headers": CORS_HEADERS,
            "body": _html_page(
                "Review Rejected",
                "The PR review has been rejected. The pipeline will stop.",
                False,
            ),
        }
    except ClientError as exc:
        code = exc.response.get("Error", {}).get("Code", "")
        if code == "InvalidToken":
            return {
                "statusCode": 400,
                "headers": CORS_HEADERS,
                "body": _html_page(
                    "Link Expired or Already Used",
                    "This approval link is no longer valid. It may have already been used, "
                    "expired, or come from an old email. Start a new PR review and use the "
                    "latest email link.",
                    False,
                ),
            }
        raise


def _html_page(title: str, message: str, success: bool) -> str:
    color = "#166534" if success else "#991b1b"
    return f"""<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>{title}</title></head>
<body style="font-family:sans-serif;max-width:600px;margin:4rem auto;text-align:center;">
  <h1 style="color:{color};">{title}</h1>
  <p>{message}</p>
  <p style="color:#64748b;font-size:0.9rem;">You can close this tab.</p>
</body></html>"""
