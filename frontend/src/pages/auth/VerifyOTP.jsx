import { useState, useEffect } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import { verifyOTP, resendOTP } from "../../api/auth";

const BLUE = "#4361ee";

export default function VerifyOTP() {
  const { state }  = useLocation();
  const navigate   = useNavigate();
  const [otp, setOtp]           = useState("");
  const [error, setError]       = useState("");
  const [success, setSuccess]   = useState(false);
  const [resendMsg, setResendMsg] = useState("");
  const [countdown, setCountdown] = useState(60);
  const [canResend, setCanResend] = useState(false);
  const [loading, setLoading]   = useState(false);

  useEffect(() => {
    if (countdown <= 0) { setCanResend(true); return; }
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (otp.length !== 6) { setError("Please enter the 6-digit code"); return; }
    setLoading(true); setError("");
    try {
      await verifyOTP({ user_id: state.user_id, otp });
      setSuccess(true);
      setTimeout(() => navigate("/login"), 2500);
    } catch (err) {
      setError(err.response?.data?.detail || "Invalid code. Try again.");
    } finally { setLoading(false); }
  };

  const handleResend = async () => {
    setResendMsg(""); setError("");
    try {
      await resendOTP({ email: state.email });
      setResendMsg("New code sent! Check your inbox.");
      setCanResend(false); setCountdown(60);
    } catch { setError("Could not resend. Try again."); }
  };

  return (
    <div style={css.page}>
      <div style={css.card} className="auth-card-inner">

        {/* ── Left blue panel ── */}
        <div style={css.left}>
          <Link to="/register" style={css.backLink}>&#8592; Back</Link>
          <div style={css.leftCenter}>
            <div style={css.mailIcon}>
              <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                <rect width="48" height="48" rx="24" fill="rgba(255,255,255,0.15)"/>
                <path d="M10 16h28v18H10V16z" stroke="#fff" strokeWidth="2" fill="none"/>
                <path d="M10 16l14 11 14-11" stroke="#fff" strokeWidth="2"/>
              </svg>
            </div>
            <h1 style={css.bigHeading}>Check<br />Your<br />Email</h1>
            <p style={css.leftSub}>
              We sent a 6-digit code to<br />
              <strong style={{ color: "#fff" }}>{state?.email}</strong>
            </p>
          </div>
          <div style={css.dots}>
            <span style={css.dot} />
            <span style={{ ...css.dot, background: "#fff" }} />
            <span style={css.dot} />
          </div>
        </div>

        {/* ── Right form panel ── */}
        <div style={css.right}>
          <div style={css.avatarWrap}>
            <div style={css.avatar}>
              <svg width="40" height="40" viewBox="0 0 48 48" fill="none">
                <path d="M8 14h32v24H8V14z" fill={BLUE} opacity="0.15"/>
                <path d="M8 14h32v24H8V14z" stroke={BLUE} strokeWidth="2.5" fill="none"/>
                <path d="M8 14l16 13 16-13" stroke={BLUE} strokeWidth="2.5"/>
              </svg>
            </div>
          </div>

          <h2 style={css.formTitle}>Enter verification code</h2>
          <p style={css.formSub}>
            The code expires in 10 minutes
          </p>

          {error && <div style={css.errorBox}>{error}</div>}
          {resendMsg && <div style={css.successBox}>{resendMsg}</div>}

          {success ? (
            <div style={css.successBox}>
              ✓ Email verified! Redirecting to login...
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ width: "100%" }}>
              {/* OTP input */}
              <div style={css.field}>
                <span style={css.fieldIcon}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#aaa" strokeWidth="2">
                    <rect x="3" y="11" width="18" height="11" rx="2"/>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                  </svg>
                </span>
                <input
                  maxLength={6}
                  placeholder="6-digit code"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                  style={{
                    ...css.input,
                    fontSize: 22,
                    letterSpacing: 10,
                    textAlign: "center",
                    fontWeight: 600,
                    color: BLUE,
                    paddingLeft: 8,
                  }}
                />
              </div>

              <button type="submit" disabled={loading} style={css.submitBtn}>
                {loading ? "Verifying..." : "Verify email"}
              </button>
            </form>
          )}

          <p style={css.resendRow}>
            Didn't receive it?{" "}
            {canResend
              ? <button onClick={handleResend} style={css.resendBtn}>Resend code</button>
              : <span style={{ color: "#aaa" }}>Resend in {countdown}s</span>
            }
          </p>
        </div>

      </div>
    </div>
  );
}

const css = {
  page: {
    minHeight: "100vh",
    display: "flex", alignItems: "center", justifyContent: "center",
    background: "#f0f2ff", padding: "16px", boxSizing: "border-box",
  },
  card: {
    display: "flex", flexDirection: "row",
    width: "100%", maxWidth: 820,
    borderRadius: 20, overflow: "hidden",
    boxShadow: "0 8px 40px rgba(67,97,238,0.13)",
  },
  left: {
    flex: "0 0 40%", background: BLUE,
    padding: "36px 32px",
    display: "flex", flexDirection: "column",
    justifyContent: "space-between", minHeight: 480,
    "@media (max-width: 600px)": {},
  },
  backLink: { color: "rgba(255,255,255,0.75)", fontSize: 13, textDecoration: "none" },
  mailIcon: { marginBottom: 20, display: "flex", justifyContent: "center" },
  leftCenter: { textAlign: "center" },
  bigHeading: {
    fontSize: "clamp(26px, 4vw, 38px)", fontWeight: 700,
    color: "#fff", lineHeight: 1.2, margin: "0 0 16px",
  },
  leftSub: { color: "rgba(255,255,255,0.8)", fontSize: 13, margin: 0, lineHeight: 1.6 },
  dots: { display: "flex", gap: 8, justifyContent: "center" },
  dot: {
    width: 10, height: 10, borderRadius: "50%",
    border: "2px solid rgba(255,255,255,0.6)", display: "inline-block",
  },
  right: {
    flex: 1, background: "#fff",
    padding: "40px 40px",
    display: "flex", flexDirection: "column",
    alignItems: "center", justifyContent: "center",
  },
  avatarWrap: { marginBottom: 12 },
  avatar: {
    width: 80, height: 80, borderRadius: "50%",
    background: "#eef0fd",
    display: "flex", alignItems: "center", justifyContent: "center",
  },
  formTitle: { fontSize: 22, fontWeight: 700, color: BLUE, margin: "0 0 6px", textAlign: "center" },
  formSub: { fontSize: 13, color: "#999", margin: "0 0 24px", textAlign: "center" },
  errorBox: {
    width: "100%", background: "#fff0f0",
    border: "1px solid #ffc0c0", borderRadius: 8,
    padding: "10px 14px", fontSize: 13, color: "#c0392b",
    marginBottom: 14, boxSizing: "border-box",
  },
  successBox: {
    width: "100%", background: "#f0fff4",
    border: "1px solid #b7f5c8", borderRadius: 8,
    padding: "10px 14px", fontSize: 13, color: "#27ae60",
    marginBottom: 14, boxSizing: "border-box", textAlign: "center",
  },
  field: { position: "relative", marginBottom: 24, width: "100%" },
  fieldIcon: {
    position: "absolute", left: 0, top: "50%",
    transform: "translateY(-50%)", display: "flex", alignItems: "center",
  },
  input: {
    width: "100%", padding: "10px 8px 10px 28px",
    border: "none", borderBottom: "1.5px solid #ddd",
    fontSize: 14, outline: "none",
    background: "transparent", color: "#222",
    boxSizing: "border-box",
  },
  submitBtn: {
    width: "100%", padding: "13px",
    background: BLUE, color: "#fff",
    border: "none", borderRadius: 50,
    fontSize: 15, fontWeight: 600,
    cursor: "pointer", letterSpacing: 0.3,
  },
  resendRow: { fontSize: 13, color: "#888", marginTop: 18, textAlign: "center" },
  resendBtn: {
    background: "none", border: "none",
    color: BLUE, fontWeight: 500,
    fontSize: 13, cursor: "pointer", padding: 0,
  },
};