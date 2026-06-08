import API from "./client";

export const createClassroom  = (data) => API.post("/classrooms/", data);
export const getMyClassrooms  = ()     => API.get("/classrooms/");
export const deleteClassroom  = (id)   => API.delete(`/classrooms/${id}`);
export const getStudents    = (classroomId)            => API.get(`/classrooms/${classroomId}/students`);
export const removeStudent  = (classroomId, studentId) => API.delete(`/classrooms/${classroomId}/students/${studentId}`);