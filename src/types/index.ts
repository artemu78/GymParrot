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
  landmarks: PoseLandmark[] | TimestampedLandmarks[];
  // Type-specific data
  poseData?: PoseLandmark[];
  movementData?: TimestampedLandmarks[];
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
