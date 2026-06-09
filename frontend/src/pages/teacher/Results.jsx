import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getExamResults } from "../../api/exam";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell
} from "recharts";

const gradeBadge = (band) => {
  const map = {
    Excellent:         { bg: "#dcfce7", color: "#16a34a" },
    Good:              { bg: "#dbeafe", color: "#1d4ed8" },
    "Needs improvement": { bg: "#fef9c3", color: "#ca8a04" },
    "At risk":         { bg: "#fee2e2", color: "#dc2626" },
  };
  const s = map[band] || { bg: "#f3f4f6", color: "#6b7280" };
  return {
    display: "inline-block", padding: "2px 10px",
    borderRadius: 20, fontSize: 11, fontWeight: 500, ...s,
  };
};

const barColor = (pct) => {
  if (pct >= 85) return "#16a34a";
  if (pct >= 70) return "#2563eb";
  if (pct >= 50) return "#d97706";
  return "#dc2626";
};

const formatDateTime = (value) => {
  if (!value) return "Not available";
  return new Date(value).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

const percent = (value) => `${Math.round((Number(value) || 0) * 100)}%`;

export default function Results() {
  const { examId, classroomId } = useParams();
  const navigate = useNavigate();
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);

  useEffect(() => {
    if (!examId) return;
    getExamResults(examId)
      .then((r) => setResults(r.data))
      .finally(() => setLoading(false));
  }, [examId]);

  const avg = results.length
    ? (results.reduce((s, r) => s + r.overall_percentage, 0) / results.length).toFixed(1)
    : 0;

  const chartData = results.map((r) => ({
    name: r.student_name.split(" ")[0],
    score: parseFloat(r.overall_percentage.toFixed(1)),
  }));

  const handleExport = () => {
    const rows = [
      ["Student", "Total Marks", "Max Marks", "Percentage", "Grade"],
      ...results.map((r) => [
        r.student_name,
        r.total_marks.toFixed(2),
        r.total_max,
        r.overall_percentage.toFixed(2) + "%",
        r.answers[0]?.grade_band || "",
      ]),
    ];
    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `exam_${examId}_results.csv`;
    a.click();
  };

  if (loading) return <p style={{ color: "#9ca3af", fontSize: 14 }}>Loading results...</p>;

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <button
            onClick={() => navigate(classroomId ? `/teacher/classrooms/${classroomId}/results` : "/teacher/exams")}
            style={{ background: "none", border: "none", cursor: "pointer", color: "#6b7280", fontSize: 14, padding: 0 }}
          >
            ← Back
          </button>
          <h1 style={{ fontSize: 22, fontWeight: 600, margin: 0, color: "#111" }}>Results</h1>
        </div>
        <button
          onClick={handleExport}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            background: "#fff", border: "1px solid #e5e7eb",
            borderRadius: 8, padding: "8px 16px", cursor: "pointer", fontSize: 13, color: "#374151",
          }}
        >
          Export CSV
        </button>
      </div>

      {results.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 0", color: "#9ca3af" }}>
          <p style={{ fontSize: 15 }}>No submissions yet for this exam.</p>
        </div>
      ) : (
        <>
          {/* Summary cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 14, marginBottom: 24 }}>
            {[
              { label: "Submissions", value: results.length },
              { label: "Average score", value: `${avg}%` },
              { label: "Passed (≥50%)", value: results.filter((r) => r.overall_percentage >= 50).length },
              { label: "At risk (<50%)", value: results.filter((r) => r.overall_percentage < 50).length },
            ].map((s) => (
              <div key={s.label} style={{
                background: "#fff", border: "1px solid #e5e7eb",
                borderRadius: 10, padding: "16px 18px",
              }}>
                <p style={{ fontSize: 12, color: "#6b7280", margin: "0 0 4px" }}>{s.label}</p>
                <p style={{ fontSize: 22, fontWeight: 600, margin: 0, color: "#111" }}>{s.value}</p>
              </div>
            ))}
          </div>

          {/* Bar chart */}
          <div style={{
            background: "#fff", border: "1px solid #e5e7eb",
            borderRadius: 12, padding: "20px 24px", marginBottom: 24,
          }}>
            <p style={{ fontWeight: 600, fontSize: 14, margin: "0 0 16px", color: "#111" }}>
              Score distribution
            </p>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData} barCategoryGap="30%">
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#6b7280" }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: "#6b7280" }} unit="%" />
                <Tooltip formatter={(v) => [`${v}%`, "Score"]} />
                <Bar dataKey="score" radius={[4, 4, 0, 0]}>
                  {chartData.map((entry, index) => (
                    <Cell key={index} fill={barColor(entry.score)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Results table */}
          <div style={{
            background: "#fff", border: "1px solid #e5e7eb",
            borderRadius: 12, overflow: "hidden",
          }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
              <thead>
                <tr style={{ background: "#f9fafb", borderBottom: "1px solid #e5e7eb" }}>
                  {["Student", "Marks", "Percentage", "Grade", "Details"].map((h) => (
                    <th key={h} style={{
                      textAlign: "left", padding: "12px 16px",
                      fontSize: 12, color: "#6b7280", fontWeight: 500,
                    }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {results.map((r) => (
                  <>
                    <tr
                      key={r.student_id}
                      style={{ borderBottom: "1px solid #f3f4f6", cursor: "pointer" }}
                      onClick={() => setExpanded(expanded === r.student_id ? null : r.student_id)}
                    >
                      <td style={{ padding: "12px 16px", fontWeight: 500, color: "#111" }}>
                        {r.student_name}
                      </td>
                      <td style={{ padding: "12px 16px", color: "#374151" }}>
                        {r.total_marks.toFixed(1)} / {r.total_max}
                      </td>
                      <td style={{ padding: "12px 16px", fontWeight: 500, color: barColor(r.overall_percentage) }}>
                        {r.overall_percentage.toFixed(1)}%
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <span style={gradeBadge(r.answers[0]?.grade_band)}>
                          {r.answers[0]?.grade_band || "—"}
                        </span>
                      </td>
                      <td style={{ padding: "12px 16px", color: "#2563eb", fontSize: 13 }}>
                        {expanded === r.student_id ? "▲ Hide" : "▼ Show"}
                      </td>
                    </tr>

                    {/* Expanded detail row */}
                    {expanded === r.student_id && (
                      <tr key={`${r.student_id}-exp`}>
                        <td colSpan={5} style={{ padding: "0 16px 14px", background: "#f9fafb" }}>
                          <div style={{ display: "flex", flexDirection: "column", gap: 8, paddingTop: 10 }}>
                            {r.answers.map((a, i) => (
                              <div key={i} style={{
                                background: "#fff", border: "1px solid #e5e7eb",
                                borderRadius: 8, padding: "14px 16px",
                              }}>
                                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10, gap: 12 }}>
                                  <span style={{ fontSize: 14, fontWeight: 700, color: "#111" }}>
                                    Question {i + 1}
                                  </span>
                                  <span style={{ fontSize: 13, color: barColor(a.percentage), fontWeight: 600 }}>
                                    {a.marks.toFixed(1)} / {a.max_marks || "?"} marks · {a.percentage.toFixed(1)}%
                                  </span>
                                </div>

                                {a.question_text && (
                                  <div style={{ marginBottom: 12 }}>
                                    <p style={{ fontSize: 12, color: "#6b7280", fontWeight: 700, margin: "0 0 5px" }}>
                                      QUESTION
                                    </p>
                                    <p style={{ fontSize: 13, color: "#374151", lineHeight: 1.5, margin: 0 }}>
                                      {a.question_text}
                                    </p>
                                  </div>
                                )}

                                <div style={{
                                  background: "#f8fafc",
                                  border: "1px solid #e5e7eb",
                                  borderRadius: 8,
                                  padding: "11px 12px",
                                  marginBottom: 12,
                                }}>
                                  <p style={{ fontSize: 12, color: "#6b7280", fontWeight: 700, margin: "0 0 6px" }}>
                                    STUDENT ANSWER
                                  </p>
                                  <p style={{ fontSize: 13, color: "#111", lineHeight: 1.6, whiteSpace: "pre-wrap", margin: 0 }}>
                                    {a.answer_text || "No answer submitted."}
                                  </p>
                                </div>

                                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 10, marginBottom: 12 }}>
                                  <div style={{ background: "#fff", border: "1px solid #f3f4f6", borderRadius: 8, padding: "9px 10px" }}>
                                    <p style={{ fontSize: 11, color: "#9ca3af", margin: "0 0 3px", fontWeight: 700 }}>ANSWERED AT</p>
                                    <p style={{ fontSize: 13, color: "#374151", margin: 0 }}>{formatDateTime(a.submitted_at)}</p>
                                  </div>
                                  <div style={{ background: "#fff", border: "1px solid #f3f4f6", borderRadius: 8, padding: "9px 10px" }}>
                                    <p style={{ fontSize: 11, color: "#9ca3af", margin: "0 0 3px", fontWeight: 700 }}>TIME GIVEN</p>
                                    <p style={{ fontSize: 13, color: "#374151", margin: 0 }}>
                                      {a.time_limit_minutes ? `${a.time_limit_minutes} minutes` : "No time limit"}
                                    </p>
                                  </div>
                                  <div style={{ background: "#fff", border: "1px solid #f3f4f6", borderRadius: 8, padding: "9px 10px" }}>
                                    <p style={{ fontSize: 11, color: "#9ca3af", margin: "0 0 3px", fontWeight: 700 }}>EVALUATED AT</p>
                                    <p style={{ fontSize: 13, color: "#374151", margin: 0 }}>{formatDateTime(a.evaluated_at)}</p>
                                  </div>
                                </div>

                                {a.missing_keywords?.length > 0 && (
                                  <p style={{ fontSize: 12, color: "#dc2626", margin: "0 0 4px" }}>
                                    Missing: {a.missing_keywords.join(", ")}
                                  </p>
                                )}
                                {a.covered_keywords?.length > 0 && (
                                  <p style={{ fontSize: 12, color: "#16a34a", margin: "0 0 4px" }}>
                                    Covered: {a.covered_keywords.join(", ")}
                                  </p>
                                )}
                                {a.suggestions?.map((s, si) => (
                                  <p key={si} style={{ fontSize: 12, color: "#6b7280", margin: "2px 0 0" }}>
                                    → {s}
                                  </p>
                                ))}
                                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
                                  {[
                                    ["Meaning", percent(a.semantic_score)],
                                    ["Keywords", percent(a.keyword_score)],
                                    ["Points", percent(a.sentence_score)],
                                    ["Length", percent(a.length_score)],
                                    ["Copy risk", `${Number(a.copy_risk || 0).toFixed(1)}%`],
                                  ].map(([label, value]) => (
                                    <span key={label} style={{
                                      background: "#f9fafb",
                                      border: "1px solid #e5e7eb",
                                      borderRadius: 999,
                                      padding: "4px 9px",
                                      fontSize: 11,
                                      color: "#4b5563",
                                    }}>
                                      {label}: {value}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
