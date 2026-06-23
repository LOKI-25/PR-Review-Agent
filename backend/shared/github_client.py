import urllib.request
import re
import os
import json
import boto3

def get_github_token() -> str:
    token = os.environ.get("GITHUB_TOKEN")
    if token:
        return token
    client = boto3.client("secretsmanager")
    secret = client.get_secret_value(SecretId="pr-review/github-token")
    return secret["SecretString"]

def parse_pr_url(pr_url: str) -> tuple[str, str, str]:
    match = re.match(r"https://github\.com/([^/]+)/([^/]+)/pull/(\d+)", pr_url)
    if not match:
        raise ValueError(f"Invalid GitHub PR URL: {pr_url}")
    return match.group(1), match.group(2), match.group(3)

def get_pr_diff(pr_url: str) -> str:
    owner, repo, pr_number = parse_pr_url(pr_url)
    api_url = f"https://api.github.com/repos/{owner}/{repo}/pulls/{pr_number}"
    
    req = urllib.request.Request(api_url)
    req.add_header("Authorization", f"Bearer {get_github_token()}")
    req.add_header("Accept", "application/vnd.github.v3.diff")
    with urllib.request.urlopen(req) as response:
        return response.read().decode("utf-8")

def post_pr_comment(pr_url: str, body: str) -> str:
    owner, repo, pr_number = parse_pr_url(pr_url)
    api_url = f"https://api.github.com/repos/{owner}/{repo}/issues/{pr_number}/comments"
    
    data = json.dumps({"body": body}).encode("utf-8")
    req = urllib.request.Request(api_url, data=data, method="POST")
    req.add_header("Authorization", f"Bearer {get_github_token()}")
    req.add_header("Accept", "application/vnd.github.v3+json")
    req.add_header("Content-Type", "application/json")
    
    with urllib.request.urlopen(req) as response:
        resp_data = json.loads(response.read().decode("utf-8"))
        return resp_data.get("html_url", "")