import { useEffect, useState } from "react";
import { School, BookOpen, Users, BarChart2 } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { getMyClassrooms } from "../../api/classroom";
import StatCard from "../../components/StatCard";

export default function TeacherDashboard() {
  const { user } = useAuth();
  const [classrooms, setClassrooms] = useState([]);

  useEffect(() => {
    getMyClassrooms().then((r) => setClassrooms(r.data)).catch(() => {});
  }, []);

  const totalStudents = classrooms.reduce((s, c) => s + c.student_count, 0);

  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 600, margin: "0 0 4px", color: "#111" }}>
        Welcome back, {user?.name?.split(" ")[0]} 👋
      </h1>
      <p style={{ color: "#6b7280", margin: "0 0 32px", fontSize: 14 }}>
        Here's what's happening across your classrooms.
      </p>

      {/* Stat cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16, marginBottom: 36 }}>
        <StatCard label="Classrooms"      value={classrooms.length} icon={School}   color="#2563eb" />
        <StatCard label="Total students"  value={totalStudents}     icon={Users}    color="#7c3aed" />
        <StatCard label="Active exams"    value="—"                 icon={BookOpen} color="#059669" />
        <StatCard label="Submissions"     value="—"                 icon={BarChart2}color="#d97706" />
      </div>

      {/* Recent classrooms */}
      <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: "20px 24px" }}>
        <p style={{ fontWeight: 600, fontSize: 15, margin: "0 0 16px", color: "#111" }}>
          Recent classrooms
        </p>
        {classrooms.length === 0 ? (
          <p style={{ color: "#9ca3af", fontSize: 14 }}>
            No classrooms yet. Create your first one.
          </p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #f3f4f6" }}>
                {["Name", "Code", "Students"].map((h) => (
                  <th key={h} style={{ textAlign: "left", padding: "8px 0", color: "#6b7280", fontWeight: 500 }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {classrooms.slice(0, 5).map((c) => (
                <tr key={c.id} style={{ borderBottom: "1px solid #f9fafb" }}>
                  <td style={{ padding: "10px 0", color: "#111", fontWeight: 500 }}>{c.name}</td>
                  <td style={{ padding: "10px 0" }}>
                    <span style={{ fontFamily: "monospace", background: "#eff6ff",
                      color: "#2563eb", padding: "2px 8px", borderRadius: 4, fontSize: 13 }}>
                      {c.code}
                    </span>
                  </td>
                  <td style={{ padding: "10px 0", color: "#6b7280" }}>{c.student_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}