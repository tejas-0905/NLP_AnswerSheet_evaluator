import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bell, BookOpen, ClipboardCheck, Plus, School,
  LogOut, Settings, Users
} from "lucide-react";
import { useAuth } from "../../context/useAuth";
import { getMyClassrooms } from "../../api/classroom";
import { getMe } from "../../api/auth";
import { getExamsForClass } from "../../api/exam";

const RECENT_ACTIVITY_CLEARED_KEY = "teacher_recent_activity_cleared_at";

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

export default function TeacherDashboard() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [classrooms, setClassrooms] = useState([]);
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [recentActivityClearedAt, setRecentActivityClearedAt] = useState(() => {
    const stored = localStorage.getItem(RECENT_ACTIVITY_CLEARED_KEY);
    return stored ? Number(stored) : 0;
  });
  const [showNotifications, setShowNotifications] = useState(false);
  const [notificationsCleared, setNotificationsCleared] = useState(false);
  const [notificationPrefs, setNotificationPrefs] = useState({
    notify_submissions: true,
    notify_low_scores: true,
    notify_ocr_review: true,
  });

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

  useEffect(() => {
    let mounted = true;
    if (classrooms.length === 0) {
      Promise.resolve().then(() => {
        if (mounted) setExams([]);
      });
      return () => {
        mounted = false;
      };
    }

    Promise.all(
      classrooms.map((classroom) =>
        getExamsForClass(classroom.id)
          .then((response) => response.data.map((exam) => ({
            ...exam,
            classroom_id: classroom.id,
            classroom_name: classroom.name,
          })))
          .catch(() => [])
      )
    ).then((groups) => {
      if (mounted) setExams(groups.flat());
    });

    return () => {
      mounted = false;
    };
  }, [classrooms]);

  useEffect(() => {
    let mounted = true;
    getMe()
      .then((response) => {
        if (!mounted) return;
        setNotificationPrefs({
          notify_submissions: response.data.notify_submissions ?? true,
          notify_low_scores: response.data.notify_low_scores ?? true,
          notify_ocr_review: response.data.notify_ocr_review ?? true,
        });
      })
      .catch(() => {});

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
    const classroomItems = classrooms.map((c) => ({
        title: `Classroom ${c.name} created`,
        meta: relativeDate(c.created_at),
        date: c.created_at,
        color: "#22c55e",
      }));

    const examItems = exams.map((exam) => ({
      title: `Exam ${exam.title} created`,
      meta: exam.classroom_name ? `${exam.classroom_name} - ${relativeDate(exam.created_at)}` : relativeDate(exam.created_at),
      date: exam.created_at,
      color: "#2563eb",
    }));

    const items = [...classroomItems, ...examItems]
      .filter((item) => {
        const time = item.date ? new Date(item.date).getTime() : 0;
        return time > recentActivityClearedAt;
      })
      .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

    if (totals.students > 0) {
      const latestClassroomTime = Math.max(
        0,
        ...classrooms.map((classroom) => (
          classroom.created_at ? new Date(classroom.created_at).getTime() : 0
        ))
      );
      if (latestClassroomTime > recentActivityClearedAt) {
        items.splice(1, 0, {
        title: `${totals.students} student${totals.students === 1 ? "" : "s"} joined`,
        meta: "Across your classrooms",
        date: latestClassroomTime || new Date().toISOString(),
        color: "#6366f1",
      });
      }
    }

    if (exams.length === 0 && recentActivityClearedAt === 0) {
      items.push({
        title: "No exams published yet",
        meta: "Create your first exam to get started",
        date: null,
        color: "#a5b4fc",
      });
    }

    return items.slice(0, 4);
  }, [classrooms, exams, recentActivityClearedAt, totals.students]);

  const clearRecentActivity = () => {
    const now = Date.now();
    localStorage.setItem(RECENT_ACTIVITY_CLEARED_KEY, String(now));
    setRecentActivityClearedAt(now);
  };

  const notificationItems = useMemo(() => {
    if (notificationsCleared) return [];
    const items = [];

    if (notificationPrefs.notify_submissions) {
      if (totals.submissions > 0) {
        items.push({
          title: `${totals.submissions} submission${totals.submissions === 1 ? "" : "s"} received`,
          meta: "Review marks from Results",
          color: "#2563eb",
          action: () => navigate("/teacher/results"),
        });
      } else {
        items.push({
          title: "No submissions yet",
          meta: "Published exams will appear here after students submit",
          color: "#94a3b8",
          action: () => navigate("/teacher/exams"),
        });
      }
    }

    if (notificationPrefs.notify_low_scores) {
      items.push({
        title: "Low score alerts are active",
        meta: "Students below 50 percent are highlighted in Results",
        color: "#d97706",
        action: () => navigate("/teacher/results"),
      });
    }

    return items;
  }, [notificationPrefs, notificationsCleared, navigate, totals.submissions]);

  const firstName = user?.name?.split(" ")[0] || "Teacher";

  return (
    <div style={{ width: "100%" }}>
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
          <div style={{ position: "relative" }}>
            <button
              style={{ ...iconButtonStyle, position: "relative" }}
              aria-label="Notifications"
              onClick={() => setShowNotifications((value) => !value)}
            >
              <Bell size={16} />
              {notificationItems.length > 0 && (
                <span style={{
                  position: "absolute",
                  top: -4,
                  right: -4,
                  minWidth: 17,
                  height: 17,
                  borderRadius: 999,
                  background: "#dc2626",
                  color: "#fff",
                  fontSize: 10,
                  fontWeight: 900,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  border: "2px solid #fff",
                }}>
                  {notificationItems.length}
                </span>
              )}
            </button>
            {showNotifications && (
              <div style={{
                position: "absolute",
                right: 0,
                top: 44,
                width: 330,
                background: "#fff",
                border: "1px solid #dfe6f3",
                borderRadius: 8,
                boxShadow: "0 18px 48px rgba(15, 23, 42, 0.16)",
                zIndex: 30,
                overflow: "hidden",
              }}>
                <div style={{
                  padding: "14px 16px",
                  borderBottom: "1px solid #e8edf7",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}>
                  <div>
                    <p style={{ color: "#0f172a", fontSize: 14, fontWeight: 900, margin: 0 }}>Notifications</p>
                    <p style={{ color: "#64748b", fontSize: 12, margin: "2px 0 0" }}>Project alerts and reminders</p>
                  </div>
                  <button
                    onClick={() => setNotificationsCleared(true)}
                    style={{ border: 0, background: "transparent", color: "#2563eb", fontSize: 12, fontWeight: 800, cursor: "pointer" }}
                  >
                    Clear
                  </button>
                </div>
                <div style={{ maxHeight: 320, overflowY: "auto" }}>
                  {notificationItems.length === 0 ? (
                    <div style={{ padding: 18, textAlign: "center", color: "#94a3b8", fontSize: 13 }}>
                      You are all caught up.
                    </div>
                  ) : notificationItems.map((item, index) => (
                    <button
                      key={`${item.title}-${index}`}
                      onClick={() => {
                        setShowNotifications(false);
                        item.action();
                      }}
                      style={{
                        width: "100%",
                        border: 0,
                        borderBottom: index === notificationItems.length - 1 ? 0 : "1px solid #eef2f7",
                        background: "#fff",
                        display: "grid",
                        gridTemplateColumns: "10px 1fr",
                        gap: 10,
                        textAlign: "left",
                        padding: "13px 16px",
                        cursor: "pointer",
                      }}
                    >
                      <span style={{ width: 8, height: 8, borderRadius: 999, background: item.color, marginTop: 5 }} />
                      <span>
                        <span style={{ display: "block", color: "#0f172a", fontSize: 13, fontWeight: 800 }}>{item.title}</span>
                        <span style={{ display: "block", color: "#64748b", fontSize: 12, marginTop: 2 }}>{item.meta}</span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          <button style={iconButtonStyle} aria-label="Settings" onClick={() => navigate("/teacher/settings")}><Settings size={16} /></button>
          <button
            onClick={logout}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 7,
              background: "#fff",
              color: "#475569",
              border: "1px solid #dfe6f3",
              borderRadius: 8,
              padding: "9px 12px",
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 800,
            }}
          >
            <LogOut size={15} /> Sign out
          </button>
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
              <button
                type="button"
                onClick={clearRecentActivity}
                disabled={recentActivity.length === 0}
                style={{
                  border: 0,
                  background: "transparent",
                  color: recentActivity.length === 0 ? "#94a3b8" : "#2563eb",
                  fontSize: 12,
                  fontWeight: 800,
                  cursor: recentActivity.length === 0 ? "not-allowed" : "pointer",
                  padding: 0,
                }}
              >
                Clear
              </button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {recentActivity.length === 0 ? (
                <div style={{
                  border: "1px dashed #cbd5e1",
                  borderRadius: 8,
                  padding: "20px 16px",
                  color: "#64748b",
                  fontSize: 13,
                  textAlign: "center",
                }}>
                  No recent activity to show.
                </div>
              ) : recentActivity.map((item, index) => (
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
