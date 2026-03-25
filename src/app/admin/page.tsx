import Link from "next/link";
import { readAdminEntries } from "@/lib/admin-entries";

export default async function AdminDashboardPage() {
  const entries = await readAdminEntries();

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem" }}>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 600 }}>Local Admin Entries</h1>
        <Link 
          href="/admin/new"
          style={{ 
            padding: "0.5rem 1rem", 
            backgroundColor: "#10b981", 
            color: "white", 
            borderRadius: "6px",
            textDecoration: "none",
            fontWeight: 500
          }}
        >
          + Add New Pin
        </Link>
      </div>

      <div style={{ background: "white", borderRadius: "8px", boxShadow: "0 1px 3px 0 rgb(0 0 0 / 0.1)", overflow: "hidden" }}>
        <table style={{ width: "100%", textAlign: "left", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ backgroundColor: "#f9fafb", borderBottom: "1px solid #f3f4f6" }}>
              <th style={{ padding: "1rem", fontWeight: 500, color: "#6b7280" }}>Name</th>
              <th style={{ padding: "1rem", fontWeight: 500, color: "#6b7280" }}>Type</th>
              <th style={{ padding: "1rem", fontWeight: 500, color: "#6b7280" }}>Coordinates</th>
              <th style={{ padding: "1rem", fontWeight: 500, color: "#6b7280", textAlign: "right" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr key={entry.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                <td style={{ padding: "1rem", fontWeight: 500 }}>{entry.name}</td>
                <td style={{ padding: "1rem" }}>
                  <span style={{ 
                    display: "inline-block", 
                    padding: "0.25rem 0.75rem", 
                    borderRadius: "9999px", 
                    backgroundColor: entry.serviceType ? "#f97316" : "#8b5cf6",
                    color: "white",
                    fontSize: "0.75rem",
                    fontWeight: 600
                  }}>
                    {entry.projectType === "services" && entry.serviceType
                      ? `Services: ${entry.serviceType}`
                      : entry.projectType}
                  </span>
                </td>
                <td style={{ padding: "1rem", color: "#6b7280", fontFamily: "monospace" }}>
                  {entry.hasLocation && entry.lat !== undefined && entry.lng !== undefined 
                    ? `${entry.lat.toFixed(5)}, ${entry.lng.toFixed(5)}` 
                    : "Unplaced"}
                </td>
                <td style={{ padding: "1rem", textAlign: "right" }}>
                  <Link 
                    href={`/admin/edit/${entry.id}`}
                    style={{ color: "#2563eb", textDecoration: "none", fontWeight: 500 }}
                  >
                    Edit
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
