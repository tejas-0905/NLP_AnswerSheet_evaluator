import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, Plus, X } from "lucide-react";
import { getMyClassrooms, createClassroom, deleteClassroom } from "../../api/classroom";
import ClassroomCard from "../../components/ClassroomCard";
import toast from "react-hot-toast";

const getErrorMessage = (error, fallback) =>
  error.response?.data?.detail ||
  error.response?.data?.message ||
  error.message ||
  fallback;

export default function Classrooms() {
  const navigate = useNavigate();
  const [classrooms, setClassrooms] = useState([]);
  const [name, setName] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingList, setLoadingList] = useState(true);
  const [error, setError] = useState("");

  const load = async () => {
    setError("");
    setLoadingList(true);
    try {
      const response = await getMyClassrooms();
      setClassrooms(response.data);
    } catch (error) {
      const message = getErrorMessage(error, "Could not load classrooms");
      setError(message);
      toast.error(message);
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    let isMounted = true;

    getMyClassrooms()
      .then((response) => {
        if (isMounted) setClassrooms(response.data);
      })
      .catch((error) => {
        if (!isMounted) return;
        const message = getErrorMessage(error, "Could not load classrooms");
        setError(message);
        toast.error(message);
      })
      .finally(() => {
        if (isMounted) setLoadingList(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    const classroomName = name.trim();
    if (!classroomName) return;

    setLoading(true);
    setError("");
    try {
      await createClassroom({ name: classroomName });
      setName("");
      setShowForm(false);
      await load();
      toast.success("Classroom created!");
    } catch (error) {
      const message = getErrorMessage(error, "Failed to create classroom");
      setError(message);
      console.error("Create classroom failed:", error);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("Delete this classroom?")) return;
    try {
      await deleteClassroom(id);
      await load();
      toast.success("Classroom deleted");
    } catch (error) {
      toast.error(getErrorMessage(error, "Could not delete classroom"));
    }
  };

  return (
    <div style={{ width:"100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: "0 0 3px", color: "#0f172a" }}>Classrooms</h1>
          <p style={{ color: "#64748b", fontSize: 13, margin: 0 }}>Manage your classrooms and share codes with students</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            background: "#0f2a5f", color: "#fff", border: "1px solid #0f2a5f",
            borderRadius: 8, padding: "10px 16px", cursor: "pointer", fontSize: 14, fontWeight: 800,
            boxShadow: "0 8px 18px rgba(15, 42, 95, 0.18)",
          }}
        >
          <Plus size={15} /> New classroom
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} style={{
          background: "#fff", border: "1px solid #dfe6f3",
          borderRadius: 8, padding: "20px 24px", marginBottom: 24,
          boxShadow: "0 10px 24px rgba(15, 23, 42, 0.04)",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 14 }}>
            <p style={{ fontWeight: 800, fontSize: 15, margin: 0, color: "#0f172a" }}>
              Create new classroom
            </p>
            <p style={{ color: "#64748b", fontSize: 12, margin: 0 }}>A unique code is auto-generated</p>
          </div>
          <label style={{ display: "block", color: "#475569", fontSize: 12, fontWeight: 800, marginBottom: 6 }}>
            Classroom name
          </label>
          <div style={{ display: "flex", gap: 12 }}>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Biology 10th B"
              required
              style={{
                flex: 1, padding: "10px 12px", border: "1px solid #dfe6f3",
                borderRadius: 8, fontSize: 14, outline: "none",
              }}
            />
            <button
              type="submit"
              disabled={loading}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                background: "#0f2a5f", color: "#fff", border: "1px solid #0f2a5f",
                borderRadius: 8, padding: "10px 18px", cursor: "pointer", fontSize: 14, fontWeight: 800,
              }}
            >
              <Check size={15} /> {loading ? "Creating..." : "Create"}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                background: "#fff", color: "#475569", border: "1px solid #dfe6f3",
                borderRadius: 8, padding: "10px 16px", cursor: "pointer", fontSize: 14, fontWeight: 800,
              }}
            >
              <X size={15} /> Cancel
            </button>
          </div>
        </form>
      )}

      {error && (
        <div style={{
          background: "#fef2f2", border: "1px solid #fecaca",
          borderRadius: 8, color: "#991b1b", padding: "10px 12px",
          marginBottom: 16, fontSize: 14,
        }}>
          {error}
        </div>
      )}

      {loadingList ? (
        <div style={{ textAlign: "center", padding: "60px 0", color: "#9ca3af" }}>
          <p style={{ fontSize: 15 }}>Loading classrooms...</p>
        </div>
      ) : classrooms.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 0", color: "#9ca3af" }}>
          <p style={{ fontSize: 15 }}>No classrooms yet.</p>
          <p style={{ fontSize: 13 }}>Click "New classroom" to create one.</p>
        </div>
      ) : (
        <div>
          <p style={{ color: "#64748b", fontSize: 12, fontWeight: 800, margin: "0 0 12px" }}>
            YOUR CLASSROOMS - {classrooms.length} TOTAL
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(270px, 1fr))", gap: 16 }}>
          {classrooms.map((c) => (
            <ClassroomCard
              key={c.id}
              classroom={c}
              onDelete={handleDelete}
              onOpen={(classroom) => navigate(`/teacher/classrooms/${classroom.id}/exams`)}
            />
          ))}
            <button
              onClick={() => setShowForm(true)}
              style={{
                minHeight: 220,
                border: "1px dashed #cbd5e1",
                background: "#fff",
                color: "#475569",
                borderRadius: 8,
                cursor: "pointer",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                fontWeight: 800,
              }}
            >
              <Plus size={20} />
              New classroom
              <span style={{ fontWeight: 500, color: "#64748b", fontSize: 12 }}>Click to create</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
