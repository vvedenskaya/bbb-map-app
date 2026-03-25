"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { APIProvider, Map, AdvancedMarker, MapMouseEvent } from "@vis.gl/react-google-maps";
import { AdminEntry, ServiceType } from "@/types/admin-entry";
import { EventType, FestivalDay } from "@/types/festival";

type PinEditorProps = {
  initialData?: AdminEntry;
};

export function PinEditor({ initialData }: PinEditorProps) {
  const projectTypeOptions: EventType[] = [
    "installation",
    "performance",
    "music",
    "lecture",
    "community",
    "social",
    "object",
    "experience",
    "film",
    "dj",
    "venue",
    "food",
    "services",
  ];
  const dayOptions: FestivalDay[] = ["fri", "sat", "sun"];
  const serviceOptions: ServiceType[] = ["garbage", "water", "toilets", "medic"];
  const isEditing = Boolean(initialData);
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: initialData?.name ?? "",
    artist: initialData?.artist ?? "",
    projectType: initialData?.projectType ?? "installation",
    serviceType: initialData?.serviceType ?? "",
    abridgedProjectText: initialData?.abridgedProjectText ?? "",
    hasSchedule: initialData?.hasSchedule ?? false,
    day: initialData?.day ?? "fri",
    startTime: initialData?.startTime ?? "",
    endTime: initialData?.endTime ?? "",
    permanence: initialData?.permanence || "",
  });

  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(
    initialData && initialData.hasLocation && initialData.lat !== undefined && initialData.lng !== undefined
      ? { lat: initialData.lat, lng: initialData.lng } 
      : null
  );
  const [selectedServiceTool, setSelectedServiceTool] = useState<ServiceType>("toilets");
  const [servicePins, setServicePins] = useState<Array<{ id: string; serviceType: ServiceType; lat: number; lng: number }>>([]);

  const isServicesBatchMode = !isEditing && formData.projectType === "services";

  const handleMapClick = (e: MapMouseEvent) => {
    if (e.detail.latLng) {
      const lat = e.detail.latLng.lat;
      const lng = e.detail.latLng.lng;
      if (isServicesBatchMode) {
        setServicePins((current) => [
          ...current,
          {
            id: `pin-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            serviceType: selectedServiceTool,
            lat,
            lng,
          },
        ]);
        return;
      }
      setLocation({ lat, lng });
    }
  };

  const handlePendingPinDragEnd = (
    pinId: string,
    event: { latLng?: { lat: () => number; lng: () => number } | null }
  ) => {
    const latLng = event.latLng;
    if (!latLng) return;
    setServicePins((current) =>
      current.map((pin) =>
        pin.id === pinId
          ? {
              ...pin,
              lat: latLng.lat(),
              lng: latLng.lng(),
            }
          : pin
      )
    );
  };

  const handleSingleLocationDragEnd = (
    event: { latLng?: { lat: () => number; lng: () => number } | null }
  ) => {
    const latLng = event.latLng;
    if (!latLng) return;
    setLocation({
      lat: latLng.lat(),
      lng: latLng.lng(),
    });
  };

  const removePendingServicePin = (pinId: string) => {
    setServicePins((current) => current.filter((pin) => pin.id !== pinId));
  };

  const handleDeleteSavedEntry = async () => {
    if (!initialData) return;
    if (!window.confirm("Delete this entry? This cannot be undone.")) return;
    setIsDeleting(true);
    setError(null);
    try {
      const res = await fetch("/api/admin-entries", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: initialData.id }),
      });
      if (!res.ok) {
        throw new Error("Failed to delete entry.");
      }
      router.push("/admin");
      router.refresh();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to delete entry.";
      setError(message);
      setIsDeleting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    if (isServicesBatchMode) {
      if (servicePins.length === 0) {
        setError("Add at least one service icon to the map before saving.");
        setIsSubmitting(false);
        return;
      }
      const payloadEntries = servicePins.map((pin, index) => ({
        name: `${pin.serviceType.charAt(0).toUpperCase()}${pin.serviceType.slice(1)} ${index + 1}`,
        artist: "",
        projectType: "services" as EventType,
        serviceType: pin.serviceType,
        abridgedProjectText: "",
        hasSchedule: false,
        day: "fri" as FestivalDay,
        startTime: "",
        endTime: "",
        permanence: "",
        lat: pin.lat,
        lng: pin.lng,
        hasLocation: true,
      }));
      try {
        const res = await fetch("/api/admin-entries", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ entries: payloadEntries }),
        });
        if (!res.ok) {
          throw new Error("Failed to save service pins.");
        }
        router.push("/admin");
        router.refresh();
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Failed to save service pins.";
        setError(message);
        setIsSubmitting(false);
      }
      return;
    }

    const payloadEntry = {
      name: formData.name,
      artist: formData.artist,
      projectType: formData.projectType,
      serviceType:
        formData.projectType === "services"
          ? ((formData.serviceType || undefined) as ServiceType | undefined)
          : undefined,
      abridgedProjectText: formData.abridgedProjectText,
      hasSchedule: formData.hasSchedule,
      day: formData.day,
      startTime: formData.hasSchedule ? formData.startTime || "TBD" : "",
      endTime: formData.hasSchedule ? formData.endTime || "TBD" : "",
      permanence: formData.permanence,
      lat: location?.lat,
      lng: location?.lng,
      hasLocation: Boolean(location),
    };

    try {
      if (!isServicesBatchMode && !formData.name.trim()) {
        throw new Error("Project / Title is required.");
      }
      if (formData.projectType === "services" && !formData.serviceType) {
        throw new Error("Service Type is required when Project Type is Services.");
      }
      if (formData.hasSchedule && (!formData.startTime.trim() || !formData.endTime.trim())) {
        throw new Error("Start Time and End Time are required when schedule is enabled.");
      }

      const res = await fetch("/api/admin-entries", {
        method: initialData ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: initialData?.id,
          entry: payloadEntry,
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to save local admin entry.");
      }

      router.push("/admin");
      router.refresh();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to save local admin entry.";
      setError(message);
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ display: "flex", gap: "2rem", height: "calc(100vh - 100px)" }}>
      <form onSubmit={handleSubmit} style={{ flex: 1, display: "flex", flexDirection: "column", gap: "1rem", background: "white", padding: "2rem", borderRadius: "8px", overflowY: "auto" }}>
        <h2 style={{ marginTop: 0 }}>{initialData ? "Edit Pin" : "Add New Pin"}</h2>
        
        {error && <div style={{ color: "red", padding: "1rem", background: "#fee2e2", borderRadius: "4px" }}>{error}</div>}

        {!isServicesBatchMode ? (
          <div>
            <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 500 }}>Project / Title *</label>
            <input required type="text" value={formData.name} onChange={e => setFormData(f => ({ ...f, name: e.target.value }))} style={{ width: "100%", padding: "0.5rem", border: "1px solid #ccc", borderRadius: "4px" }} />
          </div>
        ) : (
          <div style={{ padding: "0.5rem 0.75rem", background: "#f9fafb", borderRadius: "6px", fontSize: "0.875rem", color: "#4b5563" }}>
            Service pin names are auto-generated on save.
          </div>
        )}

        {!isServicesBatchMode && (
          <div>
            <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 500 }}>Artist / Host</label>
            <input type="text" value={formData.artist} onChange={e => setFormData(f => ({ ...f, artist: e.target.value }))} style={{ width: "100%", padding: "0.5rem", border: "1px solid #ccc", borderRadius: "4px" }} />
          </div>
        )}

        <div>
          <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 500 }}>Project Type *</label>
          <select
            value={formData.projectType}
            onChange={e => setFormData(f => ({ ...f, projectType: e.target.value as EventType }))}
            style={{ width: "100%", padding: "0.5rem", border: "1px solid #ccc", borderRadius: "4px" }}
          >
            {projectTypeOptions.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </div>

        {formData.projectType === "services" && !isServicesBatchMode && (
          <div>
            <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 500 }}>Service Type *</label>
            <select
              value={formData.serviceType}
              onChange={e => setFormData(f => ({ ...f, serviceType: e.target.value }))}
              style={{ width: "100%", padding: "0.5rem", border: "1px solid #ccc", borderRadius: "4px" }}
            >
              <option value="">Select service type...</option>
              {serviceOptions.map((serviceType) => (
                <option key={serviceType} value={serviceType}>
                  {serviceType}
                </option>
              ))}
            </select>
          </div>
        )}

        {!isServicesBatchMode && (
          <>
            <div>
              <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 500 }}>Abridged Project Text</label>
              <textarea rows={5} value={formData.abridgedProjectText} onChange={e => setFormData(f => ({ ...f, abridgedProjectText: e.target.value }))} style={{ width: "100%", padding: "0.5rem", border: "1px solid #ccc", borderRadius: "4px" }} />
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <input
                id="hasSchedule"
                type="checkbox"
                checked={formData.hasSchedule}
                onChange={(e) => setFormData((f) => ({ ...f, hasSchedule: e.target.checked }))}
              />
              <label htmlFor="hasSchedule" style={{ fontWeight: 500 }}>
                Include schedule (day/start/end)
              </label>
            </div>

            {formData.hasSchedule && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.75rem" }}>
                <div>
                  <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 500 }}>Day *</label>
                  <select
                    value={formData.day}
                    onChange={e => setFormData(f => ({ ...f, day: e.target.value as FestivalDay }))}
                    style={{ width: "100%", padding: "0.5rem", border: "1px solid #ccc", borderRadius: "4px" }}
                  >
                    {dayOptions.map((day) => (
                      <option key={day} value={day}>
                        {day}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 500 }}>Start Time *</label>
                  <input type="text" value={formData.startTime} onChange={e => setFormData(f => ({ ...f, startTime: e.target.value }))} placeholder="e.g. 03/28/2026 2:00 PM" style={{ width: "100%", padding: "0.5rem", border: "1px solid #ccc", borderRadius: "4px" }} />
                </div>
                <div>
                  <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 500 }}>End Time *</label>
                  <input type="text" value={formData.endTime} onChange={e => setFormData(f => ({ ...f, endTime: e.target.value }))} placeholder="e.g. 4:00 PM" style={{ width: "100%", padding: "0.5rem", border: "1px solid #ccc", borderRadius: "4px" }} />
                </div>
              </div>
            )}
          </>
        )}

        {isServicesBatchMode && (
          <div style={{ border: "1px solid #e5e7eb", borderRadius: "6px", padding: "0.75rem" }}>
            <p style={{ margin: "0 0 0.75rem", fontWeight: 500 }}>Service Placement Toolbar *</p>
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
              {serviceOptions.map((serviceType) => (
                <button
                  key={serviceType}
                  type="button"
                  onClick={() => setSelectedServiceTool(serviceType)}
                  style={{
                    padding: "0.4rem 0.6rem",
                    borderRadius: "999px",
                    border: selectedServiceTool === serviceType ? "2px solid #111827" : "1px solid #d1d5db",
                    background: "white",
                    cursor: "pointer",
                    fontWeight: 500,
                  }}
                >
                  {serviceType}
                </button>
              ))}
            </div>
            <p style={{ margin: "0.75rem 0 0", fontSize: "0.875rem", color: "#4b5563" }}>
              Click the map to drop {selectedServiceTool} markers. Pending markers: {servicePins.length}
            </p>
            <button
              type="button"
              onClick={() => setServicePins([])}
              style={{ marginTop: "0.5rem", fontSize: "0.75rem", padding: "0.25rem 0.5rem", borderRadius: "4px", border: "1px solid #d1d5db", background: "white", cursor: "pointer" }}
            >
              Clear Pending Service Markers
            </button>
            {servicePins.length > 0 && (
              <div style={{ marginTop: "0.75rem", display: "grid", gap: "0.35rem", maxHeight: "140px", overflowY: "auto" }}>
                {servicePins.map((pin, idx) => (
                  <div key={pin.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.8rem", border: "1px solid #e5e7eb", borderRadius: "4px", padding: "0.35rem 0.5rem" }}>
                    <span>
                      {idx + 1}. {pin.serviceType} ({pin.lat.toFixed(5)}, {pin.lng.toFixed(5)})
                    </span>
                    <button
                      type="button"
                      onClick={() => removePendingServicePin(pin.id)}
                      style={{ fontSize: "0.75rem", padding: "0.2rem 0.45rem", borderRadius: "4px", border: "1px solid #ef4444", color: "#ef4444", background: "white", cursor: "pointer" }}
                    >
                      Delete
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {!isServicesBatchMode && (
          <div>
            <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 500 }}>Permanence (e.g. Permanent, Temporary)</label>
            <input type="text" value={formData.permanence} onChange={e => setFormData(f => ({ ...f, permanence: e.target.value }))} style={{ width: "100%", padding: "0.5rem", border: "1px solid #ccc", borderRadius: "4px" }} />
          </div>
        )}

        <div style={{ marginTop: "auto", display: "flex", gap: "1rem", paddingTop: "1rem" }}>
          <button type="button" onClick={() => router.push("/admin")} style={{ padding: "0.75rem", background: "#f3f4f6", border: "none", borderRadius: "4px", flex: 1, cursor: "pointer", fontWeight: 500 }}>Cancel</button>
          {isEditing && (
            <button
              type="button"
              onClick={handleDeleteSavedEntry}
              disabled={isDeleting || isSubmitting}
              style={{ padding: "0.75rem", background: "white", border: "1px solid #ef4444", color: "#ef4444", borderRadius: "4px", flex: 1, cursor: isDeleting ? "not-allowed" : "pointer", fontWeight: 600 }}
            >
              {isDeleting ? "Deleting..." : "Delete Entry"}
            </button>
          )}
          <button type="submit" disabled={isSubmitting} style={{ padding: "0.75rem", background: "#2563eb", color: "white", border: "none", borderRadius: "4px", flex: 1, cursor: "pointer", fontWeight: 500 }}>
            {isSubmitting ? "Saving..." : "Save to local admin_entries.json"}
          </button>
        </div>
      </form>

      <div style={{ flex: 1, background: "#e5e7eb", borderRadius: "8px", overflow: "hidden", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "1rem", background: "white", borderBottom: "1px solid #e5e7eb" }}>
          <p style={{ margin: 0, fontWeight: 500 }}>Click on the map to set the exact coordinates.</p>
          <p style={{ margin: 0, fontSize: "0.875rem", color: "#6b7280" }}>
            {isServicesBatchMode
              ? `Pending markers: ${servicePins.length}`
              : `Current location: ${location ? `${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}` : "Not set (will be marked as Unplaced)"}`}
          </p>
          {!isServicesBatchMode && location && (
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
              {!isServicesBatchMode && location && (
                <AdvancedMarker position={location} draggable onDragEnd={handleSingleLocationDragEnd}>
                  <div style={{ width: "20px", height: "20px", background: "#3b82f6", borderRadius: "50%", border: "3px solid white", boxShadow: "0 0 4px rgba(0,0,0,0.5)" }} />
                </AdvancedMarker>
              )}
              {isServicesBatchMode &&
                servicePins.map((pin) => (
                  <AdvancedMarker
                    key={pin.id}
                    position={{ lat: pin.lat, lng: pin.lng }}
                    draggable
                    onDragEnd={(event) => handlePendingPinDragEnd(pin.id, event as { latLng?: { lat: () => number; lng: () => number } | null })}
                  >
                    <button
                      type="button"
                      onClick={() => removePendingServicePin(pin.id)}
                      style={{ width: "26px", height: "26px", display: "grid", placeItems: "center", background: "#111827", color: "white", borderRadius: "999px", border: "2px solid white", boxShadow: "0 0 4px rgba(0,0,0,0.5)", fontSize: "14px", cursor: "pointer" }}
                      title="Click to delete marker"
                    >
                      {pin.serviceType === "toilets" ? "🚻" : pin.serviceType === "water" ? "💧" : pin.serviceType === "garbage" ? "🗑" : "✚"}
                    </button>
                  </AdvancedMarker>
                ))}
            </Map>
          </APIProvider>
        </div>
      </div>
    </div>
  );
}
