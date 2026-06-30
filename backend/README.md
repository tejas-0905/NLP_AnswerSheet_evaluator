# AI Answer Sheet Evaluator

An NLP-powered answer evaluation app built with Streamlit and Sentence Transformers. It compares student answers with model answers and produces marks, concept coverage, missing points, weakly related points, and downloadable batch reports.

## Features

- Teacher-facing Streamlit dashboard
- Single-answer evaluation
- Multi-answer paper evaluation with total marks and question-wise feedback
- Required student information before full-paper evaluation
- Batch CSV evaluation
- Downloadable evaluated report
- Rubric-style scoring weights
- Rubric presets for balanced, concept-heavy, keyword-heavy, and descriptive answers
- Built-in sample questions for quick testing
- Manual required concepts for teacher-defined marking schemes
- Semantic similarity using `all-MiniLM-L6-v2`
- TF-IDF similarity for lexical overlap
- Keyword and concept coverage
- Abbreviation matching, such as `OOP` and `Object oriented programming`
- Sentence-level missing/extra point detection
- Length and quality warnings
- Improvement suggestions for students
- Copy-risk signal based on lexical overlap and answer length similarity
- Recent evaluation history during the current session
- Modular evaluator code for easier testing and extension

## Project Structure

```text
.
|-- main.py                    # Streamlit evaluator app
|-- evaluator.py               # Scoring and feedback logic
|-- preprocessing.py           # Text cleaning and tokenization helpers
|-- config.py                  # Environment-based settings
|-- api/
|   |-- main.py                # FastAPI app entry point
|   |-- db_startup.py          # Startup table/column initialization
|   |-- database.py            # SQLAlchemy engine/session setup
|   |-- dependencies.py        # Shared FastAPI dependencies
|   |-- models/                # SQLAlchemy database models
|   |-- schemas/               # Pydantic request/response schemas
|   |-- routers/               # API route handlers
|   `-- services/              # Auth, email, OCR, similarity services
|       `-- ocr/               # OCR engine helpers split by provider/task
|-- requirements.txt
`-- README.md
```

## Installation

```bash
pip install -r requirements.txt
```

## Run

From the project root, run the Streamlit evaluator:

```bash
streamlit run backend/main.py
```

From the `backend` folder, run the FastAPI auth API:

```powershell
cd backend
.\venv\Scripts\Activate.ps1
uvicorn api.main:app --reload
```

If PowerShell does not allow activation, run this once in PowerShell:

```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
```

The React frontend defaults to `http://127.0.0.1:8000`. If you choose a different backend port, set `VITE_API_BASE_URL` in `frontend/.env`.

From the `frontend` folder, run the React app:

```bash
cd frontend
npm run dev
```

The first run may take time because the Sentence Transformer model is downloaded and cached.

## Batch CSV Format

The batch evaluator requires these columns:

```csv
student_name,question,model_answer,student_answer,max_marks,required_concepts
```

Only `model_answer` and `student_answer` are strictly required. If `max_marks` is missing, the sidebar value is used. `required_concepts` is optional and can contain comma-separated concepts such as `OOP, classes, objects, inheritance`.

## Multi Answer Paper

Use the Multi Answer Paper tab when one student has multiple descriptive answers. The app evaluates each question separately, then shows:

- student name, roll number, class/section, subject, exam name, and evaluator
- total marks
- overall percentage
- overall grade band
- question-wise marks table
- question-wise improvement suggestions
- downloadable marks CSV
- downloadable overall feedback report

Required fields before evaluation:
- Student name
- Roll number
- Class / Section
- Subject

These details are included in the downloaded marks CSV and feedback report.

## Scoring Criteria

The final score combines:

- Concept accuracy: semantic similarity between the model answer and student answer
- Keyword coverage: important concepts from the model answer found in the student answer
- Point coverage: sentence-level match against expected answer points
- Answer length: rewards sufficient length while mildly penalizing overly long answers

Teachers can adjust the weights from the sidebar.
