import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, CheckCircle, FileText, RefreshCw, ScanText } from "lucide-react";
import { getOCRReviews } from "../../api/ocr";

const NAVY = "#0f2a5f";
const CARD_SHADOW = "0 10px 24px rgba(15, 23, 42, 0.04)";

const confidenceColor = (value) => {
  if (value >= 75) return "#16a34a";
  if (value >= 55) return "#d97706";
  return "#dc2626";
};

const statusStyle = (status) => {
  if (status === "needs_review") return { bg: "#fff7ed", color: "#9a3412", label: "Needs review" };
  if (status === "evaluated") return { bg: "#dcfce7", color: "#166534", label: "Evaluated" };
  if (status === "error") return { bg: "#fee2e2", color: "#991b1b", label: "OCR failed" };
  return { bg: "#e8eefc", color: NAVY, label: "Processed" };
};

const relativeDate = (value) => {
  if (!value) return "Recently";
  const days = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 86400000));
  if (days === 0) return "Today";
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
};

export default function OCRReviews() {
  const navigate = useNavigate();
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    getOCRReviews()
      .then((response) => setReviews(response.data))
      .catch(() => setReviews([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    Promise.resolve().then(load);
  }, []);

  const pending = reviews.filter((item) => item.status === "needs_review");

  return (
    <div style={{ maxWidth: 1080 }}>
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 16,
        marginBottom: 18,
      }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "#0f172a", margin: "0 0 4px" }}>
            OCR reviews
          </h1>
          <p style={{ color: "#64748b", fontSize: 13, margin: 0 }}>
            Track uploaded answer sheets and verify low-confidence OCR before final evaluation.
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            background: "#fff",
            border: "1px solid #dfe6f3",
            borderRadius: 8,
            color: "#475569",
            padding: "9px 12px",
            fontWeight: 800,
            cursor: "pointer",
          }}
        >
          <RefreshCw size={15} /> Refresh
        </button>
      </div>

      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
        gap: 14,
        marginBottom: 18,
      }}>
        {[
          { label: "Pending review", value: pending.length, icon: AlertTriangle, color: "#d97706" },
          { label: "Reviewed / ready", value: reviews.length - pending.length, icon: CheckCircle, color: "#16a34a" },
          { label: "Total uploads", value: reviews.length, icon: ScanText, color: NAVY },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} style={{
            background: "#fff",
            border: "1px solid #dfe6f3",
            borderRadius: 8,
            padding: 16,
            boxShadow: CARD_SHADOW,
          }}>
            <Icon size={18} color={color} />
            <p style={{ color: "#0f172a", fontSize: 26, fontWeight: 900, margin: "12px 0 4px" }}>{value}</p>
            <p style={{ color: "#64748b", fontSize: 12, fontWeight: 700, margin: 0 }}>{label}</p>
          </div>
        ))}
      </div>

      <div style={{
        background: "#fff",
        border: "1px solid #dfe6f3",
        borderRadius: 8,
        boxShadow: CARD_SHADOW,
        overflow: "hidden",
      }}>
        {loading ? (
          <p style={{ padding: 22, color: "#64748b", fontSize: 13 }}>Loading OCR reviews...</p>
        ) : reviews.length === 0 ? (
          <div style={{ padding: "46px 18px", textAlign: "center", color: "#64748b" }}>
            <FileText size={34} color="#94a3b8" />
            <p style={{ color: "#0f172a", fontWeight: 900, margin: "10px 0 4px" }}>No OCR reviews yet</p>
            <p style={{ fontSize: 13, margin: 0 }}>Low-confidence handwritten uploads will appear here.</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column" }}>
            {reviews.map((item, index) => (
              <button
                key={item.id}
                type="button"
                onClick={() => navigate(`/teacher/ocr-review/${item.id}`)}
                style={{
                  display: "grid",
                  gridTemplateColumns: "minmax(0, 1.4fr) minmax(150px, .6fr) 120px 120px",
                  gap: 16,
                  alignItems: "center",
                  padding: "15px 18px",
                  background: "#fff",
                  border: 0,
                  borderBottom: index === reviews.length - 1 ? 0 : "1px solid #eef2f7",
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: "block", color: "#0f172a", fontSize: 14, fontWeight: 900 }}>
                    {item.student_name}
                  </span>
                  <span style={{ display: "block", color: "#64748b", fontSize: 12, marginTop: 3 }}>
                    {item.exam_title} - {item.original_filename || "Uploaded sheet"}
                  </span>
                </span>
                <span style={{ color: "#64748b", fontSize: 12 }}>
                  {item.low_confidence_count} question{item.low_confidence_count === 1 ? "" : "s"} need review
                </span>
                <span style={{
                  justifySelf: "end",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: 999,
                  padding: "4px 10px",
                  background: `${confidenceColor(item.confidence_score)}16`,
                  color: confidenceColor(item.confidence_score),
                  fontSize: 12,
                  fontWeight: 900,
                }}>
                  {Number(item.confidence_score || 0).toFixed(1)}%
                </span>
                <span style={{
                  justifySelf: "end",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: 999,
                  padding: "4px 10px",
                  background: statusStyle(item.status).bg,
                  color: statusStyle(item.status).color,
                  fontSize: 12,
                  fontWeight: 900,
                }}>
                  {statusStyle(item.status).label}
                </span>
                <span style={{ gridColumn: "1 / -1", color: "#94a3b8", fontSize: 11 }}>
                  {relativeDate(item.created_at)}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
