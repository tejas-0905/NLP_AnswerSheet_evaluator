import API from "./client";

export const registerUser  = (data) => API.post("/auth/register", data);
export const verifyOTP     = (data) => API.post("/auth/verify-otp", data);
export const loginUser     = (data) => API.post("/auth/login", data);
export const getMe         = ()     => API.get("/auth/me");
export const resendOTP = (data) => API.post("/auth/resend-otp", data);