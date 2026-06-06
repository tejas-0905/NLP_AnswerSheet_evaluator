import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { getMyClassrooms, getExams } from "../../api/student";
import { Clock, BookOpen, CheckCircle, ArrowRight } from "lucide-react";

const BLUE = "#4361ee";

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

  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 20px", color: "#111" }}>My exams</h1>

      {/* Classroom selector */}
      <div style={{ marginBottom: 24 }}>
        <label style={{ fontSize: 13, color: "#6b7280", display: "block", marginBottom: 6 }}>Classroom</label>
        <select
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          style={{
            padding: "9px 12px", border: "1.5px solid #e8eaf6",
            borderRadius: 8, fontSize: 14, minWidth: 240,
            background: "#fff", color: "#111",
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
          {exams.map((exam) => (
            <div key={exam.id} style={{
              background: "#fff", border: "1px solid #e8eaf6",
              borderRadius: 12, padding: "18px 22px",
              display: "flex", alignItems: "center",
              justifyContent: "space-between",
              opacity: exam.attempted ? 0.75 : 1,
            }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                  <p style={{ fontWeight: 700, fontSize: 15, margin: 0, color: "#111" }}>{exam.title}</p>
                  {exam.attempted && (
                    <span style={{
                      display: "flex", alignItems: "center", gap: 4,
                      fontSize: 11, color: "#16a34a",
                      background: "#dcfce7", padding: "2px 8px", borderRadius: 20,
                    }}>
                      <CheckCircle size={11} /> Submitted
                    </span>
                  )}
                </div>
                <div style={{ display: "flex", gap: 16, fontSize: 13, color: "#6b7280" }}>
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
                  onClick={() => navigate(`/student/results/${exam.id}`)}
                  style={{
                    background: "#eef0fd", color: BLUE,
                    border: "none", borderRadius: 8,
                    padding: "8px 16px", cursor: "pointer",
                    fontSize: 13, fontWeight: 600,
                  }}
                >
                  View results
                </button>
              ) : (
                <button
                  onClick={() => navigate(`/student/take-exam/${exam.id}`, { state: { exam } })}
                  style={{
                    display: "flex", alignItems: "center", gap: 6,
                    background: BLUE, color: "#fff",
                    border: "none", borderRadius: 8,
                    padding: "8px 16px", cursor: "pointer",
                    fontSize: 13, fontWeight: 600,
                  }}
                >
                  Start exam <ArrowRight size={14} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}