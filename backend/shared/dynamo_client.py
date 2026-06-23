import boto3
import os
from datetime import datetime, timezone
from typing import Any

dynamodb = boto3.resource("dynamodb")
table_name = os.environ.get("DYNAMODB_TABLE", "pr-reviews")
table = dynamodb.Table(table_name)

FINDINGS_FIELDS = {
    "security": "securityFindings",
    "quality": "qualityFindings",
    "logic": "logicFindings",
}


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def get_run(run_id: str) -> dict[str, Any] | None:
    response = table.get_item(Key={"runId": run_id})
    return response.get("Item")


def list_runs(limit: int = 50) -> list[dict[str, Any]]:
    response = table.scan(
        ProjectionExpression="runId, #s, prUrl, createdAt, updatedAt",
        ExpressionAttributeNames={"#s": "status"},
        Limit=limit,
    )
    items = response.get("Items", [])
    items.sort(key=lambda x: x.get("createdAt", ""), reverse=True)
    return items


def update_run_status(run_id: str, status: str) -> None:
    table.update_item(
        Key={"runId": run_id},
        UpdateExpression="SET #s = :status, updatedAt = :updatedAt",
        ExpressionAttributeNames={"#s": "status"},
        ExpressionAttributeValues={
            ":status": status,
            ":updatedAt": _now_iso(),
        },
    )


def update_run_review(run_id: str, review: str) -> None:
    table.update_item(
        Key={"runId": run_id},
        UpdateExpression="SET finalReview = :r, updatedAt = :updatedAt",
        ExpressionAttributeValues={
            ":r": review,
            ":updatedAt": _now_iso(),
        },
    )


def update_findings(run_id: str, agent: str, findings: list) -> None:
    field = FINDINGS_FIELDS.get(agent)
    if not field:
        raise ValueError(f"Unknown agent: {agent}")
    table.update_item(
        Key={"runId": run_id},
        UpdateExpression=f"SET {field} = :findings, updatedAt = :updatedAt",
        ExpressionAttributeValues={
            ":findings": findings,
            ":updatedAt": _now_iso(),
        },
    )


def update_comment_url(run_id: str, comment_url: str) -> None:
    table.update_item(
        Key={"runId": run_id},
        UpdateExpression="SET githubCommentUrl = :url, updatedAt = :updatedAt",
        ExpressionAttributeValues={
            ":url": comment_url,
            ":updatedAt": _now_iso(),
        },
    )


def update_run_approval(run_id: str, approved_by: str) -> None:
    table.update_item(
        Key={"runId": run_id},
        UpdateExpression="SET #s = :status, approvedBy = :by, updatedAt = :updatedAt",
        ExpressionAttributeNames={"#s": "status"},
        ExpressionAttributeValues={
            ":status": "APPROVED",
            ":by": approved_by,
            ":updatedAt": _now_iso(),
        },
    )


def update_run_rejection(run_id: str, reason: str) -> None:
    table.update_item(
        Key={"runId": run_id},
        UpdateExpression="SET #s = :status, rejectedReason = :reason, updatedAt = :updatedAt",
        ExpressionAttributeNames={"#s": "status"},
        ExpressionAttributeValues={
            ":status": "REJECTED",
            ":reason": reason,
            ":updatedAt": _now_iso(),
        },
    )


def update_run_failed(run_id: str, reason: str = "Pipeline error") -> None:
    table.update_item(
        Key={"runId": run_id},
        UpdateExpression="SET #s = :status, rejectedReason = :reason, updatedAt = :updatedAt",
        ExpressionAttributeNames={"#s": "status"},
        ExpressionAttributeValues={
            ":status": "FAILED",
            ":reason": reason,
            ":updatedAt": _now_iso(),
        },
    )
