import API from "./client";

export const createExam         = (data)          => API.post("/exams/", data);
export const getExamsForClass   = (classroomId)   => API.get(`/exams/classroom/${classroomId}`);
export const toggleExam         = (examId, data)  => API.patch(`/exams/${examId}/toggle`, data);
export const deleteExam         = (examId)        => API.delete(`/exams/${examId}`);
export const getExamResults     = (examId)        => API.get(`/exams/${examId}/results`);
