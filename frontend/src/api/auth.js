import API from "./client";

export const registerUser  = (data) => API.post("/auth/register", data);
export const loginUser     = (data) => API.post("/auth/login", data);
export const getMe         = ()     => API.get("/auth/me");
export const updateMySettings = (data) => API.patch("/auth/me/settings", data);
export const uploadMyProfilePhoto = (file) => {
  const formData = new FormData();
  formData.append("file", file);
  return API.post("/auth/me/photo", formData);
};
