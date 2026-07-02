import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "./auth-context";

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const token = localStorage.getItem("token");
    const role = localStorage.getItem("role");
    const name = localStorage.getItem("name");
    const profile_photo_url = localStorage.getItem("profile_photo_url");
    return token ? { token, role, name, profile_photo_url } : null;
  });

  const navigate = useNavigate();

  const saveUser = (data) => {
    localStorage.setItem("token", data.access_token);
    localStorage.setItem("role", data.role);
    localStorage.setItem("name", data.name);
    if (data.profile_photo_url) {
      localStorage.setItem("profile_photo_url", data.profile_photo_url);
    }
    setUser({ token: data.access_token, role: data.role, name: data.name, profile_photo_url: data.profile_photo_url });
    if (data.role === "teacher") navigate("/teacher");
    else navigate("/student");
  };

  const updateUser = (patch) => {
    const next = {
      ...user,
      ...patch,
      name: patch.name || patch.full_name || user?.name,
    };
    if (next.name) localStorage.setItem("name", next.name);
    if (next.profile_photo_url) {
      localStorage.setItem("profile_photo_url", next.profile_photo_url);
    }
    setUser(next);
  };

  const logout = () => {
    localStorage.clear();
    setUser(null);
    navigate("/login");
  };

  useEffect(() => {
    const handleAuthLogout = () => {
      setUser(null);
      navigate("/login");
    };

    window.addEventListener("auth:logout", handleAuthLogout);
    return () => window.removeEventListener("auth:logout", handleAuthLogout);
  }, [navigate]);

  return (
    <AuthContext.Provider value={{ user, saveUser, updateUser, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

