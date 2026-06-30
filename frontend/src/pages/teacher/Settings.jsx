import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import {
  Bell,
  CheckCircle2,
  ClipboardCheck,
  RotateCcw,
  Save,
  Settings as SettingsIcon,
  User,
} from "lucide-react";
import { getMe, updateMySettings } from "../../api/auth";
import { useAuth } from "../../context/useAuth";

const BLUE = "#2563eb";

const cardStyle = {
  background: "#fff",
  border: "1px solid #dfe6f3",
  borderRadius: 8,
  boxShadow: "0 10px 24px rgba(15, 23, 42, 0.04)",
  overflow: "hidden",
};

const inputStyle = {
  width: "100%",
  border: "1px solid #d5deea",
  borderRadius: 8,
  background: "#fff",
  color: "#0f172a",
  padding: "10px 12px",
  fontSize: 14,
  boxSizing: "border-box",
  outline: "none",
};

const labelStyle = {
  display: "block",
  color: "#334155",
  fontSize: 12,
  fontWeight: 800,
  marginBottom: 6,
};

function ToggleRow({ title, description, checked, onChange }) {
  return (
    <label style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 18,
      padding: "14px 0",
      borderBottom: "1px solid #eef2f7",
      cursor: "pointer",
    }}>
      <span>
        <span style={{ display: "block", color: "#0f172a", fontSize: 14, fontWeight: 800 }}>
          {title}
        </span>
        <span style={{ color: "#64748b", fontSize: 12 }}>
          {description}
        </span>
      </span>
      <span style={{
        width: 44,
        height: 24,
        borderRadius: 999,
        background: checked ? BLUE : "#cbd5e1",
        padding: 3,
        boxSizing: "border-box",
        display: "flex",
        justifyContent: checked ? "flex-end" : "flex-start",
        transition: "0.2s ease",
        flexShrink: 0,
      }}>
        <input
          type="checkbox"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
          style={{ display: "none" }}
        />
        <span style={{
          width: 18,
          height: 18,
          borderRadius: "50%",
          background: "#fff",
          boxShadow: "0 1px 3px rgba(15, 23, 42, 0.24)",
        }} />
      </span>
    </label>
  );
}

export default function TeacherSettings() {
  const { updateUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [initial, setInitial] = useState(null);
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    institution: "",
    department: "",
    bio: "",
    notify_submissions: true,
    notify_low_scores: true,
    notify_ocr_review: true,
    default_question_marks: 10,
    release_marks_immediately: true,
  });

  useEffect(() => {
    let mounted = true;
    getMe()
      .then((response) => {
        if (!mounted) return;
        const data = response.data;
        const next = {
          full_name: data.full_name || "",
          email: data.email || "",
          institution: data.institution || "",
          department: data.department || "",
          bio: data.bio || "",
          notify_submissions: data.notify_submissions ?? true,
          notify_low_scores: data.notify_low_scores ?? true,
          notify_ocr_review: data.notify_ocr_review ?? true,
          default_question_marks: data.default_question_marks || 10,
          release_marks_immediately: data.release_marks_immediately ?? true,
        };
        setForm(next);
        setInitial(next);
      })
      .catch(() => toast.error("Could not load settings"))
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const initials = useMemo(() => {
    const parts = form.full_name.trim().split(/\s+/).filter(Boolean);
    return (parts[0]?.[0] || "T") + (parts[1]?.[0] || "");
  }, [form.full_name]);

  const updateField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const resetForm = () => {
    if (initial) setForm(initial);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...form,
        default_question_marks: Number(form.default_question_marks || 10),
      };
      const response = await updateMySettings(payload);
      const saved = response.data.user;
      const next = {
        ...payload,
        full_name: saved.full_name,
        email: saved.email,
        institution: saved.institution,
        department: saved.department,
        bio: saved.bio,
        notify_submissions: saved.notify_submissions,
        notify_low_scores: saved.notify_low_scores,
        notify_ocr_review: saved.notify_ocr_review,
        default_question_marks: saved.default_question_marks,
        release_marks_immediately: saved.release_marks_immediately,
      };
      setForm(next);
      setInitial(next);
      updateUser({ name: saved.full_name, full_name: saved.full_name });
      toast.success("Settings saved");
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <p style={{ color: "#94a3b8", fontSize: 14 }}>Loading settings...</p>;
  }

  return (
    <form onSubmit={handleSubmit} style={{ maxWidth: 980 }}>
      <div style={{ marginBottom: 22 }}>
        <h1 style={{ color: "#0f172a", fontSize: 22, fontWeight: 800, margin: "0 0 4px" }}>
          Settings
        </h1>
        <p style={{ color: "#64748b", fontSize: 13, margin: 0 }}>
          Manage your profile, notifications, and evaluation defaults.
        </p>
      </div>

      <div className="teacher-settings-grid" style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.25fr) minmax(280px, 0.75fr)", gap: 16 }}>
        <section style={cardStyle}>
          <div style={{
            padding: "18px 20px",
            borderBottom: "1px solid #e8edf7",
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}>
            <span style={{
              width: 34,
              height: 34,
              borderRadius: 8,
              background: "#eff6ff",
              color: BLUE,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}>
              <User size={18} />
            </span>
            <div>
              <p style={{ margin: 0, color: "#0f172a", fontWeight: 800, fontSize: 15 }}>Profile</p>
              <p style={{ margin: "2px 0 0", color: "#64748b", fontSize: 12 }}>
                Your name, email and institution details
              </p>
            </div>
          </div>

          <div style={{ padding: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 20 }}>
              <div style={{
                width: 54,
                height: 54,
                borderRadius: "50%",
                background: "#e0edff",
                color: "#0f2a5f",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 18,
                fontWeight: 900,
              }}>
                {initials.toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ color: "#0f172a", fontSize: 15, fontWeight: 800, margin: "0 0 2px" }}>
                  {form.full_name || "Teacher"}
                </p>
                <span style={{
                  display: "inline-flex",
                  background: "#dcfce7",
                  color: "#166534",
                  borderRadius: 999,
                  padding: "2px 8px",
                  fontSize: 11,
                  fontWeight: 800,
                  marginBottom: 3,
                }}>
                  Teacher
                </span>
                <p style={{ color: "#64748b", fontSize: 12, margin: 0 }}>{form.email}</p>
              </div>
              <button
                type="button"
                onClick={() => toast("Photo upload can be added after file storage is configured.")}
                style={{
                  border: "1px solid #cbd5e1",
                  background: "#fff",
                  color: "#0f172a",
                  borderRadius: 8,
                  padding: "9px 14px",
                  cursor: "pointer",
                  fontSize: 13,
                  fontWeight: 800,
                }}
              >
                Change photo
              </button>
            </div>

            <div className="teacher-settings-form-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
              <div>
                <label style={labelStyle}>Full name</label>
                <input
                  value={form.full_name}
                  onChange={(event) => updateField("full_name", event.target.value)}
                  style={inputStyle}
                  required
                />
              </div>
              <div>
                <label style={labelStyle}>Email address</label>
                <input value={form.email} readOnly style={{ ...inputStyle, background: "#f8fafc", color: "#64748b" }} />
              </div>
              <div>
                <label style={labelStyle}>Institution / School name</label>
                <input
                  value={form.institution}
                  onChange={(event) => updateField("institution", event.target.value)}
                  placeholder="e.g. Delhi Public School"
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Department / Subject</label>
                <input
                  value={form.department}
                  onChange={(event) => updateField("department", event.target.value)}
                  placeholder="e.g. Computer Science"
                  style={inputStyle}
                />
              </div>
            </div>

            <label style={labelStyle}>Bio</label>
            <textarea
              value={form.bio}
              onChange={(event) => updateField("bio", event.target.value)}
              placeholder="A short description shown on reports..."
              rows={4}
              style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit", lineHeight: 1.5 }}
            />
          </div>
        </section>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <section style={cardStyle}>
            <div style={{ padding: "18px 20px", borderBottom: "1px solid #e8edf7", display: "flex", alignItems: "center", gap: 10 }}>
              <Bell size={18} color={BLUE} />
              <div>
                <p style={{ margin: 0, color: "#0f172a", fontWeight: 800, fontSize: 15 }}>Notifications</p>
                <p style={{ margin: "2px 0 0", color: "#64748b", fontSize: 12 }}>Choose dashboard alerts</p>
              </div>
            </div>
            <div style={{ padding: "4px 20px 2px" }}>
              <ToggleRow
                title="New submissions"
                description="Show alerts when students submit exams."
                checked={form.notify_submissions}
                onChange={(value) => updateField("notify_submissions", value)}
              />
              <ToggleRow
                title="Low score alerts"
                description="Highlight students below 50 percent."
                checked={form.notify_low_scores}
                onChange={(value) => updateField("notify_low_scores", value)}
              />
              <ToggleRow
                title="OCR review alerts"
                description="Notify when uploaded sheets need review."
                checked={form.notify_ocr_review}
                onChange={(value) => updateField("notify_ocr_review", value)}
              />
            </div>
          </section>

          <section style={cardStyle}>
            <div style={{ padding: "18px 20px", borderBottom: "1px solid #e8edf7", display: "flex", alignItems: "center", gap: 10 }}>
              <ClipboardCheck size={18} color={BLUE} />
              <div>
                <p style={{ margin: 0, color: "#0f172a", fontWeight: 800, fontSize: 15 }}>Evaluation defaults</p>
                <p style={{ margin: "2px 0 0", color: "#64748b", fontSize: 12 }}>Defaults for new exams</p>
              </div>
            </div>
            <div style={{ padding: 20 }}>
              <label style={labelStyle}>Default question marks</label>
              <input
                type="number"
                min={1}
                max={100}
                value={form.default_question_marks}
                onChange={(event) => updateField("default_question_marks", event.target.value)}
                style={{ ...inputStyle, marginBottom: 14 }}
              />
              <ToggleRow
                title="Release marks immediately"
                description="Students can see marks after submission."
                checked={form.release_marks_immediately}
                onChange={(value) => updateField("release_marks_immediately", value)}
              />
            </div>
          </section>
        </div>
      </div>

      <div style={{
        marginTop: 16,
        padding: "14px 16px",
        ...cardStyle,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 12,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9, color: "#64748b", fontSize: 13 }}>
          <SettingsIcon size={16} />
          Saved settings are used across your teacher dashboard.
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button
            type="button"
            onClick={resetForm}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 7,
              border: "1px solid #d5deea",
              background: "#fff",
              color: "#334155",
              borderRadius: 8,
              padding: "10px 14px",
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 800,
            }}
          >
            <RotateCcw size={15} /> Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 7,
              border: "1px solid #0f2a5f",
              background: saving ? "#93c5fd" : "#0f2a5f",
              color: "#fff",
              borderRadius: 8,
              padding: "10px 16px",
              cursor: saving ? "not-allowed" : "pointer",
              fontSize: 13,
              fontWeight: 900,
            }}
          >
            {saving ? <CheckCircle2 size={15} /> : <Save size={15} />}
            {saving ? "Saving..." : "Save profile"}
          </button>
        </div>
      </div>
    </form>
  );
}
