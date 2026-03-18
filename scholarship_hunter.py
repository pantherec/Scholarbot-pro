#!/usr/bin/env python3
"""
ScholarBot Pro — Scholarship Hunter
Discovers new scholarship opportunities using DuckDuckGo search + AI extraction.
Modeled after job_hunter.py but optimized for scholarship discovery.

Usage:
  python scholarship_hunter.py                     # Run with default categories
  python scholarship_hunter.py --categories stem minority   # Run specific categories
  python scholarship_hunter.py --max-results 500   # Cap total results
  python scholarship_hunter.py --dry-run            # Search only, no AI extraction

Requirements:
  pip install requests beautifulsoup4 duckduckgo-search python-dotenv google-genai

Environment:
  GEMINI_API_KEY  — Google Gemini API key (or set in .env file)
  ANTHROPIC_API_KEY — Anthropic API key for Claude verification (optional, for Phase 4)
"""

import csv
import hashlib
import json
import logging
import os
import re
import sys
import time
import argparse
from datetime import datetime
from pathlib import Path

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

import requests
from bs4 import BeautifulSoup

try:
    from duckduckgo_search import DDGS
except ImportError:
    print("ERROR: Install duckduckgo-search: pip install duckduckgo-search")
    sys.exit(1)

try:
    from google import genai
    HAS_GEMINI = True
except ImportError:
    HAS_GEMINI = False
    print("WARNING: google-genai not installed. Running in search-only mode.")
    print("  Install with: pip install google-genai")

# ============================================================
# CONFIG
# ============================================================
SCRIPT_DIR = Path(__file__).parent
OUTPUT_FILE = SCRIPT_DIR / "scholarship_leads.csv"
MASTER_FILE = SCRIPT_DIR / "scholarship_master_clean.csv"
LOG_FILE = SCRIPT_DIR / "scholarship_hunter.log"

SEARCH_DELAY = 2.0        # Seconds between DuckDuckGo searches
FETCH_DELAY = 1.5         # Seconds between page fetches
MAX_CONTENT_LENGTH = 12000 # Max chars to extract from a page
MAX_RETRIES = 2
LEGITIMACY_THRESHOLD = 65  # Minimum AI legitimacy score to keep
MAX_RESULTS_PER_QUERY = 5  # DuckDuckGo results per query

# Gemini config
GEMINI_MODEL = "gemini-2.5-pro"

# ============================================================
# SEARCH CATEGORIES — Targeted queries for scholarship discovery
# ============================================================
SEARCH_CATEGORIES = {
    "stem": [
        '"scholarship" "2026" "computer science" OR "engineering" OR "STEM" site:*.org',
        '"scholarship" "2026" "science" "apply now" site:*.org',
        '"STEM scholarship" "high school senior" "2026" "deadline"',
        '"engineering scholarship" "apply" "2026-2027" -blog -list',
        '"computer science scholarship" "full tuition" OR "$10,000" OR "$20,000" "2026"',
    ],
    "minority": [
        '"scholarship" "African American" OR "Black students" "2026" site:*.org',
        '"Hispanic" OR "Latino" "scholarship" "2026" "apply" site:*.org',
        '"Native American" OR "Indigenous" "scholarship" "2026" site:*.org',
        '"Asian American" OR "Pacific Islander" "scholarship" "2026"',
        '"minority scholarship" "high school senior" "deadline" "2026"',
        '"HBCU scholarship" "2026" "apply" site:*.org',
    ],
    "first_gen": [
        '"first generation" "scholarship" "2026" "college" site:*.org',
        '"first-generation college student" "scholarship" "apply"',
        '"first in family" "scholarship" "2026" deadline',
    ],
    "need_based": [
        '"need-based scholarship" "2026" "Pell" OR "financial need" site:*.org',
        '"low income" "scholarship" "full tuition" OR "full ride" "2026"',
        '"scholarship" "EFC" OR "FAFSA" "2026" "apply" site:*.org',
    ],
    "merit": [
        '"merit scholarship" "high school senior" "GPA" "2026" site:*.org',
        '"academic excellence" "scholarship" "$10,000" OR "$20,000" OR "$25,000" "2026"',
        '"National Merit" OR "honors" "scholarship" "2026" "apply"',
    ],
    "community_service": [
        '"community service" "scholarship" "2026" "apply" site:*.org',
        '"volunteer" "scholarship" "high school" "2026" "deadline"',
        '"leadership" "scholarship" "community" "2026" site:*.org',
    ],
    "state_specific": [
        '"New York" "scholarship" "2026" "high school senior" site:*.org',
        '"California" "scholarship" "2026" "apply" site:*.org',
        '"Texas" "scholarship" "2026" "deadline" site:*.org',
        '"Florida" "scholarship" "2026" "apply" site:*.org',
        '"state scholarship" "2026" "resident" "apply"',
    ],
    "creative_arts": [
        '"arts scholarship" OR "music scholarship" OR "writing scholarship" "2026" site:*.org',
        '"performing arts" "scholarship" "2026" "apply"',
        '"creative writing" OR "visual arts" "scholarship" "2026"',
    ],
    "women": [
        '"women in STEM" "scholarship" "2026" site:*.org',
        '"scholarship" "women" OR "female" "2026" "apply" site:*.org',
        '"women engineers" OR "women scientists" "scholarship" "2026"',
    ],
    "edu_sites": [
        '"scholarship" "2026" "deadline" "apply" site:*.edu',
        '"external scholarships" "2026" site:*.edu',
        '"scholarship database" "2026-2027" site:*.edu',
    ],
}

# ============================================================
# LOGGING
# ============================================================
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.FileHandler(LOG_FILE, encoding="utf-8"),
        logging.StreamHandler(),
    ]
)
log = logging.getLogger("scholarship_hunter")


# ============================================================
# UTILITIES
# ============================================================
def generate_id(name, link=""):
    raw = (name.strip().lower() + link.strip().lower()).encode("utf-8")
    return hashlib.md5(raw).hexdigest()[:8]


def load_seen_links():
    """Load existing scholarship links to avoid duplicates."""
    seen = set()
    for fpath in [OUTPUT_FILE, MASTER_FILE]:
        if fpath.exists():
            with open(fpath, "r", encoding="utf-8") as f:
                reader = csv.DictReader(f)
                for row in reader:
                    link = (row.get("link") or "").strip().lower().rstrip("/")
                    name = (row.get("name") or "").strip().lower()
                    if link:
                        seen.add(link)
                    if name:
                        seen.add(name)
    return seen


def fetch_page(url, timeout=15):
    """Fetch and extract text content from a URL."""
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
    for attempt in range(MAX_RETRIES):
        try:
            resp = requests.get(url, headers=headers, timeout=timeout, allow_redirects=True)
            resp.raise_for_status()
            soup = BeautifulSoup(resp.text, "html.parser")

            # Remove noise elements
            for tag in soup.find_all(["script", "style", "nav", "footer", "header", "aside", "iframe"]):
                tag.decompose()

            # Try to find main content
            main = soup.find("main") or soup.find("article") or soup.find("div", {"role": "main"})
            if main:
                text = main.get_text(separator="\n", strip=True)
            else:
                text = soup.get_text(separator="\n", strip=True)

            # Clean up
            text = re.sub(r'\n{3,}', '\n\n', text)
            text = re.sub(r' {2,}', ' ', text)
            return text[:MAX_CONTENT_LENGTH]

        except Exception as e:
            if attempt < MAX_RETRIES - 1:
                time.sleep(2 ** attempt)
            else:
                log.warning(f"Failed to fetch {url}: {e}")
                return None


def extract_with_gemini(page_text, url, client):
    """Use Gemini to extract scholarship data from page content."""
    prompt = f"""Analyze this webpage content and determine if it contains a REAL scholarship opportunity.

URL: {url}

PAGE CONTENT:
{page_text[:8000]}

INSTRUCTIONS:
1. If this is NOT a real scholarship application/info page (e.g., it's a blog post, listicle, news article, or spam), respond with: {{"is_scholarship": false}}

2. If this IS a real scholarship, extract the details and respond with:
{{
  "is_scholarship": true,
  "name": "Official scholarship name",
  "organization": "Organization offering it",
  "criteria": "Eligibility requirements (2-3 sentences max)",
  "amount": "Award amount or range",
  "deadline": "Deadline in YYYY-MM-DD format if available, otherwise descriptive text",
  "need_based": "Y" or "N",
  "legitimacy_score": 0-100,
  "red_flags": ["list any concerns"]
}}

LEGITIMACY SCORING:
- 90-100: Major foundation, government, or university scholarship with clear .org/.edu/.gov domain
- 70-89: Established organization, verifiable, no red flags
- 50-69: Uncertain — limited info, unclear organization, or unverifiable
- Below 50: Likely scam, requires payment, or suspicious

Respond with ONLY the JSON object, no other text."""

    try:
        response = client.models.generate_content(
            model=GEMINI_MODEL,
            contents=prompt,
            config={
                "response_mime_type": "application/json",
                "temperature": 0.1,
            }
        )
        text = response.text.strip()
        # Parse JSON
        data = json.loads(text)
        return data
    except json.JSONDecodeError:
        # Try to extract JSON from response
        match = re.search(r'\{[\s\S]*\}', text)
        if match:
            try:
                return json.loads(match.group())
            except json.JSONDecodeError:
                pass
        log.warning(f"Failed to parse Gemini response for {url}")
        return None
    except Exception as e:
        log.warning(f"Gemini extraction error for {url}: {e}")
        return None


def search_scholarships(categories, max_total=1000):
    """Search DuckDuckGo for scholarship pages."""
    all_results = []
    seen_urls = set()

    for cat_name, queries in categories.items():
        log.info(f"\n{'='*40}")
        log.info(f"CATEGORY: {cat_name.upper()}")
        log.info(f"{'='*40}")

        for query in queries:
            try:
                with DDGS() as ddgs:
                    results = list(ddgs.text(query, max_results=MAX_RESULTS_PER_QUERY))
            except Exception as e:
                log.warning(f"Search failed for query: {e}")
                results = []

            for r in results:
                url = r.get("href", "").strip()
                if not url or url in seen_urls:
                    continue
                # Filter out obvious non-scholarship pages
                if any(skip in url.lower() for skip in [
                    "youtube.com", "facebook.com", "twitter.com", "instagram.com",
                    "reddit.com", "quora.com", "wikipedia.org", "amazon.com",
                    "niche.com/colleges", "collegeboard.org/membership",
                ]):
                    continue

                seen_urls.add(url)
                all_results.append({
                    "url": url,
                    "title": r.get("title", ""),
                    "snippet": r.get("body", ""),
                    "category": cat_name,
                })

            log.info(f"  Query yielded {len(results)} results | Total unique: {len(all_results)}")
            time.sleep(SEARCH_DELAY)

            if len(all_results) >= max_total:
                log.info(f"Reached max total ({max_total}). Stopping search.")
                return all_results

    return all_results


def main():
    parser = argparse.ArgumentParser(description="ScholarBot Pro — Scholarship Hunter")
    parser.add_argument("--categories", nargs="*", default=None,
                       help=f"Categories to search. Options: {', '.join(SEARCH_CATEGORIES.keys())}")
    parser.add_argument("--max-results", type=int, default=500,
                       help="Maximum total search results to process (default: 500)")
    parser.add_argument("--dry-run", action="store_true",
                       help="Search only, skip AI extraction")
    args = parser.parse_args()

    log.info("=" * 60)
    log.info("ScholarBot Pro — Scholarship Hunter")
    log.info("=" * 60)

    # Select categories
    if args.categories:
        categories = {k: v for k, v in SEARCH_CATEGORIES.items() if k in args.categories}
        if not categories:
            log.error(f"No valid categories. Options: {', '.join(SEARCH_CATEGORIES.keys())}")
            return
    else:
        categories = SEARCH_CATEGORIES

    log.info(f"Categories: {', '.join(categories.keys())}")
    log.info(f"Max results: {args.max_results}")

    # Load existing data to avoid duplicates
    seen = load_seen_links()
    log.info(f"Loaded {len(seen)} existing entries for dedup")

    # Phase 1: Search
    log.info("\n[PHASE 1] Searching DuckDuckGo...")
    results = search_scholarships(categories, max_total=args.max_results)
    log.info(f"Found {len(results)} unique URLs")

    # Filter out already-known
    new_results = [r for r in results if r["url"].lower().rstrip("/") not in seen]
    log.info(f"After dedup: {len(new_results)} new URLs to process")

    if args.dry_run:
        log.info("\n[DRY RUN] Writing search results only (no AI extraction)")
        dry_file = SCRIPT_DIR / "scholarship_search_results.csv"
        with open(dry_file, "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=["url", "title", "snippet", "category"])
            writer.writeheader()
            writer.writerows(new_results)
        log.info(f"Wrote {len(new_results)} search results to {dry_file}")
        return

    # Phase 2: Fetch + Extract
    if not HAS_GEMINI:
        log.error("Gemini not available. Use --dry-run or install google-genai.")
        return

    gemini_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
    if not gemini_key:
        log.error("Set GEMINI_API_KEY or GOOGLE_API_KEY environment variable.")
        return

    client = genai.Client(api_key=gemini_key)

    scholarships_found = []
    errors = 0

    log.info(f"\n[PHASE 2] Fetching pages and extracting with Gemini...")
    for i, result in enumerate(new_results):
        url = result["url"]
        log.info(f"\n[{i+1}/{len(new_results)}] {url[:80]}")

        # Fetch page
        page_text = fetch_page(url)
        if not page_text:
            errors += 1
            continue

        # Extract with Gemini
        data = extract_with_gemini(page_text, url, client)
        if not data:
            errors += 1
            continue

        if not data.get("is_scholarship"):
            log.info(f"  SKIP: Not a scholarship page")
            continue

        score = data.get("legitimacy_score", 0)
        name = data.get("name", "Unknown")

        if score < LEGITIMACY_THRESHOLD:
            log.info(f"  SKIP: {name} — Legitimacy {score} < {LEGITIMACY_THRESHOLD}")
            if data.get("red_flags"):
                log.info(f"  Red flags: {', '.join(data['red_flags'])}")
            continue

        # Check if this name is already known
        if name.strip().lower() in seen:
            log.info(f"  SKIP: {name} — Already in database")
            continue

        entry = {
            "id": generate_id(name, url),
            "name": name,
            "criteria": data.get("criteria", ""),
            "link": url,
            "deadline": data.get("deadline", "Varies"),
            "amount": data.get("amount", "Varies"),
            "needBased": data.get("need_based", ""),
            "legitimacy_score": score,
            "organization": data.get("organization", ""),
            "category": result["category"],
            "red_flags": "; ".join(data.get("red_flags", [])),
            "discovered": datetime.now().strftime("%Y-%m-%d"),
        }

        scholarships_found.append(entry)
        seen.add(name.strip().lower())
        seen.add(url.lower().rstrip("/"))
        log.info(f"  FOUND: {name} | ${data.get('amount', 'Varies')} | Score: {score}")

        time.sleep(FETCH_DELAY)

    # Phase 3: Save results
    log.info(f"\n[PHASE 3] Saving results...")
    fieldnames = ["id", "name", "criteria", "link", "deadline", "amount", "needBased",
                  "legitimacy_score", "organization", "category", "red_flags", "discovered"]

    # Append to existing file or create new
    file_exists = OUTPUT_FILE.exists()
    mode = "a" if file_exists else "w"
    with open(OUTPUT_FILE, mode, newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        if not file_exists:
            writer.writeheader()
        writer.writerows(scholarships_found)

    log.info(f"\n{'='*60}")
    log.info(f"HUNT COMPLETE!")
    log.info(f"  URLs searched: {len(results)}")
    log.info(f"  New URLs processed: {len(new_results)}")
    log.info(f"  Scholarships found: {len(scholarships_found)}")
    log.info(f"  Errors: {errors}")
    log.info(f"  Output: {OUTPUT_FILE}")
    log.info(f"{'='*60}")

    if scholarships_found:
        log.info("\nTop discoveries:")
        for s in sorted(scholarships_found, key=lambda x: -x.get("legitimacy_score", 0))[:10]:
            log.info(f"  [{s['legitimacy_score']}] {s['name']} — {s['amount']} ({s['category']})")


if __name__ == "__main__":
    main()
