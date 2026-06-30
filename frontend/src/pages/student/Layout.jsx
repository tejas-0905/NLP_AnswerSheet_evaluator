import { Outlet, NavLink } from "react-router-dom";
import { useAuth } from "../../context/useAuth";
import {
  LayoutDashboard, School, BookOpen,
  LogOut,
} from "lucide-react";

const links = [
  { to: "/student",            icon: LayoutDashboard, label: "Dashboard", end: true },
  { to: "/student/classrooms", icon: School,          label: "Classrooms" },
  { to: "/student/exams",      icon: BookOpen,        label: "My Exams"   },
];

export default function StudentLayout() {
  const { user, logout } = useAuth();
  return (
    <div className="student-shell" style={{ display: "flex", minHeight: "100vh", background: "#f6f8fc" }}>

      {/* Sidebar */}
      <aside className="student-sidebar" style={{
        width: 220, background: "#fff",
        borderRight: "1px solid #dfe6f3",
        display: "flex", flexDirection: "column",
        padding: "20px 0", flexShrink: 0,
      }}>
        <div style={{ padding: "0 20px 22px" }}>
          <p style={{ fontWeight: 800, fontSize: 16, margin: 0, color: "#0f172a" }}>
            EduEvaluator
          </p>
          <p style={{ fontSize: 12, color: "#64748b", margin: "2px 0 0" }}>
            Student portal
          </p>
        </div>

        <nav style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2, padding: "0 12px" }}>
          <p style={{ fontSize: 11, fontWeight: 800, color: "#94a3b8", margin: "10px 8px 8px", letterSpacing: 0 }}>
            MAIN
          </p>
          {links.map(({ to, icon: Icon, label, end }) => (
            <NavLink
              key={to} to={to} end={end}
              style={({ isActive }) => ({
                display: "flex", alignItems: "center", gap: 10,
                padding: "10px 12px", borderRadius: 8,
                textDecoration: "none", fontSize: 14,
                fontWeight: isActive ? 700 : 600,
                color: isActive ? "#1e3a8a" : "#475569",
                background: isActive ? "#e8eefc" : "transparent",
              })}
            >
              <Icon size={17} /> {label}
            </NavLink>
          ))}
        </nav>

        <div style={{ padding: "16px 14px 0", borderTop: "1px solid #e8edf7" }}>
          <div style={{
            display: "grid",
            gridTemplateColumns: "34px 1fr",
            gap: 10,
            alignItems: "center",
            padding: "0 6px 12px",
          }}>
            <div style={{
              width: 34,
              height: 34,
              borderRadius: 10,
              background: "#e8eefc",
              color: "#1e3a8a",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 900,
              fontSize: 13,
            }}>
              {(user?.name || "S").split(" ").map((part) => part[0]).slice(0, 2).join("").toUpperCase()}
            </div>
            <div style={{ minWidth: 0 }}>
              <p style={{ fontSize: 13, fontWeight: 800, margin: "0 0 2px", color: "#0f172a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {user?.name}
              </p>
              <p style={{ fontSize: 12, color: "#94a3b8", margin: 0 }}>Student</p>
            </div>
          </div>
          <button onClick={logout} style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            width: "100%",
            background: "#f8fafc",
            border: "1px solid #e2e8f0",
            borderRadius: 8,
            cursor: "pointer",
            fontSize: 13,
            fontWeight: 800,
            color: "#475569",
            padding: "9px 10px",
          }}>
            <LogOut size={15} /> Sign out
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="student-main" style={{ flex: 1, padding: "18px 28px 32px", overflowY: "auto", minWidth: 0 }}>
        <Outlet />
      </main>
    </div>
  );
}


