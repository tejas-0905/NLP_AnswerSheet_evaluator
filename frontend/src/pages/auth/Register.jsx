import { useState } from "react";
import { Link } from "react-router-dom";
import { registerUser } from "../../api/auth";
import { useAuth } from "../../context/useAuth";

const BLUE = "#4361ee";

export default function Register() {
  const { saveUser } = useAuth();
  const [role, setRole]     = useState("student");
  const [form, setForm]     = useState({ full_name: "", email: "", password: "" });
  const [agreed, setAgreed] = useState(false);
  const [error, setError]   = useState("");
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!agreed) { setError("Please accept the terms to continue"); return; }
    if (form.password.length < 8) { setError("Password must be at least 8 characters"); return; }
    setError(""); setLoading(true);
    try {
      const res = await registerUser({ ...form, role });
      saveUser(res.data);
    } catch (err) {
      const detail = err.response?.data?.detail;
      const message = Array.isArray(detail)
        ? detail.map((item) => item.msg || item.message || String(item)).join(", ")
        : detail;
      setError(message || err.message || "Registration failed. Try again.");
    } finally { setLoading(false); }
  };

  return (
    <div style={css.page} className="auth-page">
      <div style={css.card} className="auth-card-inner">

        {/* ── Left blue panel ── */}
        <div style={css.left} className="auth-left-panel">
          <Link to="/" style={css.backLink}>&#8592; Home page</Link>

          <div style={css.leftCenter}>
            <h1 style={css.bigHeading}>Get<br />Started</h1>
            <p style={css.leftSub}>Already have an account?</p>
            <Link to="/login" style={css.outlineBtn}>Log in</Link>
          </div>

          {/* Role toggle pills */}
          <div>
            <div style={css.rolePills}>
              {["teacher", "student"].map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRole(r)}
                  style={{
                    ...css.rolePill,
                    background: role === r ? "#fff" : "transparent",
                    color: role === r ? BLUE : "rgba(255,255,255,0.8)",
                    fontWeight: role === r ? 600 : 400,
                  }}
                >
                  {r === "teacher" ? "Teacher" : "Student"}
                </button>
              ))}
            </div>
            <div style={css.dots}>
              <span style={{ ...css.dot, background: "#fff" }} />
              <span style={css.dot} />
              <span style={css.dot} />
            </div>
          </div>
        </div>

        {/* ── Right form panel ── */}
        <div style={css.right} className="auth-form-panel">
          <div style={css.avatarWrap}>
            <div style={css.avatar}>
              <svg width="44" height="44" viewBox="0 0 44 44" fill="none">
                <circle cx="22" cy="16" r="9" fill={BLUE} />
                <ellipse cx="22" cy="36" rx="14" ry="9" fill={BLUE} />
              </svg>
            </div>
          </div>

          <h2 style={css.formTitle}>Create account</h2>

          {error && <div style={css.errorBox}>{error}</div>}

          <form onSubmit={handleSubmit} style={{ width: "100%" }} className="auth-form" autoComplete="off">

            {/* Full name */}
            <div style={css.field}>
              <span style={css.fieldIconInline}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#aaa" strokeWidth="2">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                  <circle cx="12" cy="7" r="4"/>
                </svg>
              </span>
              {!form.full_name && <span style={css.placeholderText}>Full name</span>}
              <input
                name="full_name" required
                placeholder=""
                value={form.full_name} onChange={handleChange}
                style={css.inputInline}
              />
            </div>

            {/* Email */}
            <div style={css.field}>
              <span style={css.fieldIconInline}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#aaa" strokeWidth="2">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                  <polyline points="22,6 12,13 2,6"/>
                </svg>
              </span>
              {!form.email && <span style={css.placeholderText}>E-mail</span>}
              <input
                name="contact"
                type="text"
                required
                autoComplete="new-password"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck="false"
                data-lpignore="true"
                data-form-type="other"
                placeholder=""
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                style={{ ...css.inputInline, paddingRight: 68 }}
              />
            </div>

            {/* Password */}
            <div style={css.field}>
              <span style={css.fieldIconInline}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#aaa" strokeWidth="2">
                  <rect x="3" y="11" width="18" height="11" rx="2"/>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
              </span>
              {!form.password && <span style={css.placeholderText}>Password</span>}
              <input
                name="password"
                type={showPass ? "text" : "password"}
                required
                placeholder=""
                value={form.password} onChange={handleChange}
                style={{ ...css.inputInline, paddingRight: 36 }}
              />
              <button
                type="button"
                onClick={() => setShowPass(!showPass)}
                style={css.eyeBtn}
                aria-label={showPass ? "Hide password" : "Show password"}
              >
                {showPass
                  ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#aaa" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                  : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#aaa" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                }
              </button>
            </div>

            {/* Terms */}
            <label style={css.termsRow}>
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                style={{ accentColor: BLUE, width: 15, height: 15, cursor: "pointer" }}
              />
              <span style={{ fontSize: 13, color: "#666" }}>
                I accept the{" "}
                <span style={{ color: BLUE, fontWeight: 500 }}>terms of the agreement</span>
              </span>
            </label>

            <button type="submit" disabled={loading} style={css.submitBtn}>
              {loading ? "Creating account..." : "Sign up"}
            </button>
          </form>

          <p style={css.switchText}>
            Already have an account?{" "}
            <Link to="/login" style={css.switchLink}>Log in</Link>
          </p>
        </div>

      </div>
    </div>
  );
}

const css = {
  page: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#f0f2ff",
    padding: "16px",
    boxSizing: "border-box",
  },
  card: {
    display: "flex",
    flexDirection: "row",
    width: "100%",
    maxWidth: 820,
    borderRadius: 20,
    overflow: "hidden",
    boxShadow: "0 8px 40px rgba(67,97,238,0.13)",
  },
  left: {
    flex: "0 0 40%",
    background: BLUE,
    padding: "36px 32px",
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
    minHeight: 520,
    "@media (max-width: 600px)": {},
  },
  backLink: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 13,
    textDecoration: "none",
  },
  leftCenter: { textAlign: "center" },
  bigHeading: {
    fontSize: "clamp(28px, 5vw, 42px)",
    fontWeight: 700,
    color: "#fff",
    lineHeight: 1.15,
    margin: "0 0 16px",
  },
  leftSub: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 14,
    margin: "0 0 20px",
  },
  outlineBtn: {
    display: "inline-block",
    border: "2px solid rgba(255,255,255,0.7)",
    borderRadius: 50,
    color: "#fff",
    padding: "10px 36px",
    fontSize: 14,
    textDecoration: "none",
    fontWeight: 500,
  },
  rolePills: {
    display: "flex",
    background: "rgba(255,255,255,0.15)",
    borderRadius: 50,
    padding: 4,
    marginBottom: 20,
    gap: 4,
  },
  rolePill: {
    flex: 1,
    padding: "8px 0",
    borderRadius: 50,
    border: "none",
    fontSize: 13,
    cursor: "pointer",
    transition: "all 0.2s",
  },
  dots: { display: "flex", gap: 8, justifyContent: "center" },
  dot: {
    width: 10, height: 10,
    borderRadius: "50%",
    border: "2px solid rgba(255,255,255,0.6)",
    display: "inline-block",
  },
  right: {
    flex: 1,
    background: "#fff",
    padding: "36px 40px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarWrap: { marginBottom: 10 },
  avatar: {
    width: 80, height: 80,
    borderRadius: "50%",
    background: "#eef0fd",
    display: "flex", alignItems: "center", justifyContent: "center",
  },
  formTitle: {
    fontSize: 22,
    fontWeight: 700,
    color: BLUE,
    margin: "0 0 20px",
    textAlign: "center",
  },
  errorBox: {
    width: "100%",
    background: "#fff0f0",
    border: "1px solid #ffc0c0",
    borderRadius: 8,
    padding: "10px 14px",
    fontSize: 13,
    color: "#c0392b",
    marginBottom: 14,
    boxSizing: "border-box",
  },
  field: {
    position: "relative",
    marginBottom: 20,
    width: "100%",
    minHeight: 44,
    display: "flex",
    alignItems: "center",
    gap: 12,
    borderBottom: "1.5px solid #ddd",
    boxSizing: "border-box",
  },
  fieldIconInline: {
    width: 22,
    height: 22,
    flex: "0 0 22px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  inputInline: {
    flex: 1,
    minWidth: 0,
    position: "relative",
    zIndex: 1,
    width: "100%",
    height: 42,
    padding: "0 8px 0 0",
    border: "none",
    fontSize: 15,
    lineHeight: "42px",
    outline: "none",
    background: "transparent",
    color: "#222",
    boxSizing: "border-box",
    appearance: "none",
  },
  placeholderText: {
    position: "absolute",
    left: 34,
    top: "50%",
    transform: "translateY(-50%)",
    zIndex: 0,
    color: "#6f7178",
    fontSize: 15,
    lineHeight: "42px",
    pointerEvents: "none",
  },
  eyeBtn: {
    flex: "0 0 24px",
    background: "none", border: "none",
    cursor: "pointer", padding: 0,
    display: "flex", alignItems: "center",
    justifyContent: "center",
  },
  termsRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    marginBottom: 20,
    cursor: "pointer",
  },
  submitBtn: {
    width: "100%",
    padding: "13px",
    background: BLUE,
    color: "#fff",
    border: "none",
    borderRadius: 50,
    fontSize: 15,
    fontWeight: 600,
    cursor: "pointer",
    letterSpacing: 0.3,
  },
  switchText: {
    fontSize: 13,
    color: "#888",
    marginTop: 18,
    textAlign: "center",
  },
  switchLink: {
    color: BLUE,
    fontWeight: 500,
    textDecoration: "none",
  },
};
