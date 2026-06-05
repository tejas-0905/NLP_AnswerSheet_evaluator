import { NavLink } from "react-router-dom";
import { useAuth } from "../context/useAuth";
import {
  LayoutDashboard, School, BookOpen,
  BarChart2, Trophy, LogOut
} from "lucide-react";

const links = [
  { to: "/teacher",              icon: LayoutDashboard, label: "Dashboard"   },
  { to: "/teacher/classrooms",   icon: School,          label: "Classrooms"  },
  { to: "/teacher/exams",        icon: BookOpen,        label: "Exams"       },
  { to: "/teacher/results",      icon: BarChart2,       label: "Results"     },
  { to: "/teacher/leaderboard",  icon: Trophy,          label: "Leaderboard" },
];

export default function Sidebar() {
  const { logout, user } = useAuth();

  return (
    <aside className="teacher-sidebar">
      {/* Logo */}
      <div style={{ padding: "0 20px 28px" }}>
        <p style={{ fontWeight: 600, fontSize: 16, margin: 0, color: "#111" }}>
          EduEvaluator
        </p>
        <p style={{ fontSize: 12, color: "#6b7280", margin: "2px 0 0" }}>
          Teacher portal
        </p>
      </div>

      {/* Nav links */}
      <nav style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2, padding: "0 12px" }}>
        {links.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/teacher"}
            style={({ isActive }) => ({
              display: "flex", alignItems: "center", gap: 10,
              padding: "9px 12px", borderRadius: 8, textDecoration: "none",
              fontSize: 14, fontWeight: isActive ? 500 : 400,
              color: isActive ? "#2563eb" : "#374151",
              background: isActive ? "#eff6ff" : "transparent",
            })}
          >
            <Icon size={17} />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* User + logout */}
      <div style={{ padding: "0 20px", borderTop: "1px solid #f3f4f6", paddingTop: 16 }}>
        <p style={{ fontSize: 13, fontWeight: 500, margin: "0 0 2px", color: "#111" }}>
          {user?.name}
        </p>
        <p style={{ fontSize: 12, color: "#9ca3af", margin: "0 0 12px" }}>Teacher</p>
        <button
          onClick={logout}
          style={{
            display: "flex", alignItems: "center", gap: 8,
            background: "none", border: "none", cursor: "pointer",
            fontSize: 13, color: "#6b7280", padding: 0,
          }}
        >
          <LogOut size={15} /> Sign out
        </button>
      </div>
    </aside>
  );
}
