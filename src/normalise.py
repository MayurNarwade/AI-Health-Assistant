# src/normalise.py
import re
import csv
import os
from unidecode import unidecode
from langdetect import detect
from transformers import pipeline

PHRASEBOOK = os.path.join(os.path.dirname(__file__), '..', 'data', 'phrasebook.csv')

# Global translator instance - loaded only once
_translator = None
_translator_loaded = False

def _get_translator():
    """Load the NLLB translation model only once and reuse it."""
    global _translator, _translator_loaded
    if _translator is None and not _translator_loaded:
        print("[INFO] Loading translation model (facebook/nllb-200-distilled-600M) once — this may take 1-2 minutes the first time...")
        try:
            _translator = pipeline(
                "translation",
                model="facebook/nllb-200-distilled-600M",
                device=-1  # Force CPU (change to 0 if you have GPU later)
            )
            print("[INFO] Translation model loaded successfully and cached for all future requests!")
        except Exception as e:
            print(f"[ERROR] Failed to load translation model: {e}")
            _translator = None
        _translator_loaded = True  # Prevent retry attempts
    return _translator

def translate_if_needed(text: str) -> str:
    """Translate text to English only if needed, using cached translator."""
    try:
        lang = detect(text)
        if lang == "en":
            return text

        translator = _get_translator()
        if translator is None:
            print("[WARNING] Translator not available — returning original text.")
            return text

        # Translate to English
        translated = translator(
            text,
            src_lang=lang,
            tgt_lang="eng_Latn"
        )[0]["translation_text"]
        return translated

    except Exception as e:
        print(f"[WARNING] Translation failed: {e}")
        return text

def _load_phrasebook():
    mapping = []
    if os.path.exists(PHRASEBOOK):
        with open(PHRASEBOOK, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                patt = row.get('pattern') if isinstance(row, dict) else None
                repl = row.get('replacement') if isinstance(row, dict) else None
                if patt and repl:
                    mapping.append((patt.strip(), repl.strip()))
    return mapping

_phrasebook_cache = None

def normalize(text: str) -> str:
    """
    Normalize user input:
    - phrasebook replacements
    - ascii transliteration
    - collapse whitespace and repeated chars
    - translate if non-English and phrasebook doesn't match
    """
    global _phrasebook_cache
    if _phrasebook_cache is None:
        _phrasebook_cache = _load_phrasebook()

    if not isinstance(text, str):
        return ""

    lang = None
    try:
        lang = detect(text)
    except Exception:
        lang = None

    t = text
    if lang and lang != "en":
        # Check if phrasebook already covers it → avoid unnecessary translation
        found_in_phrasebook = False
        for patt, _ in _phrasebook_cache:
            try:
                if re.search(rf'\b{re.escape(patt)}\b', t, flags=re.IGNORECASE):
                    found_in_phrasebook = True
                    break
            except re.error:
                continue
        if not found_in_phrasebook:
            t = translate_if_needed(text)

    # Basic cleaning
    t_clean = t.strip()
    t_clean = t_clean.replace('\u200d', ' ')
    t_clean = re.sub(r'\s+', ' ', t_clean)
    t_clean = re.sub(r'(.)\1{2,}', r'\1\1', t_clean, flags=re.IGNORECASE)
    t_ascii = unidecode(t_clean)

    # Apply phrasebook replacements
    def apply_map(s):
        s2 = s
        for patt, repl in _phrasebook_cache:
            try:
                s2 = re.sub(rf'\b{re.escape(patt)}\b', repl, s2, flags=re.IGNORECASE)
            except re.error:
                continue
        return s2

    t_final = apply_map(t_clean)
    t_ascii_final = apply_map(t_ascii)

    return t_ascii_final if t_ascii_final != unidecode(text) else t_final