#!/usr/bin/env python3
"""Local smoke test for Gemini integration.

Usage:
    cp .env.example .env   # set GEMINI_API_KEY
    pip install -r requirements.txt
    python scripts/test_gemini_local.py
"""

from __future__ import annotations

import logging
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

from dotenv import load_dotenv

load_dotenv(ROOT / ".env")

from shared.gemini_client import call_gemini

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger(__name__)

SECURITY_PROMPT = """You are a security code reviewer.
Analyse ONLY for security vulnerabilities: SQL injection,
hardcoded secrets, XSS, insecure dependencies, broken auth,
exposed sensitive data.
Return ONLY valid JSON with no extra text:
{"findings": [{"issue": "description", "severity": "high|medium|low", "file": "filename", "line": "line number or range"}]}
If no issues found, return: {"findings": []}"""

SAMPLE_DIFF = """diff --git a/config.py b/config.py
index abc123..def456 100644
--- a/config.py
+++ b/config.py
@@ -1,3 +1,4 @@
+API_KEY = "sk-live-hardcoded-secret-12345"
 DATABASE_URL = "postgresql://user:pass@localhost/db"
"""

def main() -> int:
    if not os.environ.get("GEMINI_API_KEY"):
        logger.error("GEMINI_API_KEY is not set. Copy .env.example to .env and add your key.")
        return 1

    logger.info("Calling Gemini (%s) with sample diff...", os.environ.get("GEMINI_MODEL", "gemini-2.5-flash-lite"))
    result = call_gemini(SECURITY_PROMPT, f"Review this PR diff:\n\n{SAMPLE_DIFF}")

    if not isinstance(result, dict):
        logger.error("Expected dict response, got: %s", type(result))
        return 1

    if "findings" not in result:
        logger.error("Response missing 'findings' key: %s", result)
        return 1

    logger.info("Findings: %s", result["findings"])
    logger.info("PASS — local Gemini test succeeded")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
