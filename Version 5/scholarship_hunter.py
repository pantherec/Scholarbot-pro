"""
ScholarBot Pro — Scholarship Hunter Engine
==========================================
Automated scholarship discovery, validation, and database update tool.
Modeled after job_hunter.py but purpose-built for scholarship applications.

Usage:
    python scholarship_hunter.py

Requires:
    - GEMINI_API_KEY in .env
    - pip install google-genai python-dotenv duckduckgo-search beautifulsoup4 requests
"""

import csv
import json
import logging
import os
import re
import time
from datetime import datetime
from typing import Dict, List, Optional, Set

import requests
from bs4 import BeautifulSoup
from ddgs import DDGS
from dotenv import load_dotenv
from google import genai
from google.genai import types

# --- CONFIGURATION ---
load_dotenv()
GEMINI_MODEL = "gemini-2.5-pro"
LOGS_BASE = os.path.join(".", "logs")
LOG_FILE = os.path.join(LOGS_BASE, "scholarship_hunter.log")
logger = logging.getLogger("scholarship_hunter")

# Scholarship aggregator sites to search through
SCHOLARSHIP_SITES = [
    "site:fastweb.com",
    "site:scholarships.com",
    "site:bold.org",
    "site:scholly.com",
    "site:unigo.com",
    "site:cappex.com",
    "site:chegg.com/scholarships",
    "site:niche.com/scholarships",
    "site:goingmerry.com",
    "site:scholarshipowl.com",
]

# Foundation and organization sites
FOUNDATION_SITES = [
    "site:jkcf.org",
    "site:uncf.org",
    "site:hsf.net",
    "site:thegatesscholarship.org",
    "site:coca-colascholarsfoundation.org",
    "site:reaganfoundation.org",
    "site:ronbrown.org",
    "site:questbridge.org",
    "site:danielsfund.org",
    "site:apiascholars.org",
]

# Search keyword strategies for different student profiles
SEARCH_STRATEGIES = {
    "general_high_school": {
        "keywords": [
            "scholarship high school senior 2026",
            "scholarship graduating senior 2026",
            "college scholarship first year student",
            "freshman scholarship application open",
            "merit scholarship high school 2026",
        ],
        "description": "Broad search for high school seniors entering college",
    },
    "need_based": {
        "keywords": [
            "need based scholarship low income student",
            "Pell eligible scholarship 2026",
            "first generation college student scholarship",
            "financial need scholarship application",
        ],
        "description": "Financial need focused scholarships",
    },
    "minority_heritage": {
        "keywords": [
            "African American scholarship 2026",
            "Hispanic Latino scholarship college",
            "Asian Pacific Islander scholarship",
            "Native American Indigenous scholarship",
            "minority scholarship STEM",
            "HBCU scholarship incoming freshman",
        ],
        "description": "Heritage and minority-focused scholarships",
    },
    "stem_focused": {
        "keywords": [
            "STEM scholarship high school senior",
            "engineering scholarship 2026",
            "computer science scholarship college",
            "science research scholarship student",
            "women in STEM scholarship",
        ],
        "description": "STEM field scholarships",
    },
    "leadership_service": {
        "keywords": [
            "community service scholarship 2026",
            "leadership scholarship high school",
            "volunteer scholarship application",
            "student leader scholarship college",
            "Eagle Scout scholarship",
        ],
        "description": "Leadership and community service scholarships",
    },
    "creative_arts": {
        "keywords": [
            "arts scholarship portfolio 2026",
            "music scholarship college freshman",
            "creative writing scholarship",
            "performing arts scholarship application",
        ],
        "description": "Arts and creative field scholarships",
    },
    "athletic": {
        "keywords": [
            "athletic scholarship high school senior",
            "scholar athlete scholarship 2026",
            "sports scholarship application",
        ],
        "description": "Athletic and scholar-athlete scholarships",
    },
}


def search_web(query: str, max_results: int = 5, retries: int = 2) -> List[Dict]:
    """Uses DuckDuckGo to find scholarship URLs."""
    print(f"   Searching: {query[:60]}...")
    results: List[Dict] = []
    for attempt in range(retries + 1):
        try:
            with DDGS() as ddgs:
                time.sleep(1.5)
                for r in ddgs.text(query, max_results=max_results):
                    results.append(r)
            return results
        except Exception as exc:
            logger.warning("Search error (attempt %s): %s", attempt + 1, exc)
            if attempt < retries:
                time.sleep(2 * (attempt + 1))
    return results


def fetch_page_content(session: requests.Session, url: str, retries: int = 2) -> str:
    """Grabs text content from a scholarship page."""
    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/120.0.0.0 Safari/537.36"
        )
    }
    for attempt in range(retries + 1):
        try:
            resp = session.get(url, headers=headers, timeout=(5, 15))
            if resp.status_code == 200:
                soup = BeautifulSoup(resp.content, "html.parser")
                for tag in soup(["script", "style", "nav", "footer", "header", "aside"]):
                    tag.extract()
                return soup.get_text(separator="\n")[:15000]
        except requests.RequestException as exc:
            logger.warning("Fetch error (attempt %s): %s", attempt + 1, exc)
            if attempt < retries:
                time.sleep(2 * (attempt + 1))
    return ""


def parse_json_response(text: str) -> Optional[Dict]:
    """Safely parse JSON from Gemini response."""
    if not text:
        return None
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", text, re.DOTALL)
        if match:
            try:
                return json.loads(match.group(0))
            except json.JSONDecodeError:
                return None
    return None


def analyze_scholarship_with_gemini(
    client: genai.Client,
    text: str,
    url: str,
) -> Optional[Dict]:
    """
    Uses Gemini to extract structured scholarship data and validate the listing.
    """
    prompt = f"""
    Analyze this scholarship page text and extract structured data.

    VALIDATION RULES:
    1. Is this a REAL, ACTIVE scholarship? (Reject blogs, expired listings, news articles, scholarship lists)
    2. Is it for students entering college for the FIRST TIME? (Reject grad-school-only)
    3. Does it have a clear application process?

    If it passes validation, extract these fields as JSON:

    FIELDS:
    - Scholarship_Name: (string) Full name of the scholarship
    - Organization: (string) Who offers it
    - Amount: (string) Dollar amount or "Full Tuition" or "Varies"
    - Deadline: (string) Application deadline (e.g., "March 1, 2026" or "Rolling")
    - Eligibility: (string) Key eligibility criteria (100 words max)
    - Requirements: (list of strings) What the application requires (essay, transcript, etc.)
    - Categories: (list of strings from: "Need-Based", "Merit", "STEM", "Arts", "Heritage", "Leadership", "Athletic", "Community Service", "First-Gen", "Women", "Minority")
    - GPA_Minimum: (string or null) If mentioned
    - Renewable: (string) "Yes", "No", or "Unknown"
    - URL: "{url}"
    - Confidence: (int 0-100) How confident are you this is a valid, current scholarship

    If the page is NOT a valid scholarship listing, return: {{"valid": false, "reason": "..."}}

    TEXT:
    {text}
    """

    try:
        response = client.models.generate_content(
            model=GEMINI_MODEL,
            contents=prompt,
            config=types.GenerateContentConfig(response_mime_type="application/json"),
        )
        cleaned = (response.text or "").replace("```json", "").replace("```", "").strip()
        data = parse_json_response(cleaned)
        if not data:
            logger.warning("Gemini parse failed for %s", url)
            return None
        if data.get("valid") is False:
            logger.info("Rejected: %s — %s", url[:50], data.get("reason", ""))
            return None
        data["URL"] = url
        data["Date_Found"] = datetime.now().strftime("%Y-%m-%d")
        return data
    except Exception as exc:
        logger.warning("Gemini error for %s: %s", url, exc)
        return None


def load_existing_database(db_file: str) -> tuple:
    """Load existing scholarship database."""
    seen_urls: Set[str] = set()
    existing = []
    if os.path.isfile(db_file):
        try:
            with open(db_file, "r", encoding="utf-8") as f:
                data = json.load(f)
                existing = data.get("scholarships", [])
                for s in existing:
                    url = s.get("URL") or s.get("link") or ""
                    if url:
                        seen_urls.add(url)
        except Exception as exc:
            logger.warning("Failed to load existing DB: %s", exc)
    return existing, seen_urls


def save_database(db_file: str, scholarships: list):
    """Save updated scholarship database."""
    output = {
        "scholarships": scholarships,
        "last_updated": datetime.now().isoformat(),
        "total_count": len(scholarships),
    }
    with open(db_file, "w", encoding="utf-8") as f:
        json.dump(output, f, indent=2, ensure_ascii=False)


def export_to_csv(scholarships: list, csv_file: str):
    """Export scholarships to CSV for spreadsheet compatibility."""
    fieldnames = [
        "Scholarship_Name",
        "Organization",
        "Amount",
        "Deadline",
        "Eligibility",
        "Categories",
        "GPA_Minimum",
        "Renewable",
        "URL",
        "Confidence",
        "Date_Found",
    ]
    with open(csv_file, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames, extrasaction="ignore")
        writer.writeheader()
        for s in scholarships:
            row = {k: s.get(k, "") for k in fieldnames}
            if isinstance(row.get("Categories"), list):
                row["Categories"] = ", ".join(row["Categories"])
            if isinstance(row.get("Requirements"), list):
                pass  # Requirements not in CSV
            writer.writerow(row)


def main():
    print("=" * 60)
    print("  SCHOLARBOT PRO — Scholarship Hunter Engine")
    print("  Automated Discovery & Database Update")
    print("=" * 60)

    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        print("ERROR: Missing GEMINI_API_KEY in .env")
        return

    os.makedirs(LOGS_BASE, exist_ok=True)
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(message)s",
        handlers=[
            logging.FileHandler(LOG_FILE, encoding="utf-8"),
            logging.StreamHandler(),
        ],
    )

    client = genai.Client(api_key=api_key)
    session = requests.Session()

    db_file = "scholarship_db.json"
    csv_file = "scholarship_db.csv"

    existing, seen_urls = load_existing_database(db_file)
    new_finds = []

    print(f"\nLoaded {len(existing)} existing scholarships.")
    print(f"Starting hunt across {len(SEARCH_STRATEGIES)} strategies...\n")

    for strategy_name, strategy in SEARCH_STRATEGIES.items():
        print(f"\n{'─' * 40}")
        print(f"Strategy: {strategy_name}")
        print(f"  {strategy['description']}")
        print(f"{'─' * 40}")

        for keyword in strategy["keywords"]:
            # Search aggregator sites
            for site_filter in SCHOLARSHIP_SITES[:3]:  # Rotate through top 3
                query = f'{site_filter} {keyword}'
                results = search_web(query, max_results=3)

                for result in results:
                    url = result.get("href") or result.get("url")
                    if not url or url in seen_urls:
                        continue

                    print(f"   >> Reading: {url[:65]}...")
                    content = fetch_page_content(session, url)

                    if len(content) < 300:
                        continue

                    data = analyze_scholarship_with_gemini(client, content, url)

                    if data and data.get("Scholarship_Name") and data.get("Confidence", 0) >= 60:
                        print(
                            f"      ✅ FOUND ({data['Confidence']}/100): "
                            f"{data['Scholarship_Name']} — {data.get('Amount', 'N/A')}"
                        )
                        new_finds.append(data)
                        seen_urls.add(url)
                    else:
                        print("      ✗ Low confidence or invalid page.")

                    time.sleep(1)  # Rate limiting

            # Also search foundation sites directly
            for foundation in FOUNDATION_SITES[:2]:
                query = f'{foundation} scholarship application 2026'
                results = search_web(query, max_results=2)

                for result in results:
                    url = result.get("href") or result.get("url")
                    if not url or url in seen_urls:
                        continue

                    content = fetch_page_content(session, url)
                    if len(content) < 300:
                        continue

                    data = analyze_scholarship_with_gemini(client, content, url)
                    if data and data.get("Scholarship_Name") and data.get("Confidence", 0) >= 60:
                        print(
                            f"      ✅ FOUND ({data['Confidence']}/100): "
                            f"{data['Scholarship_Name']} — {data.get('Amount', 'N/A')}"
                        )
                        new_finds.append(data)
                        seen_urls.add(url)

    # Merge and save
    all_scholarships = existing + new_finds
    save_database(db_file, all_scholarships)
    export_to_csv(all_scholarships, csv_file)

    print(f"\n{'=' * 60}")
    print(f"  HUNT COMPLETE")
    print(f"  New scholarships found: {len(new_finds)}")
    print(f"  Total in database: {len(all_scholarships)}")
    print(f"  Saved to: {db_file} and {csv_file}")
    print(f"{'=' * 60}")


if __name__ == "__main__":
    main()
