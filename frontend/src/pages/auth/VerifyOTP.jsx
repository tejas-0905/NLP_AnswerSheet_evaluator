import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { verifyOTP, resendOTP } from "../../api/auth";

export default function VerifyOTP() {
  const { state } = useLocation();
  const navigate = useNavigate();
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [resendMsg, setResendMsg] = useState("");
  const [countdown, setCountdown] = useState(60);
  const [loading, setLoading] = useState(false);
  const canResend = countdown <= 0;

  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (otp.length !== 6) { setError("Please enter the 6-digit code"); return; }
    setLoading(true);
    setError("");
    try {
      await verifyOTP({ user_id: state.user_id, otp });
      setSuccess(true);
      setTimeout(() => navigate("/login"), 2500);
    } catch (err) {
      setError(err.response?.data?.detail || "Invalid OTP. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResendMsg(""); setError("");
    try {
      await resendOTP({ email: state.email });
      setResendMsg("New code sent. Check your inbox.");
      setCountdown(60);
    } catch {
      setError("Could not resend. Try again.");
    }
  };

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center",
      justifyContent: "center", background: "#f1f5f9", padding: 20,
    }}>
      <div style={{
        background: "#fff", borderRadius: 16, border: "1px solid #e2e8f0",
        padding: "48px 40px", width: "100%", maxWidth: 420, textAlign: "center",
      }}>
        {/* Icon */}
        <div style={{
          width: 56, height: 56, borderRadius: "50%",
          background: "#eff6ff", display: "flex",
          alignItems: "center", justifyContent: "center",
          margin: "0 auto 20px",
        }}>
          <i className="ti ti-mail" style={{ fontSize: 24, color: "#2563eb" }} aria-hidden="true" />
        </div>

        <p style={{ fontSize: 20, fontWeight: 600, color: "#0f172a", margin: "0 0 6px" }}>
          Check your email
        </p>
        <p style={{ fontSize: 14, color: "#64748b", margin: "0 0 28px" }}>
          We sent a 6-digit code to<br />
          <strong style={{ color: "#0f172a" }}>{state?.email}</strong>
        </p>

        {success ? (
          <div style={{
            background: "#f0fdf4", border: "1px solid #bbf7d0",
            borderRadius: 10, padding: "16px",
            color: "#16a34a", fontSize: 14, fontWeight: 500,
          }}>
            ✓ Email verified! Redirecting to login...
          </div>
        ) : (
          <>
            {error && (
              <div style={{
                background: "#fef2f2", border: "1px solid #fecaca",
                borderRadius: 8, padding: "10px 14px",
                fontSize: 13, color: "#dc2626", marginBottom: 16,
              }}>
                {error}
              </div>
            )}
            {resendMsg && (
              <div style={{
                background: "#f0fdf4", border: "1px solid #bbf7d0",
                borderRadius: 8, padding: "10px 14px",
                fontSize: 13, color: "#16a34a", marginBottom: 16,
              }}>
                {resendMsg}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <input
                maxLength={6}
                placeholder="000000"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                style={{
                  width: "100%", padding: "14px 0",
                  fontSize: 32, textAlign: "center",
                  letterSpacing: 14, border: "2px solid #e2e8f0",
                  borderRadius: 10, marginBottom: 16,
                  boxSizing: "border-box", outline: "none",
                  color: "#0f172a", fontWeight: 600,
                }}
                onFocus={(e) => (e.target.style.borderColor = "#2563eb")}
                onBlur={(e) => (e.target.style.borderColor = "#e2e8f0")}
              />

              <button
                type="submit"
                disabled={loading}
                style={{
                  width: "100%", padding: "11px",
                  background: loading ? "#93c5fd" : "#2563eb",
                  color: "#fff", border: "none", borderRadius: 8,
                  fontSize: 14, fontWeight: 500,
                  cursor: loading ? "not-allowed" : "pointer",
                  marginBottom: 16,
                }}
              >
                {loading ? "Verifying..." : "Verify email"}
              </button>
            </form>

            <p style={{ fontSize: 13, color: "#64748b" }}>
              Didn't receive the code?{" "}
              {canResend ? (
                <button
                  onClick={handleResend}
                  style={{
                    background: "none", border: "none",
                    color: "#2563eb", cursor: "pointer",
                    fontSize: 13, fontWeight: 500, padding: 0,
                  }}
                >
                  Resend code
                </button>
              ) : (
                <span style={{ color: "#9ca3af" }}>Resend in {countdown}s</span>
              )}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
