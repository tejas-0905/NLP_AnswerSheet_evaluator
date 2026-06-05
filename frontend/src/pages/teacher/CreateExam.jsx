import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { getMyClassrooms } from "../../api/classroom";
import { createExam } from "../../api/exam";
import toast from "react-hot-toast";

const emptyQuestion = () => ({
  question_text: "",
  model_answer: "",
  max_marks: 10,
  required_concepts: "",
  order_index: 0,
});

const inputStyle = {
  width: "100%",
  padding: "9px 12px",
  border: "1px solid #e5e7eb",
  borderRadius: 8,
  fontSize: 14,
  boxSizing: "border-box",
  outline: "none",
  background: "#fff",
  color: "#111",
};

const labelStyle = {
  fontSize: 13,
  fontWeight: 500,
  color: "#374151",
  display: "block",
  marginBottom: 5,
};

export default function CreateExam() {
  const navigate = useNavigate();
  const [classrooms, setClassrooms] = useState([]);
  const [form, setForm] = useState({
    classroom_id: "",
    title: "",
    description: "",
    time_limit_minutes: "",
  });
  const [questions, setQuestions] = useState([emptyQuestion()]);
  const [collapsed, setCollapsed] = useState([false]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getMyClassrooms().then((r) => {
      setClassrooms(r.data);
      if (r.data.length > 0)
        setForm((f) => ({ ...f, classroom_id: r.data[0].id }));
    });
  }, []);

  const updateQuestion = (i, field, value) => {
    setQuestions((prev) =>
      prev.map((q, idx) => (idx === i ? { ...q, [field]: value } : q))
    );
  };

  const addQuestion = () => {
    setQuestions((prev) => [...prev, { ...emptyQuestion(), order_index: prev.length }]);
    setCollapsed((prev) => [...prev, false]);
  };

  const removeQuestion = (i) => {
    setQuestions((prev) => prev.filter((_, idx) => idx !== i));
    setCollapsed((prev) => prev.filter((_, idx) => idx !== i));
  };

  const toggleCollapse = (i) => {
    setCollapsed((prev) => prev.map((c, idx) => (idx === i ? !c : c)));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (questions.some((q) => !q.question_text.trim() || !q.model_answer.trim())) {
      toast.error("Fill in all question fields");
      return;
    }
    setLoading(true);
    try {
      await createExam({
        ...form,
        classroom_id: parseInt(form.classroom_id),
        time_limit_minutes: form.time_limit_minutes ? parseInt(form.time_limit_minutes) : null,
        questions: questions.map((q, i) => ({ ...q, order_index: i })),
      });
      toast.success("Exam created!");
      navigate("/teacher/exams");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to create exam");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 760 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 28 }}>
        <button
          onClick={() => navigate("/teacher/exams")}
          style={{
            background: "none", border: "none", cursor: "pointer",
            color: "#6b7280", fontSize: 14, padding: 0,
          }}
        >
          ← Back
        </button>
        <h1 style={{ fontSize: 22, fontWeight: 600, margin: 0, color: "#111" }}>
          Create new exam
        </h1>
      </div>

      <form onSubmit={handleSubmit}>
        {/* Exam details card */}
        <div style={{
          background: "#fff", border: "1px solid #e5e7eb",
          borderRadius: 12, padding: "24px", marginBottom: 20,
        }}>
          <p style={{ fontWeight: 600, fontSize: 15, margin: "0 0 20px", color: "#111" }}>
            Exam details
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
            <div>
              <label style={labelStyle}>Classroom</label>
              <select
                value={form.classroom_id}
                onChange={(e) => setForm({ ...form, classroom_id: e.target.value })}
                style={inputStyle}
                required
              >
                {classrooms.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Time limit (minutes)</label>
              <input
                type="number"
                min="5"
                placeholder="Leave blank for no limit"
                value={form.time_limit_minutes}
                onChange={(e) => setForm({ ...form, time_limit_minutes: e.target.value })}
                style={inputStyle}
              />
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Exam title</label>
            <input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="e.g. Unit 3 — Photosynthesis & Cell Division"
              required
              style={inputStyle}
            />
          </div>

          <div>
            <label style={labelStyle}>Description (optional)</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Instructions or notes for students"
              rows={2}
              style={{ ...inputStyle, resize: "vertical" }}
            />
          </div>
        </div>

        {/* Questions */}
        <div style={{ marginBottom: 16 }}>
          <p style={{ fontWeight: 600, fontSize: 15, margin: "0 0 14px", color: "#111" }}>
            Questions ({questions.length})
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {questions.map((q, i) => (
              <div key={i} style={{
                background: "#fff", border: "1px solid #e5e7eb",
                borderRadius: 12, overflow: "hidden",
              }}>
                {/* Question header */}
                <div
                  onClick={() => toggleCollapse(i)}
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "14px 18px", cursor: "pointer",
                    borderBottom: collapsed[i] ? "none" : "1px solid #f3f4f6",
                    background: "#fafafa",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{
                      width: 24, height: 24, borderRadius: 6,
                      background: "#eff6ff", color: "#2563eb",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 12, fontWeight: 600,
                    }}>
                      {i + 1}
                    </span>
                    <span style={{ fontSize: 14, color: q.question_text ? "#111" : "#9ca3af" }}>
                      {q.question_text || `Question ${i + 1}`}
                    </span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 12, color: "#6b7280" }}>{q.max_marks} marks</span>
                    {questions.length > 1 && (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); removeQuestion(i); }}
                        style={{ background: "none", border: "none", cursor: "pointer", color: "#d1d5db", padding: 4 }}
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                    {collapsed[i] ? <ChevronDown size={15} color="#9ca3af" /> : <ChevronUp size={15} color="#9ca3af" />}
                  </div>
                </div>

                {/* Question body */}
                {!collapsed[i] && (
                  <div style={{ padding: "18px" }}>
                    <div style={{ marginBottom: 14 }}>
                      <label style={labelStyle}>Question</label>
                      <textarea
                        value={q.question_text}
                        onChange={(e) => updateQuestion(i, "question_text", e.target.value)}
                        placeholder="Write the question here..."
                        rows={2}
                        required
                        style={{ ...inputStyle, resize: "vertical" }}
                      />
                    </div>

                    <div style={{ marginBottom: 14 }}>
                      <label style={labelStyle}>Model answer</label>
                      <textarea
                        value={q.model_answer}
                        onChange={(e) => updateQuestion(i, "model_answer", e.target.value)}
                        placeholder="Write the ideal answer students should give..."
                        rows={4}
                        required
                        style={{ ...inputStyle, resize: "vertical" }}
                      />
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                      <div>
                        <label style={labelStyle}>Max marks</label>
                        <input
                          type="number"
                          min={1}
                          value={q.max_marks}
                          onChange={(e) => updateQuestion(i, "max_marks", parseInt(e.target.value))}
                          style={inputStyle}
                        />
                      </div>
                      <div>
                        <label style={labelStyle}>Required concepts (comma-separated)</label>
                        <input
                          value={q.required_concepts}
                          onChange={(e) => updateQuestion(i, "required_concepts", e.target.value)}
                          placeholder="e.g. chlorophyll, glucose, sunlight"
                          style={inputStyle}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Add question button */}
          <button
            type="button"
            onClick={addQuestion}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              width: "100%", marginTop: 12, padding: "10px",
              border: "1px dashed #d1d5db", borderRadius: 10,
              background: "none", cursor: "pointer",
              fontSize: 14, color: "#6b7280", justifyContent: "center",
            }}
          >
            <Plus size={15} /> Add question
          </button>
        </div>

        {/* Submit */}
        <div style={{ display: "flex", gap: 12 }}>
          <button
            type="submit"
            disabled={loading}
            style={{
              background: "#2563eb", color: "#fff", border: "none",
              borderRadius: 8, padding: "10px 28px",
              cursor: "pointer", fontSize: 14, fontWeight: 500,
            }}
          >
            {loading ? "Creating..." : "Create exam"}
          </button>
          <button
            type="button"
            onClick={() => navigate("/teacher/exams")}
            style={{
              background: "#f3f4f6", color: "#374151", border: "none",
              borderRadius: 8, padding: "10px 20px",
              cursor: "pointer", fontSize: 14,
            }}
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}