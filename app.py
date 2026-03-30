import streamlit as st
import nltk
import numpy as np
import re
import matplotlib.pyplot as plt

from nltk.corpus import stopwords
from nltk.stem import WordNetLemmatizer

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

from sentence_transformers import SentenceTransformer

from wordcloud import WordCloud

# ---------------- MODEL LOADING ----------------

@st.cache_resource
def load_nlp():
    nltk.download('stopwords')
    nltk.download('wordnet')
    nltk.download('punkt')
    nltk.download('punkt_tab') 
    return SentenceTransformer('all-MiniLM-L6-v2')

model = load_nlp()

stop_words = set(stopwords.words('english'))
lemmatizer = WordNetLemmatizer()

# ---------------- PREPROCESS ----------------

def preprocess(text):
    text = text.lower()
    text = re.sub(r'[^a-z\s]', '', text)

    tokens = nltk.word_tokenize(text)

    tokens = [
        lemmatizer.lemmatize(w)
        for w in tokens
        if w not in stop_words
    ]

    return " ".join(tokens)

# ---------------- KEYWORD EXTRACTION ----------------

def extract_keywords(text, top_n=10):
    tfidf = TfidfVectorizer(ngram_range=(1,2))
    matrix = tfidf.fit_transform([text])

    scores = matrix.toarray()[0]
    words = tfidf.get_feature_names_out()

    keywords = sorted(
        zip(words, scores),
        key=lambda x: x[1],
        reverse=True
    )

    return [w for w, s in keywords[:top_n]]

# ---------------- FAST SEMANTIC KEYWORD MATCH ----------------

def semantic_keyword_match(keywords, student_text):
    student_tokens = student_text.split()

    # Batch embeddings
    kw_embs = model.encode(keywords)
    student_embs = model.encode(student_tokens)

    sim_matrix = cosine_similarity(kw_embs, student_embs)

    covered = []
    missing = []

    for i, kw in enumerate(keywords):
        if np.max(sim_matrix[i]) > 0.6:
            covered.append(kw)
        else:
            missing.append(kw)

    return covered, missing

# ---------------- UI ----------------

st.set_page_config(layout="wide")

st.title("🧠 NLP Based Answer Sheet Evaluator")

st.sidebar.header("Evaluation Settings")

max_marks = st.sidebar.number_input(
    "Maximum Marks",
    value=10,
    min_value=1
)

# Optional: dynamic weights
semantic_w = st.sidebar.slider("Semantic Weight", 0.0, 1.0, 0.4)
keyword_w = st.sidebar.slider("Keyword Weight", 0.0, 1.0, 0.3)
sentence_w = st.sidebar.slider("Sentence Weight", 0.0, 1.0, 0.2)
length_w = st.sidebar.slider("Length Weight", 0.0, 1.0, 0.1)

# Normalize weights
total_w = semantic_w + keyword_w + sentence_w + length_w
semantic_w /= total_w
keyword_w /= total_w
sentence_w /= total_w
length_w /= total_w

# ---------------- INPUT ----------------

col1, col2 = st.columns(2)

with col1:
    model_answer = st.text_area("📘 Model Answer", height=250)

with col2:
    student_answer = st.text_area("📝 Student Answer", height=250)

# ---------------- EVALUATION ----------------

if st.button("Evaluate Answer"):

    if model_answer and student_answer:

        clean_model = preprocess(model_answer)
        clean_student = preprocess(student_answer)

        # TF-IDF similarity
        vectorizer = TfidfVectorizer()
        tfidf = vectorizer.fit_transform([clean_model, clean_student])

        tfidf_score = cosine_similarity(
            tfidf[0:1], tfidf[1:2]
        )[0][0]

        # Semantic similarity (FAST)
        emb = model.encode([model_answer, student_answer])

        semantic_score = cosine_similarity(
            [emb[0]], [emb[1]]
        )[0][0]

        # Keywords
        keywords = extract_keywords(clean_model)

        covered, missing_keywords = semantic_keyword_match(
            keywords, clean_student
        )

        keyword_score = len(covered) / len(keywords) if keywords else 0

        # Sentence comparison
        model_sents = nltk.sent_tokenize(model_answer)
        student_sents = nltk.sent_tokenize(student_answer)

        model_emb = model.encode(model_sents)
        student_emb = model.encode(student_sents)

        sim_matrix = cosine_similarity(model_emb, student_emb)

        missing_sents = []
        extra_sents = []

        for i, ms in enumerate(model_sents):
            if max(sim_matrix[i]) < 0.6:
                missing_sents.append(ms)

        for j, ss in enumerate(student_sents):
            if max(sim_matrix[:, j]) < 0.6:
                extra_sents.append(ss)

        sentence_score = 1 - (
            len(missing_sents) / len(model_sents)
            if model_sents else 0
        )

        # Length score
        model_words = len(model_answer.split())
        student_words = len(student_answer.split())

        length_score = min(student_words / model_words, 1) if model_words else 0

        # Final score
        final_score = (
            semantic_w * semantic_score +
            keyword_w * keyword_score +
            sentence_w * sentence_score +
            length_w * length_score
        )

        marks = round(final_score * max_marks, 2)

        # ---------------- RESULTS ----------------

        st.subheader("Evaluation Results")

        col1, col2, col3, col4 = st.columns(4)

        col1.metric("Semantic", round(semantic_score, 2))
        col2.metric("Keyword", round(keyword_score, 2))
        col3.metric("Sentence", round(sentence_score, 2))
        col4.metric("Length", round(length_score, 2))

        st.success(f"Final Marks: {marks:.1f} / {max_marks}")

        # Graph
        scores = {
            "Semantic": semantic_score,
            "Keyword": keyword_score,
            "Sentence": sentence_score,
            "Length": length_score
        }

        fig, ax = plt.subplots()
        ax.bar(scores.keys(), scores.values())
        ax.set_ylim(0, 1)
        st.pyplot(fig)

        # Keywords
        st.subheader("Keywords Covered")
        st.write(covered)

        st.subheader("Missing Keywords")
        st.write(missing_keywords)

        # Sentence feedback
        st.subheader("Missing Points")
        for m in missing_sents:
            st.write("•", m)

        st.subheader("Extra / Irrelevant Points")
        for e in extra_sents:
            st.write("•", e)

        # Word stats
        st.subheader("Word Statistics")

        col1, col2 = st.columns(2)
        col1.metric("Model Words", model_words)
        col2.metric("Student Words", student_words)

       

    else:
        st.warning("Please enter both answers")