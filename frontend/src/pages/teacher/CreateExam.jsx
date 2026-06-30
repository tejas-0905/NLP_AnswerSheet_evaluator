import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  CheckSquare,
  ClipboardList,
  Copy,
  FileText,
  Plus,
  Radio,
  Save,
  Trash2,
  Users,
} from "lucide-react";
import { createExam } from "../../api/exam";
import { getMe } from "../../api/auth";
import { getMyClassrooms, getStudents } from "../../api/classroom";
import toast from "react-hot-toast";

const BLUE = "#0f2a5f";
const ACTIVE_BG = "#e8eefc";
const BORDER = "#dfe6f3";
const MUTED = "#64748b";

const inputStyle = {
  width: "100%",
  padding: "10px 12px",
  border: `1px solid ${BORDER}`,
  borderRadius: 8,
  fontSize: 14,
  boxSizing: "border-box",
  outline: "none",
  background: "#fff",
  color: "#0f172a",
};

const panelStyle = {
  background: "#fff",
  border: `1px solid ${BORDER}`,
  borderRadius: 8,
  boxShadow: "0 10px 24px rgba(15, 23, 42, 0.04)",
};

const emptyQuestion = (type = "mcq", marks = 10) => ({
  question_type: type,
  question_text: "",
  model_answer: "",
  max_marks: marks,
  required_concepts: "",
  options: ["", "", "", ""],
  correct_options: [],
  allow_multiple: false,
  order_index: 0,
});

export default function CreateExam() {
  const navigate = useNavigate();
  const { state } = useLocation();
  const initialClassroomId = state?.classroomId ? String(state.classroomId) : "";
  const [classrooms, setClassrooms] = useState([]);
  const [students, setStudents] = useState([]);
  const [defaultMarks, setDefaultMarks] = useState(10);
  const [activeQuestion, setActiveQuestion] = useState(0);
  const [assignMode, setAssignMode] = useState("all");
  const [selectedStudentIds, setSelectedStudentIds] = useState([]);
  const [studentSearch, setStudentSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    classroom_id: "",
    title: "",
    description: "",
    time_limit_minutes: "",
  });
  const [questions, setQuestions] = useState([emptyQuestion("mcq", 10)]);

  useEffect(() => {
    getMyClassrooms().then((response) => {
      setClassrooms(response.data);
      const selected = initialClassroomId || response.data[0]?.id || "";
      if (selected) setForm((current) => ({ ...current, classroom_id: String(selected) }));
    });

    getMe().then((response) => {
      const marks = response.data.default_question_marks || 10;
      setDefaultMarks(marks);
      setQuestions((current) => [{ ...current[0], max_marks: marks }]);
    }).catch(() => {});
  }, [initialClassroomId]);

  useEffect(() => {
    if (!form.classroom_id) {
      Promise.resolve().then(() => setStudents([]));
      return;
    }
    getStudents(form.classroom_id)
      .then((response) => setStudents(response.data))
      .catch(() => setStudents([]));
    Promise.resolve().then(() => {
      setSelectedStudentIds([]);
      setAssignMode("all");
    });
  }, [form.classroom_id]);

  const totalMarks = useMemo(
    () => questions.reduce((sum, question) => sum + Number(question.max_marks || 0), 0),
    [questions]
  );

  const filteredStudents = useMemo(() => {
    const query = studentSearch.trim().toLowerCase();
    if (!query) return students;
    return students.filter((student) => (
      student.full_name.toLowerCase().includes(query)
    ));
  }, [studentSearch, students]);

  const backPath = initialClassroomId
    ? `/teacher/classrooms/${initialClassroomId}/exams`
    : "/teacher/exams";

  const currentQuestion = questions[activeQuestion];

  const updateQuestion = (index, patch) => {
    setQuestions((current) => current.map((question, questionIndex) => (
      questionIndex === index ? { ...question, ...patch } : question
    )));
  };

  const setQuestionType = (type) => {
    updateQuestion(activeQuestion, {
      question_type: type,
      model_answer: type === "mcq" ? "" : currentQuestion.model_answer,
      required_concepts: type === "mcq" ? "" : currentQuestion.required_concepts,
      correct_options: type === "mcq" ? currentQuestion.correct_options : [],
      allow_multiple: type === "mcq" ? currentQuestion.allow_multiple : false,
    });
  };

  const addQuestion = (type = "mcq") => {
    setQuestions((current) => {
      const next = [...current, { ...emptyQuestion(type, defaultMarks), order_index: current.length }];
      setActiveQuestion(next.length - 1);
      return next;
    });
  };

  const duplicateQuestion = () => {
    setQuestions((current) => {
      const copy = {
        ...current[activeQuestion],
        options: [...current[activeQuestion].options],
        correct_options: [...current[activeQuestion].correct_options],
      };
      const next = [
        ...current.slice(0, activeQuestion + 1),
        copy,
        ...current.slice(activeQuestion + 1),
      ];
      setActiveQuestion(activeQuestion + 1);
      return next;
    });
  };

  const removeQuestion = () => {
    if (questions.length === 1) return;
    setQuestions((current) => current.filter((_, index) => index !== activeQuestion));
    setActiveQuestion((index) => Math.max(0, index - 1));
  };

  const updateOption = (optionIndex, value) => {
    const oldValue = currentQuestion.options[optionIndex];
    const options = currentQuestion.options.map((option, index) => (
      index === optionIndex ? value : option
    ));
    const correctOptions = currentQuestion.correct_options.map((option) => (
      option === oldValue ? value : option
    )).filter(Boolean);
    updateQuestion(activeQuestion, { options, correct_options: correctOptions });
  };

  const toggleCorrectOption = (option) => {
    if (!option.trim()) return;
    if (currentQuestion.allow_multiple) {
      const exists = currentQuestion.correct_options.includes(option);
      updateQuestion(activeQuestion, {
        correct_options: exists
          ? currentQuestion.correct_options.filter((item) => item !== option)
          : [...currentQuestion.correct_options, option],
      });
    } else {
      updateQuestion(activeQuestion, { correct_options: [option] });
    }
  };

  const setAllowMultiple = (allowMultiple) => {
    updateQuestion(activeQuestion, {
      allow_multiple: allowMultiple,
      correct_options: allowMultiple
        ? currentQuestion.correct_options
        : currentQuestion.correct_options.slice(0, 1),
    });
  };

  const toggleStudent = (studentId) => {
    setSelectedStudentIds((current) => (
      current.includes(studentId)
        ? current.filter((id) => id !== studentId)
        : [...current, studentId]
    ));
  };

  const selectFilteredStudents = () => {
    setSelectedStudentIds((current) => Array.from(new Set([
      ...current,
      ...filteredStudents.map((student) => student.student_id),
    ])));
  };

  const validate = () => {
    if (!form.classroom_id || !form.title.trim()) {
      toast.error("Add a title and select a classroom");
      return false;
    }
    if (assignMode === "selected" && selectedStudentIds.length === 0) {
      toast.error("Select at least one student or assign to all students");
      return false;
    }
    for (const [index, question] of questions.entries()) {
      if (!question.question_text.trim()) {
        toast.error(`Question ${index + 1} needs question text`);
        setActiveQuestion(index);
        return false;
      }
      if (question.question_type === "mcq") {
        const options = question.options.map((option) => option.trim()).filter(Boolean);
        if (options.length < 2) {
          toast.error(`Question ${index + 1} needs at least two options`);
          setActiveQuestion(index);
          return false;
        }
        const validCorrect = question.correct_options.filter((option) => options.includes(option));
        if (validCorrect.length === 0) {
          toast.error(`Select correct answer for question ${index + 1}`);
          setActiveQuestion(index);
          return false;
        }
        if (!question.allow_multiple && validCorrect.length !== 1) {
          toast.error(`Question ${index + 1} is single-answer, select only one correct option`);
          setActiveQuestion(index);
          return false;
        }
      } else if (!question.model_answer.trim()) {
        toast.error(`Question ${index + 1} needs a model answer`);
        setActiveQuestion(index);
        return false;
      }
    }
    return true;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      await createExam({
        classroom_id: parseInt(form.classroom_id, 10),
        title: form.title.trim(),
        description: form.description.trim(),
        time_limit_minutes: form.time_limit_minutes ? parseInt(form.time_limit_minutes, 10) : null,
        assigned_student_ids: assignMode === "selected" ? selectedStudentIds : [],
        questions: questions.map((question, index) => ({
          question_type: question.question_type,
          question_text: question.question_text.trim(),
          model_answer: question.question_type === "descriptive" ? question.model_answer.trim() : "",
          max_marks: Number(question.max_marks || 1),
          required_concepts: question.question_type === "descriptive" ? question.required_concepts.trim() : "",
          options: question.question_type === "mcq"
            ? question.options.map((option) => option.trim()).filter(Boolean)
            : null,
          correct_option: question.question_type === "mcq" ? question.correct_options[0] : null,
          correct_options: question.question_type === "mcq" ? question.correct_options : null,
          allow_multiple: question.question_type === "mcq" ? question.allow_multiple : false,
          order_index: index,
        })),
      });
      toast.success("Exam created");
      navigate(backPath);
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to create exam");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ maxWidth: 1220 }}>
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 16,
        marginBottom: 18,
        background: "#fff",
        border: `1px solid ${BORDER}`,
        borderRadius: 8,
        padding: "16px 18px",
        boxShadow: "0 10px 24px rgba(15, 23, 42, 0.04)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button type="button" onClick={() => navigate(backPath)} style={{ border: 0, background: "#f8fafc", borderRadius: 8, cursor: "pointer", color: MUTED, width: 36, height: 36, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
            <ArrowLeft size={21} />
          </button>
          <div>
            <h1 style={{ margin: 0, color: "#0f172a", fontSize: 22, fontWeight: 900 }}>Create exam</h1>
            <p style={{ margin: "3px 0 0", color: MUTED, fontSize: 13 }}>
              Compose questions, choose students, and publish when ready.
            </p>
          </div>
        </div>
        <button type="submit" disabled={loading} style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          border: "1px solid #0f2a5f",
          background: loading ? "#93c5fd" : "#0f2a5f",
          color: "#fff",
          borderRadius: 8,
          padding: "10px 18px",
          cursor: loading ? "not-allowed" : "pointer",
          fontSize: 14,
          fontWeight: 900,
        }}>
          <Save size={16} /> {loading ? "Creating..." : "Create exam"}
        </button>
      </div>

      <section style={{ ...panelStyle, padding: 18, marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
          <span style={{ width: 32, height: 32, borderRadius: 8, background: ACTIVE_BG, color: BLUE, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <ClipboardList size={17} />
          </span>
          <div>
            <p style={{ margin: 0, color: "#0f172a", fontSize: 14, fontWeight: 900 }}>Exam setup</p>
            <p style={{ margin: "2px 0 0", color: MUTED, fontSize: 12 }}>Basic details students will see before starting.</p>
          </div>
        </div>
        <div className="create-exam-top-grid" style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr 140px 140px", gap: 14, alignItems: "end" }}>
          <div>
            <label style={labelStyle}>Exam title</label>
            <input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="e.g. Deep Learning Unit Test" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Classroom</label>
            <select value={form.classroom_id} onChange={(event) => setForm({ ...form, classroom_id: event.target.value })} style={inputStyle}>
              {classrooms.map((classroom) => <option key={classroom.id} value={classroom.id}>{classroom.name}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Time limit</label>
            <input type="number" min={5} value={form.time_limit_minutes} onChange={(event) => setForm({ ...form, time_limit_minutes: event.target.value })} placeholder="None" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Total marks</label>
            <div style={{ ...inputStyle, background: "#f8fafc", fontWeight: 900 }}>{totalMarks}</div>
          </div>
        </div>
        <textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="Instructions for students..." rows={2} style={{ ...inputStyle, marginTop: 14, resize: "vertical", fontFamily: "inherit" }} />
      </section>

      <div className="create-exam-layout" style={{ display: "grid", gridTemplateColumns: "250px minmax(0, 1fr) 310px", gap: 16, alignItems: "start" }}>
        <aside style={{ ...panelStyle, padding: 14 }}>
          <p style={{ margin: "0 0 4px", color: "#0f172a", fontSize: 13, fontWeight: 900 }}>Question plan</p>
          <p style={{ margin: "0 0 12px", color: MUTED, fontSize: 12 }}>Jump between questions quickly.</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
            {questions.map((question, index) => (
              <button key={index} type="button" onClick={() => setActiveQuestion(index)} style={{
                display: "flex",
                alignItems: "center",
                gap: 9,
                textAlign: "left",
                border: `1px solid ${activeQuestion === index ? "#c7d7f5" : "#e5e7eb"}`,
                background: activeQuestion === index ? ACTIVE_BG : "#fff",
                borderRadius: 8,
                padding: "10px 11px",
                cursor: "pointer",
              }}>
                {question.question_type === "mcq" ? <Radio size={15} color={BLUE} /> : <FileText size={15} color="#475569" />}
                <span style={{ minWidth: 0, flex: 1 }}>
                  <span style={{ display: "block", color: "#0f172a", fontSize: 13, fontWeight: 800, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    Q{index + 1}. {question.question_text || "Untitled"}
                  </span>
                  <span style={{ color: "#64748b", fontSize: 11 }}>{question.max_marks} marks</span>
                </span>
              </button>
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <button type="button" onClick={() => addQuestion("mcq")} style={miniButtonStyle}><Plus size={14} /> MCQ</button>
            <button type="button" onClick={() => addQuestion("descriptive")} style={miniButtonStyle}><Plus size={14} /> Text</button>
          </div>
        </aside>

        <main style={{ ...panelStyle, overflow: "hidden" }}>
          <div className="create-exam-editor-toolbar" style={{ padding: "16px 18px", borderBottom: "1px solid #e8edf7", display: "flex", justifyContent: "space-between", gap: 12 }}>
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" onClick={() => setQuestionType("mcq")} style={typeButton(currentQuestion.question_type === "mcq")}><Radio size={15} /> MCQ</button>
              <button type="button" onClick={() => setQuestionType("descriptive")} style={typeButton(currentQuestion.question_type === "descriptive")}><FileText size={15} /> Descriptive</button>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
              <label style={{ color: MUTED, fontSize: 12, fontWeight: 800 }}>Marks</label>
              <input type="number" min={1} value={currentQuestion.max_marks} onChange={(event) => updateQuestion(activeQuestion, { max_marks: parseInt(event.target.value, 10) || 1 })} style={{ ...inputStyle, width: 80, padding: "8px 10px" }} />
              <button type="button" onClick={duplicateQuestion} title="Duplicate" style={iconButtonStyle}><Copy size={16} /></button>
              <button type="button" onClick={removeQuestion} title="Delete" style={{ ...iconButtonStyle, color: "#dc2626" }}><Trash2 size={16} /></button>
            </div>
          </div>

          <div style={{ padding: 20 }}>
            <label style={labelStyle}>Question</label>
            <textarea value={currentQuestion.question_text} onChange={(event) => updateQuestion(activeQuestion, { question_text: event.target.value })} placeholder="Write the question students will see..." rows={3} style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit", marginBottom: 16 }} />

            {currentQuestion.question_type === "mcq" ? (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <div>
                    <p style={{ margin: 0, color: "#0f172a", fontSize: 13, fontWeight: 900 }}>Answer options</p>
                    <p style={{ margin: "2px 0 0", color: MUTED, fontSize: 12 }}>
                      {currentQuestion.allow_multiple ? "Students can select multiple answers." : "Students can select one answer."}
                    </p>
                  </div>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, color: "#334155", fontSize: 13, fontWeight: 800 }}>
                    <input type="checkbox" checked={currentQuestion.allow_multiple} onChange={(event) => setAllowMultiple(event.target.checked)} style={{ accentColor: BLUE }} />
                    Multiple correct
                  </label>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {currentQuestion.options.map((option, optionIndex) => {
                    const isCorrect = currentQuestion.correct_options.includes(option) && option.trim();
                    return (
                      <div key={optionIndex} style={{ display: "grid", gridTemplateColumns: "28px 1fr 34px", gap: 10, alignItems: "center" }}>
                        <input type={currentQuestion.allow_multiple ? "checkbox" : "radio"} checked={Boolean(isCorrect)} onChange={() => toggleCorrectOption(option)} style={{ width: 17, height: 17, accentColor: BLUE }} />
                        <input value={option} onChange={(event) => updateOption(optionIndex, event.target.value)} placeholder={`Option ${optionIndex + 1}`} style={inputStyle} />
                        <button type="button" onClick={() => updateQuestion(activeQuestion, { options: currentQuestion.options.filter((_, index) => index !== optionIndex), correct_options: currentQuestion.correct_options.filter((item) => item !== option) })} style={{ ...iconButtonStyle, color: "#94a3b8" }}><Trash2 size={15} /></button>
                      </div>
                    );
                  })}
                </div>
                <button type="button" onClick={() => updateQuestion(activeQuestion, { options: [...currentQuestion.options, ""] })} style={{ ...miniButtonStyle, marginTop: 12 }}>
                  <Plus size={14} /> Add option
                </button>
              </>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div>
                  <label style={labelStyle}>Model answer</label>
                  <textarea value={currentQuestion.model_answer} onChange={(event) => updateQuestion(activeQuestion, { model_answer: event.target.value })} placeholder="Ideal answer for NLP evaluation..." rows={6} style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }} />
                </div>
                <div>
                  <label style={labelStyle}>Required concepts</label>
                  <input value={currentQuestion.required_concepts} onChange={(event) => updateQuestion(activeQuestion, { required_concepts: event.target.value })} placeholder="neural networks, gradients, activation functions" style={inputStyle} />
                </div>
              </div>
            )}
          </div>
        </main>

        <aside style={{ ...panelStyle, padding: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 14 }}>
            <span style={{ width: 32, height: 32, borderRadius: 8, background: ACTIVE_BG, color: BLUE, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Users size={17} />
            </span>
            <div>
              <p style={{ margin: 0, color: "#0f172a", fontSize: 14, fontWeight: 900 }}>Exam access</p>
              <p style={{ margin: "2px 0 0", color: MUTED, fontSize: 12 }}>Choose who can attempt</p>
            </div>
          </div>

          <label style={accessOptionStyle(assignMode === "all")}>
            <input type="radio" checked={assignMode === "all"} onChange={() => setAssignMode("all")} style={{ accentColor: BLUE }} />
            <span>
              <strong style={accessTitleStyle}>All students</strong>
              <small style={accessDescriptionStyle}>Everyone in the classroom can give this exam.</small>
            </span>
          </label>
          <label style={accessOptionStyle(assignMode === "selected")}>
            <input type="radio" checked={assignMode === "selected"} onChange={() => setAssignMode("selected")} style={{ accentColor: BLUE }} />
            <span>
              <strong style={accessTitleStyle}>Selected students</strong>
              <small style={accessDescriptionStyle}>Only checked students will see the exam.</small>
            </span>
          </label>

          {assignMode === "selected" && (
            <div style={{ marginTop: 12, borderTop: "1px solid #eef2f7", paddingTop: 10 }}>
              <input
                value={studentSearch}
                onChange={(event) => setStudentSearch(event.target.value)}
                placeholder="Search by student name"
                style={{ ...inputStyle, marginBottom: 8 }}
              />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
                <button type="button" onClick={selectFilteredStudents} disabled={filteredStudents.length === 0} style={smallAccessButtonStyle}>
                  Select visible
                </button>
                <button type="button" onClick={() => setSelectedStudentIds([])} disabled={selectedStudentIds.length === 0} style={smallAccessButtonStyle}>
                  Clear selected
                </button>
              </div>
              <div style={{ maxHeight: 220, overflowY: "auto" }}>
              {students.length === 0 ? (
                <p style={{ color: "#94a3b8", fontSize: 13, margin: 0 }}>No students joined this classroom yet.</p>
              ) : filteredStudents.length === 0 ? (
                <p style={{ color: "#94a3b8", fontSize: 13, margin: 0 }}>No students match your search.</p>
              ) : filteredStudents.map((student) => (
                <label key={student.student_id} style={{ display: "grid", gridTemplateColumns: "22px 1fr", gap: 8, alignItems: "center", padding: "8px 0", cursor: "pointer" }}>
                  <input type="checkbox" checked={selectedStudentIds.includes(student.student_id)} onChange={() => toggleStudent(student.student_id)} style={{ accentColor: BLUE }} />
                  <span>
                    <span style={{ display: "block", color: "#0f172a", fontSize: 13, fontWeight: 800 }}>{student.full_name}</span>
                    <span style={{ color: "#64748b", fontSize: 12 }}>{student.email}</span>
                  </span>
                </label>
              ))}
              </div>
            </div>
          )}

          <div style={{ borderTop: "1px solid #eef2f7", marginTop: 14, paddingTop: 14 }}>
            <p style={{ margin: "0 0 8px", color: "#0f172a", fontSize: 13, fontWeight: 900 }}>Review</p>
            <ReviewRow icon={<ClipboardList size={15} />} label={`${questions.length} questions`} />
            <ReviewRow icon={<CheckSquare size={15} />} label={`${totalMarks} total marks`} />
            <ReviewRow icon={<Users size={15} />} label={assignMode === "all" ? "Assigned to all" : `${selectedStudentIds.length} selected`} />
          </div>
        </aside>
      </div>
    </form>
  );
}

function ReviewRow({ icon, label }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#475569", fontSize: 13, fontWeight: 700, marginBottom: 8 }}>
      {icon}
      {label}
    </div>
  );
}

const labelStyle = {
  display: "block",
  color: "#334155",
  fontSize: 12,
  fontWeight: 900,
  marginBottom: 6,
};

const miniButtonStyle = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
  border: `1px solid ${BORDER}`,
  background: "#fff",
  color: BLUE,
  borderRadius: 8,
  padding: "9px 10px",
  cursor: "pointer",
  fontSize: 13,
  fontWeight: 900,
};

const iconButtonStyle = {
  width: 34,
  height: 34,
  borderRadius: 8,
  border: `1px solid ${BORDER}`,
  background: "#fff",
  color: "#475569",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
};

const typeButton = (active) => ({
  display: "flex",
  alignItems: "center",
  gap: 7,
  border: `1px solid ${active ? "#c7d7f5" : BORDER}`,
  background: active ? ACTIVE_BG : "#fff",
  color: active ? "#1e3a8a" : "#475569",
  borderRadius: 8,
  padding: "9px 12px",
  cursor: "pointer",
  fontSize: 13,
  fontWeight: 900,
});

const accessOptionStyle = (active) => ({
  display: "grid",
  gridTemplateColumns: "22px 1fr",
  gap: 9,
  alignItems: "start",
  border: `1px solid ${active ? "#c7d7f5" : "#e5e7eb"}`,
  background: active ? ACTIVE_BG : "#fff",
  borderRadius: 8,
  padding: "11px 12px",
  marginBottom: 8,
  cursor: "pointer",
  color: "#0f172a",
  fontSize: 13,
});

const accessTitleStyle = {
  display: "block",
  color: "#0f172a",
  fontSize: 13,
  fontWeight: 900,
  lineHeight: 1.25,
  marginBottom: 4,
};

const accessDescriptionStyle = {
  display: "block",
  color: MUTED,
  fontSize: 12,
  lineHeight: 1.45,
};

const smallAccessButtonStyle = {
  border: `1px solid ${BORDER}`,
  background: "#fff",
  color: BLUE,
  borderRadius: 8,
  padding: "8px 9px",
  cursor: "pointer",
  fontSize: 12,
  fontWeight: 900,
};
