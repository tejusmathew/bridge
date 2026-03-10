"""
Grammar refinement using Groq API (Llama 3).

Takes raw sign language transcript (list of words) and produces
a grammatically correct sentence.

Example:
    Input:  "Actor Acknowledgement Acceleration Theory"
    Output: "The actor acknowledges the acceleration theory."
"""
import os
from pathlib import Path

try:
    from groq import Groq
    HAS_GROQ = True
except ImportError:
    HAS_GROQ = False

# Auto-load .env file from the same directory
_env_path = Path(__file__).parent / ".env"
if _env_path.exists():
    with open(_env_path) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                key, _, value = line.partition("=")
                os.environ.setdefault(key.strip(), value.strip())


SYSTEM_PROMPT = """You are a grammar correction assistant for sign language transcription.
Given predicted sign language words, create a grammatically correct English sentence.
You may add articles, prepositions, conjunctions, fix verb tenses, and add pronouns.
Use ALL given words. Don't add extra content words. Keep it natural and concise.
Return ONLY the corrected sentence, nothing else."""


def refine_transcript(raw_words: list[str], api_key: str = None) -> str:
    """Send raw transcript words to Groq (Llama 3) for grammar correction."""
    raw_transcript = " ".join(raw_words)
    
    if not raw_words:
        return ""
    
    if len(raw_words) == 1:
        return raw_words[0]

    key = api_key or os.environ.get("GROQ_API_KEY")
    if not key:
        print("  ⚠ No GROQ_API_KEY set — returning raw transcript")
        return raw_transcript

    if not HAS_GROQ:
        print("  ⚠ groq not installed. Run: pip install groq")
        return raw_transcript

    try:
        client = Groq(api_key=key)
        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": f"Words: {raw_transcript}"},
            ],
            temperature=0.3,
            max_tokens=100,
        )
        refined = response.choices[0].message.content.strip().strip('"').strip("'")
        return refined

    except Exception as e:
        print(f"  ⚠ Groq API error: {e} — returning raw transcript")
        return raw_transcript
