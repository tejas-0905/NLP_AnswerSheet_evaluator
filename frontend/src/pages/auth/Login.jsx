import { useState } from "react";
import { Link } from "react-router-dom";
import { loginUser } from "../../api/auth";
import { useAuth } from "../../context/useAuth";

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
    padding: "48px 40px",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
  },
  logo: { fontSize: 20, fontWeight: 600, color: "#fff", margin: "0 0 6px" },
  logoSub: { fontSize: 13, color: "#93c5fd", margin: "0 0 40px" },
  featureItem: { display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 20 },
  featureDot: {
    width: 8, height: 8, borderRadius: "50%",
    background: "#60a5fa", marginTop: 5, flexShrink: 0,
  },
  featureTitle: { fontSize: 13, fontWeight: 500, color: "#e0f2fe", margin: "0 0 2px" },
  featureSub: { fontSize: 12, color: "#7dd3fc", margin: 0 },
  copyright: { fontSize: 11, color: "#334155", margin: 0 },
  heading: { fontSize: 22, fontWeight: 600, color: "#0f172a", margin: "0 0 4px" },
  subheading: { fontSize: 14, color: "#64748b", margin: "0 0 28px" },
  label: { fontSize: 13, fontWeight: 500, color: "#374151", display: "block", marginBottom: 6 },
  inputWrap: { position: "relative", marginBottom: 16 },
  iconStyle: {
    position: "absolute", left: 12, top: "50%",
    transform: "translateY(-50%)", color: "#9ca3af", fontSize: 16,
    pointerEvents: "none",
  },
  input: {
    width: "100%", padding: "10px 12px 10px 38px",
    border: "1px solid #e2e8f0", borderRadius: 8,
    fontSize: 14, outline: "none", boxSizing: "border-box",
    color: "#0f172a", background: "#fff",
    transition: "border-color 0.15s",
  },
  btn: {
    width: "100%", padding: "11px",
    background: "#2563eb", color: "#fff",
    border: "none", borderRadius: 8,
    fontSize: 14, fontWeight: 500,
    cursor: "pointer", marginTop: 4,
    transition: "background 0.15s",
  },
  error: {
    background: "#fef2f2", border: "1px solid #fecaca",
    borderRadius: 8, padding: "10px 14px",
    fontSize: 13, color: "#dc2626", marginBottom: 16,
    display: "flex", alignItems: "center", gap: 8,
  },
  footer: { fontSize: 13, color: "#64748b", textAlign: "center", marginTop: 20 },
};

const features = [
  { title: "Smart evaluation", sub: "NLP-based concept-level grading" },
  { title: "Instant feedback", sub: "Missing concepts and suggestions" },
  { title: "Class analytics", sub: "Leaderboard, charts and reports" },
];

export default function Login() {
  const { saveUser } = useAuth();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await loginUser(form);
      saveUser(res.data);
    } catch (err) {
      setError(err.response?.data?.detail || "Invalid email or password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={S.page}>
      <div style={S.card}>

        {/* Left panel */}
        <div style={S.left}>
          <div>
            <p style={S.logo}>EduEvaluator</p>
            <p style={S.logoSub}>AI-powered answer evaluation</p>
            {features.map((f) => (
              <div key={f.title} style={S.featureItem}>
                <div style={S.featureDot} />
                <div>
                  <p style={S.featureTitle}>{f.title}</p>
                  <p style={S.featureSub}>{f.sub}</p>
                </div>
              </div>
            ))}
          </div>
          <p style={S.copyright}>© 2024 EduEvaluator</p>
        </div>

        {/* Right panel */}
        <div style={S.right}>
          <p style={S.heading}>Welcome back</p>
          <p style={S.subheading}>Sign in to your account to continue</p>

          {error && (
            <div style={S.error}>
              <span style={{ fontSize: 16 }}>⚠</span> {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            {/* Email */}
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
                style={S.input}
                onFocus={(e) => (e.target.style.borderColor = "#2563eb")}
                onBlur={(e) => (e.target.style.borderColor = "#e2e8f0")}
              />
            </div>

            {/* Password */}
            <label style={S.label}>Password</label>
            <div style={{ ...S.inputWrap, marginBottom: 24 }}>
              <i className="ti ti-lock" style={S.iconStyle} aria-hidden="true" />
              <input
                name="password"
                type={showPass ? "text" : "password"}
                required
                placeholder="Enter your password"
                value={form.password}
                onChange={handleChange}
                style={{ ...S.input, paddingRight: 40 }}
                onFocus={(e) => (e.target.style.borderColor = "#2563eb")}
                onBlur={(e) => (e.target.style.borderColor = "#e2e8f0")}
              />
              <button
                type="button"
                onClick={() => setShowPass(!showPass)}
                style={{
                  position: "absolute", right: 12, top: "50%",
                  transform: "translateY(-50%)", background: "none",
                  border: "none", cursor: "pointer", color: "#9ca3af",
                  fontSize: 16, padding: 0,
                }}
                aria-label={showPass ? "Hide password" : "Show password"}
              >
                <i className={`ti ${showPass ? "ti-eye-off" : "ti-eye"}`} />
              </button>
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                ...S.btn,
                background: loading ? "#93c5fd" : "#2563eb",
                cursor: loading ? "not-allowed" : "pointer",
              }}
            >
              {loading ? "Signing in..." : "Sign in"}
            </button>
          </form>

          <p style={S.footer}>
            Don't have an account?{" "}
            <Link to="/register" style={{ color: "#2563eb", textDecoration: "none", fontWeight: 500 }}>
              Create one
            </Link>
          </p>
        </div>

      </div>
    </div>
  );
}
