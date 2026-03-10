import re

def normalize_text(text: str) -> str:
    """
    Normalizes input text for better TTS synthesis.
    - Trims extra whitespace
    - Handles basic abbreviation expansion (e.g., Dr., Mr.) if needed
    """
    if not text:
        return ""
    
    # Remove excessive whitespaces
    text = re.sub(r'\s+', ' ', text).strip()
    
    # Basic abbreviation expansion common in TTS
    abbreviations = {
        r'\bDr\.\b': 'Doctor',
        r'\bMr\.\b': 'Mister',
        r'\bMrs\.\b': 'Missus',
        r'\bMs\.\b': 'Miss',
        r'\be\.g\.\b': 'for example',
        r'\bi\.e\.\b': 'that is',
        r'\betc\.\b': 'et cetera'
    }
    
    for abbr, full_form in abbreviations.items():
        text = re.sub(abbr, full_form, text, flags=re.IGNORECASE)

    return text
