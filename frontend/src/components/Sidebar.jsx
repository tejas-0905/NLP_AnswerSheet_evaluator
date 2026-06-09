import { NavLink } from "react-router-dom";
import { useAuth } from "../context/useAuth";
import {
  LayoutDashboard, School, BookOpen,
  BarChart2, Trophy, Users, LogOut
} from "lucide-react";

const mainLinks = [
  { to: "/teacher",              icon: LayoutDashboard, label: "Dashboard"   },
  { to: "/teacher/classrooms",   icon: School,          label: "Classrooms"  },
  { to: "/teacher/students",     icon: Users,           label: "Students"    },
  { to: "/teacher/exams",        icon: BookOpen,        label: "Exams"       },
];

const insightLinks = [
  { to: "/teacher/results",      icon: BarChart2,       label: "Results"     },
  { to: "/teacher/leaderboard",  icon: Trophy,          label: "Leaderboard" },
];

export default function Sidebar() {
  const { logout, user } = useAuth();

  return (
    <aside className="teacher-sidebar">
      {/* Logo */}
      <div style={{ padding: "0 20px 22px" }}>
        <p style={{ fontWeight: 800, fontSize: 16, margin: 0, color: "#0f172a" }}>
          EduEvaluator
        </p>
        <p style={{ fontSize: 12, color: "#64748b", margin: "2px 0 0" }}>
          Teacher portal
        </p>
      </div>

      <nav style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2, padding: "0 12px" }}>
        <p style={{ fontSize: 11, fontWeight: 800, color: "#94a3b8", margin: "10px 8px 8px", letterSpacing: 0 }}>
          MAIN
        </p>
        {mainLinks.map(({ to, icon: Icon, label }) => (
          <NavLink key={to} to={to} end={to === "/teacher"} style={({ isActive }) => ({
            display: "flex", alignItems: "center", gap: 10,
            padding: "10px 12px", borderRadius: 8, textDecoration: "none",
            fontSize: 14, fontWeight: isActive ? 700 : 600,
            color: isActive ? "#1e3a8a" : "#475569",
            background: isActive ? "#e8eefc" : "transparent",
          })}>
            <Icon size={17} />
            {label}
          </NavLink>
        ))}

        <p style={{ fontSize: 11, fontWeight: 800, color: "#94a3b8", margin: "20px 8px 8px", letterSpacing: 0 }}>
          INSIGHTS
        </p>
        {insightLinks.map(({ to, icon: Icon, label }) => (
          <NavLink key={to} to={to} style={({ isActive }) => ({
            display: "flex", alignItems: "center", gap: 10,
            padding: "10px 12px", borderRadius: 8, textDecoration: "none",
            fontSize: 14, fontWeight: isActive ? 700 : 600,
            color: isActive ? "#1e3a8a" : "#475569",
            background: isActive ? "#e8eefc" : "transparent",
          })}>
            <Icon size={17} />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* User + logout */}
      <div style={{ padding: "16px 20px 0", borderTop: "1px solid #e8edf7" }}>
        <p style={{ fontSize: 13, fontWeight: 700, margin: "0 0 2px", color: "#0f172a" }}>
          {user?.name}
        </p>
        <p style={{ fontSize: 12, color: "#94a3b8", margin: "0 0 12px" }}>Teacher</p>
        <button
          onClick={logout}
          style={{
            display: "flex", alignItems: "center", gap: 8,
            background: "none", border: "none", cursor: "pointer",
            fontSize: 13, color: "#64748b", padding: 0,
          }}
        >
          <LogOut size={15} /> Sign out
        </button>
      </div>
    </aside>
  );
}
