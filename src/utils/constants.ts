// Constants for the activity system

export const DIFFICULTY_THRESHOLDS = {
  soft: 0.7,
  medium: 0.8,
  hard: 0.9
} as const

export const ACTIVITY_DURATIONS = {
  short: 10000, // 10 seconds in milliseconds
  long: 30000   // 30 seconds in milliseconds
} as const

export const MEDIAPIPE_CONFIG = {
  baseOptions: {
    modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
    delegate: 'GPU'
  },
  runningMode: 'VIDEO',
  numPoses: 1
} as const

export const ERROR_MESSAGES = {
  CAMERA_PERMISSION_DENIED: 'Camera access denied. Please allow camera permissions to record activities.',
  CAMERA_NOT_AVAILABLE: 'Camera not available. Please check your camera connection.',
  MEDIAPIPE_INIT_FAILED: 'Failed to initialize pose detection. Please refresh and try again.',
  ACTIVITY_SAVE_FAILED: 'Failed to save activity. Please try again.',
  ACTIVITY_LOAD_FAILED: 'Failed to load activities. Please refresh and try again.',
  POSE_DETECTION_FAILED: 'Pose detection failed. Please ensure you are visible in the camera.'
} as const