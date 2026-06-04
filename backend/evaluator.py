import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

from backend.preprocessing import preprocess, sentence_tokenize, word_count


DEFAULT_WEIGHTS = {
    "semantic": 0.45,
    "keyword": 0.25,
    "sentence": 0.20,
    "length": 0.10,
}

COMMON_ABBREVIATIONS = {
    "ai": ["artificial intelligence"],
    "api": ["application programming interface"],
    "cnn": ["convolutional neural network"],
    "cpu": ["central processing unit"],
    "css": ["cascading style sheets"],
    "dbms": ["database management system"],
    "dl": ["deep learning"],
    "gpu": ["graphics processing unit"],
    "html": ["hypertext markup language"],
    "http": ["hypertext transfer protocol"],
    "https": ["hypertext transfer protocol secure"],
    "ml": ["machine learning"],
    "nlp": ["natural language processing"],
    "oop": ["object oriented programming", "object-oriented programming"],
    "oops": ["object oriented programming system", "object-oriented programming system"],
    "os": ["operating system"],
    "rdbms": ["relational database management system"],
    "rnn": ["recurrent neural network"],
    "sql": ["structured query language"],
    "ui": ["user interface"],
    "ux": ["user experience"],
}


def normalize_weights(weights):
    weights = weights or DEFAULT_WEIGHTS
    total = sum(max(float(value), 0.0) for value in weights.values())
    if total == 0:
        return DEFAULT_WEIGHTS.copy()
    return {key: max(float(value), 0.0) / total for key, value in weights.items()}


def extract_keywords(text, top_n=10):
    clean_text = preprocess(text)
    if not clean_text.strip():
        return []

    vectorizer = TfidfVectorizer(ngram_range=(1, 2))
    matrix = vectorizer.fit_transform([clean_text])
    scores = matrix.toarray()[0]
    words = vectorizer.get_feature_names_out()

    ranked_keywords = sorted(zip(words, scores), key=lambda item: item[1], reverse=True)
    return [word for word, _score in ranked_keywords[:top_n]]


def parse_required_concepts(concepts_text):
    concepts = []
    for line in (concepts_text or "").replace(";", "\n").splitlines():
        for concept in line.split(","):
            concept = concept.strip()
            if concept:
                concepts.append(concept)
    return list(dict.fromkeys(concepts))


def merge_concepts(required_concepts, extracted_keywords):
    merged = []
    seen = set()
    for concept in list(required_concepts or []) + list(extracted_keywords or []):
        normalized = preprocess(concept)
        if normalized and normalized not in seen:
            merged.append(concept)
            seen.add(normalized)
    return merged


def acronym_match(keyword, student_text):
    clean_keyword = preprocess(keyword)
    clean_student = preprocess(student_text)
    keyword_tokens = keyword.split()
    student_tokens = clean_student.split()

    if not clean_keyword or not student_tokens:
        return False

    for short_form, long_forms in COMMON_ABBREVIATIONS.items():
        clean_long_forms = [preprocess(long_form) for long_form in long_forms]

        if clean_keyword == short_form and any(long_form in clean_student for long_form in clean_long_forms):
            return True

        if clean_keyword in clean_long_forms and short_form in student_tokens:
            return True

    # Example: keyword "oop" matches "object oriented programming".
    if " " not in clean_keyword and clean_keyword.isalpha() and 2 <= len(clean_keyword) <= 8:
        acronym = clean_keyword.lower()
        phrase_length = len(acronym)
        for start in range(0, len(student_tokens) - phrase_length + 1):
            candidate = "".join(token[0] for token in student_tokens[start : start + phrase_length])
            if candidate == acronym:
                return True

    # Example: keyword "object oriented programming" matches "oop".
    keyword_tokens = clean_keyword.split()
    if len(keyword_tokens) > 1:
        acronym = "".join(token[0] for token in keyword_tokens if token)
        if acronym and acronym in student_tokens:
            return True

    return False


def concept_is_covered(concept, student_text, model, threshold=0.62):
    clean_student = preprocess(student_text)
    clean_concept = preprocess(concept)

    if not clean_concept:
        return False
    if clean_concept in clean_student or acronym_match(clean_concept, student_text):
        return True

    concept_embedding = model.encode([clean_concept])
    student_embedding = model.encode([clean_student or student_text or ""])
    similarity = cosine_similarity(concept_embedding, student_embedding)[0][0]
    return float(similarity) >= threshold


def semantic_keyword_match(keywords, student_text, model, threshold=0.62):
    if not keywords:
        return [], []

    clean_student = preprocess(student_text)
    covered = []
    missing = []

    keyword_embeddings = model.encode(keywords)
    student_embedding = model.encode([clean_student or student_text or ""])
    similarities = cosine_similarity(keyword_embeddings, student_embedding).flatten()

    for keyword, similarity in zip(keywords, similarities):
        if keyword in clean_student or acronym_match(keyword, student_text) or similarity >= threshold:
            covered.append(keyword)
        else:
            missing.append(keyword)

    return covered, missing


def tfidf_similarity(model_answer, student_answer):
    clean_model = preprocess(model_answer)
    clean_student = preprocess(student_answer)
    if not clean_model.strip() or not clean_student.strip():
        return 0.0

    vectorizer = TfidfVectorizer()
    matrix = vectorizer.fit_transform([clean_model, clean_student])
    return float(cosine_similarity(matrix[0:1], matrix[1:2])[0][0])


def semantic_similarity(model_answer, student_answer, model):
    if not model_answer.strip() or not student_answer.strip():
        return 0.0

    embeddings = model.encode([model_answer, student_answer])
    return float(cosine_similarity([embeddings[0]], [embeddings[1]])[0][0])


def sentence_coverage(model_answer, student_answer, model, threshold=0.75):
    model_sentences = sentence_tokenize(model_answer)
    student_sentences = sentence_tokenize(student_answer)

    if not model_sentences:
        return 0.0, [], student_sentences
    if not student_sentences:
        return 0.0, model_sentences, []

    model_embeddings = model.encode(model_sentences)
    student_embeddings = model.encode(student_sentences)
    similarity_matrix = cosine_similarity(model_embeddings, student_embeddings)

    missing_points = [
        sentence
        for index, sentence in enumerate(model_sentences)
        if float(np.max(similarity_matrix[index])) < threshold
    ]

    extra_points = [
        sentence
        for index, sentence in enumerate(student_sentences)
        if float(np.max(similarity_matrix[:, index])) < threshold
    ]

    score = 1 - (len(missing_points) / len(model_sentences))
    return max(float(score), 0.0), missing_points, extra_points


def length_score(model_answer, student_answer):
    model_words = word_count(model_answer)
    student_words = word_count(student_answer)
    if model_words == 0:
        return 0.0

    ratio = student_words / model_words
    if ratio <= 1:
        return float(ratio)

    # Mildly penalize very long answers instead of rewarding unlimited length.
    return float(max(0.65, 1 - min(ratio - 1, 1) * 0.35))


def quality_warnings(student_answer, model_answer):
    warnings = []
    student_words = word_count(student_answer)
    model_words = word_count(model_answer)

    if student_words < 15:
        warnings.append("The answer is very short, so the score may not reflect full understanding.")
    if model_words and student_words > model_words * 2:
        warnings.append("The answer is much longer than the model answer; check for irrelevant content.")

    sentences = sentence_tokenize(student_answer)
    if len(sentences) > 1 and len(set(sentences)) < len(sentences):
        warnings.append("Repeated sentences were detected.")

    return warnings


def grade_band(percentage):
    if percentage >= 85:
        return "Excellent"
    if percentage >= 70:
        return "Good"
    if percentage >= 50:
        return "Needs improvement"
    return "At risk"


def copied_answer_risk(model_answer, student_answer):
    if not model_answer.strip() or not student_answer.strip():
        return 0.0
    model_tokens = preprocess(model_answer).split()
    student_tokens = preprocess(student_answer).split()
    if not model_tokens or not student_tokens:
        return 0.0

    overlap = len(set(model_tokens) & set(student_tokens)) / max(len(set(student_tokens)), 1)
    length_similarity = min(word_count(model_answer), word_count(student_answer)) / max(
        word_count(model_answer),
        word_count(student_answer),
        1,
    )
    return round((overlap * 0.7 + length_similarity * 0.3) * 100, 2)


def improvement_suggestions(result):
    suggestions = []

    if result["scores"]["Semantic"] < 0.55:
        suggestions.append("Review the core concept; the answer meaning is far from the model answer.")
    if result["scores"]["Keyword"] < 0.65 and result["missing_keywords"]:
        suggestions.append("Add the missing key concepts: " + ", ".join(result["missing_keywords"][:5]) + ".")
    if result["scores"]["Sentence"] < 0.7 and result["missing_points"]:
        suggestions.append("Cover the missing answer points before adding extra explanation.")
    if result["scores"]["Length"] < 0.6:
        suggestions.append("Write a fuller answer with enough explanation for the marks.")
    if not suggestions:
        suggestions.append("The answer covers the main requirements. Minor wording improvements may still help.")

    return suggestions


def evaluate_answer(
    model_answer,
    student_answer,
    model,
    max_marks=10,
    weights=None,
    keyword_count=10,
    sentence_threshold=0.75,
    required_concepts=None,
):
    weights = normalize_weights(weights)

    tfidf_score = tfidf_similarity(model_answer, student_answer)
    semantic_score = semantic_similarity(model_answer, student_answer, model)

    required_concepts = required_concepts or []
    keywords = merge_concepts(required_concepts, extract_keywords(model_answer, top_n=keyword_count))
    covered_keywords, missing_keywords = semantic_keyword_match(keywords, student_answer, model)
    keyword_score = len(covered_keywords) / len(keywords) if keywords else 0.0

    sentence_score, missing_points, extra_points = sentence_coverage(
        model_answer,
        student_answer,
        model,
        threshold=sentence_threshold,
    )

    answer_length_score = length_score(model_answer, student_answer)

    final_score = (
        weights["semantic"] * semantic_score
        + weights["keyword"] * keyword_score
        + weights["sentence"] * sentence_score
        + weights["length"] * answer_length_score
    )

    marks = round(max(0.0, min(final_score, 1.0)) * float(max_marks), 2)

    result = {
        "marks": marks,
        "max_marks": max_marks,
        "percentage": round((marks / max_marks) * 100, 2) if max_marks else 0,
        "scores": {
            "Semantic": round(semantic_score, 3),
            "Keyword": round(keyword_score, 3),
            "Sentence": round(sentence_score, 3),
            "Length": round(answer_length_score, 3),
            "TF-IDF": round(tfidf_score, 3),
        },
        "weights": weights,
        "keywords": keywords,
        "covered_keywords": covered_keywords,
        "missing_keywords": missing_keywords,
        "missing_points": missing_points,
        "extra_points": extra_points,
        "model_words": word_count(model_answer),
        "student_words": word_count(student_answer),
        "warnings": quality_warnings(student_answer, model_answer),
        "copied_answer_risk": copied_answer_risk(model_answer, student_answer),
    }
    result["grade_band"] = grade_band(result["percentage"])
    result["suggestions"] = improvement_suggestions(result)
    return result
