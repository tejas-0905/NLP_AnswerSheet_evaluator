import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getMyResults } from "../../api/student";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";

const BLUE = "#0f2a5f";
const CARD_SHADOW = "0 10px 24px rgba(15, 23, 42, 0.04)";

const gradeBadge = (band) => {
  const map = {
    Excellent: { bg: "#dcfce7", color: "#16a34a" },
    Good: { bg: "#dbeafe", color: "#1d4ed8" },
    "Needs improvement": { bg: "#fef9c3", color: "#ca8a04" },
    "At risk": { bg: "#fee2e2", color: "#dc2626" },
  };
  return map[band] || { bg: "#f3f4f6", color: "#64748b" };
};

const pctColor = (p) => p >= 85 ? "#16a34a" : p >= 70 ? "#2563eb" : p >= 50 ? "#d97706" : "#dc2626";

const displayAnswer = (value) => {
  if (!value) return "No answer submitted.";
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed.join(", ");
  } catch {
    // Descriptive answers are plain text.
  }
  return value;
};

const ScoreBar = ({ label, value }) => (
  <div style={{ marginBottom: 10 }}>
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#64748b", marginBottom: 4 }}>
      <span>{label}</span><span>{Math.round(value * 100)}%</span>
    </div>
    <div style={{ height: 6, background: "#f3f4f6", borderRadius: 3 }}>
      <div style={{
        height: "100%", borderRadius: 3,
        width: `${value * 100}%`,
        background: value >= 0.7 ? "#16a34a" : value >= 0.5 ? "#d97706" : "#dc2626",
        transition: "width 0.6s ease",
      }} />
    </div>
  </div>
);

export default function MyResults() {
  const { examId } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [expanded, setExpanded] = useState(null);

  useEffect(() => {
    getMyResults(examId).then((r) => setData(r.data)).catch(() => {});
  }, [examId]);

  if (!data) return <p style={{ color: "#9ca3af", fontSize: 14 }}>Loading results...</p>;

  const chartData = data.questions.map((q, i) => ({
    name: `Q${i + 1}`,
    score: parseFloat(q.percentage.toFixed(1)),
  }));
  const teacherReviewNote = data.questions.find((q) => q.review_requested && q.teacher_review_note)?.teacher_review_note;

  return (
    <div style={{ maxWidth: 780 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 24 }}>
        <button
          onClick={() => navigate("/student/exams")}
          style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b", fontSize: 14, padding: 0 }}
        >
          Back
        </button>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, color: "#0f172a" }}>My results</h1>
      </div>

      {/* Overall score card */}
      <div style={{
        background: BLUE, borderRadius: 8,
        padding: "24px 28px", marginBottom: 20,
        display: "flex", justifyContent: "space-between", alignItems: "center",
        color: "#fff",
        boxShadow: "0 14px 30px rgba(15, 42, 95, 0.18)",
      }}>
        <div>
          <p style={{ fontSize: 13, color: "rgba(255,255,255,0.75)", margin: "0 0 4px" }}>Overall score</p>
          <p style={{ fontSize: 42, fontWeight: 700, margin: 0, lineHeight: 1 }}>
            {data.overall_percentage}%
          </p>
          <p style={{ fontSize: 14, color: "rgba(255,255,255,0.8)", margin: "6px 0 0" }}>
            {data.total_marks} / {data.total_max} marks
          </p>
        </div>
        <div style={{ textAlign: "right" }}>
          {(() => {
            const g = data.overall_percentage >= 85 ? "Excellent" :
              data.overall_percentage >= 70 ? "Good" :
              data.overall_percentage >= 50 ? "Needs improvement" : "At risk";
            return (
              <span style={{
                background: "rgba(255,255,255,0.2)",
                padding: "6px 16px", borderRadius: 20,
                fontSize: 14, fontWeight: 700,
              }}>{g}</span>
            );
          })()}
        </div>
      </div>

      {teacherReviewNote && (
        <div style={{
          background: "#fff7ed",
          border: "1px solid #fed7aa",
          borderRadius: 8,
          padding: "14px 16px",
          marginBottom: 20,
          color: "#9a3412",
          boxShadow: CARD_SHADOW,
        }}>
          <p style={{ fontSize: 13, fontWeight: 800, margin: "0 0 5px" }}>Teacher review</p>
          <p style={{ fontSize: 13, lineHeight: 1.6, margin: 0 }}>{teacherReviewNote}</p>
        </div>
      )}

      {/* Score chart */}
      <div style={{
        background: "#fff", border: "1px solid #dfe6f3",
        borderRadius: 8, padding: "20px 24px", marginBottom: 20,
        boxShadow: CARD_SHADOW,
      }}>
        <p style={{ fontWeight: 600, fontSize: 14, margin: "0 0 16px", color: "#0f172a" }}>
          Score per question
        </p>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={chartData} barCategoryGap="35%">
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
            <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#64748b" }} />
            <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: "#64748b" }} unit="%" />
            <Tooltip formatter={(v) => [`${v}%`, "Score"]} />
            <Bar dataKey="score" radius={[5, 5, 0, 0]}>
              {chartData.map((e, i) => (
                <Cell key={i} fill={pctColor(e.score)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Per-question breakdown */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {data.questions.map((q, i) => {
          const badge = gradeBadge(q.grade_band);
          const isOpen = expanded === i;
          return (
            <div key={i} style={{
              background: "#fff", border: "1px solid #dfe6f3",
              borderRadius: 8, overflow: "hidden",
              boxShadow: CARD_SHADOW,
            }}>
              {/* Header */}
              <div
                onClick={() => setExpanded(isOpen ? null : i)}
                style={{
                  display: "flex", justifyContent: "space-between",
                  alignItems: "center", padding: "16px 20px",
                  cursor: "pointer", background: isOpen ? "#f8fafc" : "#fff",
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                    <span style={{
                      width: 24, height: 24, borderRadius: 6,
                      background: "#e8eefc", color: BLUE,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 12, fontWeight: 700, flexShrink: 0,
                    }}>
                      {i + 1}
                    </span>
                    <p style={{ fontWeight: 600, fontSize: 14, margin: 0, color: "#0f172a" }}>
                      {q.question_text.length > 80 ? q.question_text.slice(0, 80) + "..." : q.question_text}
                    </p>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0, marginLeft: 12 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: pctColor(q.percentage) }}>
                    {q.marks.toFixed(1)}/{q.max_marks}
                  </span>
                  <span style={{ ...badge, padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600 }}>
                    {q.grade_band}
                  </span>
                  <span style={{ color: "#9ca3af", fontSize: 13 }}>{isOpen ? "Up" : "Down"}</span>
                </div>
              </div>

              {/* Expanded detail */}
              {isOpen && (
                <div style={{ padding: "0 20px 20px", borderTop: "1px solid #f3f4f6" }}>

                  {/* Your answer */}
                  <div style={{ marginTop: 16, marginBottom: 16 }}>
                    <p style={{ fontSize: 12, fontWeight: 600, color: "#64748b", margin: "0 0 6px" }}>
                      YOUR ANSWER
                    </p>
                    <p style={{
                      fontSize: 14, color: "#374151", margin: 0,
                      background: "#f8fafc", borderRadius: 8,
                      padding: "12px 14px", lineHeight: 1.6,
                      border: "1px solid #dfe6f3",
                    }}>
                      {displayAnswer(q.answer_text)}
                    </p>
                  </div>

                  {q.question_type === "mcq" && (
                    <div style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
                      gap: 10,
                      marginBottom: 16,
                    }}>
                      <div style={{
                        background: q.is_correct ? "#dcfce7" : "#fee2e2",
                        border: `1px solid ${q.is_correct ? "#bbf7d0" : "#fecaca"}`,
                        borderRadius: 8,
                        padding: "11px 12px",
                        color: q.is_correct ? "#166534" : "#991b1b",
                        fontSize: 13,
                        fontWeight: 700,
                      }}>
                        {q.is_correct ? "Correct answer" : "Incorrect answer"}
                      </div>
                      <div style={{
                        background: "#f8fafc",
                        border: "1px solid #dfe6f3",
                        borderRadius: 8,
                        padding: "11px 12px",
                      }}>
                        <p style={{ fontSize: 12, fontWeight: 600, color: "#64748b", margin: "0 0 4px" }}>
                          CORRECT OPTION
                        </p>
                        <p style={{ fontSize: 14, color: "#374151", margin: 0 }}>
                          {(q.correct_options || [q.correct_option]).filter(Boolean).join(", ") || "Not available"}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Score breakdown bars */}
                  <div style={{ marginBottom: 16 }}>
                    <p style={{ fontSize: 12, fontWeight: 600, color: "#64748b", margin: "0 0 10px" }}>
                      SCORE BREAKDOWN
                    </p>
                    <ScoreBar label="Semantic accuracy" value={q.semantic_score} />
                    <ScoreBar label="Keyword coverage" value={q.keyword_score} />
                    <ScoreBar label="Point coverage" value={q.sentence_score} />
                    <ScoreBar label="Answer length" value={q.length_score} />
                  </div>

                  {/* Copy risk */}
                  {q.copy_risk > 60 && (
                    <div style={{
                      background: "#fef2f2", border: "1px solid #fecaca",
                      borderRadius: 8, padding: "10px 14px", marginBottom: 14,
                      fontSize: 13, color: "#dc2626",
                    }}>
                      High similarity to model answer ({q.copy_risk.toFixed(0)}%)
                    </div>
                  )}

                  {/* Covered / missing keywords */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
                    <div>
                      <p style={{ fontSize: 12, fontWeight: 600, color: "#16a34a", margin: "0 0 6px" }}>
                        COVERED CONCEPTS
                      </p>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                        {q.covered_keywords.length > 0
                          ? q.covered_keywords.map((k) => (
                            <span key={k} style={{
                              fontSize: 11, background: "#dcfce7",
                              color: "#166534", padding: "2px 8px", borderRadius: 20,
                            }}>{k}</span>
                          ))
                          : <span style={{ fontSize: 12, color: "#9ca3af" }}>None detected</span>
                        }
                      </div>
                    </div>
                    <div>
                      <p style={{ fontSize: 12, fontWeight: 600, color: "#dc2626", margin: "0 0 6px" }}>
                        MISSING CONCEPTS
                      </p>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                        {q.missing_keywords.length > 0
                          ? q.missing_keywords.map((k) => (
                            <span key={k} style={{
                              fontSize: 11, background: "#fee2e2",
                              color: "#991b1b", padding: "2px 8px", borderRadius: 20,
                            }}>{k}</span>
                          ))
                          : <span style={{ fontSize: 12, color: "#9ca3af" }}>None missing</span>
                        }
                      </div>
                    </div>
                  </div>

                  {/* Suggestions */}
                  {q.suggestions.length > 0 && (
                    <div style={{ background: "#f8fafc", borderRadius: 8, padding: "12px 14px", border: "1px solid #dfe6f3" }}>
                      <p style={{ fontSize: 12, fontWeight: 600, color: BLUE, margin: "0 0 8px" }}>
                        SUGGESTIONS
                      </p>
                      {q.suggestions.map((s, si) => (
                        <p key={si} style={{ fontSize: 13, color: "#374151", margin: si === 0 ? 0 : "6px 0 0" }}>
                          {s}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}


