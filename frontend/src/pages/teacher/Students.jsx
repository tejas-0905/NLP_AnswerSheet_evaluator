import { useEffect, useState } from "react";
import { getMyClassrooms } from "../../api/classroom";
import { getStudents, removeStudent } from "../../api/classroom";
import { UserX, Users } from "lucide-react";
import toast from "react-hot-toast";

const BLUE = "#4361ee";

export default function Students() {
  const [classrooms, setClassrooms]     = useState([]);
  const [selected, setSelected]         = useState("");
  const [students, setStudents]         = useState([]);
  const [loading, setLoading]           = useState(false);
  const [removingId, setRemovingId]     = useState(null);

  useEffect(() => {
    getMyClassrooms().then((r) => {
      setClassrooms(r.data);
      if (r.data.length > 0) setSelected(String(r.data[0].id));
    });
  }, []);

  useEffect(() => {
    if (!selected) return;
    setLoading(true);
    getStudents(selected)
      .then((r) => setStudents(r.data))
      .finally(() => setLoading(false));
  }, [selected]);

  const handleRemove = async (student) => {
    const confirmed = window.confirm(
      `Remove ${student.full_name} from this classroom?\n\nThis will permanently delete all their submissions and evaluation results for this classroom.`
    );
    if (!confirmed) return;

    setRemovingId(student.student_id);
    try {
      await removeStudent(selected, student.student_id);
      setStudents((prev) => prev.filter((s) => s.student_id !== student.student_id));
      toast.success(`${student.full_name} removed`);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Could not remove student");
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 24px", color: "#111" }}>
        Students
      </h1>

      {/* Classroom picker */}
      <div style={{ marginBottom: 24 }}>
        <label style={{ fontSize: 13, color: "#6b7280", display: "block", marginBottom: 6 }}>
          Classroom
        </label>
        <select
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          style={{
            padding: "9px 12px", border: "1.5px solid #e8eaf6",
            borderRadius: 8, fontSize: 14, background: "#fff",
            color: "#111", minWidth: 240,
          }}
        >
          {classrooms.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <p style={{ color: "#9ca3af", fontSize: 14 }}>Loading students...</p>
      ) : students.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 0", color: "#9ca3af" }}>
          <Users size={40} color="#d1d5db" style={{ marginBottom: 12 }} />
          <p style={{ fontSize: 15 }}>No students in this classroom yet.</p>
        </div>
      ) : (
        <div style={{
          background: "#fff", border: "1px solid #e8eaf6",
          borderRadius: 12, overflow: "hidden",
        }}>
          {/* Header */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 120px 80px 60px",
            padding: "11px 20px",
            background: "#f8f9ff",
            borderBottom: "1px solid #e8eaf6",
            fontSize: 12, fontWeight: 600,
            color: "#6b7280",
          }}>
            <span>Name</span>
            <span>Email</span>
            <span>Joined</span>
            <span>Submissions</span>
            <span></span>
          </div>

          {students.map((s, i) => (
            <div
              key={s.student_id}
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr 120px 80px 60px",
                padding: "13px 20px",
                alignItems: "center",
                borderBottom: i < students.length - 1 ? "1px solid #f3f4f6" : "none",
                fontSize: 14,
              }}
            >
              <span style={{ fontWeight: 600, color: "#111" }}>{s.full_name}</span>
              <span style={{ color: "#6b7280", fontSize: 13 }}>{s.email}</span>
              <span style={{ color: "#6b7280", fontSize: 12 }}>
                {new Date(s.joined_at).toLocaleDateString("en-IN", {
                  day: "numeric", month: "short", year: "numeric",
                })}
              </span>
              <span style={{ color: "#6b7280" }}>{s.submission_count}</span>
              <span>
                <button
                  onClick={() => handleRemove(s)}
                  disabled={removingId === s.student_id}
                  title="Remove student"
                  style={{
                    background: removingId === s.student_id ? "#f3f4f6" : "#fef2f2",
                    border: "1px solid",
                    borderColor: removingId === s.student_id ? "#e5e7eb" : "#fecaca",
                    borderRadius: 6, padding: "5px 8px",
                    cursor: removingId === s.student_id ? "not-allowed" : "pointer",
                    color: removingId === s.student_id ? "#9ca3af" : "#dc2626",
                    display: "flex", alignItems: "center", gap: 4,
                  }}
                >
                  <UserX size={14} />
                </button>
              </span>
            </div>
          ))}

          <div style={{ padding: "10px 20px", background: "#f8f9ff", fontSize: 12, color: "#9ca3af" }}>
            {students.length} student{students.length !== 1 ? "s" : ""} enrolled
          </div>
        </div>
      )}
    </div>
  );
}