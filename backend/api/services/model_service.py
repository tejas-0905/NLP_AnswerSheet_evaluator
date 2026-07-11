_sentence_model = None


def get_sentence_model():
    global _sentence_model
    if _sentence_model is None:
        from sentence_transformers import SentenceTransformer

        try:
            _sentence_model = SentenceTransformer("all-MiniLM-L6-v2", local_files_only=True)
        except Exception:
            _sentence_model = SentenceTransformer("all-MiniLM-L6-v2")
    return _sentence_model
