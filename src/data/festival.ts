import { FestivalDay, FestivalEvent, EventType, Venue } from "@/types/festival";

export const MAP_DIMENSIONS = {
  width: 7967.36,
  height: 6847.15,
};

export const dayLabels: Record<FestivalDay, string> = {
  fri: "Friday",
  sat: "Saturday",
  sun: "Sunday",
};

export const eventTypeLabels: Record<EventType, string> = {
  music: "Music",
  performance: "Performance",
  installation: "Installation",
  lecture: "Lecture",
  community: "Community",
};

export const venues: Venue[] = [
  {
    id: "drive-in",
    name: "The Drive-In",
    label: "Drive-In",
    shortDescription: "A large-format gathering point for headline performances and twilight screenings.",
    description:
      "The Drive-In anchors the western festival edge with room for larger audiences, roaming arrivals, and a mix of scheduled and ambient programming.",
    x: 4340,
    y: 3350,
    lat: 33.351,
    lng: -115.734,
    thumbnailUrl: "/map-layers/image_BB_map.jpg",
    accent: "#bc5c2d",
  },
  {
    id: "community-center",
    name: "BB Community Center",
    label: "Community Center",
    shortDescription: "Talks, workshops, and civic programming with easy daytime access.",
    description:
      "The Community Center is the MVP model for a venue that needs a strong identity, a clear daily schedule, and dense descriptive context in the sidebar.",
    x: 2860,
    y: 2700,
    lat: 33.352,
    lng: -115.732,
    thumbnailUrl: "/map-layers/image_BB_map.jpg",
    accent: "#22726f",
  },
  {
    id: "temple-method",
    name: "Temple to the Scientific Method",
    label: "Temple",
    shortDescription: "A concept-driven venue for readings, lectures, and nighttime performance interventions.",
    description:
      "This venue is a good stand-in for programming that crosses categories and needs richer editorial storytelling than a simple marker label.",
    x: 6350,
    y: 2450,
    lat: 33.353,
    lng: -115.730,
    thumbnailUrl: "/map-layers/image_BB_map.jpg",
    accent: "#9f2f63",
  },
  {
    id: "opera-house",
    name: "The Opera House",
    label: "Opera House",
    shortDescription: "An intimate schedule cluster for chamber performances and hosted encounters.",
    description:
      "The Opera House demonstrates how a smaller venue can still hold multiple event types and deserve a focused inspect state.",
    x: 3860,
    y: 5450,
    lat: 33.350,
    lng: -115.731,
    thumbnailUrl: "/map-layers/image_BB_map.jpg",
    accent: "#3c5fb1",
  },
  {
    id: "sub-club",
    name: "The Sub Club",
    label: "Sub Club",
    shortDescription: "Late-night music and social energy near the southern edge of the map.",
    description:
      "The Sub Club is useful for testing bottom-of-map labels, nighttime programming, and denser schedule grouping against a single venue.",
    x: 5050,
    y: 6330,
    lat: 33.349,
    lng: -115.729,
    thumbnailUrl: "/map-layers/image_BB_map.jpg",
    accent: "#5b7a24",
  },
];

export const events: FestivalEvent[] = [
  {
    id: "sunset-soundcheck",
    venueId: "drive-in",
    title: "Sunset Soundcheck",
    host: "Drive-In Crew",
    description:
      "A Friday evening warm-up with sound installation tests, roaming projection, and low-pressure arrival energy.",
    day: "fri",
    startTime: "5:30 PM",
    endTime: "7:00 PM",
    type: "music",
    thumbnailUrl: "/map-layers/image_BB_map.jpg",
  },
  {
    id: "midnight-projection",
    venueId: "drive-in",
    title: "Midnight Projection Assembly",
    host: "Visiting Media Artists",
    description:
      "Expanded-cinema pieces spill across the lot after dark, combining projected image, live sound, and open seating.",
    day: "sat",
    startTime: "10:00 PM",
    endTime: "11:45 PM",
    type: "performance",
    thumbnailUrl: "/map-layers/image_BB_map.jpg",
  },
  {
    id: "desert-civic-hour",
    venueId: "community-center",
    title: "Desert Civic Hour",
    host: "Community Organizers",
    description:
      "A practical conversation on infrastructure, mutual aid, and desert stewardship framed for locals, artists, and guests.",
    day: "fri",
    startTime: "1:00 PM",
    endTime: "2:15 PM",
    type: "community",
    thumbnailUrl: "/map-layers/image_BB_map.jpg",
  },
  {
    id: "publishing-workshop",
    venueId: "community-center",
    title: "Publishing as Public Practice",
    host: "Guest Editors",
    description:
      "A Saturday workshop on small-run publishing, artist books, and building temporary publics through print.",
    day: "sat",
    startTime: "11:00 AM",
    endTime: "12:30 PM",
    type: "lecture",
    thumbnailUrl: "/map-layers/image_BB_map.jpg",
  },
  {
    id: "rituals-of-proof",
    venueId: "temple-method",
    title: "Rituals of Proof",
    host: "Temple Collective",
    description:
      "Readings and staged demonstrations blur the line between lecture, invocation, and score-based performance.",
    day: "sat",
    startTime: "6:00 PM",
    endTime: "7:30 PM",
    type: "lecture",
    thumbnailUrl: "/map-layers/image_BB_map.jpg",
  },
  {
    id: "night-lab",
    venueId: "temple-method",
    title: "Night Lab for Impossible Instruments",
    host: "Experimental Ensemble",
    description:
      "An evening performance session built around custom instruments, amplification experiments, and audience circulation.",
    day: "sun",
    startTime: "8:30 PM",
    endTime: "9:45 PM",
    type: "performance",
    thumbnailUrl: "/map-layers/image_BB_map.jpg",
  },
  {
    id: "chamber-echoes",
    venueId: "opera-house",
    title: "Chamber Echoes",
    host: "Opera House Residents",
    description:
      "Voices, strings, and spoken fragments unfold as a sequence of intimate micro-performances across the afternoon.",
    day: "sun",
    startTime: "2:00 PM",
    endTime: "3:20 PM",
    type: "music",
    thumbnailUrl: "/map-layers/image_BB_map.jpg",
  },
  {
    id: "open-parlor",
    venueId: "opera-house",
    title: "Open Parlor",
    host: "Festival Hosts",
    description:
      "A social-format installation with hosted drop-ins, informal readings, and room-scale listening.",
    day: "fri",
    startTime: "3:00 PM",
    endTime: "5:00 PM",
    type: "installation",
    thumbnailUrl: "/map-layers/image_BB_map.jpg",
  },
  {
    id: "afterhours-salton",
    venueId: "sub-club",
    title: "Afterhours Salton",
    host: "Sub Club DJs",
    description:
      "A late-night dance block that tests how the schedule can communicate venue-specific energy without losing legibility.",
    day: "sat",
    startTime: "11:30 PM",
    endTime: "1:00 AM",
    type: "music",
    thumbnailUrl: "/map-layers/image_BB_map.jpg",
  },
  {
    id: "brunch-frequency",
    venueId: "sub-club",
    title: "Brunch Frequency",
    host: "Neighborhood Broadcast",
    description:
      "A Sunday social broadcast with live radio, ambient performance, and low-stakes gathering energy.",
    day: "sun",
    startTime: "11:00 AM",
    endTime: "12:15 PM",
    type: "community",
    thumbnailUrl: "/map-layers/image_BB_map.jpg",
  },
];
