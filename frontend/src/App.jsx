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
import ExamDetail    from "./pages/teacher/ExamDetail";
import Results       from "./pages/teacher/Results";
import ResultsHome   from "./pages/teacher/ResultsHome";
import Leaderboard   from "./pages/teacher/Leaderboard";
import TeacherSettings from "./pages/teacher/Settings";
import Notes         from "./pages/teacher/Notes";

import StudentLayout  from "./pages/student/Layout";
import StudentDash    from "./pages/student/Dashboard";
import StudentClasses from "./pages/student/Classrooms";
import StudentExams   from "./pages/student/Exams";
import TakeExam       from "./pages/student/TakeExam";
import MyResults      from "./pages/student/MyResults";
import StudentNotes   from "./pages/student/Notes";
import Students       from "./pages/teacher/Students";
import UploadSheet    from "./pages/student/UploadSheet";

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
          <Route path="classrooms/:classroomId" element={<Navigate to="exams" replace />} />
          <Route path="classrooms/:classroomId/exams" element={<Exams />} />
          <Route path="classrooms/:classroomId/exams/:examId" element={<ExamDetail />} />
          <Route path="classrooms/:classroomId/results" element={<ResultsHome />} />
          <Route path="classrooms/:classroomId/results/:examId" element={<Results />} />
          <Route path="classrooms/:classroomId/students" element={<Students />} />
          <Route path="classrooms/:classroomId/leaderboard" element={<Leaderboard />} />
          <Route path="classrooms/:classroomId/notes" element={<Notes />} />
          <Route path="exams"               element={<Exams />} />
          <Route path="exams/:examId"        element={<ExamDetail />} />
          <Route path="exams/create"        element={<CreateExam />} />
          <Route path="notes"               element={<Notes />} />
          <Route path="results"             element={<ResultsHome />} />
          <Route path="results/:examId"     element={<Results />} />
          <Route path="leaderboard"         element={<Leaderboard />} />
          <Route path="students"            element={<Students />} />
          <Route path="settings"            element={<TeacherSettings />} />
        </Route>
        <Route path="/student" element={
          <ProtectedRoute role="student"><StudentLayout /></ProtectedRoute>
        }>
          <Route index                         element={<StudentDash />} />
          <Route path="classrooms"             element={<StudentClasses />} />
          <Route path="exams"                  element={<StudentExams />} />
          <Route path="notes"                  element={<StudentNotes />} />
          <Route path="take-exam/:examId"      element={<TakeExam />} />
          <Route path="results/:examId"        element={<MyResults />} />
          <Route path="upload-sheet/:examId"   element={<UploadSheet />} />
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
