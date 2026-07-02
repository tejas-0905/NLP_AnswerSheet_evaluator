import API from "./client";

export const joinClassroom     = (data)        => API.post("/student/join-classroom", data);
export const getMyClassrooms   = ()            => API.get("/student/classrooms");
export const getExams          = (classId)     => API.get(`/student/classrooms/${classId}/exams`);
export const getQuestions      = (examId)      => API.get(`/student/exams/${examId}/questions`);
export const submitExam        = (examId, data)=> API.post(`/student/exams/${examId}/submit`, data);
export const getMyResults      = (examId)      => API.get(`/student/exams/${examId}/my-results`);
export const getMyRank         = (classId)     => API.get(`/student/classrooms/${classId}/my-rank`);
