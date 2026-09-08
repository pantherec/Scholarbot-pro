"""
ScholarBot Pro — Scholarship Letter Generator
===============================================
Generates targeted, human-sounding scholarship application letters
using candidate profiles and style templates.

Operates in two modes:
  1. WATCH MODE: Monitors a folder for new scholarship PDFs, auto-generates letters
  2. BATCH MODE: Generates letters for all matched scholarships from the database

Usage:
    python scholarship_letter_gen.py --watch     # Watch mode
    python scholarship_letter_gen.py --batch     # Batch mode for all matches
    python scholarship_letter_gen.py --single "scholarship_name"  # Single letter

Requires:
    - GEMINI_API_KEY in .env
    - Candidate profile (.md file)
    - pip install google-genai python-dotenv pypdf watchdog
"""

import argparse
import json
import os
import re
import time
from typing import Optional

from dotenv import load_dotenv
from google import genai
from google.genai import types
from pypdf import PdfReader
from watchdog.events import FileSystemEventHandler
from watchdog.observers import Observer

# --- CONFIGURATION ---
load_dotenv()
# "-latest" alias tracks Google's current model — the pinned "gemini-2.5-pro"
# id stopped working for this project's tier (free-tier limit: 0) in July 2026.
MODEL_NAME = "gemini-flash-latest"

INPUT_SCHOLARSHIPS = os.path.join(".", "Input_Scholarships")
OUTPUT_LETTERS = os.path.join(".", "Output_Letters")
PROFILES_DIR = os.path.join(".", "Profiles")
TEMPLATES_DIR = os.path.join(".", "Templates")
DB_FILE = "scholarship_db.json"


# --- STYLE TEMPLATES ---
DEFAULT_TEMPLATES = {
    "narrative": {
        "name": "The Storyteller",
        "rules": (
            "1. Open with a specific moment or memory from the candidate's life.\n"
            "2. Use first-person 'I' statements throughout.\n"
            "3. Weave personal story into scholarship mission alignment.\n"
            "4. Close with a forward-looking vision, not a generic 'thank you.'\n"
            "5. Vary sentence length. Mix short punchy lines with longer descriptive ones."
        ),
    },
    "evidence": {
        "name": "The Scientist",
        "rules": (
            "1. Open with a concrete achievement or metric.\n"
            "2. Use specific numbers: hours volunteered, GPA, project outcomes.\n"
            "3. Frame experiences as evidence, not claims.\n"
            "4. Connect technical skills to broader societal impact.\n"
            "5. Replace 'I am passionate about' with 'My work in X demonstrated...'"
        ),
    },
    "mission": {
        "name": "The Mission Matcher",
        "rules": (
            "1. Reference the scholarship organization's mission statement.\n"
            "2. Mirror their language naturally without being sycophantic.\n"
            "3. Show how the candidate's goals amplify the foundation's mission.\n"
            "4. Provide 2-3 specific examples of aligned work.\n"
            "5. Keep tone collaborative and genuine."
        ),
    },
    "underdog": {
        "name": "The Overcomer",
        "rules": (
            "1. Be honest about challenges without self-pity.\n"
            "2. Show agency: what the candidate DID about the challenge.\n"
            "3. Frame hardship as fuel for growth, not an excuse.\n"
            "4. Demonstrate a clear upward trajectory.\n"
            "5. End with strength and vision."
        ),
    },
}

# --- ANTI-DETECTION RULES (shared across all templates) ---
ANTI_DETECTION_SYSTEM = """
CRITICAL ANTI-DETECTION RULES — Your letter MUST follow these:
1. BANNED WORDS: Never use "delve," "cutting-edge," "landscape," "foster," "tapestry," 
   "game-changer," "testament," "unwavering," "thrilled," "elevate," "synergy,"
   "Furthermore," "Moreover," "Additionally" as paragraph starters.
2. PUNCTUATION: Do NOT use em-dashes (—). Use periods or commas instead.
3. SENTENCE VARIETY: Mix short (5-8 word) sentences with medium (15-20 word) ones.
   Never start three sentences in a row the same way.
4. SPECIFICITY: Use real details — names, dates, numbers, places. Vague = AI-sounding.
5. VOICE: Sound like a real high school student. Not a corporate press release.
   Use contractions sometimes. It's okay to be slightly informal.
6. OPENING: Never start with "Dear Scholarship Committee." Start with something
   memorable — a moment, a question, a bold statement.
7. CLOSING: Never use "In conclusion." Just start the closing thought naturally.
8. LENGTH: 350-500 words. No more, no less.
"""


def extract_pdf_text(file_path: str) -> str:
    """Extract text from a PDF scholarship description."""
    reader = PdfReader(file_path)
    pages = [page.extract_text() or "" for page in reader.pages]
    return "\n".join(pages).strip()


def load_profile(profile_path: str) -> str:
    """Load a candidate profile markdown file."""
    with open(profile_path, "r", encoding="utf-8") as f:
        return f.read()


def load_template(template_name: str) -> dict:
    """Load a style template. Check custom templates first, then defaults."""
    custom_path = os.path.join(TEMPLATES_DIR, f"{template_name}.json")
    if os.path.isfile(custom_path):
        with open(custom_path, "r", encoding="utf-8") as f:
            return json.load(f)
    return DEFAULT_TEMPLATES.get(template_name, DEFAULT_TEMPLATES["narrative"])


def load_scholarship_db() -> list:
    """Load the scholarship database."""
    if not os.path.isfile(DB_FILE):
        return []
    with open(DB_FILE, "r", encoding="utf-8") as f:
        data = json.load(f)
    return data.get("scholarships", [])


def generate_letter(
    client: genai.Client,
    profile_text: str,
    scholarship_info: str,
    template: dict,
) -> str:
    """Generate a scholarship application letter using Gemini."""

    system_prompt = f"""You are a scholarship application letter writer.
You write in the candidate's authentic voice as defined in their profile.

STYLE TEMPLATE: "{template['name']}"
WRITING RULES:
{template['rules']}

{ANTI_DETECTION_SYSTEM}

CANDIDATE PROFILE:
{profile_text}
"""

    user_prompt = f"""Write a scholarship application letter for this scholarship:

{scholarship_info}

Requirements:
- 350-500 words
- Match the candidate's strongest qualifications to this specific scholarship's criteria
- Follow the style template and anti-detection rules exactly
- Make it feel authentically HUMAN
- Include specific details from the candidate's profile
"""

    response = client.models.generate_content(
        model=MODEL_NAME,
        contents=user_prompt,
        config=types.GenerateContentConfig(system_instruction=system_prompt),
    )
    return (response.text or "").strip()


def generate_candidate_profile(
    client: genai.Client,
    answers: dict,
    brag_sheet: str = "",
) -> str:
    """Generate a candidate profile markdown from questionnaire answers and brag sheet."""

    prompt = f"""Create a candidate profile in Markdown format for scholarship applications.

MODEL THIS AFTER:
```
# Candidate Profile: [Name]

**Contact Info:**
* Email / Phone / Location

**Voice:** [Writing voice description]
* *Style:* How they write
* *Key trait:* What makes them unique

**Humanization & Anti-Detection Rules (CRITICAL):**
1. **No "AI-isms":** [specific banned words]
2. **Sentence Structure:** [rules]
3. **Tone Check:** [calibration notes]
4. **Punctuation:** [rules]

**Key Directives for the AI:**
1. [Strongest asset to always mention first]
2. [Second strongest differentiator]
3. [Unique experience or project to highlight]
4. [Leadership or service angle]
5. [Portfolio or evidence link]
```

QUESTIONNAIRE ANSWERS:
{json.dumps(answers, indent=2)}

BRAG SHEET:
{brag_sheet if brag_sheet else "Not provided."}

Generate a detailed, actionable profile that will guide AI letter generation.
Focus on what makes this candidate UNIQUE and MEMORABLE.
"""

    response = client.models.generate_content(
        model=MODEL_NAME,
        contents=prompt,
    )
    return (response.text or "").strip()


class ScholarshipPdfHandler(FileSystemEventHandler):
    """Watches for new scholarship PDFs and auto-generates letters."""

    def __init__(self, client: genai.Client, profile_text: str, template: dict):
        super().__init__()
        self.client = client
        self.profile_text = profile_text
        self.template = template

    def on_created(self, event):
        if event.is_directory or not event.src_path.lower().endswith(".pdf"):
            return

        print(f"\nNew scholarship PDF detected: {os.path.basename(event.src_path)}")
        time.sleep(2)  # Wait for file to finish writing

        try:
            scholarship_text = extract_pdf_text(event.src_path)
            if not scholarship_text:
                print(f"  No text extracted from {event.src_path}")
                return

            print("  Generating letter...")
            letter = generate_letter(
                self.client, self.profile_text, scholarship_text, self.template
            )

            base_name = os.path.splitext(os.path.basename(event.src_path))[0]
            output_path = os.path.join(OUTPUT_LETTERS, f"{base_name}_letter.md")
            os.makedirs(OUTPUT_LETTERS, exist_ok=True)

            with open(output_path, "w", encoding="utf-8") as f:
                f.write(letter + "\n")

            print(f"  ✅ Letter saved: {output_path}")

        except Exception as exc:
            print(f"  Error: {exc}")


def run_watch_mode(client: genai.Client, profile_path: str, template_name: str):
    """Watch mode: monitors folder for new scholarship PDFs."""
    profile_text = load_profile(profile_path)
    template = load_template(template_name)

    os.makedirs(INPUT_SCHOLARSHIPS, exist_ok=True)
    os.makedirs(OUTPUT_LETTERS, exist_ok=True)

    handler = ScholarshipPdfHandler(client, profile_text, template)
    observer = Observer()
    observer.schedule(handler, INPUT_SCHOLARSHIPS, recursive=False)
    observer.start()

    print(f"Watching {INPUT_SCHOLARSHIPS} for new scholarship PDFs...")
    print(f"Using profile: {profile_path}")
    print(f"Using template: {template['name']}")
    print("Press Ctrl+C to stop.\n")

    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\nStopping...")
        observer.stop()
    observer.join()


def run_batch_mode(client: genai.Client, profile_path: str, template_name: str):
    """Batch mode: generates letters for all high-match scholarships in DB."""
    profile_text = load_profile(profile_path)
    template = load_template(template_name)
    scholarships = load_scholarship_db()

    os.makedirs(OUTPUT_LETTERS, exist_ok=True)

    print(f"Loaded {len(scholarships)} scholarships from database.")
    print(f"Using template: {template['name']}")

    generated = 0
    for s in scholarships:
        confidence = s.get("Confidence", s.get("matchScore", 0))
        if confidence < 60:
            continue

        name = s.get("Scholarship_Name") or s.get("name", "Unknown")
        print(f"\nGenerating letter for: {name}")

        scholarship_info = f"""
Scholarship: {name}
Organization: {s.get('Organization', s.get('organization', 'N/A'))}
Amount: {s.get('Amount', s.get('amount', 'N/A'))}
Deadline: {s.get('Deadline', s.get('deadline', 'N/A'))}
Eligibility: {s.get('Eligibility', s.get('criteria', 'N/A'))}
        """.strip()

        try:
            letter = generate_letter(client, profile_text, scholarship_info, template)
            safe_name = re.sub(r"[^\w\s-]", "", name)[:50].strip().replace(" ", "_")
            output_path = os.path.join(OUTPUT_LETTERS, f"{safe_name}_letter.md")

            with open(output_path, "w", encoding="utf-8") as f:
                f.write(f"# Application Letter: {name}\n\n")
                f.write(f"**Template:** {template['name']}\n")
                f.write(f"**Generated:** {time.strftime('%Y-%m-%d')}\n\n---\n\n")
                f.write(letter + "\n")

            print(f"  ✅ Saved: {output_path}")
            generated += 1
            time.sleep(2)  # Rate limiting

        except Exception as exc:
            print(f"  Error: {exc}")

    print(f"\nBatch complete. Generated {generated} letters in {OUTPUT_LETTERS}/")


def run_single(client: genai.Client, profile_path: str, template_name: str, scholarship_name: str):
    """Generate a single letter for a named scholarship."""
    profile_text = load_profile(profile_path)
    template = load_template(template_name)
    scholarships = load_scholarship_db()

    target = None
    for s in scholarships:
        name = s.get("Scholarship_Name") or s.get("name", "")
        if scholarship_name.lower() in name.lower():
            target = s
            break

    if not target:
        print(f"Scholarship '{scholarship_name}' not found in database.")
        return

    name = target.get("Scholarship_Name") or target.get("name")
    print(f"Generating letter for: {name}")

    scholarship_info = f"""
Scholarship: {name}
Organization: {target.get('Organization', target.get('organization', 'N/A'))}
Amount: {target.get('Amount', target.get('amount', 'N/A'))}
Eligibility: {target.get('Eligibility', target.get('criteria', 'N/A'))}
    """.strip()

    letter = generate_letter(client, profile_text, scholarship_info, template)
    print(f"\n{'='*60}\n{letter}\n{'='*60}")

    safe_name = re.sub(r"[^\w\s-]", "", name)[:50].strip().replace(" ", "_")
    output_path = os.path.join(OUTPUT_LETTERS, f"{safe_name}_letter.md")
    os.makedirs(OUTPUT_LETTERS, exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(letter + "\n")
    print(f"\nSaved to: {output_path}")


def main():
    parser = argparse.ArgumentParser(description="ScholarBot Pro Letter Generator")
    parser.add_argument("--watch", action="store_true", help="Watch mode: auto-generate from PDFs")
    parser.add_argument("--batch", action="store_true", help="Batch mode: generate for all matches")
    parser.add_argument("--single", type=str, help="Generate for a specific scholarship name")
    parser.add_argument("--profile", type=str, default=os.path.join(PROFILES_DIR, "profile.md"), help="Path to candidate profile")
    parser.add_argument("--template", type=str, default="narrative", help="Style template name")
    args = parser.parse_args()

    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        print("ERROR: Missing GEMINI_API_KEY in .env")
        return

    client = genai.Client(api_key=api_key)

    if args.watch:
        run_watch_mode(client, args.profile, args.template)
    elif args.batch:
        run_batch_mode(client, args.profile, args.template)
    elif args.single:
        run_single(client, args.profile, args.template, args.single)
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
