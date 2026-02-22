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

@st.cache_resource
def load_nlp():
    nltk.download('stopwords')
    nltk.download('wordnet')
    nltk.download('punkt')
    return SentenceTransformer('all-MiniLM-L6-v2')

model = load_nlp()  

stop_words = set(stopwords.words('english'))
lemmatizer = WordNetLemmatizer()



# ------------------ FUNCTIONS ------------------

def preprocess(text):
    text = text.lower()
    text = re.sub(r'[^a-z\s]', '', text)
    tokens = nltk.word_tokenize(text)
    tokens = [lemmatizer.lemmatize(w) for w in tokens if w not in stop_words]
    return " ".join(tokens)

def extract_keywords(text, top_n=10):
    tfidf = TfidfVectorizer()
    tfidf_matrix = tfidf.fit_transform([text])
    scores = tfidf_matrix.toarray()[0]
    words = tfidf.get_feature_names_out()
    keywords = sorted(zip(words, scores), key=lambda x: x[1], reverse=True)
    return [w for w, s in keywords[:top_n]]

def sentence_similarity(sent1, sent2):
    emb = model.encode([sent1, sent2])
    return cosine_similarity([emb[0]], [emb[1]])[0][0]

# ------------------ STREAMLIT UI ------------------

st.title("🧠 AI Answer Sheet Evaluator")

st.write("Upload or paste **Model Answer** and **Student Answer** to evaluate automatically.")

model_answer = st.text_area("✍️ Enter Model Answer", height=150)
student_answer = st.text_area("✍️ Enter Student Answer", height=150)

max_marks = st.number_input("📝 Maximum Marks", value=10, min_value=1)

if st.button("✅ Evaluate"):
    if model_answer and student_answer:
        # Preprocess
        clean_model = preprocess(model_answer)
        clean_student = preprocess(student_answer)

        # -------- TF-IDF Similarity --------
        vectorizer = TfidfVectorizer()
        tfidf = vectorizer.fit_transform([clean_model, clean_student])
        sim_score = cosine_similarity(tfidf[0:1], tfidf[1:2])[0][0]

        # -------- Semantic Similarity --------
        semantic_sim = sentence_similarity(model_answer, student_answer)

        # -------- Final Score --------
        final_score = (sim_score + semantic_sim) / 2
        marks = round(final_score * max_marks, 2)

        # -------- Keyword Extraction --------
        keywords = extract_keywords(clean_model)
        covered = [kw for kw in keywords if kw in clean_student]
        missing_keywords = list(set(keywords) - set(covered))

        # -------- Sentence Level Comparison --------
        model_sents = nltk.sent_tokenize(model_answer)
        student_sents = nltk.sent_tokenize(student_answer)

        missing_sents = []
        extra_sents = []

        for ms in model_sents:
            sims = [sentence_similarity(ms, ss) for ss in student_sents]
            if max(sims) < 0.5:
                missing_sents.append(ms)

        for ss in student_sents:
            sims = [sentence_similarity(ss, ms) for ms in model_sents]
            if max(sims) < 0.5:
                extra_sents.append(ss)

        # ---------------- RESULTS ----------------
        st.subheader("📊 Results")
        st.write(f"**TF-IDF Similarity:** {round(sim_score,2)}")
        st.write(f"**Semantic Similarity:** {round(semantic_sim,2)}")
        st.success(f"🎯 **Final Marks:** {marks} / {max_marks}")

        # ---------------- GRAPH ----------------
        st.subheader("📈 Accuracy Graph")

        scores = {
            "TF-IDF Similarity": sim_score,
            "Semantic Similarity": semantic_sim,
            "Final Score": final_score
        }

        fig, ax = plt.subplots()
        ax.bar(scores.keys(), scores.values())
        ax.set_ylim(0, 1)
        ax.set_ylabel("Score (0 to 1)")
        ax.set_title("Answer Evaluation Scores")

        st.pyplot(fig)

        # ---------------- KEYWORDS ----------------
        st.subheader("🔑 Keywords Covered")
        st.write(covered)

        st.subheader("❌ Missing Keywords")
        st.write(missing_keywords)

        # ---------------- SENTENCES ----------------
        st.subheader("📉 Missing Points")
        if missing_sents:
            for m in missing_sents:
                st.write("•", m)
        else:
            st.write("None")

        st.subheader("📈 Extra / Irrelevant Points")
        if extra_sents:
            for e in extra_sents:
                st.write("•", e)
        else:
            st.write("None")

    else:
        st.warning("⚠️ Please enter both Model Answer and Student Answer.")
