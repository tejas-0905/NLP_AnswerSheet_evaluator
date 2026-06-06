import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BarChart2, Eye } from "lucide-react";
import { getMyClassrooms } from "../../api/classroom";
import { getExamsForClass } from "../../api/exam";

export default function ResultsHome() {
  const navigate = useNavigate();
  const [classrooms, setClassrooms] = useState([]);
  const [selectedClass, setSelectedClass] = useState("");
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getMyClassrooms().then((r) => {
      setClassrooms(r.data);
      if (r.data.length > 0) setSelectedClass(r.data[0].id);
    });
  }, []);

  useEffect(() => {
    if (!selectedClass) return;
    setLoading(true);
    getExamsForClass(selectedClass)
      .then((r) => setExams(r.data))
      .finally(() => setLoading(false));
  }, [selectedClass]);

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 600, margin: "0 0 4px", color: "#111" }}>
          Results
        </h1>
        <p style={{ color: "#6b7280", fontSize: 14, margin: 0 }}>
          Select an exam to view student submissions and scores.
        </p>
      </div>

      <div style={{ marginBottom: 22 }}>
        <label style={{ fontSize: 13, color: "#6b7280", display: "block", marginBottom: 6 }}>
          Classroom
        </label>
        <select
          value={selectedClass}
          onChange={(e) => setSelectedClass(e.target.value)}
          style={{
            padding: "8px 12px",
            border: "1px solid #e5e7eb",
            borderRadius: 8,
            fontSize: 14,
            minWidth: 240,
            background: "#fff",
            color: "#111",
          }}
        >
          {classrooms.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <p style={{ color: "#9ca3af", fontSize: 14 }}>Loading exams...</p>
      ) : exams.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 0", color: "#9ca3af" }}>
          <BarChart2 size={40} color="#d1d5db" style={{ marginBottom: 12 }} />
          <p style={{ fontSize: 15, margin: "0 0 4px" }}>No exams found for this classroom.</p>
          <p style={{ fontSize: 13, margin: 0 }}>Create an exam first, then results will appear here.</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {exams.map((exam) => (
            <div
              key={exam.id}
              style={{
                background: "#fff",
                border: "1px solid #e5e7eb",
                borderRadius: 12,
                padding: "18px 22px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 16,
              }}
            >
              <div style={{ minWidth: 0 }}>
                <p style={{ fontWeight: 600, fontSize: 15, margin: "0 0 4px", color: "#111" }}>
                  {exam.title}
                </p>
                <p style={{ fontSize: 13, color: "#6b7280", margin: 0 }}>
                  {exam.question_count} questions · {exam.total_marks} marks
                </p>
              </div>
              <button
                onClick={() => navigate(`/teacher/results/${exam.id}`)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  background: "#2563eb",
                  color: "#fff",
                  border: "none",
                  borderRadius: 8,
                  padding: "8px 16px",
                  cursor: "pointer",
                  fontSize: 13,
                  fontWeight: 600,
                  flexShrink: 0,
                }}
              >
                <Eye size={14} /> View results
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
