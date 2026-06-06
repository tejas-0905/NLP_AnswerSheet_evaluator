import { Toaster } from "react-hot-toast";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import { AuthProvider } from "./context/AuthContext";
import { useAuth } from "./context/useAuth";

import Login         from "./pages/auth/Login";
import Register      from "./pages/auth/Register";
import VerifyOTP     from "./pages/auth/VerifyOTP";
import TeacherLayout from "./pages/teacher/Layout";
import Dashboard     from "./pages/teacher/Dashboard";
import Classrooms    from "./pages/teacher/Classrooms";
import Exams         from "./pages/teacher/Exams";
import CreateExam    from "./pages/teacher/CreateExam";
import Results       from "./pages/teacher/Results";
import ResultsHome   from "./pages/teacher/ResultsHome";
import Leaderboard   from "./pages/teacher/Leaderboard";

import StudentLayout  from "./pages/student/Layout";
import StudentDash    from "./pages/student/Dashboard";
import StudentClasses from "./pages/student/Classrooms";
import StudentExams   from "./pages/student/Exams";
import TakeExam       from "./pages/student/TakeExam";
import MyResults      from "./pages/student/MyResults";


function ProtectedRoute({ children, role }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" />;
  if (role && user.role !== role) return <Navigate to="/login" />;
  return children;
}

function AppRoutes() {
  return (
    <>
      <Toaster position="top-right" toastOptions={{ style: { fontSize: 14 } }} />
      <Routes>
        <Route path="/login"      element={<Login />} />
        <Route path="/register"   element={<Register />} />
        <Route path="/verify-otp" element={<VerifyOTP />} />

        <Route path="/teacher" element={
          <ProtectedRoute role="teacher"><TeacherLayout /></ProtectedRoute>
        }>
          <Route index                      element={<Dashboard />} />
          <Route path="classrooms"          element={<Classrooms />} />
          <Route path="exams"               element={<Exams />} />
          <Route path="exams/create"        element={<CreateExam />} />
          <Route path="results"             element={<ResultsHome />} />
          <Route path="results/:examId"     element={<Results />} />
          <Route path="leaderboard"         element={<Leaderboard />} />
        </Route>
        <Route path="/student" element={
          <ProtectedRoute role="student"><StudentLayout /></ProtectedRoute>
        }>
          <Route index                         element={<StudentDash />} />
          <Route path="classrooms"             element={<StudentClasses />} />
          <Route path="exams"                  element={<StudentExams />} />
          <Route path="take-exam/:examId"      element={<TakeExam />} />
          <Route path="results/:examId"        element={<MyResults />} />
          </Route>

        <Route path="*" element={<Navigate to="/login" />} />
      </Routes>
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
