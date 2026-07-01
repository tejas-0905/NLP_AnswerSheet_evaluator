import { NavLink, useNavigate } from "react-router-dom";
import { ArrowLeft, BarChart2, BookOpen, FileText, Trophy, Users } from "lucide-react";

const tabStyle = ({ isActive }) => ({
  display: "flex",
  alignItems: "center",
  gap: 6,
  padding: "8px 12px",
  borderRadius: 8,
  textDecoration: "none",
  fontSize: 13,
  fontWeight: isActive ? 600 : 500,
  color: isActive ? "#2563eb" : "#4b5563",
  background: isActive ? "#eff6ff" : "#fff",
  border: `1px solid ${isActive ? "#bfdbfe" : "#e5e7eb"}`,
});

export default function ClassroomTabs({ classroomId, classroomName }) {
  const navigate = useNavigate();

  if (!classroomId) return null;

  return (
    <div style={{ marginBottom: 24 }}>
      <button
        onClick={() => navigate("/teacher/classrooms")}
        style={{
          display: "flex", alignItems: "center", gap: 6,
          background: "none", border: "none", padding: 0,
          cursor: "pointer", color: "#6b7280", fontSize: 13,
          marginBottom: 12,
        }}
      >
        <ArrowLeft size={14} /> Classrooms
      </button>

      <div style={{ marginBottom: 14 }}>
        <p style={{ fontSize: 12, color: "#6b7280", margin: "0 0 3px" }}>
          Classroom workspace
        </p>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "#111", margin: 0 }}>
          {classroomName || "Classroom"}
        </h1>
      </div>

      <nav style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        <NavLink to={`/teacher/classrooms/${classroomId}/exams`} style={tabStyle}>
          <BookOpen size={15} /> Exams
        </NavLink>
        <NavLink to={`/teacher/classrooms/${classroomId}/results`} style={tabStyle}>
          <BarChart2 size={15} /> Results
        </NavLink>
        <NavLink to={`/teacher/classrooms/${classroomId}/students`} style={tabStyle}>
          <Users size={15} /> Students
        </NavLink>
        <NavLink to={`/teacher/classrooms/${classroomId}/notes`} style={tabStyle}>
          <FileText size={15} /> Notes
        </NavLink>
        <NavLink to={`/teacher/classrooms/${classroomId}/leaderboard`} style={tabStyle}>
          <Trophy size={15} /> Leaderboard
        </NavLink>
      </nav>
    </div>
  );
}
