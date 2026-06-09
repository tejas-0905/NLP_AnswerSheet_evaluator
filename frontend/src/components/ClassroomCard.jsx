import { useState } from "react";
import { BookOpen, Check, Copy, MoreVertical, School, Users } from "lucide-react";

export default function ClassroomCard({ classroom, onDelete, onOpen }) {
  const [copied, setCopied] = useState(false);

  const copyCode = (event) => {
    event.stopPropagation();
    navigator.clipboard.writeText(classroom.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      onClick={() => onOpen?.(classroom)}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") onOpen?.(classroom);
      }}
      style={{
      background: "#fff",
      border: "1px solid #dfe6f3",
      borderRadius: 8,
      padding: "18px 20px",
      cursor: onOpen ? "pointer" : "default",
      transition: "border-color 0.15s ease, box-shadow 0.15s ease, transform 0.15s ease",
      boxShadow: "0 10px 24px rgba(15, 23, 42, 0.04)",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
        <div style={{
          width: 38,
          height: 38,
          borderRadius: 8,
          background: "#eef6ff",
          color: "#2563eb",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}>
          <School size={19} />
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{
            background: "#ecfdf5",
            color: "#047857",
            borderRadius: 999,
            padding: "4px 10px",
            fontSize: 11,
            fontWeight: 800,
          }}>
            Active
          </span>
          <button
            onClick={(event) => {
              event.stopPropagation();
              onDelete(classroom.id);
            }}
            title="Delete classroom"
            style={{
              width: 34,
              height: 34,
              borderRadius: 8,
              border: "1px solid #dfe6f3",
              background: "#fff",
              cursor: "pointer",
              color: "#94a3b8",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <MoreVertical size={16} />
          </button>
        </div>
      </div>

      <div>
        <div>
          <p style={{ fontWeight: 800, fontSize: 16, margin: 0, color: "#0f172a" }}>
            {classroom.name}
          </p>
          <p style={{ color: "#64748b", fontSize: 12, margin: "4px 0 0" }}>
            Created {classroom.created_at ? new Date(classroom.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "recently"}
          </p>
        </div>
      </div>

      <div style={{
        marginTop: 16,
        background: "#f8fafc",
        borderRadius: 8,
        padding: "12px 14px",
        display: "flex",
        justifyContent: "space-between", alignItems: "center",
      }}>
        <div>
          <p style={{ fontSize: 11, color: "#64748b", margin: "0 0 3px", fontWeight: 800 }}>
            CLASSROOM CODE
          </p>
          <p style={{ fontFamily: "monospace", fontSize: 16, fontWeight: 800,
            letterSpacing: 4, color: "#2563eb", margin: 0 }}>
            {classroom.code}
          </p>
        </div>
        <button
          onClick={copyCode}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            background: copied ? "#f0fdf4" : "#eff6ff",
            border: `1px solid ${copied ? "#bbf7d0" : "#bfdbfe"}`,
            borderRadius: 8, padding: "8px 12px", cursor: "pointer",
            fontSize: 12, color: copied ? "#16a34a" : "#2563eb",
            fontWeight: 800,
          }}
        >
          {copied ? <><Check size={13} /> Copied</> : <><Copy size={13} /> Copy</>}
        </button>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 18, marginTop: 14, color: "#475569", fontSize: 13, fontWeight: 700 }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <Users size={14} /> {classroom.student_count || 0} students
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <BookOpen size={14} /> {classroom.exam_count ?? 0} exams
        </span>
      </div>
    </div>
  );
}
