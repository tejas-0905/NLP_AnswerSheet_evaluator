#  AI Answer Sheet Evaluator

An intelligent **AI-powered answer evaluation system** built using **Streamlit, NLP, and Sentence Transformers**. This application automatically evaluates student answers by comparing them with a model answer using multiple scoring techniques like semantic similarity, keyword matching, sentence coverage, and length analysis.

---

##  Features

- ✅ Semantic Similarity Analysis using transformer models  
- ✅ TF-IDF Based Text Similarity  
- ✅ Keyword Extraction & Matching  
- ✅ Sentence-Level Comparison (Missing & Extra Points Detection)  
- ✅ Dynamic Scoring System with Adjustable Weights  
- ✅ Visual Performance Graphs  
- ✅ Detailed Feedback for Students  

---

##  Tech Stack

- **Frontend/UI**: Streamlit  
- **NLP**: NLTK  
- **Vectorization**: TF-IDF (Scikit-learn)  
- **Semantic Embeddings**: Sentence Transformers (`all-MiniLM-L6-v2`)  
- **Visualization**: Matplotlib  


---

##  Installation

### 1. Clone the repository

```bash
git clone https://github.com/your-username/ai-answer-evaluator.git
cd ai-answer-evaluator
```
### 2. Install dependencies

``` bash
pip install -r requirements.txt
```

### 3. Run the application

```bash
streamlit run app.py
```
## 🚀 Extended Features

- 🧠 **Context-Aware Semantic Evaluation**  
  Uses transformer-based embeddings to understand meaning beyond exact word matches.

- ⚖️ **Customizable Evaluation Weights**  
  Adjust importance of semantic, keyword, sentence, and length scores dynamically.

- 🔍 **Advanced Keyword Extraction (Unigrams + Bigrams)**  
  Captures both single words and meaningful phrases for better evaluation.

- 📊 **Real-Time Performance Visualization**  
  Displays score breakdown using bar charts for quick interpretation.

- 🧾 **Detailed Answer Feedback System**  
  Highlights:
  - Missing key points  
  - Extra/irrelevant content  
  - Covered concepts  

- ✂️ **Text Preprocessing Pipeline**  
  Includes cleaning, tokenization, stopword removal, and lemmatization.

- 🧮 **Multi-Metric Scoring Engine**  
  Combines:
  - TF-IDF similarity  
  - Semantic similarity  
  - Keyword coverage  
  - Sentence alignment  
  - Length analysis  

- 📏 **Answer Length Normalization**  
  Prevents unfair scoring for overly long or short answers.

- 🧠 **Sentence-Level Semantic Matching**  
  Compares each sentence to detect conceptual gaps.

- 🚫 **Irrelevant Content Detection**  
  Identifies sentences in student answers that don’t align with the model answer.

- ⚡ **Fast Inference with Lightweight Transformer Model**  
  Uses `all-MiniLM-L6-v2` for efficient and quick evaluation.

- 💾 **Caching for Performance Optimization**  
  Reduces model loading time using Streamlit caching.

- 🖥️ **Interactive UI with Streamlit**  
  Clean and simple interface for easy usage.

- 📈 **Scalable Evaluation Framework**  
  Can be extended for:
  - Exams  
  - Assignments  
  - Online assessments  

- 🔄 **Modular Code Design**  
  Easy to modify or extend individual components like scoring or preprocessing.

- 🌐 **Ready for Integration**  
  Can be integrated with:
  - Learning Management Systems (LMS)  
  - EdTech platforms  

- 🧪 **Supports Experimental NLP Enhancements**  
  Easy to plug in:
  - BERT / GPT models  
  - Grammar checkers  
  - Topic modeling  

- 📚 **Automatic Keyword-Based Rubric Generation** *(Extendable)*  
  Can serve as a base for automated marking schemes.

- 🧑‍🏫 **Teacher Assistance Tool**  
  Helps reduce manual grading effort and ensures consistency.

- 🎯 **Objective and Consistent Evaluation**  
  Eliminates human bias in answer checking.

- 🔐 **Local Processing Capability**  
  Runs locally without requiring external APIs after setup.

- 🧩 **Flexible Input Handling**  
  Works with descriptive answers across multiple domains.







