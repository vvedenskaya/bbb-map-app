import Link from "next/link";
import { fetchAirtableInstallations } from "@/lib/airtable";

export default async function AdminDashboardPage() {
  const data = await fetchAirtableInstallations();
  const venues = data?.venues || [];

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem" }}>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 600 }}>Pins & Installations</h1>
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
            {venues.map((venue) => (
              <tr key={venue.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                <td style={{ padding: "1rem", fontWeight: 500 }}>{venue.name}</td>
                <td style={{ padding: "1rem" }}>
                  <span style={{ 
                    display: "inline-block", 
                    padding: "0.25rem 0.75rem", 
                    borderRadius: "9999px", 
                    backgroundColor: venue.accent,
                    color: "white",
                    fontSize: "0.75rem",
                    fontWeight: 600
                  }}>
                    {venue.label}
                  </span>
                </td>
                <td style={{ padding: "1rem", color: "#6b7280", fontFamily: "monospace" }}>
                  {venue.hasLocation && venue.lat !== undefined && venue.lng !== undefined 
                    ? `${venue.lat.toFixed(5)}, ${venue.lng.toFixed(5)}` 
                    : "Unplaced"}
                </td>
                <td style={{ padding: "1rem", textAlign: "right" }}>
                  <Link 
                    href={`/admin/edit/${venue.id}`}
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
