import { Outlet } from "react-router-dom";
import Sidebar from "../../components/Sidebar";

export default function TeacherLayout() {
  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#f9fafb" }}>
      <Sidebar />
      <main style={{ flex: 1, padding: "32px 36px", overflowY: "auto" }}>
        <Outlet />
      </main>
    </div>
  );
}