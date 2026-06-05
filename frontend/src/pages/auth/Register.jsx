import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { registerUser } from "../../api/auth";

const S = {
  page: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#f1f5f9",
    padding: "20px",
  },
  card: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    width: "100%",
    maxWidth: 860,
    borderRadius: 16,
    overflow: "hidden",
    border: "1px solid #e2e8f0",
  },
  left: {
    background: "#1e3a5f",
    padding: "48px 40px",
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
  },
  right: {
    background: "#ffffff",
    padding: "40px",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
  },
  logo: { fontSize: 20, fontWeight: 600, color: "#fff", margin: "0 0 6px" },
  logoSub: { fontSize: 13, color: "#93c5fd", margin: "0 0 32px" },
  roleBox: {
    borderRadius: 10, padding: "14px 16px", marginBottom: 12,
  },
  roleTitle: { fontSize: 13, fontWeight: 500, color: "#bfdbfe", margin: "0 0 4px" },
  roleSub: { fontSize: 12, color: "#93c5fd", margin: 0 },
  copyright: { fontSize: 11, color: "#334155", margin: 0 },
  heading: { fontSize: 22, fontWeight: 600, color: "#0f172a", margin: "0 0 4px" },
  subheading: { fontSize: 14, color: "#64748b", margin: "0 0 20px" },
  label: { fontSize: 13, fontWeight: 500, color: "#374151", display: "block", marginBottom: 6 },
  input: {
    width: "100%", padding: "10px 12px",
    border: "1px solid #e2e8f0", borderRadius: 8,
    fontSize: 14, outline: "none", boxSizing: "border-box",
    color: "#0f172a", background: "#fff",
  },
  inputWrap: { position: "relative" },
  iconStyle: {
    position: "absolute", left: 12, top: "50%",
    transform: "translateY(-50%)", color: "#9ca3af",
    fontSize: 16, pointerEvents: "none",
  },
  inputWithIcon: {
    width: "100%", padding: "10px 12px 10px 38px",
    border: "1px solid #e2e8f0", borderRadius: 8,
    fontSize: 14, outline: "none", boxSizing: "border-box",
    color: "#0f172a", background: "#fff",
  },
  btn: {
    width: "100%", padding: "11px",
    background: "#2563eb", color: "#fff",
    border: "none", borderRadius: 8,
    fontSize: 14, fontWeight: 500, cursor: "pointer",
  },
  error: {
    background: "#fef2f2", border: "1px solid #fecaca",
    borderRadius: 8, padding: "10px 14px",
    fontSize: 13, color: "#dc2626", marginBottom: 14,
    display: "flex", alignItems: "center", gap: 8,
  },
  footer: { fontSize: 13, color: "#64748b", textAlign: "center", marginTop: 16 },
};

export default function Register() {
  const navigate = useNavigate();
  const [role, setRole] = useState("student");
  const [form, setForm] = useState({ full_name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const res = await registerUser({ ...form, role });
      navigate("/verify-otp", {
        state: { user_id: res.data.user_id, email: form.email },
      });
    } catch (err) {
      setError(err.response?.data?.detail || "Registration failed. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const focusStyle = (e) => (e.target.style.borderColor = "#2563eb");
  const blurStyle  = (e) => (e.target.style.borderColor = "#e2e8f0");

  const roles = [
    { value: "teacher", icon: "ti-school",        label: "Teacher", sub: "Create classrooms and exams" },
    { value: "student", icon: "ti-user-graduate",  label: "Student", sub: "Join classrooms and take exams" },
  ];

  return (
    <div style={S.page}>
      <div style={S.card}>

        {/* Left panel */}
        <div style={S.left}>
          <div>
            <p style={S.logo}>EduEvaluator</p>
            <p style={S.logoSub}>Join thousands of educators</p>
            {roles.map((r) => (
              <div
                key={r.value}
                style={{
                  ...S.roleBox,
                  background: r.value === "teacher" ? "#1e40af" : "transparent",
                  border: r.value === "student" ? "1px solid #1e40af" : "none",
                }}
              >
                <p style={S.roleTitle}>
                  <i className={`ti ${r.icon}`} style={{ marginRight: 6, fontSize: 13 }} aria-hidden="true" />
                  For {r.label.toLowerCase()}s
                </p>
                <p style={S.roleSub}>{r.sub}</p>
              </div>
            ))}
          </div>
          <p style={S.copyright}>© 2024 EduEvaluator</p>
        </div>

        {/* Right panel */}
        <div style={S.right}>
          <p style={S.heading}>Create account</p>
          <p style={S.subheading}>Choose your role to get started</p>

          {/* Role selector */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 }}>
            {roles.map((r) => {
              const active = role === r.value;
              return (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => setRole(r.value)}
                  style={{
                    padding: "14px 10px",
                    border: active ? "2px solid #2563eb" : "1px solid #e2e8f0",
                    borderRadius: 10,
                    background: active ? "#eff6ff" : "#fff",
                    cursor: "pointer",
                    textAlign: "center",
                    transition: "all 0.15s",
                  }}
                >
                  <i
                    className={`ti ${r.icon}`}
                    style={{ fontSize: 22, color: active ? "#2563eb" : "#9ca3af", display: "block", marginBottom: 6 }}
                    aria-hidden="true"
                  />
                  <p style={{ fontSize: 13, fontWeight: 500, margin: 0, color: active ? "#1d4ed8" : "#374151" }}>
                    {r.label}
                  </p>
                </button>
              );
            })}
          </div>

          {error && (
            <div style={S.error}>
              <span style={{ fontSize: 16 }}>⚠</span> {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            {/* Name + Email row */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
              <div>
                <label style={S.label}>Full name</label>
                <div style={S.inputWrap}>
                  <i className="ti ti-user" style={S.iconStyle} aria-hidden="true" />
                  <input
                    name="full_name"
                    required
                    placeholder="Ravi Kumar"
                    value={form.full_name}
                    onChange={handleChange}
                    style={S.inputWithIcon}
                    onFocus={focusStyle}
                    onBlur={blurStyle}
                  />
                </div>
              </div>
              <div>
                <label style={S.label}>Email address</label>
                <div style={S.inputWrap}>
                  <i className="ti ti-mail" style={S.iconStyle} aria-hidden="true" />
                  <input
                    name="email"
                    type="email"
                    required
                    placeholder="you@example.com"
                    value={form.email}
                    onChange={handleChange}
                    style={S.inputWithIcon}
                    onFocus={focusStyle}
                    onBlur={blurStyle}
                  />
                </div>
              </div>
            </div>

            {/* Password */}
            <label style={S.label}>Password</label>
            <div style={{ ...S.inputWrap, marginBottom: 20 }}>
              <i className="ti ti-lock" style={S.iconStyle} aria-hidden="true" />
              <input
                name="password"
                type={showPass ? "text" : "password"}
                required
                placeholder="Min. 8 characters"
                value={form.password}
                onChange={handleChange}
                style={{ ...S.inputWithIcon, paddingRight: 40 }}
                onFocus={focusStyle}
                onBlur={blurStyle}
              />
              <button
                type="button"
                onClick={() => setShowPass(!showPass)}
                style={{
                  position: "absolute", right: 12, top: "50%",
                  transform: "translateY(-50%)", background: "none",
                  border: "none", cursor: "pointer",
                  color: "#9ca3af", fontSize: 16, padding: 0,
                }}
                aria-label={showPass ? "Hide password" : "Show password"}
              >
                <i className={`ti ${showPass ? "ti-eye-off" : "ti-eye"}`} />
              </button>
            </div>

            {/* Password strength bar */}
            {form.password.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ display: "flex", gap: 4, marginBottom: 4 }}>
                  {[1, 2, 3, 4].map((i) => {
                    const strength = Math.min(Math.floor(form.password.length / 3), 4);
                    const colors = ["#ef4444", "#f97316", "#eab308", "#22c55e"];
                    return (
                      <div
                        key={i}
                        style={{
                          flex: 1, height: 3, borderRadius: 2,
                          background: i <= strength ? colors[strength - 1] : "#e5e7eb",
                          transition: "background 0.2s",
                        }}
                      />
                    );
                  })}
                </div>
                <p style={{ fontSize: 11, color: "#9ca3af", margin: 0 }}>
                  {form.password.length < 4 ? "Weak password"
                    : form.password.length < 8 ? "Fair — needs 8+ characters"
                    : form.password.length < 12 ? "Good password"
                    : "Strong password"}
                </p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                ...S.btn,
                background: loading ? "#93c5fd" : "#2563eb",
                cursor: loading ? "not-allowed" : "pointer",
              }}
            >
              {loading ? "Creating account..." : "Create account"}
            </button>
          </form>

          <p style={S.footer}>
            Already have an account?{" "}
            <Link to="/login" style={{ color: "#2563eb", textDecoration: "none", fontWeight: 500 }}>
              Sign in
            </Link>
          </p>
        </div>

      </div>
    </div>
  );
}