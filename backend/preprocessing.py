import re

import nltk
from nltk.corpus import stopwords
from nltk.stem import WordNetLemmatizer


FALLBACK_STOP_WORDS = {
    "a",
    "an",
    "and",
    "are",
    "as",
    "at",
    "be",
    "by",
    "for",
    "from",
    "has",
    "in",
    "is",
    "it",
    "of",
    "on",
    "or",
    "that",
    "the",
    "to",
    "was",
    "were",
    "with",
}


def ensure_nltk_data():
    """Download the small NLTK datasets used by the evaluator."""
    for package in ("stopwords", "wordnet", "punkt", "punkt_tab"):
        try:
            nltk.download(package, quiet=True)
        except Exception:
            # Some NLTK versions do not require punkt_tab.
            if package != "punkt_tab":
                raise


try:
    STOP_WORDS = set(stopwords.words("english"))
except LookupError:
    STOP_WORDS = FALLBACK_STOP_WORDS

LEMMATIZER = WordNetLemmatizer()


def word_tokenize(text):
    try:
        return nltk.word_tokenize(text)
    except LookupError:
        return text.split()


def sentence_tokenize(text):
    text = text or ""
    text = re.sub(r"(?m)^\s*(?:[-*]|\d+[\).])\s+", "\n", text)
    text = re.sub(r"\s+(?:[-*]|\d+[\).])\s+", "\n", text)
    parts = []
    blocks = [block.strip() for block in re.split(r"[\r\n]+", text) if block.strip()]
    for block in blocks:
        try:
            sentences = nltk.sent_tokenize(block)
        except LookupError:
            sentences = re.split(r"(?<=[.!?])\s+", block)
        parts.extend(sentences)
    return [part.strip(" \t\r\n.-:*") for part in parts if part.strip(" \t\r\n.-:*")]


def preprocess(text):
    text = (text or "").lower()
    text = re.sub(r"[^a-z\s]", " ", text)
    tokens = word_tokenize(text)

    cleaned_tokens = []
    for word in tokens:
        if word in STOP_WORDS or len(word) <= 1:
            continue

        try:
            lemma = LEMMATIZER.lemmatize(word)
        except LookupError:
            lemma = word

        if lemma not in STOP_WORDS and len(lemma) > 1:
            cleaned_tokens.append(lemma)

    return " ".join(cleaned_tokens)


def word_count(text):
    return len((text or "").split())
