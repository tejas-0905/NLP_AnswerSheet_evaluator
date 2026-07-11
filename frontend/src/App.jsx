import { lazy, Suspense } from "react";
import { Toaster } from "react-hot-toast";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import { AuthProvider } from "./context/AuthContext";
import { useAuth } from "./context/useAuth";

const Login = lazy(() => import("./pages/auth/Login"));
const Register = lazy(() => import("./pages/auth/Register"));
const TeacherLayout = lazy(() => import("./pages/teacher/Layout"));
const Dashboard = lazy(() => import("./pages/teacher/Dashboard"));
const Classrooms = lazy(() => import("./pages/teacher/Classrooms"));
const Exams = lazy(() => import("./pages/teacher/Exams"));
const CreateExam = lazy(() => import("./pages/teacher/CreateExam"));
const ExamDetail = lazy(() => import("./pages/teacher/ExamDetail"));
const Results = lazy(() => import("./pages/teacher/Results"));
const ResultsHome = lazy(() => import("./pages/teacher/ResultsHome"));
const Leaderboard = lazy(() => import("./pages/teacher/Leaderboard"));
const TeacherSettings = lazy(() => import("./pages/teacher/Settings"));
const Notes = lazy(() => import("./pages/teacher/Notes"));
const Students = lazy(() => import("./pages/teacher/Students"));
const OCRReviews = lazy(() => import("./pages/teacher/OCRReviews"));
const OCRReview = lazy(() => import("./pages/teacher/OCRReview"));

const StudentLayout = lazy(() => import("./pages/student/Layout"));
const StudentDash = lazy(() => import("./pages/student/Dashboard"));
const StudentClasses = lazy(() => import("./pages/student/Classrooms"));
const StudentExams = lazy(() => import("./pages/student/Exams"));
const TakeExam = lazy(() => import("./pages/student/TakeExam"));
const MyResults = lazy(() => import("./pages/student/MyResults"));
const StudentNotes = lazy(() => import("./pages/student/Notes"));
const UploadSheet = lazy(() => import("./pages/student/UploadSheet"));

function PageFallback() {
  return (
    <div style={{ padding: 24, color: "#64748b", fontSize: 14 }}>
      Loading...
    </div>
  );
}

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
      <Suspense fallback={<PageFallback />}>
        <Routes>
          <Route path="/login"      element={<Login />} />
          <Route path="/register"   element={<Register />} />

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
            <Route path="ocr-reviews"         element={<OCRReviews />} />
            <Route path="ocr-review/:ocrSubmissionId" element={<OCRReview />} />
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
      </Suspense>
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
