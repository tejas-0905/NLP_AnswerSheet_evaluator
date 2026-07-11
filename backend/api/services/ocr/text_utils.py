import json
import re
from difflib import SequenceMatcher

def extract_json_object(text: str) -> dict:
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        start = text.find("{")
        end = text.rfind("}")
        if start == -1 or end == -1 or end <= start:
            raise
        return json.loads(text[start:end + 1])


def expected_ocr_vocabulary(question_text: str, model_answer: str, required_concepts: str | None = None) -> set[str]:
    source = f"{question_text or ''} {model_answer or ''} {required_concepts or ''}".lower()
    words = re.findall(r"[a-z][a-z0-9]{3,}", source)
    stop_words = {
        "this", "that", "with", "from", "into", "used", "uses", "their", "there",
        "then", "than", "also", "such", "which", "when", "where", "what", "why",
        "does", "done", "have", "will", "were", "they", "them", "four", "two",
        "main", "give", "example", "explain", "answer", "question",
    }
    return {word for word in words if word not in stop_words}


def correct_ocr_text_with_context(
    text: str,
    question_text: str,
    model_answer: str,
    required_concepts: str | None = None,
) -> str:
    if not text:
        return ""

    vocabulary = expected_ocr_vocabulary(question_text, model_answer, required_concepts)
    if not vocabulary:
        return text

    corrected_tokens = []
    word_count = 0
    correction_count = 0
    for token in re.findall(r"[A-Za-z0-9]+|[^A-Za-z0-9]+", text):
        if not re.fullmatch(r"[A-Za-z0-9]+", token):
            corrected_tokens.append(token)
            continue

        word_count += 1
        lower = token.lower()
        if len(lower) < 5 or lower in vocabulary:
            corrected_tokens.append(token)
            continue

        best_word = None
        best_score = 0.0
        for expected in vocabulary:
            if abs(len(expected) - len(lower)) > max(3, len(expected) // 3):
                continue
            score = SequenceMatcher(None, lower, expected).ratio()
            if score > best_score:
                best_word = expected
                best_score = score

        if best_word and best_score >= 0.78:
            corrected_tokens.append(best_word)
            correction_count += 1
        else:
            corrected_tokens.append(token)

    if word_count >= 12 and correction_count / word_count > 0.35:
        return text

    return "".join(corrected_tokens)

def normalize_ocr_text(text: str) -> str:
    text = re.sub(r"!\[[^\]]*\]\([^)]+\)", " ", text or "")
    text = re.sub(r"<[^>]+>", " ", text)
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    lines = [re.sub(r"[ \t\f\v]+", " ", line).strip() for line in text.split("\n")]
    text = "\n".join(line for line in lines if line)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


QUESTION_MARKER_RE = re.compile(
    r"(?im)(?:^|\n)\s*(?:"
    r"(?:q|que|ques|question|ans|answer)(?:\s*(?:no|number))?\s*[\.:)\-#]?\s*(\d{1,2})(?!\d)"
    r"|(\d{1,2})\s*[\).:\-]\s+(?=[A-Za-z])"
    r")"
)


def split_text_by_question_numbers(text: str, num_questions: int) -> list[str] | None:
    """Split OCR text by explicit handwritten question markers such as Q1 or Question 1."""
    cleaned = normalize_ocr_text(text)
    if not cleaned:
        return None

    matches = []
    for match in QUESTION_MARKER_RE.finditer(cleaned):
        raw_number = match.group(1) or match.group(2)
        if not raw_number:
            continue
        question_number = int(raw_number)
        if 1 <= question_number <= num_questions:
            matches.append((match.start(), match.end(), question_number - 1))

    if not matches:
        return None

    answers = [""] * num_questions
    for item_index, (_, marker_end, question_index) in enumerate(matches):
        next_start = matches[item_index + 1][0] if item_index + 1 < len(matches) else len(cleaned)
        answer_text = cleaned[marker_end:next_start].strip(" \n\t:-")
        if answer_text:
            existing = answers[question_index]
            answers[question_index] = f"{existing}\n{answer_text}".strip() if existing else answer_text

    return answers if any(answer.strip() for answer in answers) else None
