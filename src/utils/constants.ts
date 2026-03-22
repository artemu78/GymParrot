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

// Performance optimization constants
export const PERFORMANCE_CONFIG = {
  // Frame rate optimization
  TARGET_FPS: 30,
  MIN_FPS: 15,
  MAX_FPS: 60,
  FRAME_SKIP_THRESHOLD: 100, // Skip frame if processing takes longer than 100ms
  
  // Memory management
  MAX_TRACKING_DURATION: 300000, // 5 minutes max continuous tracking
  MEMORY_CLEANUP_INTERVAL: 30000, // Clean up every 30 seconds
  MAX_POSE_HISTORY: 1000, // Maximum poses to keep in memory
  
  // Storage optimization
  IMAGE_QUALITY: 0.8, // JPEG quality for captured images
  LANDMARK_PRECISION: 4, // Decimal places for landmark coordinates
  COMPRESSION_ENABLED: true,
  
  // Lazy loading
  ACTIVITIES_PAGE_SIZE: 12, // Number of activities to load per page
  PRELOAD_THRESHOLD: 3, // Start loading next page when 3 items from end
  
  // Model caching
  MODEL_CACHE_DURATION: 3600000, // 1 hour in milliseconds
  ENABLE_MODEL_CACHING: true,
  
  // Performance monitoring
  ENABLE_PERFORMANCE_MONITORING: true,
  PERFORMANCE_LOG_INTERVAL: 5000, // Log performance metrics every 5 seconds
  FPS_SAMPLE_SIZE: 30, // Number of frames to average for FPS calculation
} as const

// Performance thresholds for warnings
export const PERFORMANCE_THRESHOLDS = {
  LOW_FPS_WARNING: 20,
  HIGH_MEMORY_WARNING: 100 * 1024 * 1024, // 100MB
  SLOW_PROCESSING_WARNING: 50, // 50ms per frame
} as const

export const ERROR_MESSAGES = {
  CAMERA_PERMISSION_DENIED: 'Camera access denied. Please allow camera permissions to record activities.',
  CAMERA_NOT_AVAILABLE: 'Camera not available. Please check your camera connection.',
  MEDIAPIPE_INIT_FAILED: 'Failed to initialize pose detection. Please refresh and try again.',
  ACTIVITY_SAVE_FAILED: 'Failed to save activity. Please try again.',
  ACTIVITY_LOAD_FAILED: 'Failed to load activities. Please refresh and try again.',
  POSE_DETECTION_FAILED: 'Pose detection failed. Please ensure you are visible in the camera.'
} as const