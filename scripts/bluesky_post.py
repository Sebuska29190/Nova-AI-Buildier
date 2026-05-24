#!/usr/bin/env python3
"""Post a text message to Bluesky via AT Protocol."""
import json, os, sys, requests

BSKY_HOST = "https://bsky.social/xrpc"

def post(identifier: str, password: str, text: str, lang: str = "en"):
    # Login
    r = requests.post(f"{BSKY_HOST}/com.atproto.server.createSession", json={
        "identifier": identifier, "password": password
    }, timeout=15)
    r.raise_for_status()
    session = r.json()
    access_jwt = session["accessJwt"]
    did = session["did"]
    handle = session["handle"]

    headers = {"Authorization": f"Bearer {access_jwt}", "Content-Type": "application/json"}

    # Create post
    record = {
        "$type": "app.bsky.feed.post",
        "text": text[:300],
        "createdAt": datetime.utcnow().isoformat() + "Z",
        "langs": [lang],
    }
    r2 = requests.post(f"{BSKY_HOST}/com.atproto.repo.createRecord", headers=headers, json={
        "repo": did, "collection": "app.bsky.feed.post", "record": record
    }, timeout=15)
    r2.raise_for_status()
    uri = r2.json()["uri"]
    rkey = uri.split("/")[-1]
    url = f"https://bsky.app/profile/{handle}/post/{rkey}"
    return url

if __name__ == "__main__":
    from datetime import datetime
    identifier = os.environ.get("BSKY_IDENTIFIER") or sys.argv[1]
    password = os.environ.get("BSKY_APP_PASSWORD") or sys.argv[2]
    text = sys.argv[3] if len(sys.argv) > 3 else sys.stdin.read().strip()
    lang = sys.argv[4] if len(sys.argv) > 4 else "en"

    url = post(identifier, password, text, lang)
    print(f"✅ Posted: {url}")
