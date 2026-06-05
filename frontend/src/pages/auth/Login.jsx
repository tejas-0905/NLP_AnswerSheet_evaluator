import { useState } from "react";
import { loginUser } from "../../api/auth";
import { useAuth } from "../../context/useAuth";
import { Link } from "react-router-dom";

export default function Login() {
  const { saveUser } = useAuth();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await loginUser(form);
      saveUser(res.data);  // stores token, redirects by role
    } catch (err) {
      setError(err.response?.data?.detail || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 400, margin: "80px auto", padding: "0 16px" }}>
      <h2>Login</h2>
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: 12 }}>
          <label>Email</label><br />
          <input name="email" type="email" required onChange={handleChange}
            style={{ width: "100%", padding: 8, marginTop: 4 }} />
        </div>
        <div style={{ marginBottom: 16 }}>
          <label>Password</label><br />
          <input name="password" type="password" required onChange={handleChange}
            style={{ width: "100%", padding: 8, marginTop: 4 }} />
        </div>
        {error && <p style={{ color: "red" }}>{error}</p>}
        <button type="submit" disabled={loading}
          style={{ width: "100%", padding: 10, background: "#2563eb", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer" }}>
          {loading ? "Logging in..." : "Login"}
        </button>
      </form>
      <p style={{ marginTop: 16, textAlign: "center" }}>
        No account? <Link to="/register">Register</Link>
      </p>
    </div>
  );
}
