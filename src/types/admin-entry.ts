import { EventType, FestivalDay } from "@/types/festival";

export type ServiceType = "garbage" | "water" | "toilets" | "medic";

export type AdminEntry = {
  id: string;
  name: string;
  artist: string;
  locationInternal: string;
  projectType: EventType;
  serviceType?: ServiceType;
  abridgedProjectText: string;
  day: FestivalDay;
  startTime: string;
  endTime: string;
  hasSchedule: boolean;
  permanence: string;
  lat?: number;
  lng?: number;
  hasLocation: boolean;
};

export type AdminEntriesFile = {
  entries: AdminEntry[];
};
