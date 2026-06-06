import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/useAuth";
import { getMyClassrooms } from "../../api/student";
import { School, BookOpen, Trophy, ArrowRight } from "lucide-react";

const BLUE = "#4361ee";

export default function StudentDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [classrooms, setClassrooms] = useState([]);

  useEffect(() => {
    getMyClassrooms().then((r) => setClassrooms(r.data)).catch(() => {});
  }, []);

  const totalExams = classrooms.reduce((s, c) => s + c.active_exams, 0);

  const stats = [
    { label: "Classrooms joined", value: classrooms.length, icon: School,   color: BLUE      },
    { label: "Active exams",      value: totalExams,         icon: BookOpen, color: "#059669" },
    { label: "Rank",              value: "—",               icon: Trophy,   color: "#d97706" },
  ];

  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 4px", color: "#111" }}>
        Hey, {user?.name?.split(" ")[0]} 👋
      </h1>
      <p style={{ color: "#6b7280", margin: "0 0 28px", fontSize: 14 }}>
        Here's your learning overview.
      </p>

      {/* Stat cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 14, marginBottom: 32 }}>
        {stats.map((s) => (
          <div key={s.label} style={{
            background: "#fff", border: "1px solid #e8eaf6",
            borderRadius: 12, padding: "18px 20px",
            display: "flex", alignItems: "center", gap: 14,
          }}>
            <div style={{
              width: 42, height: 42, borderRadius: 10,
              background: s.color + "18",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <s.icon size={19} color={s.color} />
            </div>
            <div>
              <p style={{ fontSize: 12, color: "#6b7280", margin: 0 }}>{s.label}</p>
              <p style={{ fontSize: 22, fontWeight: 700, margin: "2px 0 0", color: "#111" }}>{s.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Classrooms quick view */}
      <div style={{
        background: "#fff", border: "1px solid #e8eaf6",
        borderRadius: 12, padding: "20px 24px",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <p style={{ fontWeight: 600, fontSize: 15, margin: 0, color: "#111" }}>My classrooms</p>
          <button
            onClick={() => navigate("/student/classrooms")}
            style={{ background: "none", border: "none", cursor: "pointer", color: BLUE, fontSize: 13 }}
          >
            View all
          </button>
        </div>

        {classrooms.length === 0 ? (
          <div style={{ textAlign: "center", padding: "30px 0" }}>
            <p style={{ color: "#9ca3af", fontSize: 14, margin: "0 0 12px" }}>
              You haven't joined any classrooms yet.
            </p>
            <button
              onClick={() => navigate("/student/classrooms")}
              style={{
                background: BLUE, color: "#fff", border: "none",
                borderRadius: 8, padding: "9px 20px",
                cursor: "pointer", fontSize: 13, fontWeight: 600,
              }}
            >
              Join a classroom
            </button>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {classrooms.slice(0, 4).map((c) => (
              <div
                key={c.id}
                onClick={() => navigate("/student/exams", { state: { classroomId: c.id } })}
                style={{
                  display: "flex", justifyContent: "space-between",
                  alignItems: "center", padding: "12px 14px",
                  background: "#f8f9ff", borderRadius: 8,
                  cursor: "pointer", border: "1px solid #e8eaf6",
                }}
              >
                <div>
                  <p style={{ fontWeight: 600, fontSize: 14, margin: 0, color: "#111" }}>{c.name}</p>
                  <p style={{ fontSize: 12, color: "#6b7280", margin: "2px 0 0" }}>
                    {c.teacher_name} · {c.active_exams} active exam{c.active_exams !== 1 ? "s" : ""}
                  </p>
                </div>
                <ArrowRight size={16} color="#9ca3af" />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
