import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { Download, FileText, Plus, Trash2, Upload } from "lucide-react";
import toast from "react-hot-toast";

import { getMyClassrooms } from "../../api/classroom";
import { deleteNote, downloadNote, getNotes, uploadNote } from "../../api/notes";
import ClassroomTabs from "../../components/ClassroomTabs";

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

export default function Notes() {
  const { classroomId } = useParams();
  const [classrooms, setClassrooms] = useState([]);
  const [selectedClass, setSelectedClass] = useState("");
  const [notes, setNotes] = useState([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  const selectedClassroom = useMemo(
    () => classrooms.find((c) => String(c.id) === String(selectedClass)),
    [classrooms, selectedClass]
  );

  useEffect(() => {
    getMyClassrooms()
      .then((response) => {
        setClassrooms(response.data);
        if (classroomId) {
          setSelectedClass(String(classroomId));
        } else if (response.data.length > 0) {
          setSelectedClass(String(response.data[0].id));
        }
      })
      .catch((error) => toast.error(getErrorMessage(error, "Could not load classrooms")));
  }, [classroomId]);

  const loadNotes = async (classId = selectedClass) => {
    if (!classId) return;
    setLoading(true);
    try {
      const response = await getNotes(classId);
      setNotes(response.data);
    } catch (error) {
      toast.error(getErrorMessage(error, "Could not load notes"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedClass) loadNotes(selectedClass);
  }, [selectedClass]);

  const handleUpload = async (event) => {
    event.preventDefault();
    if (!selectedClass || files.length === 0 || !title.trim()) return;

    const form = event.currentTarget;
    const uploadCount = files.length;
    const formData = new FormData();
    formData.append("classroom_id", selectedClass);
    formData.append("title", title.trim());
    formData.append("description", description.trim());
    files.forEach((selectedFile) => {
      formData.append("files", selectedFile);
    });

    setUploading(true);
    try {
      await uploadNote(formData);
      setTitle("");
      setDescription("");
      setFiles([]);
      form.reset();
      await loadNotes(selectedClass);
      toast.success(uploadCount === 1 ? "Note uploaded" : `${uploadCount} notes uploaded`);
    } catch (error) {
      toast.error(getErrorMessage(error, "Could not upload note"));
    } finally {
      setUploading(false);
    }
  };

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

  const handleDelete = async (note) => {
    if (!confirm(`Delete "${note.title}"?`)) return;
    try {
      await deleteNote(note.id);
      setNotes((prev) => prev.filter((item) => item.id !== note.id));
      toast.success("Note deleted");
    } catch (error) {
      toast.error(getErrorMessage(error, "Could not delete note"));
    }
  };

  return (
    <div style={{ maxWidth: 1120 }}>
      {classroomId ? (
        <ClassroomTabs
          classroomId={classroomId}
          classroomName={selectedClassroom?.name}
        />
      ) : (
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: "0 0 3px", color: "#0f172a" }}>
            Notes
          </h1>
          <p style={{ color: "#64748b", fontSize: 13, margin: 0 }}>
            Upload study material for your classrooms
          </p>
        </div>
      )}

      {!classroomId && (
        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 13, color: "#475569", display: "block", marginBottom: 6, fontWeight: 700 }}>
            Classroom
          </label>
          <select
            value={selectedClass}
            onChange={(event) => setSelectedClass(event.target.value)}
            style={{
              padding: "9px 12px",
              border: "1px solid #dfe6f3",
              borderRadius: 8,
              fontSize: 14,
              background: "#fff",
              color: "#0f172a",
              minWidth: 260,
            }}
          >
            {classrooms.map((classroom) => (
              <option key={classroom.id} value={classroom.id}>
                {classroom.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {classrooms.length === 0 ? (
        <div style={{ background: "#fff", border: "1px solid #dfe6f3", borderRadius: 8, padding: 32, color: "#64748b" }}>
          Create a classroom before uploading notes.
        </div>
      ) : (
        <>
          <form
            onSubmit={handleUpload}
            style={{
              background: "#fff",
              border: "1px solid #dfe6f3",
              borderRadius: 8,
              padding: 20,
              marginBottom: 22,
              display: "grid",
              gap: 14,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Upload size={18} color="#1e3a8a" />
              <p style={{ fontWeight: 800, color: "#0f172a", fontSize: 15 }}>Upload note</p>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "minmax(180px, 1fr) minmax(220px, 1.2fr)", gap: 12 }}>
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Title"
                required
                style={{ padding: "10px 12px", border: "1px solid #dfe6f3", borderRadius: 8, fontSize: 14 }}
              />
              <input
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Description"
                style={{ padding: "10px 12px", border: "1px solid #dfe6f3", borderRadius: 8, fontSize: 14 }}
              />
            </div>

            <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
              <input
                type="file"
                required
                multiple
                onChange={(event) => setFiles(Array.from(event.target.files || []))}
                accept=".pdf,.doc,.docx,.ppt,.pptx,.txt,.jpg,.jpeg,.png,.webp"
                style={{ fontSize: 14, color: "#475569" }}
              />
              {files.length > 0 && (
                <span style={{ color: "#64748b", fontSize: 13 }}>
                  {files.length} {files.length === 1 ? "file" : "files"} selected
                </span>
              )}
              <button
                type="submit"
                disabled={uploading || !selectedClass || files.length === 0}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  background: "#0f2a5f",
                  color: "#fff",
                  border: "1px solid #0f2a5f",
                  borderRadius: 8,
                  padding: "10px 16px",
                  cursor: uploading ? "not-allowed" : "pointer",
                  fontSize: 14,
                  fontWeight: 800,
                }}
              >
                <Plus size={15} /> {uploading ? "Uploading..." : "Upload"}
              </button>
            </div>
          </form>

          {loading ? (
            <p style={{ color: "#94a3b8", fontSize: 14 }}>Loading notes...</p>
          ) : notes.length === 0 ? (
            <div style={{ textAlign: "center", padding: "54px 0", color: "#9ca3af" }}>
              <FileText size={42} color="#cbd5e1" style={{ marginBottom: 12 }} />
              <p style={{ fontSize: 15 }}>No notes uploaded yet.</p>
            </div>
          ) : (
            <div style={{ background: "#fff", border: "1px solid #dfe6f3", borderRadius: 8, overflow: "hidden" }}>
              <div style={{
                display: "grid",
                gridTemplateColumns: "1.3fr 1fr 120px 130px 90px",
                padding: "11px 18px",
                background: "#f8fafc",
                borderBottom: "1px solid #e8edf7",
                fontSize: 12,
                fontWeight: 800,
                color: "#64748b",
              }}>
                <span>Title</span>
                <span>File</span>
                <span>Size</span>
                <span>Uploaded</span>
                <span></span>
              </div>

              {notes.map((note, index) => (
                <div
                  key={note.id}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1.3fr 1fr 120px 130px 90px",
                    padding: "13px 18px",
                    alignItems: "center",
                    borderBottom: index < notes.length - 1 ? "1px solid #f1f5f9" : "none",
                    fontSize: 14,
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontWeight: 800, color: "#0f172a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {note.title}
                    </p>
                    {note.description && (
                      <p style={{ color: "#64748b", fontSize: 12, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {note.description}
                      </p>
                    )}
                  </div>
                  <span style={{ color: "#475569", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {note.original_filename}
                  </span>
                  <span style={{ color: "#64748b" }}>{formatBytes(note.file_size)}</span>
                  <span style={{ color: "#64748b", fontSize: 12 }}>
                    {new Date(note.created_at).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </span>
                  <span style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                    <button
                      type="button"
                      onClick={() => handleDownload(note)}
                      title="Download note"
                      style={{ border: "1px solid #bfdbfe", background: "#eff6ff", color: "#1d4ed8", borderRadius: 6, padding: 7, cursor: "pointer" }}
                    >
                      <Download size={15} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(note)}
                      title="Delete note"
                      style={{ border: "1px solid #fecaca", background: "#fef2f2", color: "#dc2626", borderRadius: 6, padding: 7, cursor: "pointer" }}
                    >
                      <Trash2 size={15} />
                    </button>
                  </span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
