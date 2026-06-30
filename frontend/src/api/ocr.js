import API from "./client";

export const uploadAnswerSheet  = (examId, formData) =>
  API.post(`/ocr/upload/${examId}`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
    onUploadProgress: (e) => {
      if (e.total) console.log(`Upload: ${Math.round((e.loaded / e.total) * 100)}%`);
    },
  });

export const getOCRSubmission   = (ocrSubmissionId) =>
  API.get(`/ocr/submission/${ocrSubmissionId}`);

export const getOCRReviews      = () =>
  API.get("/ocr/reviews");

export const correctExtraction  = (ocrSubmissionId, data) =>
  API.patch(`/ocr/correct/${ocrSubmissionId}`, data);
