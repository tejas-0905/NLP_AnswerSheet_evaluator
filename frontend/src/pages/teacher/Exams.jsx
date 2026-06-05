import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, ToggleLeft, ToggleRight, Trash2, Eye } from "lucide-react";
import { getMyClassrooms } from "../../api/classroom";
import { getExamsForClass, toggleExam, deleteExam } from "../../api/exam";
import toast from "react-hot-toast";

const badge = (active) => ({
  display: "inline-block",
  padding: "2px 10px",
  borderRadius: 20,
  fontSize: 11,
  fontWeight: 500,
  background: active ? "#dcfce7" : "#f3f4f6",
  color: active ? "#16a34a" : "#6b7280",
});

export default function Exams() {
  const navigate = useNavigate();
  const [classrooms, setClassrooms] = useState([]);
  const [selectedClass, setSelectedClass] = useState("");
  const [exams, setExams] = useState([]);
  const [loadingExams, setLoadingExams] = useState(false);

  useEffect(() => {
    getMyClassrooms().then((r) => {
      setClassrooms(r.data);
      if (r.data.length > 0) setSelectedClass(r.data[0].id);
    });
  }, []);

  const loadExams = (classroomId) => {
    setLoadingExams(true);
    getExamsForClass(classroomId)
      .then((r) => setExams(r.data))
      .finally(() => setLoadingExams(false));
  };

  useEffect(() => {
    if (!selectedClass) return;
    const timer = setTimeout(() => loadExams(selectedClass), 0);
    return () => clearTimeout(timer);
  }, [selectedClass]);

  const handleToggle = async (exam) => {
    try {
      await toggleExam(exam.id, { is_active: !exam.is_active });
      setExams((prev) =>
        prev.map((e) => e.id === exam.id ? { ...e, is_active: !e.is_active } : e)
      );
      toast.success(exam.is_active ? "Exam deactivated" : "Exam published");
    } catch {
      toast.error("Could not update exam");
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("Delete this exam and all its questions?")) return;
    try {
      await deleteExam(id);
      setExams((prev) => prev.filter((e) => e.id !== id));
      toast.success("Exam deleted");
    } catch {
      toast.error("Could not delete");
    }
  };

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 600, margin: 0, color: "#111" }}>Exams</h1>
        <button
          onClick={() => navigate("/teacher/exams/create")}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            background: "#2563eb", color: "#fff", border: "none",
            borderRadius: 8, padding: "9px 16px", cursor: "pointer", fontSize: 14,
          }}
        >
          <Plus size={15} /> New exam
        </button>
      </div>

      {/* Classroom selector */}
      <div style={{ marginBottom: 20 }}>
        <label style={{ fontSize: 13, color: "#6b7280", display: "block", marginBottom: 6 }}>
          Filter by classroom
        </label>
        <select
          value={selectedClass}
          onChange={(e) => setSelectedClass(e.target.value)}
          style={{
            padding: "8px 12px", border: "1px solid #e5e7eb",
            borderRadius: 8, fontSize: 14, minWidth: 240, background: "#fff",
          }}
        >
          {classrooms.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      {/* Exams list */}
      {loadingExams ? (
        <p style={{ color: "#9ca3af", fontSize: 14 }}>Loading exams...</p>
      ) : exams.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 0", color: "#9ca3af" }}>
          <p style={{ fontSize: 15 }}>No exams yet for this classroom.</p>
          <p style={{ fontSize: 13 }}>Click "New exam" to create one.</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {exams.map((exam) => (
            <div key={exam.id} style={{
              background: "#fff", border: "1px solid #e5e7eb",
              borderRadius: 12, padding: "18px 22px",
              display: "flex", alignItems: "center", justifyContent: "space-between",
            }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                  <p style={{ fontWeight: 600, fontSize: 15, margin: 0, color: "#111" }}>
                    {exam.title}
                  </p>
                  <span style={badge(exam.is_active)}>
                    {exam.is_active ? "Live" : "Draft"}
                  </span>
                </div>
                <p style={{ fontSize: 13, color: "#6b7280", margin: 0 }}>
                  {exam.question_count} questions · {exam.total_marks} marks
                  {exam.time_limit_minutes ? ` · ${exam.time_limit_minutes} min` : " · No time limit"}
                </p>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <button
                  onClick={() => navigate(`/teacher/results/${exam.id}`)}
                  title="View results"
                  style={{
                    background: "#f8fafc", border: "1px solid #e5e7eb",
                    borderRadius: 7, padding: "6px 12px", cursor: "pointer",
                    display: "flex", alignItems: "center", gap: 5, fontSize: 13, color: "#374151",
                  }}
                >
                  <Eye size={14} /> Results
                </button>
                <button
                  onClick={() => handleToggle(exam)}
                  title={exam.is_active ? "Deactivate" : "Publish"}
                  style={{
                    background: exam.is_active ? "#f0fdf4" : "#f8fafc",
                    border: `1px solid ${exam.is_active ? "#bbf7d0" : "#e5e7eb"}`,
                    borderRadius: 7, padding: "6px 10px", cursor: "pointer",
                    color: exam.is_active ? "#16a34a" : "#6b7280",
                  }}
                >
                  {exam.is_active ? <ToggleRight size={17} /> : <ToggleLeft size={17} />}
                </button>
                <button
                  onClick={() => handleDelete(exam.id)}
                  style={{
                    background: "none", border: "none",
                    cursor: "pointer", color: "#d1d5db", padding: "6px",
                  }}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
