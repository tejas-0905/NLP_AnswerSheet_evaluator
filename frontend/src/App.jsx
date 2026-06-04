import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext.jsx";
import { useAuth } from "./context/useAuth";
import Register from "./pages/Register";
import VerifyOTP from "./pages/VerifyOTP";
import Login from "./pages/Login";

function ProtectedRoute({ children, role }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" />;
  if (role && user.role !== role) return <Navigate to="/login" />;
  return children;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/register"   element={<Register />} />
      <Route path="/verify-otp" element={<VerifyOTP />} />
      <Route path="/login"      element={<Login />} />
      <Route path="/teacher"    element={
        <ProtectedRoute role="teacher">
          <h2 style={{ textAlign: "center", marginTop: 80 }}>Teacher Dashboard (coming soon)</h2>
        </ProtectedRoute>
      } />
      <Route path="/student"    element={
        <ProtectedRoute role="student">
          <h2 style={{ textAlign: "center", marginTop: 80 }}>Student Dashboard (coming soon)</h2>
        </ProtectedRoute>
      } />
      <Route path="*" element={<Navigate to="/login" />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
