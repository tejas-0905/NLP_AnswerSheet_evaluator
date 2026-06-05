export default function StatCard({ label, value, icon: Icon, color = "#2563eb" }) {
  return (
    <div style={{
      background: "#fff", border: "1px solid #e5e7eb",
      borderRadius: 12, padding: "20px 24px",
      display: "flex", alignItems: "center", gap: 16,
    }}>
      <div style={{
        width: 44, height: 44, borderRadius: 10,
        background: color + "15", display: "flex",
        alignItems: "center", justifyContent: "center",
      }}>
        <Icon size={20} color={color} />
      </div>
      <div>
        <p style={{ fontSize: 13, color: "#6b7280", margin: 0 }}>{label}</p>
        <p style={{ fontSize: 24, fontWeight: 600, margin: "2px 0 0", color: "#111" }}>{value}</p>
      </div>
    </div>
  );
}