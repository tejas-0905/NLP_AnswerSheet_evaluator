import API from "./client";

export const getNotes = (classroomId) =>
  API.get("/notes/", { params: classroomId ? { classroom_id: classroomId } : {} });

export const uploadNote = (data) =>
  API.post("/notes/", data, {
    headers: { "Content-Type": "multipart/form-data" },
  });

export const deleteNote = (id) => API.delete(`/notes/${id}`);

export const downloadNote = (id) =>
  API.get(`/notes/${id}/download`, { responseType: "blob" });
