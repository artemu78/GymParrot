export type RecordingState =
  | "idle"
  | "preparing"
  | "countdown"
  | "capturing"
  | "reviewing"
  | "recording"
  | "processing"
  | "completed"
  | "error";

export interface ActivityCreatorProps {
  initialType?: "pose" | "movement";
  onActivityCreated?: (activityId: string) => void;
  onError?: (error: string) => void;
  onTypeChange?: (type: "pose" | "movement") => void;
  className?: string;
}
