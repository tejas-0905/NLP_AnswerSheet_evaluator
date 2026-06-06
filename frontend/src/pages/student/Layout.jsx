import { Outlet, NavLink } from "react-router-dom";
import { useAuth } from "../../context/useAuth";
import {
  LayoutDashboard, School, BookOpen,
  LogOut,
} from "lucide-react";

const BLUE = "#4361ee";

const links = [
  { to: "/student",            icon: LayoutDashboard, label: "Dashboard", end: true },
  { to: "/student/classrooms", icon: School,          label: "Classrooms" },
  { to: "/student/exams",      icon: BookOpen,        label: "My Exams"   },
];

export default function StudentLayout() {
  const { user, logout } = useAuth();
  return (
    <div className="student-shell" style={{ display: "flex", minHeight: "100vh", background: "#f0f2ff" }}>

      {/* Sidebar */}
      <aside className="student-sidebar" style={{
        width: 220, background: "#fff",
        borderRight: "1px solid #e8eaf6",
        display: "flex", flexDirection: "column",
        padding: "24px 0", flexShrink: 0,
      }}>
        <div style={{ padding: "0 20px 28px" }}>
          <p style={{ fontWeight: 700, fontSize: 16, margin: 0, color: BLUE }}>
            EduEvaluator
          </p>
          <p style={{ fontSize: 12, color: "#9ca3af", margin: "2px 0 0" }}>
            Student portal
          </p>
        </div>

        <nav style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2, padding: "0 12px" }}>
          {links.map(({ to, icon: Icon, label, end }) => (
            <NavLink
              key={to} to={to} end={end}
              style={({ isActive }) => ({
                display: "flex", alignItems: "center", gap: 10,
                padding: "9px 12px", borderRadius: 8,
                textDecoration: "none", fontSize: 14,
                fontWeight: isActive ? 600 : 400,
                color: isActive ? BLUE : "#374151",
                background: isActive ? "#eef0fd" : "transparent",
              })}
            >
              <Icon size={17} /> {label}
            </NavLink>
          ))}
        </nav>

        <div style={{ padding: "16px 20px 0", borderTop: "1px solid #f3f4f6" }}>
          <p style={{ fontSize: 13, fontWeight: 600, margin: "0 0 2px", color: "#111" }}>
            {user?.name}
          </p>
          <p style={{ fontSize: 12, color: "#9ca3af", margin: "0 0 12px" }}>Student</p>
          <button onClick={logout} style={{
            display: "flex", alignItems: "center", gap: 6,
            background: "none", border: "none", cursor: "pointer",
            fontSize: 13, color: "#6b7280", padding: 0,
          }}>
            <LogOut size={14} /> Sign out
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="student-main" style={{ flex: 1, padding: "32px 36px", overflowY: "auto", minWidth: 0 }}>
        <Outlet />
      </main>
    </div>
  );
}
