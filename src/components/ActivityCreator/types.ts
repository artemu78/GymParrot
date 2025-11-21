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
  onActivityCreated?: (activityId: string) => void;
  onError?: (error: string) => void;
  className?: string;
}
