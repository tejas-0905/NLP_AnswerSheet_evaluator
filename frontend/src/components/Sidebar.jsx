import { NavLink } from "react-router-dom";
import { useAuth } from "../context/useAuth";
import {
  LayoutDashboard, School, BookOpen,
  BarChart2, Trophy, Users, LogOut, Settings, FileText
} from "lucide-react";

const mainLinks = [
  { to: "/teacher",              icon: LayoutDashboard, label: "Dashboard"   },
  { to: "/teacher/classrooms",   icon: School,          label: "Classrooms"  },
  { to: "/teacher/students",     icon: Users,           label: "Students"    },
  { to: "/teacher/exams",        icon: BookOpen,        label: "Exams"       },
  { to: "/teacher/notes",        icon: FileText,        label: "Notes"       },
];

const insightLinks = [
  { to: "/teacher/results",      icon: BarChart2,       label: "Results"     },
  { to: "/teacher/leaderboard",  icon: Trophy,          label: "Leaderboard" },
];

const accountLinks = [
  { to: "/teacher/settings",     icon: Settings,        label: "Settings"    },
];

const colors = {
  panel: "#4965f2",
  panelDark: "#3f59df",
  active: "#f5f1f3",
  text: "#ffffff",
  muted: "rgba(255, 255, 255, 0.72)",
  line: "rgba(255, 255, 255, 0.24)",
};

const sectionLabelStyle = {
  fontSize: 11,
  fontWeight: 800,
  color: colors.muted,
  margin: "18px 8px 8px",
  letterSpacing: 0,
};

const linkStyle = ({ isActive }) => ({
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "10px 12px",
  borderRadius: 7,
  textDecoration: "none",
  fontSize: 13,
  fontWeight: isActive ? 800 : 700,
  color: isActive ? "#1f2f69" : colors.muted,
  background: isActive ? colors.active : undefined,
  transition: "background 160ms ease, color 160ms ease",
});

export default function Sidebar() {
  const { logout, user } = useAuth();

  return (
    <aside className="teacher-sidebar">
      {/* Logo */}
      <div style={{ padding: "0 20px 16px" }}>
        <p style={{ fontWeight: 800, fontSize: 16, margin: 0, color: colors.text }}>
          EduEvaluator
        </p>
        <p style={{ fontSize: 12, color: colors.muted, margin: "2px 0 0", fontWeight: 600 }}>
          Teacher portal
        </p>
      </div>

      <nav style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2, padding: "0 12px" }}>
        <p style={{ ...sectionLabelStyle, marginTop: 10 }}>
          MAIN
        </p>
        {mainLinks.map(({ to, icon: Icon, label }) => (
          <NavLink key={to} to={to} end={to === "/teacher"} className="app-sidebar-link" style={linkStyle}>
            <Icon size={17} />
            {label}
          </NavLink>
        ))}

        <p style={sectionLabelStyle}>
          INSIGHTS
        </p>
        {insightLinks.map(({ to, icon: Icon, label }) => (
          <NavLink key={to} to={to} className="app-sidebar-link" style={linkStyle}>
            <Icon size={17} />
            {label}
          </NavLink>
        ))}

        <p style={sectionLabelStyle}>
          ACCOUNT
        </p>
        {accountLinks.map(({ to, icon: Icon, label }) => (
          <NavLink key={to} to={to} className="app-sidebar-link" style={linkStyle}>
            <Icon size={17} />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* User + logout */}
      <div style={{ padding: "14px 14px 0", borderTop: `1px solid ${colors.line}` }}>
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
            borderRadius: 999,
            background: colors.active,
            color: colors.text,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
            fontWeight: 900,
            fontSize: 13,
          }}>
            {user?.profile_photo_url ? (
              <img
                src={user.profile_photo_url}
                alt="Profile"
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            ) : (
              (user?.name || "T").split(" ").map((part) => part[0]).slice(0, 2).join("").toUpperCase()
            )}
          </div>
          <div style={{ minWidth: 0 }}>
            <p style={{ fontSize: 13, fontWeight: 800, margin: "0 0 2px", color: colors.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {user?.name}
            </p>
            <p style={{ fontSize: 11, color: colors.muted, margin: 0, fontWeight: 700 }}>Teacher</p>
          </div>
        </div>
        <button
          onClick={logout}
          style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            width: "100%",
            background: colors.panelDark,
            border: `1px solid ${colors.line}`,
            borderRadius: 7,
            cursor: "pointer",
            fontSize: 12,
            fontWeight: 800,
            color: colors.muted,
            padding: "8px 10px",
          }}
        >
          <LogOut size={15} /> Sign out
        </button>
      </div>
    </aside>
  );
}
