import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  BarChart2, Bell, BookOpen, ClipboardCheck, Plus, School,
  Settings, Trophy, Users
} from "lucide-react";
import { useAuth } from "../../context/useAuth";
import { getMyClassrooms } from "../../api/classroom";

const formatToday = () => new Date().toLocaleDateString("en-IN", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});

const relativeDate = (value) => {
  if (!value) return "Recently";
  const diffMs = Date.now() - new Date(value).getTime();
  const days = Math.max(0, Math.floor(diffMs / 86400000));
  if (days === 0) return "Today";
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
};

function StatTile({ label, value, icon: Icon, color, badge }) {
  return (
    <div style={{
      background: "#fff",
      border: "1px solid #dfe6f3",
      borderRadius: 8,
      padding: "16px 16px 14px",
      minHeight: 96,
      boxShadow: "0 10px 24px rgba(15, 23, 42, 0.04)",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18 }}>
        <div style={{
          width: 30,
          height: 30,
          borderRadius: 8,
          background: `${color}14`,
          color,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}>
          <Icon size={17} />
        </div>
        {badge && (
          <span style={{
            background: `${color}18`,
            color,
            borderRadius: 999,
            padding: "3px 9px",
            fontSize: 11,
            fontWeight: 800,
          }}>
            {badge}
          </span>
        )}
      </div>
      <p style={{ color: "#0f172a", fontSize: 26, fontWeight: 800, lineHeight: 1, margin: "0 0 6px" }}>
        {value}
      </p>
      <p style={{ color: "#64748b", fontSize: 12, fontWeight: 600, margin: 0 }}>
        {label}
      </p>
    </div>
  );
}

function QuickAction({ icon: Icon, title, subtitle, onClick, color }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: "#f8fbff",
        border: "1px solid #dfe6f3",
        borderRadius: 8,
        padding: 14,
        textAlign: "left",
        cursor: "pointer",
        minHeight: 72,
      }}
    >
      <Icon size={16} color={color} />
      <p style={{ margin: "8px 0 2px", color: "#0f172a", fontSize: 13, fontWeight: 800 }}>{title}</p>
      <p style={{ margin: 0, color: "#64748b", fontSize: 12 }}>{subtitle}</p>
    </button>
  );
}

export default function TeacherDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [classrooms, setClassrooms] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    getMyClassrooms()
      .then((r) => {
        if (mounted) setClassrooms(r.data);
      })
      .catch(() => {
        if (mounted) setClassrooms([]);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const totals = useMemo(() => {
    const students = classrooms.reduce((sum, c) => sum + Number(c.student_count || 0), 0);
    const exams = classrooms.reduce((sum, c) => sum + Number(c.active_exam_count ?? c.exam_count ?? 0), 0);
    const submissions = classrooms.reduce((sum, c) => sum + Number(c.submission_count || 0), 0);
    return { students, exams, submissions };
  }, [classrooms]);

  const recentActivity = useMemo(() => {
    const items = classrooms
      .slice()
      .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
      .slice(0, 3)
      .map((c) => ({
        title: `Classroom ${c.name} created`,
        meta: relativeDate(c.created_at),
        color: "#22c55e",
      }));

    if (totals.students > 0) {
      items.splice(1, 0, {
        title: `${totals.students} student${totals.students === 1 ? "" : "s"} joined`,
        meta: "Across your classrooms",
        color: "#6366f1",
      });
    }

    if (totals.exams === 0) {
      items.push({
        title: "No exams published yet",
        meta: "Create your first exam to get started",
        color: "#a5b4fc",
      });
    }

    return items.slice(0, 4);
  }, [classrooms, totals]);

  const firstName = user?.name?.split(" ")[0] || "Teacher";

  return (
    <div style={{ maxWidth: 1180 }}>
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 16,
        marginBottom: 24,
      }}>
        <div>
          <h1 style={{ color: "#0f172a", fontSize: 20, fontWeight: 800, margin: "0 0 4px" }}>
            Good morning, {firstName}
          </h1>
          <p style={{ color: "#64748b", fontSize: 13, margin: 0 }}>{formatToday()}</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button style={iconButtonStyle} aria-label="Notifications"><Bell size={16} /></button>
          <button style={iconButtonStyle} aria-label="Settings"><Settings size={16} /></button>
          <button
            onClick={() => navigate("/teacher/exams/create")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              background: "#0f2a5f",
              color: "#fff",
              border: "1px solid #0f2a5f",
              borderRadius: 8,
              padding: "10px 16px",
              cursor: "pointer",
              fontSize: 14,
              fontWeight: 800,
              boxShadow: "0 8px 18px rgba(15, 42, 95, 0.18)",
            }}
          >
            <Plus size={16} /> New exam
          </button>
        </div>
      </div>

      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(4, minmax(150px, 1fr))",
        gap: 14,
        marginBottom: 14,
      }}>
        <StatTile label="Classrooms" value={classrooms.length} icon={School} color="#2563eb" badge="+1 week" />
        <StatTile label="Students" value={totals.students} icon={Users} color="#4f46e5" badge={`${totals.students} active`} />
        <StatTile label="Exams" value={totals.exams} icon={BookOpen} color="#059669" badge={`${totals.exams} live`} />
        <StatTile label="Submissions" value={totals.submissions} icon={ClipboardCheck} color="#d97706" badge="awaiting" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.45fr) minmax(280px, 0.95fr)", gap: 14 }}>
        <div style={panelStyle}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
            <p style={{ color: "#0f172a", fontSize: 14, fontWeight: 800, margin: 0 }}>Classrooms</p>
            <button
              onClick={() => navigate("/teacher/classrooms")}
              style={{ border: 0, background: "transparent", color: "#2563eb", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
            >
              View all
            </button>
          </div>
          {loading ? (
            <p style={{ color: "#94a3b8", fontSize: 13 }}>Loading classrooms...</p>
          ) : classrooms.length === 0 ? (
            <div style={emptyBoxStyle}>
              <School size={18} />
              <p style={{ margin: "8px 0 2px", color: "#0f172a", fontWeight: 800 }}>No classrooms yet</p>
              <p style={{ margin: 0, color: "#64748b", fontSize: 12 }}>Create a classroom to share a code with students.</p>
            </div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #e8edf7" }}>
                  {["Name", "Code", "Students", "Exams"].map((h) => (
                    <th key={h} style={{ textAlign: "left", padding: "8px 0", color: "#94a3b8", fontSize: 11, fontWeight: 800 }}>
                      {h.toUpperCase()}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {classrooms.slice(0, 5).map((c) => (
                  <tr key={c.id} style={{ borderBottom: "1px solid #eef2f7" }}>
                    <td style={{ padding: "10px 0", color: "#0f172a", fontWeight: 800 }}>{c.name}</td>
                    <td style={{ padding: "10px 0" }}>
                      <span style={{
                        fontFamily: "ui-monospace, Consolas, monospace",
                        background: "#eef6ff",
                        color: "#2563eb",
                        padding: "3px 8px",
                        borderRadius: 5,
                        fontSize: 12,
                        letterSpacing: 1,
                      }}>{c.code}</span>
                    </td>
                    <td style={{ padding: "10px 0", color: "#475569", fontWeight: 600 }}>{c.student_count || 0}</td>
                    <td style={{ padding: "10px 0", color: "#475569", fontWeight: 600 }}>{c.exam_count ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* <div style={{ display: "grid", gridTemplateRows: "auto auto", gap: 14 }}>
          <div style={panelStyle}>
            <p style={{ color: "#0f172a", fontSize: 14, fontWeight: 800, margin: "0 0 14px" }}>Quick actions</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <QuickAction icon={Plus} title="Create exam" subtitle="Add questions" color="#2563eb" onClick={() => navigate("/teacher/exams/create")} />
              <QuickAction icon={School} title="Classrooms" subtitle="Manage codes" color="#059669" onClick={() => navigate("/teacher/classrooms")} />
              <QuickAction icon={BarChart2} title="Results" subtitle="Review marks" color="#d97706" onClick={() => navigate("/teacher/results")} />
              <QuickAction icon={Trophy} title="Leaderboard" subtitle="Rank students" color="#7c3aed" onClick={() => navigate("/teacher/leaderboard")} />
            </div>
          </div> */}

          <div style={panelStyle}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <p style={{ color: "#0f172a", fontSize: 14, fontWeight: 800, margin: 0 }}>Recent activity</p>
              <span style={{ color: "#2563eb", fontSize: 12, fontWeight: 700 }}>Clear</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {recentActivity.map((item, index) => (
                <div key={`${item.title}-${index}`} style={{ display: "grid", gridTemplateColumns: "10px 1fr", gap: 10 }}>
                  <span style={{ width: 8, height: 8, borderRadius: 999, background: item.color, marginTop: 5 }} />
                  <div style={{ borderBottom: index === recentActivity.length - 1 ? 0 : "1px solid #eef2f7", paddingBottom: 12 }}>
                    <p style={{ color: "#0f172a", fontSize: 13, fontWeight: 800, lineHeight: 1.2, margin: 0 }}>
                      {item.title}
                    </p>
                    <p style={{ color: "#64748b", fontSize: 12, margin: "3px 0 0" }}>{item.meta}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
  );
}

const iconButtonStyle = {
  width: 36,
  height: 36,
  borderRadius: 8,
  border: "1px solid #dfe6f3",
  background: "#fff",
  color: "#475569",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
};

const panelStyle = {
  background: "#fff",
  border: "1px solid #dfe6f3",
  borderRadius: 8,
  padding: "18px 20px",
  boxShadow: "0 10px 24px rgba(15, 23, 42, 0.04)",
};

const emptyBoxStyle = {
  border: "1px dashed #cbd5e1",
  borderRadius: 8,
  padding: 24,
  color: "#64748b",
  textAlign: "center",
};
