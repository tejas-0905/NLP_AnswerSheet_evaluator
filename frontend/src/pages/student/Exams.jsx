import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { getMyClassrooms, getExams } from "../../api/student";
import { Clock, BookOpen, CheckCircle, Edit3, UploadCloud, Loader2, AlertTriangle } from "lucide-react";

const BLUE = "#0f2a5f";
const CARD_SHADOW = "0 10px 24px rgba(15, 23, 42, 0.04)";

export default function StudentExams() {
  const navigate = useNavigate();
  const { state } = useLocation();
  const [classrooms, setClassrooms] = useState([]);
  const [selected, setSelected] = useState(state?.classroomId || "");
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getMyClassrooms().then((r) => {
      setClassrooms(r.data);
      if (!selected && r.data.length > 0) setSelected(r.data[0].id);
    });
  }, []);

  useEffect(() => {
    if (!selected) return;
    setLoading(true);
    getExams(selected).then((r) => setExams(r.data)).finally(() => setLoading(false));
  }, [selected]);

  const examState = (exam) => {
    if (exam.ocr_status === "processing" || exam.ocr_status === "ocr_done") {
      return {
        label: "Processing",
        icon: Loader2,
        bg: "#eef2ff",
        color: BLUE,
        canView: false,
      };
    }
    if (exam.ocr_status === "needs_review") {
      return {
        label: "Under review",
        icon: AlertTriangle,
        bg: "#fef9c3",
        color: "#a16207",
        canView: true,
      };
    }
    if (exam.attempted) {
      return {
        label: "Submitted",
        icon: CheckCircle,
        bg: "#dcfce7",
        color: "#16a34a",
        canView: true,
      };
    }
    return null;
  };

  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 20px", color: "#0f172a" }}>My exams</h1>

      {/* Classroom selector */}
      <div style={{ marginBottom: 24 }}>
        <label style={{ fontSize: 13, color: "#64748b", display: "block", marginBottom: 6 }}>Classroom</label>
        <select
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          style={{
            padding: "9px 12px", border: "1.5px solid #dfe6f3",
            borderRadius: 8, fontSize: 14, minWidth: 240,
            background: "#fff", color: "#0f172a",
          }}
        >
          {classrooms.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {loading ? (
        <p style={{ color: "#9ca3af" }}>Loading exams...</p>
      ) : exams.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 0", color: "#9ca3af" }}>
          <BookOpen size={40} color="#d1d5db" style={{ marginBottom: 12 }} />
          <p>No active exams in this classroom.</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {exams.map((exam) => {
            const state = examState(exam);
            const StatusIcon = state?.icon;
            return (
            <div key={exam.id} style={{
              background: "#fff", border: "1px solid #dfe6f3",
              borderRadius: 8, padding: "18px 22px",
              display: "flex", alignItems: "center",
              justifyContent: "space-between",
              opacity: exam.attempted ? 0.82 : 1,
              boxShadow: CARD_SHADOW,
            }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                  <p style={{ fontWeight: 700, fontSize: 15, margin: 0, color: "#0f172a" }}>{exam.title}</p>
                  {state && (
                    <span style={{
                      display: "flex", alignItems: "center", gap: 4,
                      fontSize: 11, color: state.color,
                      background: state.bg, padding: "2px 8px", borderRadius: 20,
                    }}>
                      <StatusIcon size={11} /> {state.label}
                    </span>
                  )}
                </div>
                <div style={{ display: "flex", gap: 16, fontSize: 13, color: "#64748b" }}>
                  <span>{exam.question_count} questions</span>
                  <span>{exam.total_marks} marks</span>
                  {exam.time_limit_minutes && (
                    <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <Clock size={13} /> {exam.time_limit_minutes} min
                    </span>
                  )}
                </div>
              </div>

              {exam.attempted ? (
                <button
                  onClick={() => state?.canView && navigate(`/student/results/${exam.id}`)}
                  disabled={!state?.canView}
                  style={{
                    background: state?.canView ? "#e8eefc" : "#f1f5f9",
                    color: state?.canView ? BLUE : "#94a3b8",
                    border: "none", borderRadius: 8,
                    padding: "8px 16px",
                    cursor: state?.canView ? "pointer" : "not-allowed",
                    fontSize: 13, fontWeight: 600,
                  }}
                >
                  {state?.canView ? "View results" : "Processing..."}
                </button>
              ) : (
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                  <button
                    onClick={() => navigate(`/student/take-exam/${exam.id}`, { state: { exam } })}
                    style={{
                      display: "flex", alignItems: "center", gap: 6,
                      background: BLUE, color: "#fff",
                      border: "none", borderRadius: 8,
                      padding: "8px 14px", cursor: "pointer",
                      fontSize: 13, fontWeight: 600,
                    }}
                  >
                    <Edit3 size={14} /> Type answers
                  </button>
                  <button
                    onClick={() => navigate(`/student/upload-sheet/${exam.id}`, { state: { exam } })}
                    style={{
                      display: "flex", alignItems: "center", gap: 6,
                      background: "#e8eefc", color: BLUE,
                      border: "none", borderRadius: 8,
                      padding: "8px 14px", cursor: "pointer",
                      fontSize: 13, fontWeight: 600,
                    }}
                  >
                    <UploadCloud size={14} /> Upload sheet
                  </button>
                </div>
              )}
            </div>
          )})}
        </div>
      )}
    </div>
  );
}


