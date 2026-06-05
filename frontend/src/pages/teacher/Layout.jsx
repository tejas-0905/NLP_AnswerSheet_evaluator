import { Outlet } from "react-router-dom";
import Sidebar from "../../components/Sidebar";

export default function TeacherLayout() {
  return (
    <div className="teacher-shell">
      <Sidebar />
      <main className="teacher-main">
        <Outlet />
      </main>
    </div>
  );
}
