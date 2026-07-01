import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { joinClassroom, getMyClassrooms } from "../../api/student";
import { Plus, School, ArrowRight, X, FileText } from "lucide-react";
import toast from "react-hot-toast";

const BLUE = "#0f2a5f";
const CARD_SHADOW = "0 10px 24px rgba(15, 23, 42, 0.04)";

export default function StudentClassrooms() {
  const navigate = useNavigate();
  const [classrooms, setClassrooms] = useState([]);
  const [code, setCode] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);

  const load = () => getMyClassrooms().then((r) => setClassrooms(r.data));
  useEffect(() => { load(); }, []);

  const handleJoin = async (e) => {
    e.preventDefault();
    if (!code.trim()) return;
    setLoading(true);
    try {
      const res = await joinClassroom({ code: code.toUpperCase() });
      toast.success(res.data.message);
      setCode(""); setShowForm(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Invalid code");
    } finally { setLoading(false); }
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, color: "#0f172a" }}>My classrooms</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            background: BLUE, color: "#fff", border: "none",
            borderRadius: 8, padding: "9px 16px",
            cursor: "pointer", fontSize: 14, fontWeight: 600,
          }}
        >
          <Plus size={15} /> Join classroom
        </button>
      </div>

      {/* Join form */}
      {showForm && (
        <div style={{
          background: "#fff", border: "1px solid #dfe6f3",
          borderRadius: 8, padding: "24px", marginBottom: 24,
          boxShadow: CARD_SHADOW,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
            <p style={{ fontWeight: 600, fontSize: 15, margin: 0, color: "#0f172a" }}>
              Enter classroom code
            </p>
            <button onClick={() => setShowForm(false)} style={{ background: "none", border: "none", cursor: "pointer" }}>
              <X size={16} color="#9ca3af" />
            </button>
          </div>
          <form onSubmit={handleJoin} style={{ display: "flex", gap: 10 }}>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="e.g. PHY2A7X"
              maxLength={8}
              required
              style={{
                flex: 1, padding: "10px 14px",
                border: "1.5px solid #dfe6f3",
                borderRadius: 8, fontSize: 16,
                fontFamily: "monospace", letterSpacing: 4,
                fontWeight: 700, color: BLUE, outline: "none",
                textTransform: "uppercase",
              }}
            />
            <button type="submit" disabled={loading} style={{
              background: BLUE, color: "#fff", border: "none",
              borderRadius: 8, padding: "10px 24px",
              cursor: "pointer", fontSize: 14, fontWeight: 600,
            }}>
              {loading ? "Joining..." : "Join"}
            </button>
          </form>
        </div>
      )}

      {/* Classroom cards */}
      {classrooms.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 0", color: "#9ca3af" }}>
          <School size={40} color="#d1d5db" style={{ marginBottom: 12 }} />
          <p style={{ fontSize: 15 }}>No classrooms yet.</p>
          <p style={{ fontSize: 13 }}>Ask your teacher for a classroom code.</p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: 16 }}>
          {classrooms.map((c) => (
            <div key={c.id} style={{
              background: "#fff", border: "1px solid #dfe6f3",
              borderRadius: 8, padding: "20px 22px",
              cursor: "pointer",
              boxShadow: CARD_SHADOW,
            }}
              onClick={() => navigate("/student/exams", { state: { classroomId: c.id, classroomName: c.name } })}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 10,
                  background: "#e8eefc", display: "flex",
                  alignItems: "center", justifyContent: "center",
                }}>
                  <School size={18} color={BLUE} />
                </div>
                <span style={{
                  fontSize: 11, fontWeight: 600,
                  background: c.active_exams > 0 ? "#dcfce7" : "#f3f4f6",
                  color: c.active_exams > 0 ? "#16a34a" : "#64748b",
                  padding: "3px 10px", borderRadius: 20,
                }}>
                  {c.active_exams} active exam{c.active_exams !== 1 ? "s" : ""}
                </span>
              </div>
              <p style={{ fontWeight: 700, fontSize: 15, margin: "0 0 4px", color: "#0f172a" }}>{c.name}</p>
              <p style={{ fontSize: 12, color: "#64748b", margin: "0 0 14px" }}>
                Teacher: {c.teacher_name}
              </p>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                <span style={{
                  fontFamily: "monospace", fontSize: 13,
                  fontWeight: 700, color: BLUE, letterSpacing: 2,
                  background: "#e8eefc", padding: "3px 10px", borderRadius: 6,
                }}>
                  {c.code}
                </span>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      navigate("/student/notes", { state: { classroomId: c.id, classroomName: c.name } });
                    }}
                    title="View notes"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 5,
                      background: "#f8fafc",
                      color: BLUE,
                      border: "1px solid #dfe6f3",
                      borderRadius: 7,
                      padding: "6px 9px",
                      cursor: "pointer",
                      fontSize: 12,
                      fontWeight: 700,
                    }}
                  >
                    <FileText size={13} /> Notes
                  </button>
                  <ArrowRight size={16} color="#9ca3af" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

