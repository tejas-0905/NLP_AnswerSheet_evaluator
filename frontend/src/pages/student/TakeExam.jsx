import { useEffect, useState, useRef } from "react";
import { useParams, useLocation, useNavigate } from "react-router-dom";
import { getQuestions, submitExam } from "../../api/student";
import { Clock, AlertTriangle } from "lucide-react";
import toast from "react-hot-toast";

const BLUE = "#4361ee";

export default function TakeExam() {
  const { examId } = useParams();
  const { state } = useLocation();
  const navigate = useNavigate();
  const exam = state?.exam;

  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [current, setCurrent] = useState(0);
  const [timeLeft, setTimeLeft] = useState(
    exam?.time_limit_minutes ? exam.time_limit_minutes * 60 : null
  );
  const [submitting, setSubmitting] = useState(false);
  const timerRef = useRef();

  useEffect(() => {
    getQuestions(examId).then((r) => setQuestions(r.data));
  }, [examId]);

  // Countdown timer
  useEffect(() => {
    if (!timeLeft) return;
    if (timeLeft <= 0) { handleSubmit(); return; }
    timerRef.current = setTimeout(() => setTimeLeft((t) => t - 1), 1000);
    return () => clearTimeout(timerRef.current);
  }, [timeLeft]);

  const formatTime = (secs) => {
    const m = Math.floor(secs / 60).toString().padStart(2, "0");
    const s = (secs % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  const handleSubmit = async () => {
    const unanswered = questions.filter((q) => !answers[q.id]?.trim());
    if (unanswered.length > 0 && timeLeft > 0) {
      if (!confirm(`${unanswered.length} question(s) unanswered. Submit anyway?`)) return;
    }
    setSubmitting(true);
    clearTimeout(timerRef.current);
    try {
      const payload = {
        answers: questions
          .filter((q) => answers[q.id]?.trim())
          .map((q) => ({ question_id: q.id, answer_text: answers[q.id] })),
      };
      await submitExam(examId, payload);
      toast.success("Exam submitted! Results ready.");
      navigate(`/student/results/${examId}`);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Submission failed");
    } finally { setSubmitting(false); }
  };

  const answered = Object.values(answers).filter((a) => a?.trim()).length;
  const isLowTime = timeLeft !== null && timeLeft < 120;

  return (
    <div style={{ maxWidth: 760 }}>
      {/* Header */}
      <div style={{
        display: "flex", justifyContent: "space-between",
        alignItems: "center", marginBottom: 24,
        background: "#fff", borderRadius: 12,
        padding: "16px 22px", border: "1px solid #e8eaf6",
      }}>
        <div>
          <p style={{ fontWeight: 700, fontSize: 16, margin: 0, color: "#111" }}>
            {exam?.title || "Exam"}
          </p>
          <p style={{ fontSize: 13, color: "#6b7280", margin: "2px 0 0" }}>
            {answered} / {questions.length} answered
          </p>
        </div>
        {timeLeft !== null && (
          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            background: isLowTime ? "#fef2f2" : "#eef0fd",
            border: `1px solid ${isLowTime ? "#fecaca" : "#c7d2fe"}`,
            borderRadius: 8, padding: "8px 16px",
          }}>
            <Clock size={16} color={isLowTime ? "#dc2626" : BLUE} />
            <span style={{
              fontFamily: "monospace", fontSize: 18,
              fontWeight: 700, color: isLowTime ? "#dc2626" : BLUE,
            }}>
              {formatTime(timeLeft)}
            </span>
          </div>
        )}
      </div>

      {isLowTime && (
        <div style={{
          display: "flex", alignItems: "center", gap: 8,
          background: "#fef2f2", border: "1px solid #fecaca",
          borderRadius: 8, padding: "10px 16px", marginBottom: 16,
          fontSize: 13, color: "#dc2626",
        }}>
          <AlertTriangle size={15} /> Less than 2 minutes remaining!
        </div>
      )}

      {/* Question navigation pills */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 20 }}>
        {questions.map((q, i) => (
          <button
            key={q.id}
            onClick={() => setCurrent(i)}
            style={{
              width: 36, height: 36, borderRadius: "50%",
              border: `2px solid ${i === current ? BLUE : answers[q.id]?.trim() ? "#16a34a" : "#e8eaf6"}`,
              background: i === current ? BLUE : answers[q.id]?.trim() ? "#dcfce7" : "#fff",
              color: i === current ? "#fff" : answers[q.id]?.trim() ? "#16a34a" : "#6b7280",
              fontWeight: 700, fontSize: 13, cursor: "pointer",
            }}
          >
            {i + 1}
          </button>
        ))}
      </div>

      {/* Current question */}
      {questions[current] && (
        <div style={{
          background: "#fff", border: "1px solid #e8eaf6",
          borderRadius: 12, padding: "24px",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
            <span style={{
              fontSize: 12, fontWeight: 700, color: BLUE,
              background: "#eef0fd", padding: "3px 10px", borderRadius: 20,
            }}>
              Q{current + 1} of {questions.length}
            </span>
            <span style={{ fontSize: 13, color: "#6b7280" }}>
              {questions[current].max_marks} marks
            </span>
          </div>

          <p style={{ fontSize: 15, fontWeight: 600, color: "#111", margin: "0 0 20px", lineHeight: 1.5 }}>
            {questions[current].question_text}
          </p>

          <textarea
            value={answers[questions[current].id] || ""}
            onChange={(e) => setAnswers({ ...answers, [questions[current].id]: e.target.value })}
            placeholder="Type your answer here..."
            rows={6}
            style={{
              width: "100%", padding: "12px 14px",
              border: "1.5px solid #e8eaf6", borderRadius: 8,
              fontSize: 14, outline: "none", resize: "vertical",
              boxSizing: "border-box", lineHeight: 1.6,
              fontFamily: "inherit",
            }}
            onFocus={(e) => (e.target.style.borderColor = BLUE)}
            onBlur={(e) => (e.target.style.borderColor = "#e8eaf6")}
          />

          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 16 }}>
            <button
              onClick={() => setCurrent((c) => Math.max(0, c - 1))}
              disabled={current === 0}
              style={{
                padding: "9px 20px", border: "1px solid #e8eaf6",
                borderRadius: 8, background: "#fff",
                cursor: current === 0 ? "not-allowed" : "pointer",
                fontSize: 14, color: "#374151",
              }}
            >
              ← Previous
            </button>

            {current < questions.length - 1 ? (
              <button
                onClick={() => setCurrent((c) => c + 1)}
                style={{
                  padding: "9px 20px", background: BLUE,
                  border: "none", borderRadius: 8,
                  color: "#fff", cursor: "pointer", fontSize: 14, fontWeight: 600,
                }}
              >
                Next →
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={submitting}
                style={{
                  padding: "9px 24px",
                  background: submitting ? "#93c5fd" : "#16a34a",
                  border: "none", borderRadius: 8,
                  color: "#fff", cursor: submitting ? "not-allowed" : "pointer",
                  fontSize: 14, fontWeight: 700,
                }}
              >
                {submitting ? "Submitting..." : "Submit exam"}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}