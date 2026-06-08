import axios from "axios";
const API = axios.create({ baseURL: "http://localhost:8000" });
API.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export const uploadAnswerSheet  = (examId, formData) =>
  API.post(`/ocr/upload/${examId}`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
    onUploadProgress: (e) => {
      if (e.total) console.log(`Upload: ${Math.round((e.loaded / e.total) * 100)}%`);
    },
  });

export const getOCRSubmission   = (ocrSubmissionId) =>
  API.get(`/ocr/submission/${ocrSubmissionId}`);

export const correctExtraction  = (ocrSubmissionId, data) =>
  API.patch(`/ocr/correct/${ocrSubmissionId}`, data);