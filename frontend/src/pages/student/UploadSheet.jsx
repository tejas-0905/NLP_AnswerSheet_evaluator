import { useState, useRef } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { uploadAnswerSheet } from "../../api/ocr";
import { Upload, FileImage, AlertTriangle, CheckCircle, X } from "lucide-react";
import toast from "react-hot-toast";

const BLUE = "#4361ee";

export default function UploadSheet() {
  const { examId }   = useParams();
  const { state }    = useLocation();
  const navigate     = useNavigate();
  const fileRef      = useRef();

  const [file, setFile]           = useState(null);
  const [preview, setPreview]     = useState(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress]   = useState(0);
  const [result, setResult]       = useState(null);
  const [dragOver, setDragOver]   = useState(false);

  const handleFile = (f) => {
    if (!f) return;
    const allowed = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
    if (!allowed.includes(f.type)) {
      toast.error("Only JPG, PNG, WEBP, or PDF allowed");
      return;
    }
    if (f.size > 20 * 1024 * 1024) {
      toast.error("File too large. Max 20MB");
      return;
    }
    setFile(f);
    if (f.type !== "application/pdf") {
      const url = URL.createObjectURL(f);
      setPreview(url);
    } else {
      setPreview(null);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    handleFile(e.dataTransfer.files[0]);
  };

  const handleSubmit = async () => {
    if (!file) return;
    setUploading(true);
    setProgress(0);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await uploadAnswerSheet(examId, formData);
      setResult(res.data);
      toast.success("Answer sheet evaluated!");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Upload failed. Try again.");
    } finally {
      setUploading(false);
    }
  };

  if (result) {
    return (
      <div style={{ maxWidth: 600 }}>
        <div style={{
          background: "#fff", border: "1px solid #e8eaf6",
          borderRadius: 14, padding: "32px", textAlign: "center",
        }}>
          <div style={{
            width: 64, height: 64, borderRadius: "50%",
            background: result.needs_review ? "#fef9c3" : "#dcfce7", margin: "0 auto 16px",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            {result.needs_review ? (
              <AlertTriangle size={30} color="#ca8a04" />
            ) : (
              <CheckCircle size={30} color="#16a34a" />
            )}
          </div>
          <h2 style={{ fontSize: 20, fontWeight: 700, margin: "0 0 8px", color: "#111" }}>
            {result.needs_review ? "Submitted for review" : "Sheet processed!"}
          </h2>
          <p style={{ color: "#6b7280", fontSize: 14, margin: "0 0 24px" }}>
            {result.needs_review
              ? "Your teacher needs to verify the OCR text before marks are confirmed."
              : `${result.questions_extracted} questions extracted from ${result.pages_processed} page(s)`}
          </p>

          {/* Confidence score */}
          <div style={{
            background: "#f8f9ff", borderRadius: 10,
            padding: "16px 20px", marginBottom: 20, textAlign: "left",
          }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: "#374151", margin: "0 0 10px" }}>
              OCR confidence score
            </p>
            <div style={{ height: 8, background: "#e8eaf6", borderRadius: 4, marginBottom: 6 }}>
              <div style={{
                height: "100%", borderRadius: 4,
                width: `${result.overall_confidence}%`,
                background: result.overall_confidence >= 75 ? "#16a34a"
                  : result.overall_confidence >= 55 ? "#d97706" : "#dc2626",
                transition: "width 1s ease",
              }} />
            </div>
            <p style={{ fontSize: 13, color: "#6b7280", margin: 0 }}>
              {result.overall_confidence.toFixed(1)}% average confidence
            </p>
          </div>

          {result.needs_review && (
            <div style={{
              display: "flex", alignItems: "flex-start", gap: 10,
              background: "#fef9c3", border: "1px solid #fde68a",
              borderRadius: 8, padding: "12px 14px",
              marginBottom: 20, textAlign: "left",
            }}>
              <AlertTriangle size={16} color="#ca8a04" style={{ flexShrink: 0, marginTop: 1 }} />
              <p style={{ fontSize: 13, color: "#92400e", margin: 0 }}>
                {result.low_confidence_questions} question(s) had low OCR confidence.
                Your teacher may review and correct the extracted text before final marks are confirmed.
              </p>
            </div>
          )}

          <button
            onClick={() => navigate(result.needs_review ? "/student/exams" : `/student/results/${examId}`)}
            style={{
              background: BLUE, color: "#fff", border: "none",
              borderRadius: 8, padding: "11px 28px",
              cursor: "pointer", fontSize: 14, fontWeight: 600,
            }}
          >
            {result.needs_review ? "Back to exams" : "View my results"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 600 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 24 }}>
        <button
          onClick={() => navigate("/student/exams")}
          style={{ background: "none", border: "none", cursor: "pointer", color: "#6b7280", fontSize: 14, padding: 0 }}
        >
          ← Back
        </button>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0, color: "#111" }}>
            Upload answer sheet
          </h1>
          <p style={{ fontSize: 13, color: "#6b7280", margin: "2px 0 0" }}>
            {state?.exam?.title || `Exam ${examId}`}
          </p>
        </div>
      </div>

      {/* Instructions */}
      <div style={{
        background: "#eef0fd", border: "1px solid #c7d2fe",
        borderRadius: 10, padding: "14px 16px", marginBottom: 20,
        fontSize: 13, color: "#3730a3",
      }}>
        <p style={{ fontWeight: 600, margin: "0 0 6px" }}>Tips for best results</p>
        <p style={{ margin: "0 0 4px" }}>• Photograph in good lighting — avoid shadows on the paper</p>
        <p style={{ margin: "0 0 4px" }}>• Hold the camera directly above, not at an angle</p>
        <p style={{ margin: "0 0 4px" }}>• Make sure all questions are visible on the sheet</p>
        <p style={{ margin: 0 }}>• Each question should occupy roughly equal space on the page</p>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileRef.current?.click()}
        style={{
          border: `2px dashed ${dragOver ? BLUE : "#c7d2fe"}`,
          borderRadius: 12, padding: "40px 20px",
          textAlign: "center", cursor: "pointer",
          background: dragOver ? "#eef0fd" : "#f8f9ff",
          transition: "all 0.2s", marginBottom: 16,
        }}
      >
        <input
          ref={fileRef}
          type="file"
          accept=".jpg,.jpeg,.png,.webp,.pdf"
          onChange={(e) => handleFile(e.target.files[0])}
          style={{ display: "none" }}
        />
        {file ? (
          <div>
            <FileImage size={36} color={BLUE} style={{ marginBottom: 10 }} />
            <p style={{ fontWeight: 600, fontSize: 14, margin: "0 0 4px", color: "#111" }}>
              {file.name}
            </p>
            <p style={{ fontSize: 12, color: "#6b7280", margin: 0 }}>
              {(file.size / 1024 / 1024).toFixed(2)} MB · Click to change
            </p>
          </div>
        ) : (
          <div>
            <Upload size={36} color="#9ca3af" style={{ marginBottom: 12 }} />
            <p style={{ fontWeight: 600, fontSize: 15, margin: "0 0 4px", color: "#374151" }}>
              Drag & drop your answer sheet here
            </p>
            <p style={{ fontSize: 13, color: "#9ca3af", margin: 0 }}>
              or click to browse — JPG, PNG, PDF up to 20MB
            </p>
          </div>
        )}
      </div>

      {/* Image preview */}
      {preview && (
        <div style={{
          position: "relative", marginBottom: 16,
          border: "1px solid #e8eaf6", borderRadius: 10, overflow: "hidden",
        }}>
          <img
            src={preview} alt="Answer sheet preview"
            style={{ width: "100%", display: "block", maxHeight: 400, objectFit: "contain" }}
          />
          <button
            onClick={(e) => { e.stopPropagation(); setFile(null); setPreview(null); }}
            style={{
              position: "absolute", top: 8, right: 8,
              background: "rgba(0,0,0,0.5)", border: "none",
              borderRadius: "50%", width: 28, height: 28,
              cursor: "pointer", color: "#fff",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Upload progress */}
      {uploading && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#6b7280", marginBottom: 6 }}>
            <span>Processing answer sheet with OCR...</span>
          </div>
          <div style={{ height: 6, background: "#e8eaf6", borderRadius: 3, overflow: "hidden" }}>
            <div style={{
              height: "100%", background: BLUE,
              borderRadius: 3,
              animation: "indeterminate 1.5s infinite ease-in-out",
              width: "40%",
            }} />
          </div>
          <style>{`
            @keyframes indeterminate {
              0% { transform: translateX(-100%); }
              100% { transform: translateX(350%); }
            }
          `}</style>
          <p style={{ fontSize: 12, color: "#9ca3af", marginTop: 6 }}>
            This may take 20–60 seconds depending on page count
          </p>
        </div>
      )}

      <button
        onClick={handleSubmit}
        disabled={!file || uploading}
        style={{
          width: "100%", padding: "12px",
          background: !file || uploading ? "#c7d2fe" : BLUE,
          color: "#fff", border: "none", borderRadius: 8,
          cursor: !file || uploading ? "not-allowed" : "pointer",
          fontSize: 15, fontWeight: 700,
        }}
      >
        {uploading ? "Processing..." : "Submit answer sheet"}
      </button>
    </div>
  );
}
