import io
import os
import sys
from datetime import datetime
from pathlib import Path

os.environ.setdefault("USE_TF", "0")

app = None
if os.getenv("RENDER") or any("uvicorn" in Path(arg).name.lower() for arg in sys.argv):
    from api.main import app

import pandas as pd
import streamlit as st
from sklearn.feature_extraction.text import HashingVectorizer
from sentence_transformers import SentenceTransformer

try:
    from backend.evaluator import DEFAULT_WEIGHTS, evaluate_answer, grade_band, parse_required_concepts
except ModuleNotFoundError:
    from evaluator import DEFAULT_WEIGHTS, evaluate_answer, grade_band, parse_required_concepts


st.set_page_config(
    page_title="AI Answer Sheet Evaluator",
    page_icon="A",
    layout="wide",
)


SAMPLE_QUESTIONS = {
    "Photosynthesis": {
        "model": "Photosynthesis is the process by which green plants prepare their food using sunlight, carbon dioxide, and water. Chlorophyll present in the leaves captures sunlight. During this process, plants produce glucose as food and release oxygen as a by-product.",
        "student": "Plants use sunlight, water, and carbon dioxide to make food. Chlorophyll helps absorb sunlight and oxygen is released.",
        "concepts": "sunlight, carbon dioxide, water, chlorophyll, glucose, oxygen",
    },
    "OOP": {
        "model": "OOP is a programming approach based on classes and objects. It helps organize code using encapsulation, inheritance, polymorphism, and abstraction.",
        "student": "Object oriented programming uses objects and classes. Encapsulation keeps data and methods together, inheritance helps reuse code, and polymorphism allows different behavior.",
        "concepts": "OOP, classes, objects, encapsulation, inheritance, polymorphism, abstraction",
    },
    "NLP": {
        "model": "NLP is a field of artificial intelligence that helps computers understand, interpret, and generate human language. It is used in chatbots, translation, sentiment analysis, and text summarization.",
        "student": "Natural language processing helps computers work with human language. It is used for chatbots, translation, and finding sentiment in text.",
        "concepts": "NLP, artificial intelligence, human language, chatbots, translation, sentiment analysis",
    },
}


RUBRIC_PRESETS = {
    "Balanced": DEFAULT_WEIGHTS,
    "Concept Heavy": {"semantic": 0.60, "keyword": 0.20, "sentence": 0.15, "length": 0.05},
    "Keyword Heavy": {"semantic": 0.30, "keyword": 0.45, "sentence": 0.20, "length": 0.05},
    "Descriptive Answer": {"semantic": 0.40, "keyword": 0.20, "sentence": 0.30, "length": 0.10},
}


def apply_custom_styles():
    st.markdown(
        """
        <style>
        .block-container {
            padding-top: 1.5rem;
            padding-bottom: 2rem;
        }
        div[data-testid="stMetric"] {
            background-color: #f8fafc !important;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 14px 16px;
            color: #0f172a !important;
        }
        div[data-testid="stMetric"] label {
            color: #475569 !important;
        }
        div[data-testid="stMetric"] [data-testid="stMetricValue"] {
            color: #0f172a !important;
            font-weight: 700;
        }
        div[data-testid="stMetric"] [data-testid="stMetricDelta"] {
            color: #334155 !important;
        }
        div[data-testid="stMetric"] p {
            color: #0f172a !important;
        }
        .section-note {
            color: #475569;
            font-size: 0.95rem;
            margin-bottom: 1rem;
        }
        </style>
        """,
        unsafe_allow_html=True,
    )


class LocalHashingEmbeddingModel:
    """Offline fallback with the same encode() shape as SentenceTransformer."""

    name = "Local TF-IDF-style fallback"

    def __init__(self):
        self.vectorizer = HashingVectorizer(
            n_features=1024,
            alternate_sign=False,
            norm="l2",
            ngram_range=(1, 2),
        )

    def encode(self, texts):
        return self.vectorizer.transform([str(text) for text in texts]).toarray()


@st.cache_resource(show_spinner="Loading NLP model...")
def load_model():
    try:
        model = SentenceTransformer("all-MiniLM-L6-v2", local_files_only=True)
        return model, "Sentence Transformer"
    except Exception:
        try:
            model = SentenceTransformer("all-MiniLM-L6-v2")
            return model, "Sentence Transformer"
        except Exception as error:
            return LocalHashingEmbeddingModel(), f"Fallback model: {error}"


def sidebar_settings():
    st.sidebar.header("Evaluation Settings")
    preset_name = st.sidebar.selectbox("Rubric preset", list(RUBRIC_PRESETS.keys()))
    preset = RUBRIC_PRESETS[preset_name]
    max_marks = st.sidebar.number_input("Maximum marks", min_value=1, value=10)
    keyword_count = st.sidebar.slider("Keywords to check", 3, 20, 10)
    sentence_threshold = st.sidebar.slider("Sentence match strictness", 0.50, 0.95, 0.75, 0.01)

    st.sidebar.divider()
    st.sidebar.caption("Rubric weights")
    semantic_w = st.sidebar.slider("Concept accuracy", 0.0, 1.0, preset["semantic"], 0.05)
    keyword_w = st.sidebar.slider("Keyword coverage", 0.0, 1.0, preset["keyword"], 0.05)
    sentence_w = st.sidebar.slider("Point coverage", 0.0, 1.0, preset["sentence"], 0.05)
    length_w = st.sidebar.slider("Answer length", 0.0, 1.0, preset["length"], 0.05)

    return {
        "max_marks": max_marks,
        "keyword_count": keyword_count,
        "sentence_threshold": sentence_threshold,
        "weights": {
            "semantic": semantic_w,
            "keyword": keyword_w,
            "sentence": sentence_w,
            "length": length_w,
        },
    }


def render_score_cards(result):
    score_col, percent_col, band_col, risk_col = st.columns(4)
    score_col.metric("Marks", f"{result['marks']} / {result['max_marks']}")
    percent_col.metric("Percentage", f"{result['percentage']}%")
    band_col.metric("Grade band", result["grade_band"])
    risk_col.metric("Copy risk", f"{result['copied_answer_risk']}%")


def render_feedback(result):
    st.subheader("Score Breakdown")
    chart_scores = {
        key: value
        for key, value in result["scores"].items()
        if key in {"Semantic", "Keyword", "Sentence", "Length"}
    }
    st.bar_chart(chart_scores)

    if result["warnings"]:
        for warning in result["warnings"]:
            st.warning(warning)

    st.subheader("Improvement Suggestions")
    for suggestion in result["suggestions"]:
        st.write(f"- {suggestion}")

    word_col, model_word_col = st.columns(2)
    word_col.metric("Student words", result["student_words"])
    model_word_col.metric("Model words", result["model_words"])

    keyword_col, missing_col = st.columns(2)
    with keyword_col:
        st.subheader("Covered Concepts")
        if result["covered_keywords"]:
            st.write(", ".join(result["covered_keywords"]))
        else:
            st.write("No major concepts detected as covered.")

    with missing_col:
        st.subheader("Missing Concepts")
        if result["missing_keywords"]:
            st.write(", ".join(result["missing_keywords"]))
        else:
            st.write("No major keyword gaps found.")

    points_col, extra_col = st.columns(2)
    with points_col:
        st.subheader("Missing Points")
        if result["missing_points"]:
            for point in result["missing_points"]:
                st.write(f"- {point}")
        else:
            st.write("No missing model-answer points found.")

    with extra_col:
        st.subheader("Extra or Weakly Related Points")
        if result["extra_points"]:
            for point in result["extra_points"]:
                st.write(f"- {point}")
        else:
            st.write("No weakly related points found.")


def build_text_report(result, model_answer, student_answer):
    lines = [
        "AI Answer Evaluation Report",
        f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M')}",
        "",
        f"Marks: {result['marks']} / {result['max_marks']}",
        f"Percentage: {result['percentage']}%",
        f"Grade band: {result['grade_band']}",
        f"Copy risk: {result['copied_answer_risk']}%",
        "",
        "Score Breakdown:",
    ]
    for name, score in result["scores"].items():
        lines.append(f"- {name}: {score}")

    lines.extend(["", "Covered Concepts:", ", ".join(result["covered_keywords"]) or "None"])
    lines.extend(["", "Missing Concepts:", ", ".join(result["missing_keywords"]) or "None"])
    lines.extend(["", "Missing Points:"])
    lines.extend([f"- {point}" for point in result["missing_points"]] or ["None"])
    lines.extend(["", "Extra or Weakly Related Points:"])
    lines.extend([f"- {point}" for point in result["extra_points"]] or ["None"])
    lines.extend(["", "Suggestions:"])
    lines.extend([f"- {suggestion}" for suggestion in result["suggestions"]])
    lines.extend(["", "Model Answer:", model_answer, "", "Student Answer:", student_answer])
    return "\n".join(lines)


def build_multi_answer_report(student_info, question_results):
    total_marks = sum(item["result"]["marks"] for item in question_results)
    total_max_marks = sum(item["result"]["max_marks"] for item in question_results)
    overall_percentage = round((total_marks / total_max_marks) * 100, 2) if total_max_marks else 0

    lines = [
        "Multi Answer Evaluation Report",
        f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M')}",
        "",
        "Student Information",
        f"Student name: {student_info.get('student_name') or 'Not provided'}",
        f"Roll number: {student_info.get('roll_number') or 'Not provided'}",
        f"Class/Section: {student_info.get('class_section') or 'Not provided'}",
        f"Subject: {student_info.get('subject') or 'Not provided'}",
        f"Exam/Assignment: {student_info.get('exam_name') or 'Not provided'}",
        f"Teacher/Evaluator: {student_info.get('teacher_name') or 'Not provided'}",
        "",
        f"Overall marks: {round(total_marks, 2)} / {round(total_max_marks, 2)}",
        f"Overall percentage: {overall_percentage}%",
        f"Overall grade band: {grade_band(overall_percentage)}",
        "",
        "Question-wise Feedback",
    ]

    for item in question_results:
        result = item["result"]
        lines.extend(
            [
                "",
                f"Q{item['question_no']}: {item['question_title']}",
                f"Marks: {result['marks']} / {result['max_marks']}",
                f"Percentage: {result['percentage']}%",
                f"Grade band: {result['grade_band']}",
                f"Missing concepts: {', '.join(result['missing_keywords']) or 'None'}",
                f"Suggestions: {' | '.join(result['suggestions'])}",
            ]
        )

    return "\n".join(lines)


def save_history(result):
    if "history" not in st.session_state:
        st.session_state.history = []
    st.session_state.history.insert(
        0,
        {
            "time": datetime.now().strftime("%H:%M:%S"),
            "marks": result["marks"],
            "max_marks": result["max_marks"],
            "percentage": result["percentage"],
            "grade_band": result["grade_band"],
            "missing_count": len(result["missing_keywords"]),
        },
    )
    st.session_state.history = st.session_state.history[:10]


def single_answer_view(model, settings):
    st.subheader("Single Answer Evaluation")
    sample_name = st.selectbox("Load sample question", ["Blank"] + list(SAMPLE_QUESTIONS.keys()))
    sample = SAMPLE_QUESTIONS.get(sample_name, {})

    left, right = st.columns(2)
    with left:
        model_answer = st.text_area("Model answer", value=sample.get("model", ""), height=260)
    with right:
        student_answer = st.text_area("Student answer", value=sample.get("student", ""), height=260)

    required_concepts_text = st.text_area(
        "Required concepts or abbreviations",
        value=sample.get("concepts", ""),
        help="Optional. Add comma-separated concepts such as OOP, encapsulation, inheritance.",
    )

    if st.button("Evaluate Answer", type="primary"):
        if not model_answer.strip() or not student_answer.strip():
            st.warning("Please enter both the model answer and the student answer.")
            return

        required_concepts = parse_required_concepts(required_concepts_text)
        result = evaluate_answer(
            model_answer=model_answer,
            student_answer=student_answer,
            model=model,
            max_marks=settings["max_marks"],
            weights=settings["weights"],
            keyword_count=settings["keyword_count"],
            sentence_threshold=settings["sentence_threshold"],
            required_concepts=required_concepts,
        )
        save_history(result)
        render_score_cards(result)
        render_feedback(result)
        st.download_button(
            "Download detailed feedback",
            build_text_report(result, model_answer, student_answer),
            file_name="answer_feedback_report.txt",
            mime="text/plain",
        )

    if st.session_state.get("history"):
        st.subheader("Recent Evaluations")
        st.dataframe(pd.DataFrame(st.session_state.history), use_container_width=True)


def question_result_row(item):
    result = item["result"]
    student_info = item.get("student_info", {})
    return {
        "student_name": student_info.get("student_name", ""),
        "roll_number": student_info.get("roll_number", ""),
        "class_section": student_info.get("class_section", ""),
        "subject": student_info.get("subject", ""),
        "exam_name": student_info.get("exam_name", ""),
        "teacher_name": student_info.get("teacher_name", ""),
        "question_no": item["question_no"],
        "question": item["question_title"],
        "marks": result["marks"],
        "max_marks": result["max_marks"],
        "percentage": result["percentage"],
        "grade_band": result["grade_band"],
        "copy_risk": result["copied_answer_risk"],
        "missing_concepts": ", ".join(result["missing_keywords"]),
        "suggestions": " | ".join(result["suggestions"]),
    }


def render_overall_result(question_results):
    rows = [question_result_row(item) for item in question_results]
    report = pd.DataFrame(rows)
    student_info = question_results[0].get("student_info", {}) if question_results else {}
    total_marks = report["marks"].sum()
    total_max_marks = report["max_marks"].sum()
    overall_percentage = round((total_marks / total_max_marks) * 100, 2) if total_max_marks else 0

    st.subheader("Overall Result")
    info_cols = st.columns(5)
    info_cols[0].metric("Student", student_info.get("student_name", "-"))
    info_cols[1].metric("Roll no.", student_info.get("roll_number", "-"))
    info_cols[2].metric("Class", student_info.get("class_section", "-"))
    info_cols[3].metric("Subject", student_info.get("subject", "-"))
    info_cols[4].metric("Exam", student_info.get("exam_name", "-"))

    total_col, percent_col, band_col, weak_col = st.columns(4)
    total_col.metric("Total marks", f"{round(total_marks, 2)} / {round(total_max_marks, 2)}")
    percent_col.metric("Overall percentage", f"{overall_percentage}%")
    band_col.metric("Overall grade", grade_band(overall_percentage))
    weak_col.metric("Questions needing review", int((report["percentage"] < 50).sum()))

    st.subheader("Question-wise Marks")
    st.bar_chart(report.set_index("question_no")["percentage"])
    st.dataframe(report, use_container_width=True)

    with st.expander("Detailed question feedback", expanded=True):
        for item in question_results:
            result = item["result"]
            st.markdown(f"**Q{item['question_no']}. {item['question_title']}**")
            st.write(f"Marks: {result['marks']} / {result['max_marks']} | Grade: {result['grade_band']}")
            if result["missing_keywords"]:
                st.write("Missing concepts: " + ", ".join(result["missing_keywords"]))
            else:
                st.write("Missing concepts: None")
            for suggestion in result["suggestions"]:
                st.write(f"- {suggestion}")

    csv_buffer = io.StringIO()
    report.to_csv(csv_buffer, index=False)
    download_col, text_col = st.columns(2)
    with download_col:
        st.download_button(
            "Download marks table",
            csv_buffer.getvalue(),
            file_name="multi_answer_marks.csv",
            mime="text/csv",
        )
    with text_col:
        st.download_button(
            "Download overall feedback",
            build_multi_answer_report(student_info, question_results),
            file_name="multi_answer_feedback.txt",
            mime="text/plain",
        )


def collect_student_info():
    st.subheader("Student Information")
    st.markdown(
        '<div class="section-note">Fill the basic details before evaluating the paper. These details are included in downloaded reports.</div>',
        unsafe_allow_html=True,
    )
    row1_col1, row1_col2, row1_col3 = st.columns(3)
    with row1_col1:
        student_name = st.text_input("Student name *", key="multi_student_name")
    with row1_col2:
        roll_number = st.text_input("Roll number *", key="multi_roll_number")
    with row1_col3:
        class_section = st.text_input("Class / Section *", key="multi_class_section")

    row2_col1, row2_col2, row2_col3 = st.columns(3)
    with row2_col1:
        subject = st.text_input("Subject *", key="multi_subject")
    with row2_col2:
        exam_name = st.text_input("Exam / Assignment name", key="multi_exam_name")
    with row2_col3:
        teacher_name = st.text_input("Teacher / Evaluator", key="multi_teacher_name")

    return {
        "student_name": student_name.strip(),
        "roll_number": roll_number.strip(),
        "class_section": class_section.strip(),
        "subject": subject.strip(),
        "exam_name": exam_name.strip(),
        "teacher_name": teacher_name.strip(),
    }


def validate_student_info(student_info):
    required_fields = {
        "student_name": "Student name",
        "roll_number": "Roll number",
        "class_section": "Class / Section",
        "subject": "Subject",
    }
    missing = [label for key, label in required_fields.items() if not student_info.get(key)]
    return missing


def multi_answer_view(model, settings):
    st.subheader("Multi Answer Paper")
    st.markdown(
        '<div class="section-note">Enter multiple model answers and student answers, then evaluate the full paper at once.</div>',
        unsafe_allow_html=True,
    )

    student_info = collect_student_info()
    question_count = st.number_input("Number of answers", min_value=2, max_value=10, value=3, step=1)

    use_samples = st.checkbox("Prefill first questions with sample data", value=True)
    sample_values = list(SAMPLE_QUESTIONS.items()) if use_samples else []
    question_payloads = []

    for index in range(int(question_count)):
        sample_name, sample = sample_values[index % len(sample_values)] if sample_values else (f"Question {index + 1}", {})
        with st.expander(f"Question {index + 1}", expanded=index == 0):
            title = st.text_input(
                "Question title",
                value=sample_name if use_samples else f"Question {index + 1}",
                key=f"multi_title_{index}",
            )
            marks = st.number_input(
                "Marks for this question",
                min_value=1,
                value=int(settings["max_marks"]),
                key=f"multi_marks_{index}",
            )
            left, right = st.columns(2)
            with left:
                model_answer = st.text_area(
                    "Model answer",
                    value=sample.get("model", ""),
                    height=180,
                    key=f"multi_model_{index}",
                )
            with right:
                student_answer = st.text_area(
                    "Student answer",
                    value=sample.get("student", ""),
                    height=180,
                    key=f"multi_student_{index}",
                )
            concepts = st.text_area(
                "Required concepts",
                value=sample.get("concepts", ""),
                height=80,
                key=f"multi_concepts_{index}",
            )
            question_payloads.append(
                {
                    "question_no": index + 1,
                    "question_title": title or f"Question {index + 1}",
                    "max_marks": marks,
                    "model_answer": model_answer,
                    "student_answer": student_answer,
                    "required_concepts": concepts,
                }
            )

    if st.button("Evaluate Full Paper", type="primary"):
        missing_student_info = validate_student_info(student_info)
        if missing_student_info:
            st.error("Please fill required student information: " + ", ".join(missing_student_info))
            return

        question_results = []
        missing_inputs = []

        progress = st.progress(0)
        for index, payload in enumerate(question_payloads):
            if not payload["model_answer"].strip() or not payload["student_answer"].strip():
                missing_inputs.append(str(payload["question_no"]))
                continue

            result = evaluate_answer(
                model_answer=payload["model_answer"],
                student_answer=payload["student_answer"],
                model=model,
                max_marks=payload["max_marks"],
                weights=settings["weights"],
                keyword_count=settings["keyword_count"],
                sentence_threshold=settings["sentence_threshold"],
                required_concepts=parse_required_concepts(payload["required_concepts"]),
            )
            question_results.append({**payload, "student_info": student_info, "result": result})
            progress.progress((index + 1) / len(question_payloads))

        if missing_inputs:
            st.warning("Skipped questions with missing model/student answer: " + ", ".join(missing_inputs))
        if not question_results:
            st.error("Please add at least one complete question before evaluating.")
            return

        st.session_state.multi_results = question_results

    if st.session_state.get("multi_results"):
        render_overall_result(st.session_state.multi_results)


def build_report_row(row, result):
    return {
        "student_name": row.get("student_name", ""),
        "question": row.get("question", ""),
        "marks": result["marks"],
        "max_marks": result["max_marks"],
        "percentage": result["percentage"],
        "semantic_score": result["scores"]["Semantic"],
        "keyword_score": result["scores"]["Keyword"],
        "sentence_score": result["scores"]["Sentence"],
        "length_score": result["scores"]["Length"],
        "tfidf_score": result["scores"]["TF-IDF"],
        "covered_keywords": ", ".join(result["covered_keywords"]),
        "missing_keywords": ", ".join(result["missing_keywords"]),
        "missing_points": " | ".join(result["missing_points"]),
        "extra_points": " | ".join(result["extra_points"]),
        "warnings": " | ".join(result["warnings"]),
        "suggestions": " | ".join(result["suggestions"]),
        "grade_band": result["grade_band"],
        "copy_risk": result["copied_answer_risk"],
    }


def batch_view(model, settings):
    st.subheader("Batch Evaluation")
    st.write("Upload a CSV with columns: student_name, question, model_answer, student_answer, max_marks, required_concepts.")

    sample = pd.DataFrame(
        [
            {
                "student_name": "Student 1",
                "question": "Explain photosynthesis.",
                "model_answer": "Photosynthesis is the process by which green plants use sunlight, carbon dioxide, and water to produce glucose and oxygen.",
                "student_answer": "Plants use sunlight with carbon dioxide and water to make food and release oxygen.",
                "max_marks": 10,
                "required_concepts": "sunlight, carbon dioxide, water, chlorophyll, glucose, oxygen",
            }
        ]
    )
    st.download_button(
        "Download sample CSV",
        sample.to_csv(index=False),
        file_name="answer_evaluation_sample.csv",
        mime="text/csv",
    )

    uploaded_file = st.file_uploader("Upload answer CSV", type=["csv"])
    if uploaded_file is None:
        return

    data = pd.read_csv(uploaded_file)
    required_columns = {"model_answer", "student_answer"}
    missing_columns = required_columns - set(data.columns)
    if missing_columns:
        st.error(f"Missing required columns: {', '.join(sorted(missing_columns))}")
        return

    st.dataframe(data.head(10), use_container_width=True)

    if st.button("Evaluate CSV", type="primary"):
        report_rows = []
        progress = st.progress(0)

        for index, row in data.iterrows():
            max_marks = row.get("max_marks", settings["max_marks"])
            try:
                max_marks = float(max_marks)
            except (TypeError, ValueError):
                max_marks = settings["max_marks"]

            result = evaluate_answer(
                model_answer=str(row["model_answer"]),
                student_answer=str(row["student_answer"]),
                model=model,
                max_marks=max_marks,
                weights=settings["weights"],
                keyword_count=settings["keyword_count"],
                sentence_threshold=settings["sentence_threshold"],
                required_concepts=parse_required_concepts(row.get("required_concepts", "")),
            )
            report_rows.append(build_report_row(row, result))
            progress.progress((index + 1) / len(data))

        report = pd.DataFrame(report_rows)
        st.success("Batch evaluation complete.")
        summary_col, average_col, risk_col = st.columns(3)
        summary_col.metric("Answers evaluated", len(report))
        average_col.metric("Average percentage", f"{report['percentage'].mean():.2f}%")
        risk_col.metric("High copy-risk answers", int((report["copy_risk"] >= 80).sum()))

        st.subheader("Batch Grade Distribution")
        st.bar_chart(report["grade_band"].value_counts())

        st.dataframe(report, use_container_width=True)

        csv_buffer = io.StringIO()
        report.to_csv(csv_buffer, index=False)
        st.download_button(
            "Download evaluated report",
            csv_buffer.getvalue(),
            file_name="evaluated_answer_report.csv",
            mime="text/csv",
        )


def main():
    apply_custom_styles()
    st.title("AI Answer Sheet Evaluator")
    st.caption("Evaluate single answers, full question papers, and CSV batches with concept-level feedback.")

    model, model_status = load_model()
    if model_status == "Sentence Transformer":
        st.sidebar.success("Using Sentence Transformer model.")
    else:
        st.sidebar.warning("Using local fallback model. Semantic scores will be less accurate.")
        with st.sidebar.expander("Model load details"):
            st.write(model_status)

    settings = sidebar_settings()

    tab_single, tab_multi, tab_batch = st.tabs(["Single Answer", "Multi Answer Paper", "Batch CSV"])
    with tab_single:
        single_answer_view(model, settings)
    with tab_multi:
        multi_answer_view(model, settings)
    with tab_batch:
        batch_view(model, settings)


if __name__ == "__main__":
    main()
