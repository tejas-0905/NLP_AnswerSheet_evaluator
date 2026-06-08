import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getOCRSubmission, correctExtraction } from "../../api/ocr";
import { CheckCircle, AlertTriangle, Edit3 } from "lucide-react";
import toast from "react-hot-toast";

const BLUE = "#4361ee";

export default function OCRReview() {
  const { ocrSubmissionId } = useParams();
  const navigate = useNavigate();
  const [data, setData]           = useState(null);
  const [edits, setEdits]         = useState({});
  const [saving, setSaving]       = useState({});

  useEffect(() => {
    getOCRSubmission(ocrSubmissionId).then((r) => {
      setData(r.data);
      const initial = {};
      r.data.extractions.forEach((e) => {
        initial[e.question_id] = e.extracted_text || "";
      });
      setEdits(initial);
    });
  }, [ocrSubmissionId]);

  const handleSave = async (questionId) => {
    setSaving({ ...saving, [questionId]: true });
    try {
      await correctExtraction(ocrSubmissionId, {
        question_id: questionId,
        corrected_text: edits[questionId],
      });
      toast.success("Corrected and re-evaluated");
      setData((prev) => ({
        ...prev,
        extractions: prev.extractions.map((e) =>
          e.question_id === questionId
            ? { ...e, extracted_text: edits[questionId], is_corrected: true }
            : e
        ),
      }));
    } catch {
      toast.error("Could not save correction");
    } finally {
      setSaving({ ...saving, [questionId]: false });
    }
  };

  if (!data) return <p style={{ color: "#9ca3af" }}>Loading...</p>;

  const confColor = (c) => c >= 75 ? "#16a34a" : c >= 55 ? "#d97706" : "#dc2626";
  const confBg    = (c) => c >= 75 ? "#dcfce7" : c >= 55 ? "#fef9c3" : "#fee2e2";

  return (
    <div style={{ maxWidth: 780 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 24 }}>
        <button
          onClick={() => navigate(-1)}
          style={{ background: "none", border: "none", cursor: "pointer", color: "#6b7280", fontSize: 14, padding: 0 }}
        >
          ← Back
        </button>
        <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0, color: "#111" }}>
          OCR review panel
        </h1>
      </div>

      {/* Summary */}
      <div style={{
        display: "grid", gridTemplateColumns: "1fr 1fr 1fr",
        gap: 12, marginBottom: 24,
      }}>
        {[
          { label: "Overall confidence", value: `${data.confidence_score?.toFixed(1)}%` },
          { label: "Questions extracted", value: data.extractions.length },
          { label: "Original file", value: data.original_filename || "—" },
        ].map((s) => (
          <div key={s.label} style={{
            background: "#fff", border: "1px solid #e8eaf6",
            borderRadius: 10, padding: "14px 16px",
          }}>
            <p style={{ fontSize: 12, color: "#6b7280", margin: "0 0 4px" }}>{s.label}</p>
            <p style={{ fontSize: 16, fontWeight: 700, margin: 0, color: "#111" }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Per-question extractions */}
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {data.extractions.map((ext, i) => (
          <div key={ext.question_id} style={{
            background: "#fff", border: "1px solid #e8eaf6",
            borderRadius: 12, padding: "20px 22px",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{
                  width: 26, height: 26, borderRadius: 6,
                  background: "#eef0fd", color: BLUE,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 12, fontWeight: 700,
                }}>
                  {i + 1}
                </span>
                <span style={{ fontWeight: 600, fontSize: 14, color: "#111" }}>
                  Question {i + 1}
                </span>
                {ext.is_corrected && (
                  <span style={{
                    display: "flex", alignItems: "center", gap: 4,
                    fontSize: 11, color: "#16a34a",
                    background: "#dcfce7", padding: "2px 8px", borderRadius: 20,
                  }}>
                    <CheckCircle size={11} /> Corrected
                  </span>
                )}
              </div>
              <span style={{
                fontSize: 12, fontWeight: 600,
                background: confBg(ext.confidence),
                color: confColor(ext.confidence),
                padding: "3px 10px", borderRadius: 20,
              }}>
                {ext.confidence?.toFixed(1)}% confidence
              </span>
            </div>

            {ext.confidence < 55 && (
              <div style={{
                display: "flex", alignItems: "center", gap: 8,
                background: "#fef2f2", border: "1px solid #fecaca",
                borderRadius: 7, padding: "8px 12px", marginBottom: 12,
                fontSize: 12, color: "#dc2626",
              }}>
                <AlertTriangle size={13} />
                Low confidence — please verify and correct if needed
              </div>
            )}

            <label style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", display: "block", marginBottom: 6 }}>
              EXTRACTED TEXT
            </label>
            <textarea
              value={edits[ext.question_id] || ""}
              onChange={(e) => setEdits({ ...edits, [ext.question_id]: e.target.value })}
              rows={4}
              style={{
                width: "100%", padding: "10px 12px",
                border: "1.5px solid #e8eaf6", borderRadius: 8,
                fontSize: 14, lineHeight: 1.6,
                boxSizing: "border-box", outline: "none",
                fontFamily: "inherit", resize: "vertical",
                color: "#111",
              }}
              onFocus={(e) => (e.target.style.borderColor = BLUE)}
              onBlur={(e) => (e.target.style.borderColor = "#e8eaf6")}
            />

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 10 }}>
              <button
                onClick={() => handleSave(ext.question_id)}
                disabled={saving[ext.question_id]}
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  background: saving[ext.question_id] ? "#c7d2fe" : BLUE,
                  color: "#fff", border: "none", borderRadius: 7,
                  padding: "8px 18px", cursor: saving[ext.question_id] ? "not-allowed" : "pointer",
                  fontSize: 13, fontWeight: 600,
                }}
              >
                <Edit3 size={13} />
                {saving[ext.question_id] ? "Saving..." : "Save & re-evaluate"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
