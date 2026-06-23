import google.generativeai as genai
import json
import logging
import os
import time
import boto3
from google.api_core import exceptions as google_exceptions

logger = logging.getLogger(__name__)

# gemini-2.0-flash was shut down June 2026 — use 2.5+ (override via GEMINI_MODEL env var)
DEFAULT_MODEL = "gemini-2.5-flash-lite"
MAX_DIFF_CHARS = int(os.environ.get("GEMINI_MAX_DIFF_CHARS", "80000"))


def get_gemini_key() -> str:
    api_key = os.environ.get("GEMINI_API_KEY")
    if api_key:
        return api_key

    client = boto3.client("secretsmanager")
    secret = client.get_secret_value(SecretId="pr-review/gemini-key")
    return secret["SecretString"]


def get_model_name() -> str:
    return os.environ.get("GEMINI_MODEL", DEFAULT_MODEL)


def _strip_json_fences(text: str) -> str:
    if text.startswith("```"):
        text = text.split("```")[1]
        if text.startswith("json"):
            text = text[4:]
    return text.strip()


def _truncate_content(content: str) -> str:
    if len(content) <= MAX_DIFF_CHARS:
        return content
    logger.warning("Truncating input from %d to %d chars", len(content), MAX_DIFF_CHARS)
    return content[:MAX_DIFF_CHARS] + "\n\n[... diff truncated for token limits ...]"


def call_gemini(system_prompt: str, user_content: str, expect_json: bool = True) -> dict | str:
    genai.configure(api_key=get_gemini_key())
    model_name = get_model_name()
    model = genai.GenerativeModel(
        model_name=model_name,
        system_instruction=system_prompt,
    )

    content = _truncate_content(user_content)
    max_retries = 3

    for attempt in range(max_retries):
        try:
            response = model.generate_content(content)
            text = response.text.strip()
            break
        except google_exceptions.ResourceExhausted as exc:
            if attempt == max_retries - 1:
                raise
            wait = 30 * (attempt + 1)
            logger.warning("Gemini rate limit (attempt %d/%d), retrying in %ds: %s",
                           attempt + 1, max_retries, wait, exc)
            time.sleep(wait)

    if not expect_json:
        return text

    try:
        return json.loads(_strip_json_fences(text))
    except json.JSONDecodeError:
        logger.warning("Gemini returned invalid JSON, using empty findings fallback")
        return {"findings": []}
