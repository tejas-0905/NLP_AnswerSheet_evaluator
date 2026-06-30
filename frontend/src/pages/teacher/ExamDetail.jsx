import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, CalendarDays, CheckCircle2, Clock, FileText, ListChecks } from "lucide-react";
import { getExamDetail } from "../../api/exam";
import ClassroomTabs from "../../components/ClassroomTabs";
import toast from "react-hot-toast";

const badge = (active) => ({
  display: "inline-flex",
  alignItems: "center",
  gap: 5,
  padding: "4px 10px",
  borderRadius: 20,
  fontSize: 12,
  fontWeight: 600,
  background: active ? "#dcfce7" : "#f3f4f6",
  color: active ? "#16a34a" : "#6b7280",
});

const metaItemStyle = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  color: "#4b5563",
  fontSize: 13,
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

export default function ExamDetail() {
  const { examId, classroomId } = useParams();
  const navigate = useNavigate();
  const [exam, setExam] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    Promise.resolve().then(() => {
      if (isMounted) setLoading(true);
    });
    getExamDetail(examId)
      .then((response) => {
        if (isMounted) setExam(response.data);
      })
      .catch((error) => {
        toast.error(error.response?.data?.detail || "Could not load exam details");
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [examId]);

  const backPath = classroomId
    ? `/teacher/classrooms/${classroomId}/exams`
    : "/teacher/exams";

  if (loading) {
    return <p style={{ color: "#9ca3af", fontSize: 14 }}>Loading exam details...</p>;
  }

  if (!exam) {
    return (
      <div style={{ color: "#9ca3af", fontSize: 14 }}>
        Exam details could not be loaded.
      </div>
    );
  }

  return (
    <div>
      {classroomId && (
        <ClassroomTabs
          classroomId={classroomId}
          classroomName={exam.classroom_name}
        />
      )}

      <button
        onClick={() => navigate(backPath)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          background: "none",
          border: "none",
          color: "#6b7280",
          cursor: "pointer",
          fontSize: 14,
          padding: 0,
          marginBottom: 18,
        }}
      >
        <ArrowLeft size={15} /> Back to exams
      </button>

      <section style={{
        background: "#fff",
        border: "1px solid #e5e7eb",
        borderRadius: 12,
        padding: "22px 24px",
        marginBottom: 18,
      }}>
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 16,
          marginBottom: 16,
        }}>
          <div>
            <p style={{ color: "#6b7280", fontSize: 13, margin: "0 0 5px" }}>
              {exam.classroom_name}
            </p>
            <h1 style={{ color: "#111", fontSize: 24, margin: 0, fontWeight: 700 }}>
              {exam.title}
            </h1>
          </div>
          <span style={badge(exam.is_active)}>
            <CheckCircle2 size={14} /> {exam.is_active ? "Live" : "Draft"}
          </span>
        </div>

        {exam.description && (
          <p style={{
            color: "#374151",
            fontSize: 14,
            lineHeight: 1.6,
            margin: "0 0 18px",
            maxWidth: 880,
          }}>
            {exam.description}
          </p>
        )}

        <div style={{ display: "flex", flexWrap: "wrap", gap: 18 }}>
          <div style={metaItemStyle}>
            <CalendarDays size={16} color="#6b7280" />
            Created {formatDateTime(exam.created_at)}
          </div>
          <div style={metaItemStyle}>
            <ListChecks size={16} color="#6b7280" />
            {exam.question_count} question{exam.question_count !== 1 ? "s" : ""}
          </div>
          <div style={metaItemStyle}>
            <FileText size={16} color="#6b7280" />
            {exam.total_marks} marks
          </div>
          <div style={metaItemStyle}>
            <Clock size={16} color="#6b7280" />
            {exam.time_limit_minutes ? `${exam.time_limit_minutes} min` : "No time limit"}
          </div>
        </div>
      </section>

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {exam.questions.map((question, index) => (
          <section
            key={question.id}
            style={{
              background: "#fff",
              border: "1px solid #e5e7eb",
              borderRadius: 12,
              padding: "18px 22px",
            }}
          >
            <div style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
              marginBottom: 12,
            }}>
              <h2 style={{ fontSize: 16, color: "#111", margin: 0, fontWeight: 700 }}>
                Question {index + 1}
              </h2>
              <span style={{
                background: "#eff6ff",
                color: "#2563eb",
                border: "1px solid #bfdbfe",
                borderRadius: 999,
                padding: "3px 10px",
                fontSize: 12,
                fontWeight: 600,
                whiteSpace: "nowrap",
              }}>
                {question.max_marks} marks
              </span>
            </div>

            <div style={{ marginBottom: 14 }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: "#6b7280", margin: "0 0 6px" }}>
                QUESTION
              </p>
              <p style={{ color: "#111", fontSize: 14, lineHeight: 1.6, margin: 0 }}>
                {question.question_text}
              </p>
            </div>

            {question.question_type === "mcq" ? (
              <div style={{
                background: "#f9fafb",
                border: "1px solid #f3f4f6",
                borderRadius: 8,
                padding: "12px 14px",
              }}>
                <p style={{ fontSize: 12, fontWeight: 700, color: "#6b7280", margin: "0 0 8px" }}>
                  OPTIONS
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {(question.options || []).map((option) => {
                    const isCorrect = (question.correct_options || [question.correct_option]).includes(option);
                    return (
                    <div
                      key={option}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 12,
                        background: isCorrect ? "#dcfce7" : "#fff",
                        border: `1px solid ${isCorrect ? "#bbf7d0" : "#e5e7eb"}`,
                        borderRadius: 8,
                        padding: "8px 10px",
                        color: isCorrect ? "#166534" : "#374151",
                        fontSize: 13,
                      }}
                    >
                      <span>{option}</span>
                      {isCorrect && <span style={{ fontWeight: 700 }}>Correct</span>}
                    </div>
                  );})}
                </div>
                <p style={{ color: "#64748b", fontSize: 12, margin: "10px 0 0" }}>
                  {question.allow_multiple ? "Multiple answers allowed" : "Single answer"}
                </p>
              </div>
            ) : (
              <div style={{
              background: "#f9fafb",
              border: "1px solid #f3f4f6",
              borderRadius: 8,
              padding: "12px 14px",
              marginBottom: question.required_concepts ? 12 : 0,
            }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: "#6b7280", margin: "0 0 6px" }}>
                MODEL ANSWER
              </p>
              <p style={{ color: "#374151", fontSize: 14, lineHeight: 1.6, margin: 0, whiteSpace: "pre-wrap" }}>
                {question.model_answer}
              </p>
            </div>
            )}

            {question.question_type !== "mcq" && question.required_concepts && (
              <div>
                <p style={{ fontSize: 12, fontWeight: 700, color: "#6b7280", margin: "0 0 7px" }}>
                  REQUIRED CONCEPTS
                </p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {question.required_concepts.split(",").map((concept) => concept.trim()).filter(Boolean).map((concept) => (
                    <span
                      key={concept}
                      style={{
                        background: "#f8fafc",
                        border: "1px solid #e5e7eb",
                        borderRadius: 999,
                        color: "#4b5563",
                        fontSize: 12,
                        padding: "4px 9px",
                      }}
                    >
                      {concept}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}
