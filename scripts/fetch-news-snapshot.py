#!/usr/bin/env python3
"""Fetch a bounded snapshot of public RSS headlines for the static dashboard."""
import json
import sys
import time
import urllib.error
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from pathlib import Path

SOURCES = {
    "aljazeera": ("https://www.aljazeera.com/xml/rss/all.xml", {"www.aljazeera.com"}),
    "reuters": ("https://news.google.com/rss/search?q=when:2d+site:reuters.com/world&ceid=US:en&hl=en-US&gl=US", {"news.google.com", "www.reuters.com"}),
    "ap": ("https://news.google.com/rss/search?q=when:2d+site:apnews.com&ceid=US:en&hl=en-US&gl=US", {"news.google.com", "apnews.com", "www.apnews.com"}),
    "dw": ("https://rss.dw.com/rdf/rss-en-all", {"www.dw.com", "dw.com"}),
    "guardian": ("https://www.theguardian.com/world/rss", {"www.theguardian.com"}),
    "bbc": ("https://feeds.bbci.co.uk/news/world/rss.xml", {"www.bbc.co.uk", "www.bbc.com"}),
}
MAX_ITEMS_PER_SOURCE = 30
MAX_AGE_SECONDS = 48 * 60 * 60
USER_AGENT = "Cyber-Threat-Map-News-Snapshot/1.0 (+https://github.com/dellongrant97-dev/Cyber-Threat-Map)"

def text(node, name):
    child = node.find(name)
    return (child.text or "").strip() if child is not None else ""

def main():
    now = time.time()
    feeds = {}
    failures = []
    for source_id, (feed_url, allowed_hosts) in SOURCES.items():
        request = urllib.request.Request(feed_url, headers={"User-Agent": USER_AGENT, "Accept": "application/rss+xml, application/xml, text/xml"})
        try:
            with urllib.request.urlopen(request, timeout=15) as response:
                if response.status != 200:
                    raise ValueError("HTTP " + str(response.status))
                payload = response.read(2_000_000)
            root = ET.fromstring(payload)
            items = []
            for item in root.findall(".//item"):
                title = text(item, "title")
                link = text(item, "link")
                description = text(item, "description")
                pub_date = text(item, "pubDate")
                if not title or not link or not pub_date:
                    continue
                # The browser performs the final publisher-host and 48-hour validation.
                items.append({"title": title, "link": link, "description": description, "pubDate": pub_date})
                if len(items) >= MAX_ITEMS_PER_SOURCE:
                    break
            if items:
                feeds[source_id] = items
            else:
                failures.append(source_id + ": no readable RSS items")
        except Exception as error:
            failures.append(source_id + ": " + str(error)[:180])
    if not feeds:
        print("All public news feeds failed; refusing to publish an empty snapshot.", file=sys.stderr)
        for failure in failures:
            print(failure, file=sys.stderr)
        return 1
    output = {
        "generatedAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "feeds": feeds,
        "sourceFailures": failures,
    }
    destination = Path("public/news-snapshot.json")
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(json.dumps(output, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    print("Saved snapshot: " + str(sum(map(len, feeds.values()))) + " headlines from " + str(len(feeds)) + " publisher feeds.")
    if failures:
        print("Unavailable feeds: " + "; ".join(failures))
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
