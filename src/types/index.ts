// Core data types for the activity system

export interface PoseLandmark {
  x: number;
  y: number;
  z: number;
  visibility?: number;
}

export interface TimestampedLandmarks {
  timestamp: number;
  landmarks: PoseLandmark[];
}

export type ActivityType = "pose" | "movement";
export type DifficultyLevel = "soft" | "medium" | "hard";

export interface ActivityMetadata {
  name: string;
  type: ActivityType;
  createdBy: string;
  duration?: number;
  isPublic: boolean;
}

export interface Activity {
  id: string;
  type: ActivityType;
  name: string;
  createdBy: string;
  createdAt: Date;
  duration?: number;
  isPublic: boolean;
  imageData?: string; // Base64-encoded image for pose activities
  landmarks: PoseLandmark[] | TimestampedLandmarks[];
  // Type-specific data
  poseData?: PoseLandmark[];
  movementData?: TimestampedLandmarks[];
  // Movement-activity reference video (MediaRecorder output, typically WebM)
  // The video is stored separately as a Blob (IndexedDB or cloud backend) and
  // referenced here by id. `videoUrl` may be used when the backend returns a
  // remote URL directly; clients can call VideoBlobStore.resolveUrl() to get a
  // playable object URL for either case.
  videoBlobId?: string;
  videoUrl?: string;
  videoMimeType?: string;
}

export interface ComparisonResult {
  isMatch: boolean;
  score: number;
  feedback: string[];
  suggestions: string[];
}

// Error types
export class MediaPipeError extends Error {
  constructor(
    message: string,
    public code?: string
  ) {
    super(message);
    this.name = "MediaPipeError";
  }
}

export class WebcamError extends Error {
  constructor(
    message: string,
    public code?: string
  ) {
    super(message);
    this.name = "WebcamError";
  }
}

export class ActivityError extends Error {
  constructor(
    message: string,
    public code?: string
  ) {
    super(message);
    this.name = "ActivityError";
  }
}
