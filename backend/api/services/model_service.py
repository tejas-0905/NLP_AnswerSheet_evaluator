import threading

_sentence_model = None
_sentence_model_lock = threading.Lock()


def get_sentence_model():
    """Lazy-load and cache the sentence-transformers model.

    Render memory issues often happen when multiple workers/threads try to
    load the model simultaneously. This lock ensures only one load happens
    per process.
    """

    global _sentence_model
    if _sentence_model is None:
        with _sentence_model_lock:
            if _sentence_model is None:
                from sentence_transformers import SentenceTransformer

                model_name = "all-MiniLM-L6-v2"
                # local_files_only=True first to avoid repeated downloads.
                try:
                    _sentence_model = SentenceTransformer(model_name, local_files_only=True)
                except Exception:
                    _sentence_model = SentenceTransformer(model_name)
    return _sentence_model

