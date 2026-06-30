import API from "./client";

export const createExam         = (data)          => API.post("/exams/", data);
export const getExamsForClass   = (classroomId)   => API.get(`/exams/classroom/${classroomId}`);
export const getExamDetail      = (examId)        => API.get(`/exams/${examId}`);
export const toggleExam         = (examId, data)  => API.patch(`/exams/${examId}/toggle`, data);
export const deleteExam         = (examId)        => API.delete(`/exams/${examId}`);
export const getExamResults     = (examId)        => API.get(`/exams/${examId}/results`);
export const setStudentReview   = (examId, studentId, data) => API.patch(`/exams/${examId}/students/${studentId}/review`, data);
export const downloadExamResultsCsv = (examId)    => API.get(`/exams/${examId}/results.csv`, { responseType: "blob" });
