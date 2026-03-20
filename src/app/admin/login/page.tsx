"use client";

import { useActionState } from "react";
import { loginAction } from "../actions";

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(loginAction, null);

  return (
    <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "#f3f4f6" }}>
      <form action={formAction} style={{ background: "white", padding: "2rem", borderRadius: "12px", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)", maxWidth: "400px", width: "100%" }}>
        <h1 style={{ margin: "0 0 1.5rem", fontSize: "1.5rem", fontWeight: 600 }}>Admin Login</h1>
        
        <div style={{ marginBottom: "1.5rem" }}>
          <label htmlFor="password" style={{ display: "block", marginBottom: "0.5rem", fontWeight: 500, fontSize: "0.875rem" }}>
            Password
          </label>
          <input 
            type="password" 
            id="password" 
            name="password" 
            required 
            style={{ width: "100%", padding: "0.75rem", border: "1px solid #e5e7eb", borderRadius: "6px", fontSize: "1rem" }}
          />
        </div>

        {state?.error && (
          <p style={{ color: "#ef4444", fontSize: "0.875rem", marginBottom: "1rem", fontWeight: 500 }}>
            {state.error}
          </p>
        )}

        <button 
          type="submit" 
          disabled={pending}
          style={{ 
            width: "100%", 
            padding: "0.75rem", 
            backgroundColor: "#2563eb", 
            color: "white", 
            border: "none", 
            borderRadius: "6px", 
            fontSize: "1rem",
            fontWeight: 500,
            cursor: pending ? "not-allowed" : "pointer",
            opacity: pending ? 0.7 : 1
          }}
        >
          {pending ? "Logging in..." : "Log in"}
        </button>
      </form>
    </main>
  );
}
