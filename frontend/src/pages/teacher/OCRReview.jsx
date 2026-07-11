import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getOCRSubmission, getOCRSubmissionFile, correctExtraction } from "../../api/ocr";
import { AlertTriangle, CheckCircle, Edit3, ExternalLink, FileText } from "lucide-react";
import toast from "react-hot-toast";

const BLUE = "#0f2a5f";
const CARD_SHADOW = "0 10px 24px rgba(15, 23, 42, 0.04)";

const confColor = (value) => {
  if (value >= 75) return "#16a34a";
  if (value >= 55) return "#d97706";
  return "#dc2626";
};

const confBg = (value) => {
  if (value >= 75) return "#dcfce7";
  if (value >= 55) return "#fef9c3";
  return "#fee2e2";
};

export default function OCRReview() {
  const { ocrSubmissionId } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [edits, setEdits] = useState({});
  const [saving, setSaving] = useState({});
  const [openingFile, setOpeningFile] = useState(false);

  useEffect(() => {
    getOCRSubmission(ocrSubmissionId).then((response) => {
      setData(response.data);
      const initial = {};
      response.data.extractions.forEach((item) => {
        initial[item.question_id] = item.extracted_text || "";
      });
      setEdits(initial);
    });
  }, [ocrSubmissionId]);

  const handleSave = async (questionId) => {
    setSaving((current) => ({ ...current, [questionId]: true }));
    try {
      await correctExtraction(ocrSubmissionId, {
        question_id: questionId,
        corrected_text: edits[questionId],
      });
      toast.success("Corrected and re-evaluated");
      setData((previous) => ({
        ...previous,
        extractions: previous.extractions.map((item) =>
          item.question_id === questionId
            ? { ...item, extracted_text: edits[questionId], is_corrected: true }
            : item
        ),
      }));
    } catch {
      toast.error("Could not save correction");
    } finally {
      setSaving((current) => ({ ...current, [questionId]: false }));
    }
  };

  const openUploadedSheet = async () => {
    setOpeningFile(true);
    try {
      const response = await getOCRSubmissionFile(ocrSubmissionId);
      const fileUrl = URL.createObjectURL(response.data);
      window.open(fileUrl, "_blank", "noopener,noreferrer");
      window.setTimeout(() => URL.revokeObjectURL(fileUrl), 60000);
    } catch (error) {
      toast.error(error.response?.data?.detail || "Could not open uploaded sheet");
    } finally {
      setOpeningFile(false);
    }
  };

  if (!data) return <p style={{ color: "#64748b", fontSize: 13 }}>Loading OCR review...</p>;

  return (
    <div style={{ width: "100%" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 24 }}>
        <button
          onClick={() => navigate(-1)}
          style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b", fontSize: 14, padding: 0 }}
        >
          Back
        </button>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0, color: "#0f172a" }}>
            OCR review panel
          </h1>
          <p style={{ color: "#64748b", fontSize: 13, margin: "3px 0 0" }}>
            {data.student_name} - {data.exam_title}
          </p>
        </div>
        {data.has_uploaded_file && (
          <button
            type="button"
            onClick={openUploadedSheet}
            disabled={openingFile}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 7,
              background: openingFile ? "#c7d2fe" : BLUE,
              color: "#fff",
              border: "none",
              borderRadius: 8,
              padding: "9px 14px",
              cursor: openingFile ? "not-allowed" : "pointer",
              fontSize: 13,
              fontWeight: 800,
            }}
          >
            <ExternalLink size={14} />
            {openingFile ? "Opening..." : "View uploaded sheet"}
          </button>
        )}
      </div>

      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
        gap: 12,
        marginBottom: 24,
      }}>
        {[
          { label: "Overall confidence", value: `${Number(data.confidence_score || 0).toFixed(1)}%` },
          { label: "Questions extracted", value: data.extractions.length },
          { label: "Original file", value: data.original_filename || "-", icon: FileText },
        ].map((item) => (
          <div key={item.label} style={{
            background: "#fff",
            border: "1px solid #dfe6f3",
            borderRadius: 8,
            padding: "14px 16px",
            boxShadow: CARD_SHADOW,
          }}>
            <p style={{ fontSize: 12, color: "#64748b", margin: "0 0 4px" }}>{item.label}</p>
            <p style={{ fontSize: 16, fontWeight: 800, margin: 0, color: "#0f172a" }}>{item.value}</p>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {data.extractions.map((item, index) => (
          <div key={item.question_id} style={{
            background: "#fff",
            border: "1px solid #dfe6f3",
            borderRadius: 8,
            padding: "20px 22px",
            boxShadow: CARD_SHADOW,
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{
                  width: 26,
                  height: 26,
                  borderRadius: 6,
                  background: "#e8eefc",
                  color: BLUE,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 12,
                  fontWeight: 800,
                }}>
                  {index + 1}
                </span>
                <span style={{ fontWeight: 800, fontSize: 14, color: "#0f172a" }}>
                  Question {index + 1}
                </span>
                {item.is_corrected && (
                  <span style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                    fontSize: 11,
                    color: "#16a34a",
                    background: "#dcfce7",
                    padding: "2px 8px",
                    borderRadius: 20,
                    fontWeight: 800,
                  }}>
                    <CheckCircle size={11} /> Corrected
                  </span>
                )}
              </div>
              <span style={{
                fontSize: 12,
                fontWeight: 800,
                background: confBg(item.confidence),
                color: confColor(item.confidence),
                padding: "3px 10px",
                borderRadius: 20,
              }}>
                {Number(item.confidence || 0).toFixed(1)}% confidence
              </span>
            </div>

            {item.confidence < 55 && (
              <div style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                background: "#fef2f2",
                border: "1px solid #fecaca",
                borderRadius: 8,
                padding: "8px 12px",
                marginBottom: 12,
                fontSize: 12,
                color: "#dc2626",
              }}>
                <AlertTriangle size={13} />
                Low confidence - please verify and correct if needed
              </div>
            )}

            {item.question_text && (
              <div style={{
                background: "#f8fafc",
                border: "1px solid #dfe6f3",
                borderRadius: 8,
                padding: "10px 12px",
                marginBottom: 12,
              }}>
                <p style={{ fontSize: 11, fontWeight: 900, color: "#94a3b8", margin: "0 0 4px" }}>QUESTION</p>
                <p style={{ fontSize: 13, color: "#334155", lineHeight: 1.5, margin: 0 }}>{item.question_text}</p>
              </div>
            )}

            <label style={{ fontSize: 12, fontWeight: 800, color: "#64748b", display: "block", marginBottom: 6 }}>
              EXTRACTED TEXT
            </label>
            <textarea
              value={edits[item.question_id] || ""}
              onChange={(event) => setEdits({ ...edits, [item.question_id]: event.target.value })}
              rows={4}
              style={{
                width: "100%",
                padding: "10px 12px",
                border: "1.5px solid #dfe6f3",
                borderRadius: 8,
                fontSize: 14,
                lineHeight: 1.6,
                boxSizing: "border-box",
                outline: "none",
                fontFamily: "inherit",
                resize: "vertical",
                color: "#0f172a",
              }}
              onFocus={(event) => (event.target.style.borderColor = BLUE)}
              onBlur={(event) => (event.target.style.borderColor = "#dfe6f3")}
            />

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 10 }}>
              <button
                onClick={() => handleSave(item.question_id)}
                disabled={saving[item.question_id]}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  background: saving[item.question_id] ? "#c7d2fe" : BLUE,
                  color: "#fff",
                  border: "none",
                  borderRadius: 8,
                  padding: "8px 18px",
                  cursor: saving[item.question_id] ? "not-allowed" : "pointer",
                  fontSize: 13,
                  fontWeight: 800,
                }}
              >
                <Edit3 size={13} />
                {saving[item.question_id] ? "Saving..." : "Save and re-evaluate"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
