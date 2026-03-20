"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { APIProvider, Map, AdvancedMarker, MapMouseEvent } from "@vis.gl/react-google-maps";
import { Venue } from "@/types/festival";

type PinEditorProps = {
  initialData?: Venue;
};

export function PinEditor({ initialData }: PinEditorProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: initialData?.name || "",
    artist: initialData?.shortDescription?.replace("By ", "") || "",
    type: initialData?.label || "Installation",
    description: initialData?.description || "",
    permanence: initialData?.permanence || "",
  });

  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(
    initialData && initialData.hasLocation !== false && initialData.lat !== undefined && initialData.lng !== undefined
      ? { lat: initialData.lat, lng: initialData.lng } 
      : null
  );

  const handleMapClick = (e: MapMouseEvent) => {
    if (e.detail.latLng) {
      setLocation({
        lat: e.detail.latLng.lat,
        lng: e.detail.latLng.lng,
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const gpsData = location ? `${location.lat}, ${location.lng}` : "";

    const payloadFields = {
      "Project Name": formData.name,
      "Artist Name": formData.artist,
      "Project Type": formData.type,
      "Abridged Project Text": formData.description,
      "Year or Permanent": formData.permanence,
      "GPS Coordinates/Link (from Location NEW)": gpsData,
    };

    try {
      const res = await fetch("/api/airtable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: initialData ? "update" : "create",
          password: "bombaybeach", // Minimal auth prop for MVP
          payload: {
            id: initialData?.id,
            fields: payloadFields,
          },
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to save. Check your Airtable configuration.");
      }

      router.push("/admin");
      router.refresh();
    } catch (err: any) {
      setError(err.message);
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ display: "flex", gap: "2rem", height: "calc(100vh - 100px)" }}>
      <form onSubmit={handleSubmit} style={{ flex: 1, display: "flex", flexDirection: "column", gap: "1rem", background: "white", padding: "2rem", borderRadius: "8px", overflowY: "auto" }}>
        <h2 style={{ marginTop: 0 }}>{initialData ? "Edit Pin" : "Add New Pin"}</h2>
        
        {error && <div style={{ color: "red", padding: "1rem", background: "#fee2e2", borderRadius: "4px" }}>{error}</div>}

        <div>
          <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 500 }}>Project / Title</label>
          <input required type="text" value={formData.name} onChange={e => setFormData(f => ({ ...f, name: e.target.value }))} style={{ width: "100%", padding: "0.5rem", border: "1px solid #ccc", borderRadius: "4px" }} />
        </div>

        <div>
          <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 500 }}>Artist / Host</label>
          <input type="text" value={formData.artist} onChange={e => setFormData(f => ({ ...f, artist: e.target.value }))} style={{ width: "100%", padding: "0.5rem", border: "1px solid #ccc", borderRadius: "4px" }} />
        </div>

        <div>
          <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 500 }}>Project Type</label>
          <select value={formData.type} onChange={e => setFormData(f => ({ ...f, type: e.target.value }))} style={{ width: "100%", padding: "0.5rem", border: "1px solid #ccc", borderRadius: "4px" }}>
            <option value="Installation">Installation</option>
            <option value="Performance">Performance</option>
            <option value="Object">Object</option>
            <option value="Facilitated Experience">Facilitated Experience</option>
            <option value="DJ">DJ</option>
            <option value="Music">Music</option>
            <option value="Venue">Venue</option>
            <option value="Food & Beverage">Food & Beverage</option>
          </select>
        </div>

        <div>
          <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 500 }}>Permanence (e.g. Permanent, Temporary)</label>
          <input type="text" value={formData.permanence} onChange={e => setFormData(f => ({ ...f, permanence: e.target.value }))} style={{ width: "100%", padding: "0.5rem", border: "1px solid #ccc", borderRadius: "4px" }} />
        </div>

        <div>
          <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 500 }}>Description</label>
          <textarea rows={5} value={formData.description} onChange={e => setFormData(f => ({ ...f, description: e.target.value }))} style={{ width: "100%", padding: "0.5rem", border: "1px solid #ccc", borderRadius: "4px" }} />
        </div>

        <div style={{ marginTop: "auto", display: "flex", gap: "1rem", paddingTop: "1rem" }}>
          <button type="button" onClick={() => router.push("/admin")} style={{ padding: "0.75rem", background: "#f3f4f6", border: "none", borderRadius: "4px", flex: 1, cursor: "pointer", fontWeight: 500 }}>Cancel</button>
          <button type="submit" disabled={isSubmitting} style={{ padding: "0.75rem", background: "#2563eb", color: "white", border: "none", borderRadius: "4px", flex: 1, cursor: "pointer", fontWeight: 500 }}>
            {isSubmitting ? "Saving..." : "Save to Airtable"}
          </button>
        </div>
      </form>

      <div style={{ flex: 1, background: "#e5e7eb", borderRadius: "8px", overflow: "hidden", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "1rem", background: "white", borderBottom: "1px solid #e5e7eb" }}>
          <p style={{ margin: 0, fontWeight: 500 }}>Click on the map to set the exact coordinates.</p>
          <p style={{ margin: 0, fontSize: "0.875rem", color: "#6b7280" }}>
            Current location: {location ? `${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}` : "Not set (will be marked as Unplaced)"}
          </p>
          {location && (
            <button type="button" onClick={() => setLocation(null)} style={{ marginTop: "0.5rem", fontSize: "0.75rem", padding: "0.25rem 0.5rem", color: "red", border: "1px solid red", borderRadius: "4px", background: "transparent", cursor: "pointer" }}>Clear Location</button>
          )}
        </div>
        <div style={{ flex: 1 }}>
          <APIProvider apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ""}>
            <Map
              defaultCenter={{ lat: 33.352, lng: -115.729 }}
              defaultZoom={16}
              mapId="2f9f04bb8e9c458045b99a65"
              mapTypeId="satellite"
              disableDefaultUI={true}
              zoomControl={true}
              mapTypeControl={true}
              onClick={handleMapClick}
              gestureHandling="greedy"
              style={{ width: "100%", height: "100%" }}
            >
              {location && (
                <AdvancedMarker position={location}>
                  <div style={{ width: "20px", height: "20px", background: "#3b82f6", borderRadius: "50%", border: "3px solid white", boxShadow: "0 0 4px rgba(0,0,0,0.5)" }} />
                </AdvancedMarker>
              )}
            </Map>
          </APIProvider>
        </div>
      </div>
    </div>
  );
}
