#!/usr/bin/env python3
"""
Bluesky news poster — fetches latest news from RSS feeds, posts 5 updates to Bluesky.
Runs as a no_agent cron job — no LLM needed.
"""
import json, os, requests, xml.etree.ElementTree as ET
from datetime import datetime, timezone
from typing import Optional

BSKY_HOST = "https://bsky.social/xrpc"

# Free RSS feeds for each topic (no API key needed)
RSS_FEEDS = {
    "Ukraine war": "https://rss.nytimes.com/services/xml/rss/nyt/World.xml",
    "USA politics": "https://feeds.bbci.co.uk/news/world/us_and_canada/rss.xml",
    "Iran": "https://rss.aljazeera.com/automanual/mideast.xml",
    "Trump": "https://feeds.bbci.co.uk/news/world/us_and_canada/rss.xml",
    "Mexico": "https://rss.nytimes.com/services/xml/rss/nyt/World.xml",
}

def fetch_rss(url: str, keyword: str, max_items: int = 3) -> list[dict]:
    """Fetch RSS feed and filter items by keyword."""
    try:
        r = requests.get(url, timeout=15, headers={"User-Agent": "Mozilla/5.0"})
        r.raise_for_status()
        root = ET.fromstring(r.content)
        items = []
        for item in root.iter("item"):
            title = item.findtext("title", "")
            desc = item.findtext("description", "")
            link = item.findtext("link", "")
            text = f"{title} {desc}"
            if keyword.lower() in text.lower():
                items.append({"title": title, "link": link, "desc": desc[:200]})
                if len(items) >= max_items:
                    break
        return items
    except Exception as e:
        return [{"title": f"[RSS error: {e}]", "link": "", "desc": ""}]

def login(identifier: str, password: str) -> tuple[str, str, str]:
    """Login to Bluesky, return (accessJwt, did, handle)."""
    r = requests.post(f"{BSKY_HOST}/com.atproto.server.createSession", json={
        "identifier": identifier, "password": password
    }, timeout=15)
    r.raise_for_status()
    s = r.json()
    return s["accessJwt"], s["did"], s["handle"]

def post_bluesky(access_jwt: str, did: str, text: str, lang: str = "en") -> str:
    """Post to Bluesky, return post URL."""
    record = {
        "$type": "app.bsky.feed.post",
        "text": text[:300],
        "createdAt": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.000Z"),
        "langs": [lang],
    }
    r = requests.post(f"{BSKY_HOST}/com.atproto.repo.createRecord", headers={
        "Authorization": f"Bearer {access_jwt}", "Content-Type": "application/json"
    }, json={"repo": did, "collection": "app.bsky.feed.post", "record": record}, timeout=15)
    r.raise_for_status()
    uri = r.json()["uri"]
    rkey = uri.split("/")[-1]
    return f"https://bsky.app/profile/{handle}/post/{rkey}"

def get_recent_posts(access_jwt: str, did: str, handle: str, limit: int = 20) -> list[str]:
    """Get text of recent posts to detect duplicates."""
    r = requests.get(f"{BSKY_HOST}/app.bsky.feed.getAuthorFeed?actor={handle}&limit={limit}&filter=posts_no_replies", headers={
        "Authorization": f"Bearer {access_jwt}"
    }, timeout=15)
    if r.status_code != 200:
        return []
    data = r.json()
    texts = []
    for item in data.get("feed", []):
        txt = item["post"]["record"].get("text", "")
        texts.append(txt[:80])  # Compare first 80 chars
    return texts

def format_post(topic: str, news_item: dict) -> str:
    """Format a news item into a post."""
    title = news_item.get("title", "")
    desc = news_item.get("desc", "")
    link = news_item.get("link", "")
    text = f"📰 {topic}: {title}"
    if len(text) < 250 and desc:
        text += f" — {desc[:200]}"
    if len(text) < 280:
        text = text[:280]
    else:
        text = text[:277] + "..."
    return text


if __name__ == "__main__":
    identifier = os.environ.get("BSKY_IDENTIFIER", "")
    password = os.environ.get("BSKY_APP_PASSWORD", "")
    if not identifier or not password:
        print("❌ Missing BSKY_IDENTIFIER or BSKY_APP_PASSWORD env vars", flush=True)
        exit(1)

    print(f"🤖 Bluesky News Poster — {datetime.now().isoformat()}", flush=True)
    print(f"   Account: {identifier}", flush=True)

    # Login once
    access_jwt, did, handle = login(identifier, password)
    print(f"✅ Logged in as @{handle}", flush=True)

    # Get recent posts to avoid duplicates
    recent = get_recent_posts(access_jwt, did, handle)
    print(f"📋 Recent posts: {len(recent)} (for dedup)", flush=True)

    # Fetch news for each topic
    posted = 0
    skipped = 0
    for topic, feed_url in RSS_FEEDS.items():
        print(f"\n🔍 {topic}...", flush=True)
        items = fetch_rss(feed_url, topic.split(" ")[0])
        if not items:
            print(f"   ⚠️ No news found for {topic}", flush=True)
            continue

        news_item = items[0]
        post_text = format_post(topic, news_item)

        # Dedup check
        if any(post_text[:60] in r for r in recent):
            print(f"   ⏭️ Duplicate, skipping: {post_text[:60]}...", flush=True)
            skipped += 1
            continue

        try:
            url = post_bluesky(access_jwt, did, post_text)
            print(f"   ✅ {url}", flush=True)
            posted += 1
        except Exception as e:
            print(f"   ❌ Post failed: {e}", flush=True)

    print(f"\n📊 Done: {posted} posted, {skipped} skipped", flush=True)
    if posted == 0:
        print("No new posts — everything was already posted recently.", flush=True)
        exit(0)
