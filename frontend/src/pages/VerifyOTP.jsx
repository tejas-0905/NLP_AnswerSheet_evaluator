import { useState } from "react";
import { verifyOTP } from "../auth/auth";
import { useLocation, useNavigate } from "react-router-dom";

export default function VerifyOTP() {
  const { state } = useLocation();
  const navigate = useNavigate();
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!state?.user_id) {
      setError("Please register first so we can verify your OTP.");
      return;
    }

    try {
      await verifyOTP({ user_id: state.user_id, otp });
      setSuccess(true);
      setTimeout(() => navigate("/login"), 2000);
    } catch (err) {
      setError(err.response?.data?.detail || "Verification failed");
    }
  };

  return (
    <div style={{ maxWidth: 360, margin: "80px auto", padding: "0 16px" }}>
      <h2>Verify your email</h2>
      <p style={{ color: "#555" }}>
        We sent a 6-digit code to <strong>{state?.email || "your email"}</strong>
      </p>
      {success ? (
        <p style={{ color: "green" }}>Verified! Redirecting to login...</p>
      ) : (
        <form onSubmit={handleSubmit}>
          <input
            maxLength={6}
            placeholder="Enter 6-digit OTP"
            value={otp}
            onChange={(e) => setOtp(e.target.value)}
            style={{
              width: "100%",
              padding: 10,
              fontSize: 20,
              textAlign: "center",
              letterSpacing: 8,
              marginBottom: 12,
            }}
          />
          {error && <p style={{ color: "red" }}>{error}</p>}
          <button
            type="submit"
            style={{
              width: "100%",
              padding: 10,
              background: "#2563eb",
              color: "#fff",
              border: "none",
              borderRadius: 6,
              cursor: "pointer",
            }}
          >
            Verify
          </button>
        </form>
      )}
    </div>
  );
}
