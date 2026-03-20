export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f3f4f6", fontFamily: "system-ui, sans-serif" }}>
      <header style={{ backgroundColor: "white", padding: "1rem 2rem", boxShadow: "0 1px 2px 0 rgb(0 0 0 / 0.05)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2 style={{ fontSize: "1.25rem", fontWeight: 600, margin: 0 }}>Bombay Beach Biennale — Admin</h2>
        <a href="/" style={{ color: "#6b7280", textDecoration: "none" }}>Back to Map</a>
      </header>
      <main style={{ maxWidth: "1200px", margin: "0 auto", padding: "2rem" }}>
        {children}
      </main>
    </div>
  );
}
