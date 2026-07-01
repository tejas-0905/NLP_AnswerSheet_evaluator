import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { Download, FileText } from "lucide-react";
import toast from "react-hot-toast";

import { getMyClassrooms } from "../../api/student";
import { downloadNote, getNotes } from "../../api/notes";

const BLUE = "#0f2a5f";
const CARD_SHADOW = "0 10px 24px rgba(15, 23, 42, 0.04)";

const getErrorMessage = (error, fallback) =>
  error.response?.data?.detail ||
  error.response?.data?.message ||
  error.message ||
  fallback;

const formatBytes = (bytes) => {
  if (!bytes) return "0 KB";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
};

export default function StudentNotes() {
  const { state } = useLocation();
  const [classrooms, setClassrooms] = useState([]);
  const [selected, setSelected] = useState(state?.classroomId || "");
  const [notes, setNotes] = useState([]);
  const [loadingClassrooms, setLoadingClassrooms] = useState(false);
  const [loadingNotes, setLoadingNotes] = useState(false);

  useEffect(() => {
    setLoadingClassrooms(true);
    getMyClassrooms()
      .then((response) => {
        setClassrooms(response.data);
        if (!selected && response.data.length > 0) {
          setSelected(String(response.data[0].id));
        }
      })
      .catch((error) => toast.error(getErrorMessage(error, "Could not load classrooms")))
      .finally(() => setLoadingClassrooms(false));
  }, [selected]);

  useEffect(() => {
    if (!selected) {
      setNotes([]);
      return;
    }
    setLoadingNotes(true);
    getNotes(selected)
      .then((response) => setNotes(response.data))
      .catch((error) => toast.error(getErrorMessage(error, "Could not load notes")))
      .finally(() => setLoadingNotes(false));
  }, [selected]);

  const handleDownload = async (note) => {
    try {
      const response = await downloadNote(note.id);
      const url = URL.createObjectURL(response.data);
      const link = document.createElement("a");
      link.href = url;
      link.download = note.original_filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      toast.error(getErrorMessage(error, "Could not download note"));
    }
  };

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 4px", color: "#0f172a" }}>
          Notes
        </h1>
        <p style={{ color: "#64748b", fontSize: 13, margin: 0 }}>
          View study material shared by your teachers
        </p>
      </div>

      {loadingClassrooms ? (
        <p style={{ color: "#9ca3af" }}>Loading classrooms...</p>
      ) : classrooms.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 0", color: "#9ca3af" }}>
          <FileText size={40} color="#d1d5db" style={{ marginBottom: 12 }} />
          <p style={{ fontSize: 15 }}>Join a classroom to view notes.</p>
        </div>
      ) : (
        <>
          <div style={{ marginBottom: 24 }}>
            <label style={{ fontSize: 13, color: "#64748b", display: "block", marginBottom: 6 }}>
              Classroom
            </label>
            <select
              value={selected}
              onChange={(event) => setSelected(event.target.value)}
              style={{
                padding: "9px 12px",
                border: "1.5px solid #dfe6f3",
                borderRadius: 8,
                fontSize: 14,
                minWidth: 240,
                background: "#fff",
                color: "#0f172a",
              }}
            >
              {classrooms.map((classroom) => (
                <option key={classroom.id} value={classroom.id}>
                  {classroom.name}
                </option>
              ))}
            </select>
          </div>

          {loadingNotes ? (
            <p style={{ color: "#9ca3af" }}>Loading notes...</p>
          ) : notes.length === 0 ? (
            <div style={{ textAlign: "center", padding: "60px 0", color: "#9ca3af" }}>
              <FileText size={40} color="#d1d5db" style={{ marginBottom: 12 }} />
              <p>No notes shared in this classroom yet.</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {notes.map((note) => (
                <div
                  key={note.id}
                  style={{
                    background: "#fff",
                    border: "1px solid #dfe6f3",
                    borderRadius: 8,
                    padding: "16px 18px",
                    display: "grid",
                    gridTemplateColumns: "minmax(0, 1fr) auto",
                    gap: 16,
                    alignItems: "center",
                    boxShadow: CARD_SHADOW,
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 5 }}>
                      <FileText size={17} color={BLUE} />
                      <p style={{ fontWeight: 800, fontSize: 15, margin: 0, color: "#0f172a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {note.title}
                      </p>
                    </div>
                    {note.description && (
                      <p style={{ color: "#64748b", fontSize: 13, margin: "0 0 7px" }}>
                        {note.description}
                      </p>
                    )}
                    <div style={{ display: "flex", gap: 14, flexWrap: "wrap", color: "#64748b", fontSize: 12 }}>
                      <span>{note.original_filename}</span>
                      <span>{formatBytes(note.file_size)}</span>
                      <span>
                        {new Date(note.created_at).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDownload(note)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      background: "#e8eefc",
                      color: BLUE,
                      border: "none",
                      borderRadius: 8,
                      padding: "9px 14px",
                      cursor: "pointer",
                      fontSize: 13,
                      fontWeight: 700,
                    }}
                  >
                    <Download size={14} /> Download
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
