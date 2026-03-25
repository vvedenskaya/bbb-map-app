export type FestivalDay = "fri" | "sat" | "sun";

export type EventType =
  | "music"
  | "performance"
  | "installation"
  | "lecture"
  | "community"
  | "social"
  | "object"
  | "experience"
  | "film"
  | "dj"
  | "venue"
  | "food";

export type Venue = {
  id: string;
  name: string;
  label: string;
  shortDescription: string;
  description: string;
  x: number;
  y: number;
  lat?: number;
  lng?: number;
  hasLocation?: boolean;
  permanence?: string;
  thumbnailUrl: string;
  accent: string;
};

export type FestivalEvent = {
  id: string;
  venueId: string;
  title: string;
  host: string;
  description: string;
  day: FestivalDay;
  startTime: string;
  endTime: string;
  type: EventType;
  thumbnailUrl: string;
  lat?: number;
  lng?: number;
  hasLocation?: boolean;
  permanence?: string;
};
