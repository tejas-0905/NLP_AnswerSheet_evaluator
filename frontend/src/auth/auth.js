import axios from "axios";

const API = axios.create({ baseURL: "http://localhost:8000" });

// Auto-attach token to every request
API.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export const registerUser  = (data) => API.post("/auth/register", data);
export const verifyOTP     = (data) => API.post("/auth/verify-otp", data);
export const loginUser     = (data) => API.post("/auth/login", data);
export const getMe         = ()     => API.get("/auth/me");