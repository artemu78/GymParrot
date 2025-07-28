import React, { useState, useCallback, useRef } from "react";
import WebcamPreview from "./WebcamPreview";
import { mediaPipeService, webcamService, activityService } from "../services";
import type {
  PoseLandmark,
  TimestampedLandmarks,
  ActivityType,
  ActivityMetadata,
} from "../types";
import { ACTIVITY_DURATIONS } from "../utils/constants";

interface ActivityCreatorProps {
  onActivityCreated?: (activityId: string) => void;
  onError?: (error: string) => void;
  className?: string;
}

type RecordingState =
  | "idle"
  | "preparing"
  | "countdown"
  | "recording"
  | "processing"
  | "completed"
  | "error";

const ActivityCreator: React.FC<ActivityCreatorProps> = ({
  onActivityCreated,
  onError,
  className = "",
}) => {
  const [activityType, setActivityType] = useState<ActivityType>("pose");
  const [activityName, setActivityName] = useState("");
  const [duration, setDuration] = useState<number>(ACTIVITY_DURATIONS.short);
  const [recordingState, setRecordingState] = useState<RecordingState>("idle");
  const [recordingProgress, setRecordingProgress] = useState(0);
  const [currentLandmarks, setCurrentLandmarks] = useState<PoseLandmark[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [countdownValue, setCountdownValue] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const [countdownDelay, setCountdownDelay] = useState(3);

  const videoRef = useRef<HTMLVideoElement>(null);
  const recordingDataRef = useRef<TimestampedLandmarks[]>([]);
  const stopTrackingRef = useRef<(() => void) | null>(null);
  const isInitializedRef = useRef<boolean>(false);
  const countdownTimeoutRef = useRef<number | null>(null);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const handleError = useCallback(
    (errorMessage: string) => {
      setError(errorMessage);
      setRecordingState("error");
      onError?.(errorMessage);
    },
    [onError]
  );

  const handleVideoReady = useCallback(
    async (video: HTMLVideoElement) => {
      // Prevent multiple initializations
      if (isInitializedRef.current) return;

      try {
        isInitializedRef.current = true;

        // Initialize MediaPipe when video is ready
        await mediaPipeService.initializePoseLandmarker();

        // Automatically start the camera when video element is ready
        clearError();
        await webcamService.startVideoStream(video);
      } catch (error) {
        isInitializedRef.current = false; // Reset on error
        const message =
          error instanceof Error
            ? error.message
            : "Failed to initialize pose detection or start camera";
        handleError(message);
      }
    },
    [handleError, clearError]
  );

  const startCamera = useCallback(async () => {
    if (!videoRef.current) return;

    try {
      clearError();

      // Initialize MediaPipe if not already done
      if (!isInitializedRef.current) {
        await mediaPipeService.initializePoseLandmarker();
        isInitializedRef.current = true;
      }

      await webcamService.startVideoStream(videoRef.current);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to start camera";
      handleError(message);
    }
  }, [clearError, handleError]);

  const stopCamera = useCallback(() => {
    webcamService.stopVideoStream();
    setCurrentLandmarks([]);
    isInitializedRef.current = false; // Reset initialization flag
  }, []);

  const startCountdown = useCallback(async () => {
    return new Promise<void>((resolve) => {
      // Skip countdown in test environment
      if (process.env.NODE_ENV === "test") {
        setRecordingState("recording");
        resolve();
        return;
      }

      setRecordingState("countdown");
      let count = countdownDelay;
      setCountdownValue(count);

      const countdown = () => {
        if (count > 1) {
          count--;
          setCountdownValue(count);
          countdownTimeoutRef.current = window.setTimeout(countdown, 1000);
        } else {
          setCountdownValue(0);
          setRecordingState("recording");
          resolve();
        }
      };

      countdownTimeoutRef.current = window.setTimeout(countdown, 1000);
    });
  }, [countdownDelay]);

  const cancelCountdown = useCallback(() => {
    if (countdownTimeoutRef.current) {
      window.clearTimeout(countdownTimeoutRef.current);
      countdownTimeoutRef.current = null;
    }
    setCountdownValue(0);
    setRecordingState("idle");
  }, []);

  const startPoseRecording = useCallback(async () => {
    if (!videoRef.current || recordingState !== "idle") return;

    try {
      setRecordingState("preparing");
      clearError();

      // Start camera if not already started
      await startCamera();

      // Start countdown before recording
      await startCountdown();

      // Detect single pose after countdown
      const result = await mediaPipeService.detectSinglePose(videoRef.current);
      const landmarks = mediaPipeService.extractLandmarks(result);

      if (landmarks.length === 0) {
        throw new Error(
          "No pose detected. Please ensure you are visible in the camera."
        );
      }

      // Validate pose quality
      const validation = mediaPipeService.validatePoseQuality(landmarks);
      if (!validation.isValid) {
        throw new Error(`Pose quality issues: ${validation.issues.join(", ")}`);
      }

      setCurrentLandmarks(landmarks);
      setRecordingState("processing");

      // Create pose activity
      const metadata: ActivityMetadata = {
        name: activityName || `Pose Activity ${Date.now()}`,
        type: "pose",
        createdBy: "trainer", // In production, this would come from auth
        isPublic: true,
      };

      const activityId = await activityService.createPoseActivity(
        landmarks,
        metadata
      );

      setRecordingState("completed");

      // Release camera after successful recording
      stopCamera();

      onActivityCreated?.(activityId);
    } catch (error) {
      // Cancel countdown and release camera on error
      cancelCountdown();
      stopCamera();

      const message =
        error instanceof Error ? error.message : "Failed to record pose";
      handleError(message);
    }
  }, [
    recordingState,
    clearError,
    startCamera,
    stopCamera,
    startCountdown,
    cancelCountdown,
    activityName,
    onActivityCreated,
    handleError,
  ]);

  const startMovementRecording = useCallback(async () => {
    if (!videoRef.current || recordingState !== "idle") return;

    try {
      setRecordingState("preparing");
      clearError();

      // Start camera if not already started
      await startCamera();

      setRecordingState("recording");
      recordingDataRef.current = [];
      setRecordingProgress(0);

      // Start movement tracking
      const stopTracking = await mediaPipeService.startMovementTracking(
        videoRef.current,
        (landmarks, timestamp) => {
          recordingDataRef.current.push({ timestamp, landmarks });
          setCurrentLandmarks(landmarks);
        },
        {
          duration,
          onProgress: (elapsed, total) => {
            setRecordingProgress(elapsed / total);
          },
          onComplete: async () => {
            try {
              setRecordingState("processing");

              const sequence = recordingDataRef.current;
              if (sequence.length === 0) {
                throw new Error("No movement data recorded");
              }

              // Validate movement sequence
              const validation =
                mediaPipeService.validateMovementSequence(sequence);
              if (!validation.isValid) {
                throw new Error(
                  `Movement quality issues: ${validation.issues.join(", ")}`
                );
              }

              // Create movement activity
              const metadata: ActivityMetadata = {
                name: activityName || `Movement Activity ${Date.now()}`,
                type: "movement",
                createdBy: "trainer", // In production, this would come from auth
                duration,
                isPublic: true,
              };

              const activityId = await activityService.createMovementActivity(
                sequence,
                metadata
              );

              setRecordingState("completed");

              // Release camera after successful recording
              stopCamera();

              onActivityCreated?.(activityId);
            } catch (error) {
              // Release camera on error
              stopCamera();

              const message =
                error instanceof Error
                  ? error.message
                  : "Failed to save movement";
              handleError(message);
            }
          },
          onError: (error) => {
            // Release camera on error
            stopCamera();
            handleError(error.message);
          },
        }
      );

      stopTrackingRef.current = stopTracking;
    } catch (error) {
      // Release camera on error
      stopCamera();

      const message =
        error instanceof Error
          ? error.message
          : "Failed to start movement recording";
      handleError(message);
    }
  }, [
    recordingState,
    clearError,
    startCamera,
    stopCamera,
    duration,
    activityName,
    onActivityCreated,
    handleError,
  ]);

  const stopRecording = useCallback(() => {
    if (stopTrackingRef.current) {
      stopTrackingRef.current();
      stopTrackingRef.current = null;
    }
    cancelCountdown();
    setRecordingState("idle");
    setRecordingProgress(0);
    recordingDataRef.current = [];
  }, [cancelCountdown]);

  const resetForm = useCallback(() => {
    stopRecording();
    stopCamera();
    setActivityName("");
    setError(null);
    setCurrentLandmarks([]);
    setCountdownValue(0);
    setRecordingState("idle");
  }, [stopRecording, stopCamera]);

  const canStartRecording =
    activityName.trim().length > 0 && recordingState === "idle";
  const isRecording = recordingState === "recording";
  const isProcessing = recordingState === "processing";
  const isCountdown = recordingState === "countdown";

  return (
    <div className={`max-w-4xl mx-auto p-6 ${className}`}>
      <div className="bg-white rounded-lg shadow-lg overflow-hidden">
        {/* Header */}
        <div className="bg-gray-50 px-6 py-4 border-b">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">
                Create Activity
              </h2>
              <p className="text-gray-600 mt-1">
                Record a pose or movement for trainees to practice
              </p>
            </div>
            <div
              onClick={() => setShowSettings(true)}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded-md transition-colors cursor-pointer"
              title="Settings"
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  setShowSettings(true);
                }
              }}
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
            </div>
          </div>
        </div>

        <div className="p-6">
          {/* Form Controls */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            {/* Activity Name */}
            <div>
              <label
                htmlFor="activityName"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Activity Name *
              </label>
              <input
                id="activityName"
                type="text"
                value={activityName}
                onChange={(e) => setActivityName(e.target.value)}
                placeholder="Enter activity name..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={recordingState !== "idle"}
              />
            </div>

            {/* Activity Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Activity Type
              </label>
              <div className="flex space-x-4">
                <label className="flex items-center">
                  <input
                    type="radio"
                    value="pose"
                    checked={activityType === "pose"}
                    onChange={(e) =>
                      setActivityType(e.target.value as ActivityType)
                    }
                    className="mr-2"
                    disabled={recordingState !== "idle"}
                  />
                  <span className="text-sm text-gray-700">Single Pose</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    value="movement"
                    checked={activityType === "movement"}
                    onChange={(e) =>
                      setActivityType(e.target.value as ActivityType)
                    }
                    className="mr-2"
                    disabled={recordingState !== "idle"}
                  />
                  <span className="text-sm text-gray-700">
                    Movement Sequence
                  </span>
                </label>
              </div>
            </div>

            {/* Duration (only for movements) */}
            {activityType === "movement" && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Duration
                </label>
                <select
                  value={duration}
                  onChange={(e) => setDuration(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={recordingState !== "idle"}
                >
                  <option value={ACTIVITY_DURATIONS.short}>10 seconds</option>
                  <option value={ACTIVITY_DURATIONS.long}>30 seconds</option>
                </select>
              </div>
            )}
          </div>

          {/* Error Display */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg
                    className="h-5 w-5 text-red-400"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-red-800">{error}</p>
                </div>
                <div className="ml-auto pl-3">
                  <button
                    onClick={clearError}
                    className="text-red-400 hover:text-red-600"
                  >
                    <span className="sr-only">Dismiss</span>
                    <svg
                      className="h-5 w-5"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Camera Preview */}
          <div className="mb-6 relative flex justify-center">
            <WebcamPreview
              ref={videoRef}
              isActive={true}
              showLandmarks={true}
              landmarks={currentLandmarks}
              isRecording={isRecording}
              recordingProgress={recordingProgress}
              onVideoReady={handleVideoReady}
              onError={handleError}
              className=""
              width={640}
              height={480}
            />

            {/* Countdown Overlay */}
            {recordingState === "countdown" && countdownValue > 0 && (
              <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 rounded-lg">
                <div className="text-center">
                  <div className="text-8xl font-bold text-white mb-4 animate-pulse">
                    {countdownValue}
                  </div>
                  <p className="text-xl text-white">Get ready to pose!</p>
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex justify-center space-x-4">
            {recordingState === "idle" && (
              <>
                <button
                  onClick={
                    activityType === "pose"
                      ? startPoseRecording
                      : startMovementRecording
                  }
                  disabled={!canStartRecording}
                  className="px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                  data-testid="start-recording-button"
                >
                  Start Recording
                </button>
                <button
                  onClick={startCamera}
                  className="px-6 py-3 bg-gray-600 text-white rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 font-medium"
                >
                  Test Camera
                </button>
              </>
            )}

            {(isRecording || isCountdown) && (
              <button
                onClick={stopRecording}
                className="px-6 py-3 bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 font-medium"
              >
                {isCountdown ? "Cancel" : "Stop Recording"}
              </button>
            )}

            {isProcessing && (
              <div className="flex items-center space-x-2">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                <span className="text-gray-600">Processing...</span>
              </div>
            )}

            {recordingState === "completed" && (
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2 text-green-600">
                  <svg
                    className="h-5 w-5"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span className="font-medium">
                    Activity Created Successfully!
                  </span>
                </div>
                <button
                  onClick={resetForm}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 font-medium"
                >
                  Create Another
                </button>
              </div>
            )}

            {recordingState === "error" && (
              <button
                onClick={resetForm}
                className="px-6 py-3 bg-gray-600 text-white rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 font-medium"
              >
                Try Again
              </button>
            )}
          </div>

          {/* Instructions */}
          <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-md">
            <h3 className="text-sm font-medium text-blue-800 mb-2">
              Instructions:
            </h3>
            <ul className="text-sm text-blue-700 space-y-1">
              {activityType === "pose" ? (
                <>
                  <li>• Enter a name for your pose activity</li>
                  <li>• Position yourself in front of the camera</li>
                  <li>
                    • Click "Start Recording" - you'll see a {countdownDelay}
                    -second countdown
                  </li>
                  <li>• hold your pose when the countdown reaches zero</li>
                  <li>
                    • Make sure your whole body is visible for best results
                  </li>
                </>
              ) : (
                <>
                  <li>• Enter a name for your movement activity</li>
                  <li>• Choose the duration (10 or 30 seconds)</li>
                  <li>• Position yourself in front of the camera</li>
                  <li>• Click "Start Recording" and perform your movement</li>
                  <li>
                    • Keep your whole body visible throughout the movement
                  </li>
                </>
              )}
            </ul>
          </div>
        </div>
      </div>

      {/* Settings Modal */}
      {showSettings && process.env.NODE_ENV !== "test" && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="px-6 py-4 border-b">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold text-gray-900">
                  Settings
                </h3>
                <button
                  onClick={() => setShowSettings(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg
                    className="w-6 h-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
            </div>

            <div className="px-6 py-4">
              <div className="space-y-4">
                {/* Countdown Delay Setting */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Pose Recording Countdown Delay
                  </label>
                  <div className="space-y-2">
                    <div className="flex items-center space-x-4">
                      <span className="text-sm text-gray-500 w-12">1s</span>
                      <input
                        type="range"
                        min="1"
                        max="30"
                        value={countdownDelay}
                        onChange={(e) =>
                          setCountdownDelay(Number(e.target.value))
                        }
                        className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                      />
                      <span className="text-sm text-gray-500 w-12">30s</span>
                    </div>
                    <div className="text-center">
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                        {countdownDelay} second
                        {countdownDelay !== 1 ? "s" : ""}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500">
                      Time to get into position before pose is captured
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t bg-gray-50 flex justify-end">
              <button
                onClick={() => setShowSettings(false)}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 font-medium"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ActivityCreator;
