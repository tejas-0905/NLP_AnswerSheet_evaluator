import API from "./client";

export const createClassroom  = (data) => API.post("/classrooms/", data);
export const getMyClassrooms  = ()     => API.get("/classrooms/");
export const deleteClassroom  = (id)   => API.delete(`/classrooms/${id}`);
