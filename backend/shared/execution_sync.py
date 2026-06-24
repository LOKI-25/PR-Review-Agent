import logging
import os

import boto3
from botocore.exceptions import ClientError

from shared.dynamo_client import get_run, update_run_failed

logger = logging.getLogger(__name__)

sfn_client = boto3.client("stepfunctions")

TERMINAL_STATUSES = frozenset({"APPROVED", "REJECTED", "FAILED", "AWAITING_APPROVAL"})
SFN_FAILED_STATUSES = frozenset({"FAILED", "TIMED_OUT", "ABORTED"})


def execution_arn_for_run(run_id: str, execution_arn: str | None = None) -> str | None:
    if execution_arn:
        return execution_arn

    state_machine_arn = os.environ.get("STATE_MACHINE_ARN")
    if not state_machine_arn or ":stateMachine:" not in state_machine_arn:
        return None

    machine_name = state_machine_arn.rsplit(":", 1)[-1]
    prefix = state_machine_arn.replace(":stateMachine:", ":execution:", 1).rsplit(":", 1)[0]
    return f"{prefix}:{machine_name}:{run_id}"


def sync_run_with_execution(item: dict) -> dict:
    """Align DynamoDB status with Step Functions when the pipeline has failed."""
    status = item.get("status", "")
    if status in TERMINAL_STATUSES:
        return item

    run_id = item["runId"]
    arn = execution_arn_for_run(run_id, item.get("executionArn"))
    if not arn:
        return item

    try:
        response = sfn_client.describe_execution(executionArn=arn)
    except ClientError as exc:
        logger.warning("Could not describe execution %s: %s", arn, exc)
        return item

    sfn_status = response.get("status", "")
    if sfn_status not in SFN_FAILED_STATUSES:
        return item

    error = response.get("error") or "PipelineFailed"
    cause = response.get("cause") or sfn_status
    reason = f"{error}: {cause}"[:500]
    update_run_failed(run_id, reason)
    return get_run(run_id) or item
