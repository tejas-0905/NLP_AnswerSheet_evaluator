import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { getMyClassrooms, createClassroom, deleteClassroom } from "../../api/classroom";
import ClassroomCard from "../../components/ClassroomCard";
import toast from "react-hot-toast";

const getErrorMessage = (error, fallback) =>
  error.response?.data?.detail ||
  error.response?.data?.message ||
  error.message ||
  fallback;

export default function Classrooms() {
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
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 600, margin: 0, color: "#111" }}>Classrooms</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            background: "#2563eb", color: "#fff", border: "none",
            borderRadius: 8, padding: "9px 16px", cursor: "pointer", fontSize: 14,
          }}
        >
          <Plus size={15} /> New classroom
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} style={{
          background: "#fff", border: "1px solid #e5e7eb",
          borderRadius: 12, padding: "20px 24px", marginBottom: 24,
        }}>
          <p style={{ fontWeight: 600, fontSize: 15, margin: "0 0 14px", color: "#111" }}>
            Create new classroom
          </p>
          <div style={{ display: "flex", gap: 12 }}>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Physics 2024 - Batch A"
              required
              style={{
                flex: 1, padding: "9px 12px", border: "1px solid #e5e7eb",
                borderRadius: 8, fontSize: 14, outline: "none",
              }}
            />
            <button
              type="submit"
              disabled={loading}
              style={{
                background: "#2563eb", color: "#fff", border: "none",
                borderRadius: 8, padding: "9px 20px", cursor: "pointer", fontSize: 14,
              }}
            >
              {loading ? "Creating..." : "Create"}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              style={{
                background: "#f3f4f6", color: "#374151", border: "none",
                borderRadius: 8, padding: "9px 16px", cursor: "pointer", fontSize: 14,
              }}
            >
              Cancel
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
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
          {classrooms.map((c) => (
            <ClassroomCard key={c.id} classroom={c} onDelete={handleDelete} />
          ))}
        </div>
      )}
    </div>
  );
}
