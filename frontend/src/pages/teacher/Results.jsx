import { Fragment, useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { downloadExamResultsCsv, getExamResults, setStudentReview } from "../../api/exam";
import { CheckCircle, Download, GripVertical, MessageSquare } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell
} from "recharts";

const gradeBadge = (band) => {
  const map = {
    Excellent:         { bg: "#dcfce7", color: "#16a34a" },
    Good:              { bg: "#dbeafe", color: "#1d4ed8" },
    "Needs improvement": { bg: "#fef9c3", color: "#ca8a04" },
    "At risk":         { bg: "#fee2e2", color: "#dc2626" },
  };
  const s = map[band] || { bg: "#f3f4f6", color: "#6b7280" };
  return {
    display: "inline-block", padding: "2px 10px",
    borderRadius: 20, fontSize: 11, fontWeight: 500, ...s,
  };
};

const barColor = (pct) => {
  if (pct >= 85) return "#16a34a";
  if (pct >= 70) return "#2563eb";
  if (pct >= 50) return "#d97706";
  return "#dc2626";
};

const formatDateTime = (value) => {
  if (!value) return "Not available";
  return new Date(value).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

const percent = (value) => `${Math.round((Number(value) || 0) * 100)}%`;

const displayAnswer = (value) => {
  if (!value) return "No answer submitted.";
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed.join(", ");
  } catch {
    // Plain text answers are displayed as-is.
  }
  return value;
};

const htmlEscape = (value) => String(value ?? "")
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;")
  .replace(/'/g, "&#39;");

const reorderList = (list, fromIndex, toIndex) => {
  if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0) return list;
  const next = [...list];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
};

const baseExportFieldDefinitions = [
  { id: "serial_no", label: "Sr No", getValue: (_, index) => index + 1 },
  { id: "roll_no", label: "Roll No", getValue: (row) => row.student_id },
  { id: "name", label: "Name", getValue: (row) => row.student_name },
  { id: "submitted_at", label: "Submitted At", getValue: (row) => formatDateTime(row.answers?.[0]?.submitted_at) },
  { id: "marks", label: "Marks", getValue: (row) => Number(row.total_marks || 0).toFixed(1) },
  { id: "total_marks", label: "Total Marks", getValue: (row) => row.total_max },
  { id: "percentage", label: "Percentage", getValue: (row) => `${Number(row.overall_percentage || 0).toFixed(1)}%` },
];

const buildExportFieldDefinitions = (results) => {
  const questionCount = Math.max(0, ...results.map((row) => row.answers?.length || 0));
  const questionFields = Array.from({ length: questionCount }, (_, index) => ({
    id: `question_${index + 1}`,
    label: `Q${index + 1}`,
    getValue: (row) => {
      const answer = row.answers?.[index];
      return answer ? Number(answer.marks || 0).toFixed(1) : "";
    },
  }));

  return [...baseExportFieldDefinitions, ...questionFields];
};

const defaultExportHeadings = [
  "Shri Ramdeobaba College of Engineering and Management, Nagpur",
  "Katol Road, Nagpur, Maharashtra, India - 440 013.",
  "Programme Name : B.Tech Computer Science and Engineering (Data Science)",
  "Marks in Test & Assessment [Section C]",
  "Subject: CDT6006-Applied Econometrics",
  "Even Semester-Session 2025-26",
];

export default function Results() {
  const { examId, classroomId } = useParams();
  const navigate = useNavigate();
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);
  const [showExportBuilder, setShowExportBuilder] = useState(false);
  const [reviewDrafts, setReviewDrafts] = useState({});
  const [savingReviewId, setSavingReviewId] = useState(null);
  const [newColumnName, setNewColumnName] = useState("");
  const [draggedHeadingIndex, setDraggedHeadingIndex] = useState(null);
  const [draggedColumnId, setDraggedColumnId] = useState(null);
  const [exportHeadings, setExportHeadings] = useState(defaultExportHeadings);
  const [exportColumns, setExportColumns] = useState(
    baseExportFieldDefinitions.map((field) => ({
      id: field.id,
      label: field.label,
      source: field.id,
      enabled: true,
      staticValue: "",
    }))
  );

  useEffect(() => {
    if (!examId) return;
    getExamResults(examId)
      .then((r) => {
        setResults(r.data);
        setReviewDrafts(Object.fromEntries(
          r.data.map((row) => [row.student_id, row.teacher_review_note || ""])
        ));
      })
      .finally(() => setLoading(false));
  }, [examId]);

  const avg = results.length
    ? (results.reduce((s, r) => s + r.overall_percentage, 0) / results.length).toFixed(1)
    : 0;

  const chartData = results.map((r) => ({
    name: r.student_name.split(" ")[0],
    score: parseFloat(r.overall_percentage.toFixed(1)),
  }));

  const exportFieldDefinitions = buildExportFieldDefinitions(results);
  const fieldMap = Object.fromEntries(exportFieldDefinitions.map((field) => [field.id, field]));

  const updateExportHeading = (index, value) => {
    setExportHeadings((prev) => prev.map((heading, idx) => (
      idx === index ? value : heading
    )));
  };

  const addExportHeading = () => {
    setExportHeadings((prev) => [...prev, ""]);
  };

  const removeExportHeading = (index) => {
    setExportHeadings((prev) => prev.filter((_, idx) => idx !== index));
  };

  const moveExportHeading = (toIndex) => {
    if (draggedHeadingIndex === null) return;
    setExportHeadings((prev) => reorderList(prev, draggedHeadingIndex, toIndex));
    setDraggedHeadingIndex(null);
  };

  const updateExportColumn = (id, patch) => {
    setExportColumns((prev) => prev.map((column) => (
      column.id === id ? { ...column, ...patch } : column
    )));
  };

  const addExportColumn = () => {
    const label = newColumnName.trim() || "Custom Column";
    setExportColumns((prev) => [
      ...prev,
      {
        id: `custom_${Date.now()}`,
        label,
        source: "blank",
        enabled: true,
        staticValue: "",
        custom: true,
      },
    ]);
    setNewColumnName("");
  };

  const removeExportColumn = (id) => {
    setExportColumns((prev) => prev.filter((column) => column.id !== id));
  };

  const moveExportColumn = (toId) => {
    if (!draggedColumnId) return;
    setExportColumns((prev) => {
      const fromIndex = prev.findIndex((column) => column.id === draggedColumnId);
      const toIndex = prev.findIndex((column) => column.id === toId);
      return reorderList(prev, fromIndex, toIndex);
    });
    setDraggedColumnId(null);
  };

  const getExportRows = () => {
    const activeColumns = exportColumns.filter((column) => column.enabled);
    const columnCount = Math.max(activeColumns.length, 1);
    const centerIndex = Math.floor((columnCount - 1) / 2);
    const centeredHeadingRows = exportHeadings
      .filter((heading) => heading.trim())
      .map((heading) => {
        const row = Array(columnCount).fill("");
        row[centerIndex] = heading.trim();
        return row;
      });
    const rows = [
      ...centeredHeadingRows,
      activeColumns.map((column) => column.label),
      ...results.map((row, rowIndex) => activeColumns.map((column) => {
        if (column.source === "blank") return "";
        if (column.source === "static") return column.staticValue || "";
        return fieldMap[column.source]?.getValue(row, rowIndex) ?? "";
      })),
    ];
    return { activeColumns, rows };
  };

  const handleExport = () => {
    const { activeColumns, rows } = getExportRows();
    const columnCount = Math.max(activeColumns.length, 1);
    const headingCount = exportHeadings.filter((heading) => heading.trim()).length;
    const headingRows = rows.slice(0, headingCount);
    const dataRows = rows.slice(headingCount);
    const averageMarks = results.length
      ? (results.reduce((sum, row) => sum + Number(row.total_marks || 0), 0) / results.length).toFixed(1)
      : "";
    const maxMarks = results[0]?.total_max ?? "";
    const averageRow = activeColumns.map((column, index) => {
      if (index === 0) return "Class Average";
      if (column.source === "marks") return averageMarks;
      if (column.source === "total_marks") return maxMarks;
      return "";
    });
    const tableRows = [
      ...headingRows.map((row) => `
        <tr>
          <th colspan="${columnCount}" class="sheet-heading">${htmlEscape(row.find((cell) => cell) || "")}</th>
        </tr>
      `),
      ...dataRows.map((row, rowIndex) => `
        <tr class="${rowIndex > 0 && Number(results[rowIndex - 1]?.total_marks || 0) === 0 ? "zero-row" : ""}">
          ${row.map((cell) => `
            <${rowIndex === 0 ? "th" : "td"} class="${rowIndex === 0 ? "table-header" : ""}">${htmlEscape(cell)}</${rowIndex === 0 ? "th" : "td"}>
          `).join("")}
        </tr>
      `),
      `<tr class="spacer-row">${Array(columnCount).fill("<td></td>").join("")}</tr>`,
      `<tr class="average-row">${averageRow.map((cell) => `<td>${htmlEscape(cell)}</td>`).join("")}</tr>`,
    ].join("");
    const html = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">
        <head>
          <meta charset="UTF-8" />
          <style>
            table { border-collapse: collapse; font-family: Calibri, Arial, sans-serif; }
            th, td { border: 1px solid #000; padding: 5px 8px; font-size: 12pt; vertical-align: middle; text-align: center; }
            .sheet-heading { background: #fff; color: #000; font-size: 13pt; text-align: center; font-weight: 700; }
            .table-header { background: #3b3697; color: #fff; font-weight: 700; }
            .zero-row td { background: #ffff00; }
            .spacer-row td { height: 14px; border-left: 1px solid #000; border-right: 1px solid #000; border-top: 2px solid #000; border-bottom: 2px solid #000; }
            .average-row td { background: #ffff99; font-weight: 700; }
            .average-row td:first-child { text-align: left; }
          </style>
        </head>
        <body>
          <table>${tableRows}</table>
        </body>
      </html>
    `;
    const blob = new Blob([html], { type: "application/vnd.ms-excel;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `exam_${examId}_results.xls`;
    a.click();
  };

  const handleCsvExport = () => {
    downloadExamResultsCsv(examId).then((response) => {
      const url = URL.createObjectURL(new Blob([response.data], { type: "text/csv" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = `exam_${examId}_results.csv`;
      link.click();
      URL.revokeObjectURL(url);
    });
  };

  const updateReviewDraft = (studentId, value) => {
    setReviewDrafts((prev) => ({ ...prev, [studentId]: value }));
  };

  const saveStudentReview = (studentId, shouldRequest = true) => {
    setSavingReviewId(studentId);
    setStudentReview(examId, studentId, {
      review_requested: shouldRequest,
      teacher_review_note: reviewDrafts[studentId] || "",
    })
      .then((response) => {
        const updated = response.data;
        setResults((prev) => prev.map((row) => (
          row.student_id === studentId
            ? {
              ...row,
              review_requested: updated.review_requested,
              teacher_review_note: updated.teacher_review_note,
              answers: row.answers.map((answer) => ({
                ...answer,
                review_requested: updated.review_requested,
                teacher_review_note: updated.teacher_review_note,
              })),
            }
            : row
        )));
        if (!updated.review_requested) {
          updateReviewDraft(studentId, "");
        }
        toast.success(updated.review_requested ? "Review shared with student" : "Review request cleared");
      })
      .catch((error) => {
        toast.error(error.response?.data?.detail || "Could not update review");
      })
      .finally(() => setSavingReviewId(null));
  };

  if (loading) return <p style={{ color: "#9ca3af", fontSize: 14 }}>Loading results...</p>;

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <button
            onClick={() => navigate(classroomId ? `/teacher/classrooms/${classroomId}/results` : "/teacher/exams")}
            style={{ background: "none", border: "none", cursor: "pointer", color: "#6b7280", fontSize: 14, padding: 0 }}
          >
            Back
          </button>
          <h1 style={{ fontSize: 22, fontWeight: 600, margin: 0, color: "#111" }}>Results</h1>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={handleCsvExport}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              background: "#fff", border: "1px solid #bfdbfe",
              borderRadius: 8, padding: "8px 16px", cursor: "pointer",
              fontSize: 13, color: "#2563eb",
            }}
          >
            <Download size={15} /> Download CSV
          </button>
          <button
            onClick={() => setShowExportBuilder((value) => !value)}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              background: showExportBuilder ? "#eff6ff" : "#fff",
              border: `1px solid ${showExportBuilder ? "#bfdbfe" : "#e5e7eb"}`,
              borderRadius: 8, padding: "8px 16px", cursor: "pointer",
              fontSize: 13, color: showExportBuilder ? "#2563eb" : "#374151",
            }}
          >
            Customize Export
          </button>
          <button
            onClick={handleExport}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              background: "#111827", border: "1px solid #111827",
              borderRadius: 8, padding: "8px 16px", cursor: "pointer", fontSize: 13, color: "#fff",
            }}
          >
            Export Table
          </button>
        </div>
      </div>

      {results.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 0", color: "#9ca3af" }}>
          <p style={{ fontSize: 15 }}>No submissions yet for this exam.</p>
        </div>
      ) : (
        <>
          {showExportBuilder && (
            <div style={{
              background: "#fff",
              border: "1px solid #e5e7eb",
              borderRadius: 12,
              padding: "18px 20px",
              marginBottom: 24,
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 14, marginBottom: 14 }}>
                <div>
                  <p style={{ fontSize: 15, fontWeight: 700, color: "#111", margin: "0 0 4px" }}>
                    Export customization
                  </p>
                  <p style={{ fontSize: 13, color: "#6b7280", margin: 0 }}>
                    Default columns are Sr No, Roll No, Name, Submitted At, Marks, Total Marks, Percentage. Drag rows to change export order.
                  </p>
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                  <input
                    value={newColumnName}
                    onChange={(event) => setNewColumnName(event.target.value)}
                    placeholder="New column name"
                    style={{
                      border: "1px solid #e5e7eb",
                      borderRadius: 8,
                      padding: "8px 10px",
                      fontSize: 13,
                      minWidth: 180,
                    }}
                  />
                  <button
                    onClick={addExportColumn}
                    style={{
                      border: "none",
                      borderRadius: 8,
                      background: "#2563eb",
                      color: "#fff",
                      padding: "8px 12px",
                      cursor: "pointer",
                      fontSize: 13,
                      fontWeight: 600,
                    }}
                  >
                    Add column
                  </button>
                </div>
              </div>

              <div style={{
                background: "#f9fafb",
                border: "1px solid #f3f4f6",
                borderRadius: 10,
                padding: "12px 14px",
                marginBottom: 14,
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <p style={{ fontSize: 13, fontWeight: 700, color: "#374151", margin: 0 }}>
                    Header rows
                  </p>
                  <button
                    onClick={addExportHeading}
                    style={{
                      border: "1px solid #bfdbfe",
                      borderRadius: 8,
                      background: "#eff6ff",
                      color: "#2563eb",
                      padding: "6px 10px",
                      cursor: "pointer",
                      fontSize: 12,
                      fontWeight: 600,
                    }}
                  >
                    Add heading
                  </button>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {exportHeadings.map((heading, index) => (
                    <div
                      key={index}
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={() => moveExportHeading(index)}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "28px 1fr 80px",
                        gap: 8,
                        alignItems: "center",
                        opacity: draggedHeadingIndex === index ? 0.55 : 1,
                      }}
                    >
                      <span
                        draggable
                        onDragStart={() => setDraggedHeadingIndex(index)}
                        onDragEnd={() => setDraggedHeadingIndex(null)}
                        title="Drag to reorder heading row"
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "#9ca3af",
                          cursor: "grab",
                        }}
                      >
                        <GripVertical size={16} />
                      </span>
                      <input
                        value={heading}
                        onChange={(event) => updateExportHeading(index, event.target.value)}
                        placeholder={`Heading row ${index + 1}`}
                        style={{
                          border: "1px solid #e5e7eb",
                          borderRadius: 8,
                          padding: "8px 10px",
                          fontSize: 13,
                          background: "#fff",
                        }}
                      />
                      <button
                        onClick={() => removeExportHeading(index)}
                        style={{
                          border: "none",
                          background: "#fef2f2",
                          color: "#dc2626",
                          borderRadius: 8,
                          padding: "8px 10px",
                          cursor: "pointer",
                          fontSize: 12,
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {exportColumns.map((column) => (
                  <div
                    key={column.id}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={() => moveExportColumn(column.id)}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "28px 32px minmax(150px, 1fr) minmax(150px, 1fr) minmax(150px, 1fr) 70px",
                      gap: 8,
                      alignItems: "center",
                      opacity: draggedColumnId === column.id ? 0.55 : 1,
                    }}
                  >
                    <span
                      draggable
                      onDragStart={() => setDraggedColumnId(column.id)}
                      onDragEnd={() => setDraggedColumnId(null)}
                      title="Drag to reorder export column"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "#9ca3af",
                        cursor: "grab",
                      }}
                    >
                      <GripVertical size={16} />
                    </span>
                    <input
                      type="checkbox"
                      checked={column.enabled}
                      onChange={(event) => updateExportColumn(column.id, { enabled: event.target.checked })}
                    />
                    <input
                      value={column.label}
                      onChange={(event) => updateExportColumn(column.id, { label: event.target.value })}
                      style={{
                        border: "1px solid #e5e7eb",
                        borderRadius: 8,
                        padding: "8px 10px",
                        fontSize: 13,
                      }}
                    />
                    <select
                      value={column.source}
                      onChange={(event) => updateExportColumn(column.id, { source: event.target.value })}
                      style={{
                        border: "1px solid #e5e7eb",
                        borderRadius: 8,
                        padding: "8px 10px",
                        fontSize: 13,
                        background: "#fff",
                      }}
                    >
                      {exportFieldDefinitions.map((field) => (
                        <option key={field.id} value={field.id}>{field.label}</option>
                      ))}
                      <option value="blank">Blank cell</option>
                      <option value="static">Same value for all rows</option>
                    </select>
                    <input
                      value={column.staticValue || ""}
                      onChange={(event) => updateExportColumn(column.id, { staticValue: event.target.value })}
                      disabled={column.source !== "static"}
                      placeholder={column.source === "static" ? "Static value" : "Static only"}
                      style={{
                        border: "1px solid #e5e7eb",
                        borderRadius: 8,
                        padding: "8px 10px",
                        fontSize: 13,
                        background: column.source === "static" ? "#fff" : "#f9fafb",
                        color: column.source === "static" ? "#111" : "#9ca3af",
                      }}
                    />
                    <button
                      onClick={() => removeExportColumn(column.id)}
                      disabled={!column.custom}
                      style={{
                        border: "none",
                        background: column.custom ? "#fef2f2" : "#f9fafb",
                        color: column.custom ? "#dc2626" : "#d1d5db",
                        borderRadius: 8,
                        padding: "8px 10px",
                        cursor: column.custom ? "pointer" : "not-allowed",
                        fontSize: 12,
                      }}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Summary cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 14, marginBottom: 24 }}>
            {[
              { label: "Submissions", value: results.length },
              { label: "Average score", value: `${avg}%` },
              { label: "Passed (≥50%)", value: results.filter((r) => r.overall_percentage >= 50).length },
              { label: "At risk (<50%)", value: results.filter((r) => r.overall_percentage < 50).length },
            ].map((s) => (
              <div key={s.label} style={{
                background: "#fff", border: "1px solid #e5e7eb",
                borderRadius: 10, padding: "16px 18px",
              }}>
                <p style={{ fontSize: 12, color: "#6b7280", margin: "0 0 4px" }}>{s.label}</p>
                <p style={{ fontSize: 22, fontWeight: 600, margin: 0, color: "#111" }}>{s.value}</p>
              </div>
            ))}
          </div>

          {/* Bar chart */}
          <div style={{
            background: "#fff", border: "1px solid #e5e7eb",
            borderRadius: 12, padding: "20px 24px", marginBottom: 24,
          }}>
            <p style={{ fontWeight: 600, fontSize: 14, margin: "0 0 16px", color: "#111" }}>
              Score distribution
            </p>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData} barCategoryGap="30%">
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#6b7280" }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: "#6b7280" }} unit="%" />
                <Tooltip formatter={(v) => [`${v}%`, "Score"]} />
                <Bar dataKey="score" radius={[4, 4, 0, 0]}>
                  {chartData.map((entry, index) => (
                    <Cell key={index} fill={barColor(entry.score)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Results table */}
          <div style={{
            background: "#fff", border: "1px solid #e5e7eb",
            borderRadius: 12, overflow: "hidden",
          }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
              <thead>
                <tr style={{ background: "#f9fafb", borderBottom: "1px solid #e5e7eb" }}>
                  {["Student", "Marks", "Percentage", "Grade", "Review", "Details"].map((h) => (
                    <th key={h} style={{
                      textAlign: "left", padding: "12px 16px",
                      fontSize: 12, color: "#6b7280", fontWeight: 500,
                    }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {results.map((r) => (
                  <Fragment key={r.student_id}>
                    <tr
                      style={{ borderBottom: "1px solid #f3f4f6", cursor: "pointer" }}
                      onClick={() => setExpanded(expanded === r.student_id ? null : r.student_id)}
                    >
                      <td style={{ padding: "12px 16px", fontWeight: 500, color: "#111" }}>
                        {r.student_name}
                      </td>
                      <td style={{ padding: "12px 16px", color: "#374151" }}>
                        {r.total_marks.toFixed(1)} / {r.total_max}
                      </td>
                      <td style={{ padding: "12px 16px", fontWeight: 500, color: barColor(r.overall_percentage) }}>
                        {r.overall_percentage.toFixed(1)}%
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <span style={gradeBadge(r.answers[0]?.grade_band)}>
                          {r.answers[0]?.grade_band || "-"}
                        </span>
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        {r.review_requested ? (
                          <span style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 6,
                            background: "#dcfce7",
                            color: "#166534",
                            borderRadius: 999,
                            padding: "4px 9px",
                            fontSize: 12,
                            fontWeight: 800,
                          }}>
                            <CheckCircle size={13} /> Shared
                          </span>
                        ) : (
                          <span style={{ color: "#9ca3af", fontSize: 12 }}>Not requested</span>
                        )}
                      </td>
                      <td style={{ padding: "12px 16px", color: "#2563eb", fontSize: 13 }}>
                        {expanded === r.student_id ? "Hide" : "Show"}
                      </td>
                    </tr>

                    {/* Expanded detail row */}
                    {expanded === r.student_id && (
                      <tr key={`${r.student_id}-exp`}>
                        <td colSpan={6} style={{ padding: "0 16px 14px", background: "#f9fafb" }}>
                          <div style={{ display: "flex", flexDirection: "column", gap: 8, paddingTop: 10 }}>
                            <div style={{
                              background: "#fff",
                              border: "1px solid #e5e7eb",
                              borderRadius: 8,
                              padding: "14px 16px",
                            }}>
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 10 }}>
                                <div>
                                  <p style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 14, fontWeight: 800, color: "#111", margin: "0 0 4px" }}>
                                    <MessageSquare size={15} /> Teacher review
                                  </p>
                                  <p style={{ color: "#6b7280", fontSize: 12, margin: 0 }}>
                                    Share a targeted review note with this student when you want them to revisit their answers.
                                  </p>
                                </div>
                                {r.review_requested && (
                                  <span style={{
                                    background: "#dcfce7",
                                    color: "#166534",
                                    borderRadius: 999,
                                    padding: "4px 9px",
                                    fontSize: 12,
                                    fontWeight: 800,
                                    whiteSpace: "nowrap",
                                  }}>
                                    Visible to student
                                  </span>
                                )}
                              </div>
                              <textarea
                                value={reviewDrafts[r.student_id] || ""}
                                onClick={(event) => event.stopPropagation()}
                                onChange={(event) => updateReviewDraft(r.student_id, event.target.value)}
                                placeholder="Example: Please review questions 2 and 4. Add more detail on the key concepts before our next class."
                                style={{
                                  width: "100%",
                                  minHeight: 82,
                                  resize: "vertical",
                                  border: "1px solid #e5e7eb",
                                  borderRadius: 8,
                                  padding: "10px 12px",
                                  fontSize: 13,
                                  lineHeight: 1.5,
                                  color: "#111",
                                  boxSizing: "border-box",
                                }}
                              />
                              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 10 }}>
                                {r.review_requested && (
                                  <button
                                    type="button"
                                    disabled={savingReviewId === r.student_id}
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      saveStudentReview(r.student_id, false);
                                    }}
                                    style={{
                                      border: "1px solid #e5e7eb",
                                      background: "#fff",
                                      borderRadius: 8,
                                      color: "#6b7280",
                                      padding: "8px 12px",
                                      cursor: "pointer",
                                      fontSize: 13,
                                      fontWeight: 700,
                                    }}
                                  >
                                    Clear review
                                  </button>
                                )}
                                <button
                                  type="button"
                                  disabled={savingReviewId === r.student_id}
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    saveStudentReview(r.student_id, true);
                                  }}
                                  style={{
                                    border: "none",
                                    background: "#111827",
                                    borderRadius: 8,
                                    color: "#fff",
                                    padding: "8px 12px",
                                    cursor: "pointer",
                                    fontSize: 13,
                                    fontWeight: 800,
                                  }}
                                >
                                  {savingReviewId === r.student_id ? "Saving..." : "Share review"}
                                </button>
                              </div>
                            </div>
                            {r.answers.map((a, i) => (
                              <div key={i} style={{
                                background: "#fff", border: "1px solid #e5e7eb",
                                borderRadius: 8, padding: "14px 16px",
                              }}>
                                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10, gap: 12 }}>
                                  <span style={{ fontSize: 14, fontWeight: 700, color: "#111" }}>
                                    Question {i + 1}
                                  </span>
                                  <span style={{ fontSize: 13, color: barColor(a.percentage), fontWeight: 600 }}>
                                    {a.marks.toFixed(1)} / {a.max_marks || "?"} marks - {a.percentage.toFixed(1)}%
                                  </span>
                                </div>

                                {a.question_text && (
                                  <div style={{ marginBottom: 12 }}>
                                    <p style={{ fontSize: 12, color: "#6b7280", fontWeight: 700, margin: "0 0 5px" }}>
                                      QUESTION
                                    </p>
                                    <p style={{ fontSize: 13, color: "#374151", lineHeight: 1.5, margin: 0 }}>
                                      {a.question_text}
                                    </p>
                                  </div>
                                )}

                                <div style={{
                                  background: "#f8fafc",
                                  border: "1px solid #e5e7eb",
                                  borderRadius: 8,
                                  padding: "11px 12px",
                                  marginBottom: 12,
                                }}>
                                  <p style={{ fontSize: 12, color: "#6b7280", fontWeight: 700, margin: "0 0 6px" }}>
                                    STUDENT ANSWER
                                  </p>
                                  <p style={{ fontSize: 13, color: "#111", lineHeight: 1.6, whiteSpace: "pre-wrap", margin: 0 }}>
                                      {displayAnswer(a.answer_text)}
                                  </p>
                                </div>

                                {a.question_type === "mcq" && (
                                  <div style={{
                                    display: "grid",
                                    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                                    gap: 10,
                                    marginBottom: 12,
                                  }}>
                                    <div style={{
                                      background: a.is_correct ? "#dcfce7" : "#fee2e2",
                                      border: `1px solid ${a.is_correct ? "#bbf7d0" : "#fecaca"}`,
                                      borderRadius: 8,
                                      padding: "10px 12px",
                                      color: a.is_correct ? "#166534" : "#991b1b",
                                      fontSize: 13,
                                      fontWeight: 700,
                                    }}>
                                      {a.is_correct ? "Correct MCQ answer" : "Incorrect MCQ answer"}
                                    </div>
                                    <div style={{ background: "#fff", border: "1px solid #f3f4f6", borderRadius: 8, padding: "10px 12px" }}>
                                      <p style={{ fontSize: 11, color: "#9ca3af", margin: "0 0 3px", fontWeight: 700 }}>CORRECT OPTION</p>
                                      <p style={{ fontSize: 13, color: "#374151", margin: 0 }}>{(a.correct_options || [a.correct_option]).filter(Boolean).join(", ") || "Not set"}</p>
                                    </div>
                                  </div>
                                )}

                                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 10, marginBottom: 12 }}>
                                  <div style={{ background: "#fff", border: "1px solid #f3f4f6", borderRadius: 8, padding: "9px 10px" }}>
                                    <p style={{ fontSize: 11, color: "#9ca3af", margin: "0 0 3px", fontWeight: 700 }}>ANSWERED AT</p>
                                    <p style={{ fontSize: 13, color: "#374151", margin: 0 }}>{formatDateTime(a.submitted_at)}</p>
                                  </div>
                                  <div style={{ background: "#fff", border: "1px solid #f3f4f6", borderRadius: 8, padding: "9px 10px" }}>
                                    <p style={{ fontSize: 11, color: "#9ca3af", margin: "0 0 3px", fontWeight: 700 }}>TIME GIVEN</p>
                                    <p style={{ fontSize: 13, color: "#374151", margin: 0 }}>
                                      {a.time_limit_minutes ? `${a.time_limit_minutes} minutes` : "No time limit"}
                                    </p>
                                  </div>
                                  <div style={{ background: "#fff", border: "1px solid #f3f4f6", borderRadius: 8, padding: "9px 10px" }}>
                                    <p style={{ fontSize: 11, color: "#9ca3af", margin: "0 0 3px", fontWeight: 700 }}>EVALUATED AT</p>
                                    <p style={{ fontSize: 13, color: "#374151", margin: 0 }}>{formatDateTime(a.evaluated_at)}</p>
                                  </div>
                                </div>

                                {a.missing_keywords?.length > 0 && (
                                  <p style={{ fontSize: 12, color: "#dc2626", margin: "0 0 4px" }}>
                                    Missing: {a.missing_keywords.join(", ")}
                                  </p>
                                )}
                                {a.covered_keywords?.length > 0 && (
                                  <p style={{ fontSize: 12, color: "#16a34a", margin: "0 0 4px" }}>
                                    Covered: {a.covered_keywords.join(", ")}
                                  </p>
                                )}
                                {(Number(a.copy_risk || 0) >= 80 || Number(a.peer_similarity || 0) >= 80) && (
                                  <div style={{
                                    display: "grid",
                                    gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
                                    gap: 10,
                                    margin: "10px 0 12px",
                                  }}>
                                    {Number(a.copy_risk || 0) >= 80 && (
                                      <div style={{
                                        background: "#fef2f2",
                                        border: "1px solid #fecaca",
                                        borderRadius: 8,
                                        padding: "10px 12px",
                                        color: "#991b1b",
                                        fontSize: 12,
                                        fontWeight: 800,
                                      }}>
                                        High model-answer similarity: {Number(a.copy_risk || 0).toFixed(1)}%
                                      </div>
                                    )}
                                    {Number(a.peer_similarity || 0) >= 80 && (
                                      <div style={{
                                        background: "#fff7ed",
                                        border: "1px solid #fed7aa",
                                        borderRadius: 8,
                                        padding: "10px 12px",
                                        color: "#9a3412",
                                        fontSize: 12,
                                        fontWeight: 800,
                                      }}>
                                        Similar to {a.similar_student_name || "another student"}: {Number(a.peer_similarity || 0).toFixed(1)}%
                                      </div>
                                    )}
                                  </div>
                                )}

                                {a.suggestions?.map((s, si) => (
                                  <p key={si} style={{ fontSize: 12, color: "#6b7280", margin: "2px 0 0" }}>
                                    {s}
                                  </p>
                                ))}
                                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
                                  {[
                                    ["Meaning", percent(a.semantic_score)],
                                    ["Keywords", percent(a.keyword_score)],
                                    ["Points", percent(a.sentence_score)],
                                    ["Length", percent(a.length_score)],
                                    ["Model copy", `${Number(a.copy_risk || 0).toFixed(1)}%`],
                                    ["Peer similarity", `${Number(a.peer_similarity || 0).toFixed(1)}%`],
                                  ].map(([label, value]) => (
                                    <span key={label} style={{
                                      background: "#f9fafb",
                                      border: "1px solid #e5e7eb",
                                      borderRadius: 999,
                                      padding: "4px 9px",
                                      fontSize: 11,
                                      color: "#4b5563",
                                    }}>
                                      {label}: {value}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
