import json
import logging
from shared.github_client import get_pr_diff
from shared.dynamo_client import update_run_status

logger = logging.getLogger()
logger.setLevel(logging.INFO)


def handler(event: dict, context) -> dict:
    """Fetch PR diff from GitHub API."""
    logger.info("Event received: %s", json.dumps(event))

    try:
        return process(event)
    except Exception as exc:
        logger.error("Error: %s", str(exc))
        raise


def process(event: dict) -> dict:
    run_id = event["runId"]
    pr_url = event["prUrl"]
    
    update_run_status(run_id, "FETCHING")
    diff = get_pr_diff(pr_url)
    
    return {
        "runId": run_id,
        "diff": diff
    }
