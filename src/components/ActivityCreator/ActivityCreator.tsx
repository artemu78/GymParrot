import React, { useState, useCallback, useRef, useEffect } from "react";
import WebcamPreview from "../WebcamPreview";
import { mediaPipeService, webcamService, activityService } from "../../services";
import { MovementVideoRecorder } from "../../services/MovementVideoRecorder";
import type {
  PoseLandmark,
  TimestampedLandmarks,
  ActivityType,
  ActivityMetadata,
} from "../../types";
import { ACTIVITY_DURATIONS } from "../../utils/constants";
import { captureImageFromVideo } from "./utils";
import type { RecordingState, ActivityCreatorProps } from "./types";
import CountdownOverlay from "./CountdownOverlay";
import CapturingFlash from "./CapturingFlash";
import CapturedPoseView from "./CapturedPoseView";
import MovementReviewView from "./MovementReviewView";
import ActionButtons from "./ActionButtons";
import ErrorDisplay from "./ErrorDisplay";
import Instructions from "./Instructions";
import SettingsModal from "./SettingsModal";

const ActivityCreator: React.FC<ActivityCreatorProps> = ({
  initialType,
  onActivityCreated,
  onError,
  onTypeChange,
  className = "",
}) => {
  const [activityType, setActivityType] = useState<ActivityType>(initialType || "pose");
  const [activityName, setActivityName] = useState("");
  const [duration, setDuration] = useState<number>(ACTIVITY_DURATIONS.short);
  const [recordingState, setRecordingState] = useState<RecordingState>("idle");
  const [recordingProgress, setRecordingProgress] = useState(0);
  const [currentLandmarks, setCurrentLandmarks] = useState<PoseLandmark[]>([]);
  const [capturedLandmarks, setCapturedLandmarks] = useState<PoseLandmark[]>([]);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [countdownValue, setCountdownValue] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const [countdownDelay, setCountdownDelay] = useState(3);
  const [isCameraActive, setIsCameraActive] = useState(false);

  const [recordedVideoUrl, setRecordedVideoUrl] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const recordingDataRef = useRef<TimestampedLandmarks[]>([]);
  const stopTrackingRef = useRef<(() => void) | null>(null);
  const isInitializedRef = useRef<boolean>(false);
  const countdownTimeoutRef = useRef<number | null>(null);
  const videoRecorderRef = useRef<MovementVideoRecorder | null>(null);
  const recordedVideoRef = useRef<{ blob: Blob; mimeType: string } | null>(null);

  useEffect(() => {
    const url = recordedVideoUrl;
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [recordedVideoUrl]);

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
      videoRef.current = video;
    },
    []
  );

  const startCamera = useCallback(async () => {
    if (!videoRef.current) return;

    try {
      clearError();

      if (!isInitializedRef.current) {
        await mediaPipeService.initializePoseLandmarker();
        isInitializedRef.current = true;
      }

      await webcamService.startVideoStream(videoRef.current);
      setIsCameraActive(true);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to start camera";
      handleError(message);
    }
  }, [clearError, handleError]);

  const stopCamera = useCallback(() => {
    webcamService.stopVideoStream();
    setCurrentLandmarks([]);
    setIsCameraActive(false);
    isInitializedRef.current = false;
  }, []);

  const toggleCamera = useCallback(async () => {
    if (isCameraActive) {
      stopCamera();
    } else {
      await startCamera();
    }
  }, [isCameraActive, stopCamera, startCamera]);

  const startCountdown = useCallback(async () => {
    return new Promise<void>((resolve) => {
      if (process.env.NODE_ENV === "test") {
        setRecordingState("recording");
        resolve();
        return;
      }

      setRecordingState("countdown");
      let count = countdownDelay;
      setCountdownValue(count);

      const countdown = () => {
        if (count > 0) {
          count--;
          setCountdownValue(count);
          if (count === 0) {
            countdownTimeoutRef.current = window.setTimeout(() => {
              setRecordingState("recording");
              resolve();
            }, 500);
          } else {
            countdownTimeoutRef.current = window.setTimeout(countdown, 1000);
          }
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

    let stopTracking: (() => void) | null = null;

    try {
      setRecordingState("preparing");
      clearError();

      await startCamera();

      stopTracking = await mediaPipeService.startMovementTracking(
        videoRef.current,
        (landmarks) => {
          setCurrentLandmarks(landmarks);
        },
        {
          duration: 999999999,
        }
      );

      await startCountdown();

      if (stopTracking) {
        stopTracking();
        stopTracking = null;
      }

      setRecordingState("capturing");
      await new Promise((resolve) => setTimeout(resolve, 300));

      const result = await mediaPipeService.detectSinglePose(videoRef.current);
      const landmarks = mediaPipeService.extractLandmarks(result);

      if (landmarks.length === 0) {
        throw new Error(
          "No pose detected. Please ensure you are visible in the camera."
        );
      }

      const validation = mediaPipeService.validatePoseQuality(landmarks);
      if (!validation.isValid) {
        throw new Error(`Pose quality issues: ${validation.issues.join(", ")}`);
      }

      const imageDataUrl = captureImageFromVideo(videoRef.current);

      setCapturedLandmarks(landmarks);
      setCurrentLandmarks(landmarks);
      setCapturedImage(imageDataUrl);
      setRecordingState("reviewing");

      stopCamera();
    } catch (error) {
      if (stopTracking) {
        stopTracking();
      }
      
      cancelCountdown();
      stopCamera();
      setCurrentLandmarks([]);

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
    handleError,
  ]);

  const approvePose = useCallback(async () => {
    if (recordingState !== "reviewing" || capturedLandmarks.length === 0) return;

    try {
      setRecordingState("processing");

      const metadata: ActivityMetadata = {
        name: activityName || `Pose Activity ${Date.now()}`,
        type: "pose",
        createdBy: "trainer",
        isPublic: true,
      };

      const activityId = await activityService.createPoseActivity(
        capturedLandmarks,
        metadata,
        capturedImage || undefined
      );

      setRecordingState("completed");
      await new Promise((resolve) => setTimeout(resolve, 1000));

      stopCamera();
      onActivityCreated?.(activityId);
    } catch (error) {
      stopCamera();
      const message =
        error instanceof Error ? error.message : "Failed to save pose";
      handleError(message);
    }
  }, [
    recordingState,
    capturedLandmarks,
    activityName,
    stopCamera,
    onActivityCreated,
    handleError,
    capturedImage,
  ]);

  const retakePose = useCallback(() => {
    setCapturedLandmarks([]);
    setCurrentLandmarks([]);
    setCapturedImage(null);
    setRecordingState("idle");
  }, []);

  const startMovementRecording = useCallback(async () => {
    if (!videoRef.current || recordingState !== "idle") return;

    try {
      setRecordingState("preparing");
      clearError();

      await startCamera();

      setRecordingState("recording");
      recordingDataRef.current = [];
      setRecordingProgress(0);

      const videoEl = videoRef.current;
      if (!videoEl) throw new Error("Video element not ready");

      // Start real-video recording (landmarks baked into the frame).
      if (MovementVideoRecorder.isSupported()) {
        try {
          const recorder = new MovementVideoRecorder(videoEl, { frameRate: 30 });
          recorder.start();
          videoRecorderRef.current = recorder;
        } catch (err) {
          console.warn("Video recording unavailable, continuing without video:", err);
          videoRecorderRef.current = null;
        }
      } else {
        console.warn("MediaRecorder not supported – movement will be saved without video");
      }

      const stopTracking = await mediaPipeService.startMovementTracking(
        videoRef.current,
        (landmarks, timestamp) => {
          recordingDataRef.current.push({ timestamp, landmarks });
          setCurrentLandmarks(landmarks);
          if (videoRecorderRef.current) {
            videoRecorderRef.current.pushLandmarks(landmarks);
          }
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

              const validation =
                mediaPipeService.validateMovementSequence(sequence);
              if (!validation.isValid) {
                throw new Error(
                  `Movement quality issues: ${validation.issues.join(", ")}`
                );
              }

              // Stop video recording and collect the blob for review.
              let recordedVideo: { blob: Blob; mimeType: string } | null = null;
              if (videoRecorderRef.current) {
                try {
                  const result = await videoRecorderRef.current.stop();
                  if (result.blob.size > 0) {
                    recordedVideo = { blob: result.blob, mimeType: result.mimeType };
                  }
                } catch (err) {
                  console.warn("Failed to finalize video recording:", err);
                } finally {
                  videoRecorderRef.current = null;
                }
              }

              recordedVideoRef.current = recordedVideo;
              if (recordedVideo) {
                setRecordedVideoUrl(URL.createObjectURL(recordedVideo.blob));
              } else {
                setRecordedVideoUrl(null);
              }

              stopCamera();
              setRecordingState("reviewing");
            } catch (error) {
              if (videoRecorderRef.current) {
                videoRecorderRef.current.cancel();
                videoRecorderRef.current = null;
              }
              stopCamera();

              const message =
                error instanceof Error
                  ? error.message
                  : "Failed to save movement";
              handleError(message);
            }
          },
          onError: (error) => {
            if (videoRecorderRef.current) {
              videoRecorderRef.current.cancel();
              videoRecorderRef.current = null;
            }
            stopCamera();
            handleError(error.message);
          },
        }
      );

      stopTrackingRef.current = stopTracking;
    } catch (error) {
      if (videoRecorderRef.current) {
        videoRecorderRef.current.cancel();
        videoRecorderRef.current = null;
      }
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
    handleError,
  ]);

  const approveMovement = useCallback(async () => {
    if (recordingState !== "reviewing") return;
    const sequence = recordingDataRef.current;
    if (sequence.length === 0) {
      handleError("No movement data to save");
      return;
    }

    try {
      setRecordingState("processing");

      const metadata: ActivityMetadata = {
        name: activityName || `Movement Activity ${Date.now()}`,
        type: "movement",
        createdBy: "trainer",
        duration,
        isPublic: true,
      };

      const activityId = await activityService.createMovementActivity(
        sequence,
        metadata,
        recordedVideoRef.current ?? undefined
      );

      recordedVideoRef.current = null;
      setRecordedVideoUrl(null);
      setRecordingState("completed");
      onActivityCreated?.(activityId);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to save movement";
      handleError(message);
    }
  }, [recordingState, activityName, duration, onActivityCreated, handleError]);

  const retakeMovement = useCallback(() => {
    recordingDataRef.current = [];
    recordedVideoRef.current = null;
    setRecordedVideoUrl(null);
    setCurrentLandmarks([]);
    setRecordingProgress(0);
    setRecordingState("idle");
  }, []);

  const stopRecording = useCallback(() => {
    if (stopTrackingRef.current) {
      stopTrackingRef.current();
      stopTrackingRef.current = null;
    }
    if (videoRecorderRef.current) {
      videoRecorderRef.current.cancel();
      videoRecorderRef.current = null;
    }
    recordedVideoRef.current = null;
    setRecordedVideoUrl(null);
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
    setCapturedLandmarks([]);
    setCapturedImage(null);
    setCountdownValue(0);
    setRecordingState("idle");
  }, [stopRecording, stopCamera]);

  const canStartRecording =
    activityName.trim().length > 0 && recordingState === "idle";
  const isRecording = recordingState === "recording";

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
                disabled={recordingState !== "idle" && recordingState !== "reviewing"}
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
                    onChange={(e) => {
                        const newType = e.target.value as ActivityType;
                        setActivityType(newType);
                        onTypeChange?.(newType);
                    }}
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
                    onChange={(e) => {
                        const newType = e.target.value as ActivityType;
                        setActivityType(newType);
                        onTypeChange?.(newType);
                    }}
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
          {error && <ErrorDisplay error={error} onClear={clearError} />}

          {/* Camera Preview */}
          <div className="mb-6 flex flex-col items-center">
            {recordingState === "reviewing" && activityType === "movement" ? (
              <MovementReviewView
                videoUrl={recordedVideoUrl}
                sequence={recordingDataRef.current}
              />
            ) : recordingState === "reviewing" && capturedImage ? (
              <CapturedPoseView
                capturedImage={capturedImage}
                capturedLandmarks={capturedLandmarks}
              />
            ) : (
              <div className="relative">
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

                {recordingState === "countdown" && (
                  <CountdownOverlay countdownValue={countdownValue} />
                )}

                {recordingState === "capturing" && <CapturingFlash />}
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <ActionButtons
            recordingState={recordingState}
            canStartRecording={canStartRecording}
            isCameraActive={isCameraActive}
            isCapturing={recordingState === "capturing"}
            activityType={activityType}
            onStartRecording={
              activityType === "pose"
                ? startPoseRecording
                : startMovementRecording
            }
            onToggleCamera={toggleCamera}
            onStopRecording={stopRecording}
            onApprovePose={
              activityType === "movement" ? approveMovement : approvePose
            }
            onRetakePose={
              activityType === "movement" ? retakeMovement : retakePose
            }
            onResetForm={resetForm}
          />

          {/* Instructions */}
          <Instructions
            activityType={activityType}
            countdownDelay={countdownDelay}
          />
        </div>
      </div>

      {/* Settings Modal */}
      <SettingsModal
        isOpen={showSettings}
        countdownDelay={countdownDelay}
        onCountdownDelayChange={setCountdownDelay}
        onClose={() => setShowSettings(false)}
      />
    </div>
  );
};

export default ActivityCreator;
