#!/usr/bin/env python3
"""CLI entry point for simplified ISL inference."""
import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from infer import infer_video


def main():
    parser = argparse.ArgumentParser(
        description="ISL Video-to-Text Inference"
    )
    parser.add_argument(
        "--video", "-v",
        required=True,
        help="Path to the ISL video file"
    )
    parser.add_argument(
        "--enhance", "-e",
        action="store_true",
        help="Enable preprocessing (ROI crop, CLAHE, denoise). Off by default."
    )
    parser.add_argument(
        "--no-refine",
        action="store_true",
        help="Skip Gemini grammar refinement (refinement is ON by default)."
    )
    args = parser.parse_args()

    results = infer_video(args.video, enhance=args.enhance)

    if not args.no_refine and results:
        from grammar import refine_transcript
        raw_words = [r["word"] for r in results]
        refined = refine_transcript(raw_words)
        print("=" * 50)
        print(f"  Refined: {refined}")
        print("=" * 50 + "\n")


if __name__ == "__main__":
    main()
