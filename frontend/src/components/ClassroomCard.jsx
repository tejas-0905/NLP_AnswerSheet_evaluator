import { useState } from "react";
import { Copy, Check, Trash2, Users } from "lucide-react";

export default function ClassroomCard({ classroom, onDelete }) {
  const [copied, setCopied] = useState(false);

  const copyCode = () => {
    navigator.clipboard.writeText(classroom.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{
      background: "#fff", border: "1px solid #e5e7eb",
      borderRadius: 12, padding: "20px 24px",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <p style={{ fontWeight: 600, fontSize: 15, margin: 0, color: "#111" }}>
            {classroom.name}
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6 }}>
            <Users size={13} color="#9ca3af" />
            <span style={{ fontSize: 13, color: "#6b7280" }}>
              {classroom.student_count} student{classroom.student_count !== 1 ? "s" : ""}
            </span>
          </div>
        </div>
        <button
          onClick={() => onDelete(classroom.id)}
          style={{
            background: "none", border: "none", cursor: "pointer",
            color: "#d1d5db", padding: 4,
          }}
        >
          <Trash2 size={15} />
        </button>
      </div>

      {/* Classroom code */}
      <div style={{
        marginTop: 16, background: "#f9fafb", borderRadius: 8,
        padding: "10px 14px", display: "flex",
        justifyContent: "space-between", alignItems: "center",
      }}>
        <div>
          <p style={{ fontSize: 11, color: "#9ca3af", margin: "0 0 2px" }}>
            CLASSROOM CODE
          </p>
          <p style={{ fontFamily: "monospace", fontSize: 18, fontWeight: 700,
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
            borderRadius: 6, padding: "6px 12px", cursor: "pointer",
            fontSize: 12, color: copied ? "#16a34a" : "#2563eb",
          }}
        >
          {copied ? <><Check size={13} /> Copied</> : <><Copy size={13} /> Copy</>}
        </button>
      </div>
    </div>
  );
}