#!/usr/bin/env python3
"""
ScholarBot Pro — Merge & Upload
Bridges the gap between scholarship_hunter.py output and the app's database.

Workflow:
  1. Run the hunter:        python scholarship_hunter.py
  2. Merge into your app:   python scholarship_merge.py

What it does:
  - Reads new finds from scholarship_leads.csv
  - Reads existing master from scholarship_master_clean.csv
  - Deduplicates across both files
  - Outputs updated scholarship_master_clean.csv
  - Generates scholarship_db.json (for app import / Supabase upload)
  - Optionally pushes to Supabase if SUPABASE_URL + SUPABASE_KEY are set

Usage:
  python scholarship_merge.py                    # Merge + generate JSON
  python scholarship_merge.py --push-supabase    # Also upload to Supabase
  python scholarship_merge.py --stats            # Just show current DB stats
"""

import csv
import hashlib
import json
import os
import re
import sys
import argparse
from datetime import datetime, date
from difflib import SequenceMatcher
from pathlib import Path

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

SCRIPT_DIR = Path(__file__).parent
HUNTER_OUTPUT = SCRIPT_DIR / "scholarship_leads.csv"
MASTER_CSV = SCRIPT_DIR / "scholarship_master_clean.csv"
OUTPUT_JSON = SCRIPT_DIR / "scholarship_db.json"
ARCHIVE_DIR = SCRIPT_DIR / "archives"

SIMILARITY_THRESHOLD = 0.85


# ============================================================
# UTILITIES
# ============================================================
def generate_id(name, link=""):
    raw = (name.strip().lower() + link.strip().lower()).encode("utf-8")
    return hashlib.md5(raw).hexdigest()[:8]


def is_similar(a, b, threshold=SIMILARITY_THRESHOLD):
    if not a or not b:
        return False
    return SequenceMatcher(None, a.lower(), b.lower()).ratio() >= threshold


def normalize_amount(raw):
    if not raw:
        return "Varies"
    raw = str(raw).strip()
    if raw.lower() in ["varies", "unknown", "n/a", ""]:
        return "Varies"
    raw = re.sub(r'\s*[-\u2013\u2014]\s*', '-', raw)
    if re.match(r'^\d[\d,]*$', raw):
        raw = f"${raw}"
    return raw


def normalize_deadline(raw):
    if not raw:
        return "Varies"
    raw = str(raw).strip()
    if re.match(r'^\d{4}-\d{2}-\d{2}$', raw):
        return raw
    lower = raw.lower()
    if any(w in lower for w in ["varies", "ongoing", "rolling", "multiple", "nomination", "closed", "unknown"]):
        return raw.title()
    for fmt in ['%Y-%m-%d', '%m/%d/%Y', '%m/%d/%y', '%B %d, %Y', '%b %d, %Y']:
        try:
            return datetime.strptime(raw, fmt).strftime('%Y-%m-%d')
        except (ValueError, TypeError):
            continue
    return raw


# ============================================================
# LOAD FUNCTIONS
# ============================================================
def load_master():
    """Load existing master CSV."""
    entries = []
    if not MASTER_CSV.exists():
        print(f"  No existing master found at {MASTER_CSV}")
        return entries
    with open(MASTER_CSV, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            entries.append(row)
    print(f"  Loaded {len(entries)} scholarships from master CSV")
    return entries


def load_hunter_leads():
    """Load new finds from the hunter."""
    entries = []
    if not HUNTER_OUTPUT.exists():
        print(f"  No hunter output found at {HUNTER_OUTPUT}")
        print(f"  Run 'python scholarship_hunter.py' first!")
        return entries
    with open(HUNTER_OUTPUT, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            entry = {
                "id": row.get("id") or generate_id(row.get("name", ""), row.get("link", "")),
                "name": row.get("name", "").strip(),
                "criteria": row.get("criteria", "").strip(),
                "link": row.get("link", "").strip(),
                "deadline": normalize_deadline(row.get("deadline", "")),
                "amount": normalize_amount(row.get("amount", "")),
                "needBased": row.get("needBased", ""),
                "status": "ACTIVE",
                "source_sheet": f"hunter-{row.get('category', 'unknown')}",
            }
            if entry["name"]:
                entries.append(entry)
    print(f"  Loaded {len(entries)} new leads from hunter")
    return entries


# ============================================================
# DEDUPLICATE
# ============================================================
def deduplicate(all_entries):
    """Remove duplicates by URL and name similarity."""
    unique = []
    seen_links = set()
    seen_names = []

    for entry in all_entries:
        name = entry.get("name", "").strip()
        link = entry.get("link", "").strip().lower().rstrip("/")

        if not name:
            continue

        if link and link in seen_links:
            continue

        is_dup = False
        for existing_name in seen_names:
            if is_similar(name, existing_name):
                is_dup = True
                break

        if not is_dup:
            unique.append(entry)
            seen_names.append(name)
            if link:
                seen_links.add(link)

    return unique


# ============================================================
# STATUS CHECK
# ============================================================
def update_statuses(entries):
    """Flag expired deadlines."""
    today = date.today()
    active = expired = unknown = 0
    for entry in entries:
        dl = entry.get("deadline", "Varies")
        try:
            dl_date = datetime.strptime(dl, "%Y-%m-%d").date()
            if dl_date < today:
                entry["status"] = "EXPIRED"
                expired += 1
            else:
                entry["status"] = "ACTIVE"
                active += 1
        except (ValueError, TypeError):
            entry["status"] = "UNKNOWN"
            unknown += 1
    return active, expired, unknown


# ============================================================
# OUTPUT FUNCTIONS
# ============================================================
def save_master_csv(entries):
    """Write the updated master CSV."""
    fieldnames = ["id", "name", "criteria", "link", "deadline", "amount", "needBased", "status", "source_sheet"]
    with open(MASTER_CSV, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames, extrasaction="ignore")
        writer.writeheader()
        for entry in entries:
            writer.writerow(entry)
    print(f"  Wrote {len(entries)} scholarships to {MASTER_CSV}")


def save_json(entries):
    """Generate the JSON file the app can import."""
    scholarships = []
    for entry in entries:
        if entry.get("status") == "EXPIRED":
            continue
        scholarships.append({
            "id": entry.get("id", ""),
            "name": entry.get("name", ""),
            "criteria": entry.get("criteria", ""),
            "link": entry.get("link", ""),
            "deadline": entry.get("deadline", "Varies"),
            "amount": entry.get("amount", "Varies"),
            "need_based": entry.get("needBased", ""),
            "source": entry.get("source_sheet", "merged"),
        })
    with open(OUTPUT_JSON, "w", encoding="utf-8") as f:
        json.dump({"scholarships": scholarships, "updated": date.today().isoformat(), "count": len(scholarships)}, f, indent=2)
    print(f"  Wrote {len(scholarships)} active scholarships to {OUTPUT_JSON}")


def archive_hunter_leads():
    """Move processed hunter leads to archive."""
    if not HUNTER_OUTPUT.exists():
        return
    ARCHIVE_DIR.mkdir(exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    archive_path = ARCHIVE_DIR / f"scholarship_leads_{timestamp}.csv"
    HUNTER_OUTPUT.rename(archive_path)
    print(f"  Archived hunter leads to {archive_path}")


def push_to_supabase(entries):
    """Upload active scholarships to Supabase."""
    try:
        import requests
    except ImportError:
        print("  ERROR: 'requests' package needed for Supabase upload.")
        print("  Install with: pip install requests")
        return False

    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_KEY")

    if not url or not key:
        print("  ERROR: Set SUPABASE_URL and SUPABASE_KEY in .env or environment.")
        print("  Example .env:")
        print("    SUPABASE_URL=https://yourproject.supabase.co")
        print("    SUPABASE_KEY=your-anon-key-here")
        return False

    active = [e for e in entries if e.get("status") != "EXPIRED"]
    rows = []
    for e in active:
        rows.append({
            "id": e.get("id"),
            "name": e.get("name"),
            "criteria": e.get("criteria"),
            "link": e.get("link"),
            "deadline": e.get("deadline"),
            "amount": e.get("amount"),
            "need_based": e.get("needBased", ""),
        })

    headers = {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates",
    }

    batch_size = 100
    total_uploaded = 0
    for i in range(0, len(rows), batch_size):
        batch = rows[i:i+batch_size]
        resp = requests.post(
            f"{url}/rest/v1/scholarships",
            headers=headers,
            json=batch,
        )
        if resp.status_code in (200, 201):
            total_uploaded += len(batch)
            print(f"  Uploaded batch {i//batch_size + 1} ({len(batch)} rows)")
        else:
            print(f"  ERROR uploading batch: {resp.status_code} - {resp.text[:200]}")
            return False

    print(f"  Successfully pushed {total_uploaded} scholarships to Supabase")
    return True


# ============================================================
# MAIN
# ============================================================
def main():
    parser = argparse.ArgumentParser(description="ScholarBot Pro - Merge & Upload")
    parser.add_argument("--push-supabase", action="store_true", help="Upload to Supabase after merge")
    parser.add_argument("--stats", action="store_true", help="Show current DB stats and exit")
    parser.add_argument("--no-archive", action="store_true", help="Don't archive the hunter leads file after merge")
    args = parser.parse_args()

    print("=" * 60)
    print("ScholarBot Pro - Merge & Upload")
    print("=" * 60)

    if args.stats:
        master = load_master()
        if master:
            active, expired, unknown = update_statuses(master)
            sources = {}
            for e in master:
                src = e.get("source_sheet", "unknown")
                sources[src] = sources.get(src, 0) + 1
            print(f"\n  Total: {len(master)}")
            print(f"  Active: {active} | Expired: {expired} | Unknown: {unknown}")
            print(f"  Sources: {json.dumps(sources, indent=4)}")
        if HUNTER_OUTPUT.exists():
            leads = load_hunter_leads()
            print(f"\n  Pending hunter leads: {len(leads)}")
        return

    print("\n[1] Loading data...")
    master = load_master()
    new_leads = load_hunter_leads()

    if not new_leads and not master:
        print("\n  Nothing to merge. Run the hunter first:")
        print("    python scholarship_hunter.py")
        return

    print("\n[2] Merging...")
    combined = master + new_leads
    before = len(combined)
    merged = deduplicate(combined)
    print(f"  Combined: {before} -> Deduplicated: {len(merged)} (removed {before - len(merged)})")

    print("\n[3] Checking deadlines...")
    active, expired, unknown = update_statuses(merged)
    print(f"  Active: {active} | Expired: {expired} | Unknown: {unknown}")

    print("\n[4] Saving...")
    save_master_csv(merged)
    save_json(merged)

    new_count = len(merged) - len(master)
    if new_count > 0:
        print(f"\n  +{new_count} NEW scholarships added!")

    if not args.no_archive and new_leads:
        print("\n[5] Archiving processed leads...")
        archive_hunter_leads()

    if args.push_supabase:
        print("\n[6] Pushing to Supabase...")
        push_to_supabase(merged)

    print(f"\n{'=' * 60}")
    print(f"DONE! Your app database now has {active} active scholarships.")
    print(f"{'=' * 60}")

    if not args.push_supabase:
        print("\nNext steps:")
        print("  Option A (Supabase): python scholarship_merge.py --push-supabase")
        print("  Option B (Manual):   Upload scholarship_db.json to your app")


if __name__ == "__main__":
    main()
