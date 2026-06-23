import json
import logging
from shared.gemini_client import call_gemini
from shared.dynamo_client import update_findings

logger = logging.getLogger()
logger.setLevel(logging.INFO)

SYSTEM_PROMPT = """You are a code quality reviewer.
Analyse ONLY for code quality issues: poor naming conventions, lack of readability, 
code duplication (DRY principle violations), high complexity, and missing standard best practices.
Return ONLY valid JSON with no extra text:
{"findings": [{"issue": "description", "severity": "high|medium|low", "file": "filename", "line": "line number or range"}]}
If no issues found, return: {"findings": []}"""


def handler(event: dict, context) -> dict:
    """Code quality-focused Gemini review agent."""
    logger.info("Event received: %s", json.dumps(event))

    try:
        return process(event)
    except Exception as exc:
        logger.error("Error: %s", str(exc))
        raise


def process(event: dict) -> dict:
    run_id = event["runId"]
    diff = event["fetchResult"]["diff"]
    
    result = call_gemini(SYSTEM_PROMPT, f"Review this PR diff:\n\n{diff}")
    findings = result.get("findings", [])
    update_findings(run_id, "quality", findings)

    return {
        "agent": "quality",
        "runId": run_id,
        "findings": findings,
    }
