import { useEffect, useState } from "react";
import { getMyClassrooms } from "../../api/classroom";
import { getExamsForClass, getExamResults } from "../../api/exam";

const medal = (rank) => {
  if (rank === 1) return { bg: "#fef9c3", color: "#ca8a04", icon: "🥇" };
  if (rank === 2) return { bg: "#f3f4f6", color: "#6b7280", icon: "🥈" };
  if (rank === 3) return { bg: "#fef3ec", color: "#c2570a", icon: "🥉" };
  return { bg: "transparent", color: "#9ca3af", icon: rank };
};

export default function Leaderboard() {
  const [classrooms, setClassrooms] = useState([]);
  const [selectedClass, setSelectedClass] = useState("");
  const [exams, setExams] = useState([]);
  const [selectedExam, setSelectedExam] = useState("");
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getMyClassrooms().then((r) => {
      setClassrooms(r.data);
      if (r.data.length > 0) setSelectedClass(String(r.data[0].id));
    });
  }, []);

  useEffect(() => {
    if (!selectedClass) return;
    getExamsForClass(selectedClass).then((r) => {
      setExams(r.data);
      if (r.data.length > 0) setSelectedExam(String(r.data[0].id));
      else { setSelectedExam(""); setLeaderboard([]); }
    });
  }, [selectedClass]);

  useEffect(() => {
    if (!selectedExam) return;
    setLoading(true);
    getExamResults(selectedExam)
      .then((r) => setLeaderboard(r.data))
      .finally(() => setLoading(false));
  }, [selectedExam]);

  const pctColor = (pct) => {
    if (pct >= 85) return "#16a34a";
    if (pct >= 70) return "#2563eb";
    if (pct >= 50) return "#d97706";
    return "#dc2626";
  };

  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 600, margin: "0 0 24px", color: "#111" }}>
        Leaderboard
      </h1>

      {/* Selectors */}
      <div style={{ display: "flex", gap: 14, marginBottom: 28 }}>
        <div>
          <label style={{ fontSize: 12, color: "#6b7280", display: "block", marginBottom: 5 }}>
            Classroom
          </label>
          <select
            value={selectedClass}
            onChange={(e) => setSelectedClass(e.target.value)}
            style={{
              padding: "8px 12px", border: "1px solid #e5e7eb",
              borderRadius: 8, fontSize: 14, background: "#fff", minWidth: 200,
            }}
          >
            {classrooms.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label style={{ fontSize: 12, color: "#6b7280", display: "block", marginBottom: 5 }}>
            Exam
          </label>
          <select
            value={selectedExam}
            onChange={(e) => setSelectedExam(e.target.value)}
            style={{
              padding: "8px 12px", border: "1px solid #e5e7eb",
              borderRadius: 8, fontSize: 14, background: "#fff", minWidth: 220,
            }}
          >
            {exams.length === 0 && <option value="">No exams</option>}
            {exams.map((e) => (
              <option key={e.id} value={e.id}>{e.title}</option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <p style={{ color: "#9ca3af", fontSize: 14 }}>Loading...</p>
      ) : leaderboard.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 0", color: "#9ca3af" }}>
          <p>No results yet for this exam.</p>
        </div>
      ) : (
        <>
          {/* Top 3 podium */}
          {leaderboard.length >= 3 && (
            <div style={{
              display: "grid", gridTemplateColumns: "1fr 1fr 1fr",
              gap: 12, marginBottom: 24,
            }}>
              {[1, 0, 2].map((idx) => {
                const r = leaderboard[idx];
                if (!r) return <div key={idx} />;
                const rank = idx + 1;
                const realRank = idx === 0 ? 2 : idx === 1 ? 1 : 3;
                const m = medal(realRank);
                return (
                  <div key={idx} style={{
                    background: "#fff", border: "1px solid #e5e7eb",
                    borderRadius: 12, padding: "20px 16px", textAlign: "center",
                    borderTop: realRank === 1 ? "3px solid #ca8a04" : "1px solid #e5e7eb",
                  }}>
                    <div style={{
                      width: 44, height: 44, borderRadius: "50%",
                      background: m.bg, margin: "0 auto 10px",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: realRank <= 3 ? 20 : 14, fontWeight: 600, color: m.color,
                    }}>
                      {m.icon}
                    </div>
                    <p style={{ fontWeight: 600, fontSize: 14, margin: "0 0 2px", color: "#111" }}>
                      {leaderboard[idx].student_name}
                    </p>
                    <p style={{ fontSize: 20, fontWeight: 600, margin: "4px 0 0",
                      color: pctColor(leaderboard[idx].overall_percentage) }}>
                      {leaderboard[idx].overall_percentage.toFixed(1)}%
                    </p>
                    <p style={{ fontSize: 12, color: "#9ca3af", margin: "2px 0 0" }}>
                      {leaderboard[idx].total_marks.toFixed(1)} / {leaderboard[idx].total_max} marks
                    </p>
                  </div>
                );
              })}
            </div>
          )}

          {/* Full rankings table */}
          <div style={{
            background: "#fff", border: "1px solid #e5e7eb",
            borderRadius: 12, overflow: "hidden",
          }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
              <thead>
                <tr style={{ background: "#f9fafb", borderBottom: "1px solid #e5e7eb" }}>
                  {["Rank", "Student", "Marks", "Percentage"].map((h) => (
                    <th key={h} style={{
                      textAlign: "left", padding: "11px 16px",
                      fontSize: 12, color: "#6b7280", fontWeight: 500,
                    }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {leaderboard.map((r, i) => {
                  const m = medal(i + 1);
                  return (
                    <tr key={r.student_id} style={{
                      borderBottom: "1px solid #f3f4f6",
                      background: i < 3 ? m.bg + "55" : "transparent",
                    }}>
                      <td style={{ padding: "11px 16px", fontWeight: 600, color: m.color, fontSize: 13 }}>
                        {i < 3 ? m.icon : `#${i + 1}`}
                      </td>
                      <td style={{ padding: "11px 16px", fontWeight: 500, color: "#111" }}>
                        {r.student_name}
                      </td>
                      <td style={{ padding: "11px 16px", color: "#374151" }}>
                        {r.total_marks.toFixed(1)} / {r.total_max}
                      </td>
                      <td style={{ padding: "11px 16px", fontWeight: 500, color: pctColor(r.overall_percentage) }}>
                        {r.overall_percentage.toFixed(1)}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}