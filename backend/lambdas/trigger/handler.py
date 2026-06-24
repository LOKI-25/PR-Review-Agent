import json
import logging
import uuid
import os
import boto3
from datetime import datetime, timezone
from shared.dynamo_client import get_run, list_runs
from shared.execution_sync import TERMINAL_STATUSES, sync_run_with_execution

logger = logging.getLogger()
logger.setLevel(logging.INFO)

dynamodb = boto3.resource("dynamodb")
table_name = os.environ.get("DYNAMODB_TABLE", "pr-reviews")
table = dynamodb.Table(table_name)
sfn_client = boto3.client("stepfunctions")
state_machine_arn = os.environ.get("STATE_MACHINE_ARN")

CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "application/json",
}


def handler(event: dict, context) -> dict:
    """API Gateway entry: POST /review starts pipeline, GET /review/{runId} returns status."""
    logger.info("Event received: %s", json.dumps(event))

    try:
        return process(event)
    except Exception as exc:
        logger.error("Error: %s", str(exc))
        raise


def _http_method(event: dict) -> str:
    if "httpMethod" in event:
        return event["httpMethod"]
    return event.get("requestContext", {}).get("http", {}).get("method", "POST")


def process(event: dict) -> dict:
    method = _http_method(event)

    if method == "OPTIONS":
        return {
            "statusCode": 200,
            "headers": {
                **CORS_HEADERS,
                "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type",
            },
            "body": "",
        }

    if method == "GET":
        path = event.get("path", "")
        if path.endswith("/runs"):
            return list_all_runs()
        return get_run_status(event)

    return start_review(event)


def list_all_runs() -> dict:
    runs = list_runs()
    synced_runs = []
    for run in runs:
        if run.get("status") not in TERMINAL_STATUSES:
            run = sync_run_with_execution(run)
        synced_runs.append(run)
    return {
        "statusCode": 200,
        "headers": CORS_HEADERS,
        "body": json.dumps({"runs": synced_runs}, default=str),
    }


def get_run_status(event: dict) -> dict:
    run_id = (event.get("pathParameters") or {}).get("runId")
    if not run_id:
        return {
            "statusCode": 400,
            "headers": CORS_HEADERS,
            "body": json.dumps({"error": "Missing runId"}),
        }

    item = get_run(run_id)
    if not item:
        return {
            "statusCode": 404,
            "headers": CORS_HEADERS,
            "body": json.dumps({"error": "Run not found"}),
        }

    item = sync_run_with_execution(item)

    return {
        "statusCode": 200,
        "headers": CORS_HEADERS,
        "body": json.dumps(item, default=str),
    }


def start_review(event: dict) -> dict:
    body = event.get("body", "{}")
    if isinstance(body, str):
        body = json.loads(body)

    pr_url = body.get("prUrl")
    if not pr_url:
        return {
            "statusCode": 400,
            "headers": CORS_HEADERS,
            "body": json.dumps({"error": "Missing prUrl in request body"}),
        }

    if not state_machine_arn:
        return {
            "statusCode": 500,
            "headers": CORS_HEADERS,
            "body": json.dumps({"error": "STATE_MACHINE_ARN is not configured"}),
        }

    run_id = f"run_{datetime.now(timezone.utc).strftime('%Y%m%d')}_{uuid.uuid4().hex[:8]}"
    now_iso = datetime.now(timezone.utc).isoformat()

    table.put_item(
        Item={
            "runId": run_id,
            "prUrl": pr_url,
            "status": "STARTED",
            "createdAt": now_iso,
            "updatedAt": now_iso,
            "securityFindings": [],
            "qualityFindings": [],
            "logicFindings": [],
            "finalReview": "",
            "githubCommentUrl": "",
            "approvedBy": "",
            "rejectedReason": "",
            "executionArn": "",
        }
    )

    execution = sfn_client.start_execution(
        stateMachineArn=state_machine_arn,
        name=run_id,
        input=json.dumps({"runId": run_id, "prUrl": pr_url}),
    )

    table.update_item(
        Key={"runId": run_id},
        UpdateExpression="SET executionArn = :arn, updatedAt = :updatedAt",
        ExpressionAttributeValues={
            ":arn": execution["executionArn"],
            ":updatedAt": datetime.now(timezone.utc).isoformat(),
        },
    )

    return {
        "statusCode": 200,
        "headers": CORS_HEADERS,
        "body": json.dumps({"runId": run_id, "message": "Review pipeline started"}),
    }
