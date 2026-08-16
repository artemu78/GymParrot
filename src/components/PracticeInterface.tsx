import React, { useState, useCallback, useRef, useEffect } from "react";
import WebcamPreview from "./WebcamPreview";
import VideoReferencePlayer from "./VideoReferencePlayer";
import {
  mediaPipeService,
  webcamService,
  comparisonService,
  activityService,
} from "../services";
import { MovementVideoRecorder } from "../services/MovementVideoRecorder";
import PerformancePanel from "./PerformancePanel";
import { MEDIAPIPE_CONFIG } from "../utils/constants";
import type {
  PoseLandmark,
  TimestampedLandmarks,
  Activity,
  DifficultyLevel,
  ComparisonResult,
} from "../types";

/**
 * Component to render pose landmarks as an SVG overlay
 * @param landmarks - Array of pose landmarks to render
 */
interface PoseLandmarkOverlayProps {
  landmarks: PoseLandmark[];
  sourceWidth: number;
  sourceHeight: number;
}

const PoseLandmarkOverlay: React.FC<PoseLandmarkOverlayProps> = ({
  landmarks,
  sourceWidth,
  sourceHeight,
}) => {
  if (!landmarks || landmarks.length === 0) {
    return null;
  }

  // MediaPipe pose connections for drawing skeleton
  const connections = [
    // Face
    [0, 1],
    [1, 2],
    [2, 3],
    [3, 7],
    [0, 4],
    [4, 5],
    [5, 6],
    [6, 8],
    // Body
    [9, 10],
    [11, 12],
    [11, 13],
    [13, 15],
    [15, 17],
    [15, 19],
    [15, 21],
    [12, 14],
    [14, 16],
    [16, 18],
    [16, 20],
    [16, 22],
    // Legs
    [11, 23],
    [12, 24],
    [23, 24],
    [23, 25],
    [25, 27],
    [27, 29],
    [29, 31],
    [24, 26],
    [26, 28],
    [28, 30],
    [30, 32],
  ];

  return (
    <svg
      className="absolute inset-0 pointer-events-none w-full h-full"
      viewBox={`0 0 ${sourceWidth} ${sourceHeight}`}
      preserveAspectRatio="xMidYMid meet"
    >
      {/* Draw connections */}
      {connections.map(([startIdx, endIdx], index) => {
        const startLandmark = landmarks[startIdx];
        const endLandmark = landmarks[endIdx];

        if (
          !startLandmark ||
          !endLandmark ||
          (startLandmark.visibility || 1) < 0.5 ||
          (endLandmark.visibility || 1) < 0.5
        ) {
          return null;
        }

        return (
          <line
            key={index}
            x1={startLandmark.x * sourceWidth}
            y1={startLandmark.y * sourceHeight}
            x2={endLandmark.x * sourceWidth}
            y2={endLandmark.y * sourceHeight}
            stroke="#00ff00"
            strokeWidth={Math.min(sourceWidth, sourceHeight) * 0.003}
            opacity="0.8"
          />
        );
      })}

      {/* Draw landmarks */}
      {landmarks.map((landmark, index) => {
        if ((landmark.visibility || 1) < 0.5) return null;

        return (
          <circle
            key={index}
            cx={landmark.x * sourceWidth}
            cy={landmark.y * sourceHeight}
            r={Math.min(sourceWidth, sourceHeight) * 0.005}
            fill="#ff0000"
            opacity="0.9"
          />
        );
      })}
    </svg>
  );
};

interface PoseImageWithOverlayProps {
  src: string;
  alt: string;
  landmarks?: PoseLandmark[];
  mirrorImage?: boolean;
  mirrorOverlay?: boolean;
}

const PoseImageWithOverlay: React.FC<PoseImageWithOverlayProps> = ({
  src,
  alt,
  landmarks = [],
  mirrorImage = false,
  mirrorOverlay = false,
}) => {
  const [dimensions, setDimensions] = useState({ width: 1, height: 1 });

  return (
    <>
      <img
        src={src}
        alt={alt}
        className="w-full h-full object-contain"
        style={{ transform: mirrorImage ? "scaleX(-1)" : undefined }}
        onLoad={(event) => {
          const image = event.currentTarget;
          if (image.naturalWidth > 0 && image.naturalHeight > 0) {
            setDimensions({ width: image.naturalWidth, height: image.naturalHeight });
          }
        }}
      />
      {landmarks.length > 0 ? (
        <div
          className="absolute inset-0"
          style={{ transform: mirrorOverlay ? "scaleX(-1)" : undefined }}
        >
          <PoseLandmarkOverlay
            landmarks={landmarks}
            sourceWidth={dimensions.width}
            sourceHeight={dimensions.height}
          />
        </div>
      ) : null}
    </>
  );
};

interface PracticeInterfaceProps {
  activityId: string;
  initialDifficulty?: DifficultyLevel;
  mode?: "practice" | "demo";
  onComplete?: (score: number) => void;
  onError?: (error: string) => void;
  onDifficultyChange?: (difficulty: DifficultyLevel) => void;
  className?: string;
  reviewRecordingEnabled?: boolean;
}

type PracticeState =
  | "loading"
  | "ready"
  | "countdown"
  | "practicing"
  | "processing" // New state for analyzing result
  | "completed"
  | "error";

const POSE_EVALUATION_DURATION_MS = 5000;

interface PracticeSession {
  startTime: number;
  attempts: number;
  successfulMatches: number;
  totalScore: number;
  bestScore: number;
}

const PracticeInterface: React.FC<PracticeInterfaceProps> = ({
  activityId,
  initialDifficulty = "medium",
  onComplete,
  onError,
  onDifficultyChange,
  className = "",
  reviewRecordingEnabled = false,
}) => {
  const [activity, setActivity] = useState<Activity | null>(null);
  const [practiceState, setPracticeState] = useState<PracticeState>("loading");
  const [difficulty, setDifficulty] = useState<DifficultyLevel>(
    initialDifficulty
  );
  const [currentLandmarks, setCurrentLandmarks] = useState<PoseLandmark[]>([]);
  const [comparisonResult, setComparisonResult] =
    useState<ComparisonResult | null>(null);
  const [session, setSession] = useState<PracticeSession>({
    startTime: Date.now(),
    attempts: 0,
    successfulMatches: 0,
    totalScore: 0,
    bestScore: 0,
  });
  const [error, setError] = useState<string | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  const [isCameraTesting, setIsCameraTesting] = useState(false);
  const [diagnostics, setDiagnostics] = useState(() => ({
    ...mediaPipeService.getPerformanceMetrics(),
    uiFps: 0,
    recordingEnabled: false,
  }));
  const diagnosticsEnabled = new URLSearchParams(window.location.search).has("poseDiagnostics");

  // New states for the requested features
  const [countdown, setCountdown] = useState<number | null>(null);
  const [evaluationSecondsRemaining, setEvaluationSecondsRemaining] = useState(5);
  const [liveScore, setLiveScore] = useState<number | null>(null);
  const [bestLiveScore, setBestLiveScore] = useState(0);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [traineeRecordingUrl, setTraineeRecordingUrl] = useState<string | null>(
    null
  );

  const videoRef = useRef<HTMLVideoElement>(null);
  const stopTrackingRef = useRef<(() => void) | null>(null);
  const isInitializedRef = useRef<boolean>(false);

  // Ref to access latest landmarks in callbacks without triggering effects
  const currentLandmarksRef = useRef<PoseLandmark[]>([]);
  const lastUiUpdateRef = useRef(0);
  const lastScoreUiUpdateRef = useRef(0);
  const uiPublishTimesRef = useRef<number[]>([]);
  const poseAttemptIdRef = useRef(0);
  const bestPoseRef = useRef<{
    result: ComparisonResult;
    image: string | null;
    landmarks: PoseLandmark[];
  } | null>(null);

  const publishLandmarks = useCallback((landmarks: PoseLandmark[]) => {
    currentLandmarksRef.current = landmarks;
    const now = performance.now();
    if (now - lastUiUpdateRef.current >= 100) {
      lastUiUpdateRef.current = now;
      uiPublishTimesRef.current = [
        ...uiPublishTimesRef.current.filter(
          (timestamp) => now - timestamp <= 1000
        ),
        now,
      ];
      setCurrentLandmarks(landmarks);
    }
  }, []);

  // Movement practice capture (for post-practice comparison)
  const movementAttemptRef = useRef<TimestampedLandmarks[]>([]);
  const traineeRecorderRef = useRef<MovementVideoRecorder | null>(null);
  const traineeRecordingUrlRef = useRef<string | null>(null);

  useEffect(() => {
    const url = traineeRecordingUrl;
    traineeRecordingUrlRef.current = url;
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [traineeRecordingUrl]);

  // Sync ref with state
  useEffect(() => {
    currentLandmarksRef.current = currentLandmarks;
  }, [currentLandmarks]);

  // Update internal difficulty state when prop changes
  useEffect(() => {
    setDifficulty(initialDifficulty);
  }, [initialDifficulty]);

  useEffect(() => {
    if (!diagnosticsEnabled) return;
    const timer = window.setInterval(() => {
      const now = performance.now();
      const recentPublishes = uiPublishTimesRef.current.filter(
        (timestamp) => now - timestamp <= 1000
      );
      uiPublishTimesRef.current = recentPublishes;
      const publishDuration =
        recentPublishes.length > 1
          ? recentPublishes.at(-1)! - recentPublishes[0]
          : 0;
      const uiFps =
        publishDuration > 0
          ? ((recentPublishes.length - 1) * 1000) / publishDuration
          : 0;

      setDiagnostics({
        ...mediaPipeService.getPerformanceMetrics(),
        uiFps,
        recordingEnabled: traineeRecorderRef.current !== null,
      });
    }, 500);
    return () => window.clearInterval(timer);
  }, [diagnosticsEnabled]);

  // Notify parent of difficulty change
  const handleDifficultyChange = (newDifficulty: DifficultyLevel) => {
    setDifficulty(newDifficulty);
    onDifficultyChange?.(newDifficulty);
  };

  // Load activity data
  useEffect(() => {
    const loadActivity = async () => {
      try {
        setPracticeState("loading");
        const activityData = await activityService.getActivityById(activityId);
        if (!activityData) {
          throw new Error("Activity not found");
        }
        setActivity(activityData);
        setPracticeState("ready");
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to load activity";
        setError(message);
        setPracticeState("error");
        onError?.(message);
      }
    };

    loadActivity();
  }, [activityId, onError]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const handleError = useCallback(
    (errorMessage: string) => {
      setError(errorMessage);
      setPracticeState("error");
      onError?.(errorMessage);
    },
    [onError]
  );

  const stopPractice = useCallback(() => {
    console.log("🛑 stopPractice called");
    if (stopTrackingRef.current) {
      stopTrackingRef.current();
      stopTrackingRef.current = null;
    }
    setIsTracking(false);
    webcamService.stopVideoStream();
    isInitializedRef.current = false;
  }, []);

  const resetPractice = useCallback(() => {
    poseAttemptIdRef.current += 1;
    stopPractice();
    if (traineeRecorderRef.current) {
      traineeRecorderRef.current.cancel();
      traineeRecorderRef.current = null;
    }
    if (traineeRecordingUrlRef.current) {
      URL.revokeObjectURL(traineeRecordingUrlRef.current);
      traineeRecordingUrlRef.current = null;
    }
    movementAttemptRef.current = [];
    setTraineeRecordingUrl(null);
    setPracticeState("ready");
    setCountdown(null);
    setEvaluationSecondsRemaining(5);
    setLiveScore(null);
    setBestLiveScore(0);
    setCapturedImage(null);
    setComparisonResult(null);
    setCurrentLandmarks([]);
    bestPoseRef.current = null;
  }, [stopPractice]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopPractice();
    };
  }, [stopPractice]);

  const handleVideoReady = useCallback(
    async (video: HTMLVideoElement) => {
      // Don't auto-initialize if we're in the middle of practice
      // The startPractice function handles initialization
      if (practiceState === "countdown" || practiceState === "practicing") {
        return;
      }

      // We only auto-start stream if we are testing camera
      if (!isCameraTesting && practiceState === "ready") return;

      if (isInitializedRef.current) return;

      try {
        isInitializedRef.current = true;
        await mediaPipeService.initializePoseLandmarker();
        await webcamService.startVideoStream(video);
      } catch (error) {
        isInitializedRef.current = false;
        const message =
          error instanceof Error
            ? error.message
            : "Failed to initialize camera";
        handleError(message);
      }
    },
    [handleError, isCameraTesting, practiceState]
  );

  const captureVideoFrame = useCallback((video: HTMLVideoElement) => {
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    // Mirror the saved frame to match the webcam preview.
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0);
    return canvas.toDataURL("image/jpeg");
  }, []);

  const completePoseEvaluation = useCallback(
    (attemptId: number) => {
      if (attemptId !== poseAttemptIdRef.current || !activity?.poseData) return;

      setPracticeState("processing");
      const fallbackLandmarks = [...currentLandmarksRef.current];
      const bestPose =
        bestPoseRef.current ?? {
          result: comparisonService.comparePoses(
            activity.poseData,
            fallbackLandmarks,
            difficulty
          ),
          image: videoRef.current ? captureVideoFrame(videoRef.current) : null,
          landmarks: fallbackLandmarks,
        };

      stopPractice();
      setCapturedImage(bestPose.image);
      setCurrentLandmarks(bestPose.landmarks);
      currentLandmarksRef.current = bestPose.landmarks;
      setComparisonResult(bestPose.result);
      setLiveScore(bestPose.result.score);
      setBestLiveScore(bestPose.result.score);

      setSession((prev) => ({
        ...prev,
        attempts: prev.attempts + 1,
        successfulMatches:
          prev.successfulMatches + (bestPose.result.isMatch ? 1 : 0),
        totalScore: prev.totalScore + bestPose.result.score,
        bestScore: Math.max(prev.bestScore, bestPose.result.score),
      }));

      setPracticeState("completed");
    },
    [activity, captureVideoFrame, difficulty, stopPractice]
  );

  const startPoseEvaluation = useCallback(async () => {
    const video = videoRef.current;
    if (!video || !activity?.poseData) return;

    if (stopTrackingRef.current) {
      stopTrackingRef.current();
      stopTrackingRef.current = null;
    }

    const attemptId = poseAttemptIdRef.current;
    bestPoseRef.current = null;
    lastScoreUiUpdateRef.current = 0;
    setLiveScore(null);
    setBestLiveScore(0);
    setEvaluationSecondsRemaining(5);
    setCountdown(null);
    setPracticeState("practicing");

    try {
      const stopTracking = await mediaPipeService.startMovementTracking(
        video,
        (landmarks) => {
          if (attemptId !== poseAttemptIdRef.current) return;

          publishLandmarks(landmarks);
          const result = comparisonService.comparePoses(
            activity.poseData ?? [],
            landmarks,
            difficulty
          );
          const now = performance.now();
          if (now - lastScoreUiUpdateRef.current >= 100) {
            lastScoreUiUpdateRef.current = now;
            setLiveScore(result.score);
          }

          if (!bestPoseRef.current || result.score > bestPoseRef.current.result.score) {
            bestPoseRef.current = {
              result,
              image: captureVideoFrame(video),
              landmarks: landmarks.map((landmark) => ({ ...landmark })),
            };
            setBestLiveScore(result.score);
          }
        },
        {
          duration: POSE_EVALUATION_DURATION_MS,
          onProgress: (elapsed, total) => {
            if (attemptId !== poseAttemptIdRef.current) return;
            setEvaluationSecondsRemaining(
              Math.max(0, Math.ceil((total - elapsed) / 1000))
            );
          },
          onComplete: () => completePoseEvaluation(attemptId),
          onError: (error) => {
            if (attemptId !== poseAttemptIdRef.current) return;
            stopPractice();
            handleError(error.message);
          },
        }
      );

      if (attemptId === poseAttemptIdRef.current) {
        stopTrackingRef.current = stopTracking;
      } else {
        stopTracking();
      }
    } catch (error) {
      if (attemptId !== poseAttemptIdRef.current) return;
      stopPractice();
      handleError(
        error instanceof Error ? error.message : "Failed to evaluate pose"
      );
    }
  }, [
    activity,
    captureVideoFrame,
    completePoseEvaluation,
    difficulty,
    handleError,
    publishLandmarks,
    stopPractice,
  ]);

  // Countdown logic
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (practiceState === "countdown" && countdown !== null) {
      if (countdown > 0) {
        timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      } else {
        void startPoseEvaluation();
      }
    }
    return () => clearTimeout(timer);
  }, [practiceState, countdown, startPoseEvaluation]);

  const startPractice = useCallback(async () => {
    if (!videoRef.current || !activity || practiceState !== "ready") return;

    try {
      clearError();
      poseAttemptIdRef.current += 1;
      bestPoseRef.current = null;
      setLiveScore(null);
      setBestLiveScore(0);
      setEvaluationSecondsRemaining(5);
      setCapturedImage(null);
      setComparisonResult(null);

      await mediaPipeService.initializePoseLandmarker();
      await webcamService.startVideoStream(videoRef.current);
      
      const video = videoRef.current;
      if (!video) throw new Error("Video element not found");
      
      if (video.paused) await video.play();
      
      // Wait for video dimensions
      await new Promise(resolve => setTimeout(resolve, 300));

      if (video.videoWidth === 0) {
        throw new Error("Camera not ready. Please try again.");
      }

      if (activity.type === "pose") {
        setPracticeState("countdown");
        setCountdown(3);
        setIsTracking(true);

        const stopTracking = await mediaPipeService.startMovementTracking(
          videoRef.current,
          publishLandmarks,
          {
            duration: Infinity,
            onError: (error) => {
              console.error("Tracking error", error);
            }
          }
        );
        stopTrackingRef.current = stopTracking;

      } else if (activity.type === "movement" && activity.movementData) {
        setPracticeState("practicing");
        setIsTracking(true);

        movementAttemptRef.current = [];
        if (traineeRecordingUrlRef.current) {
          URL.revokeObjectURL(traineeRecordingUrlRef.current);
          traineeRecordingUrlRef.current = null;
        }
        setTraineeRecordingUrl(null);

        // Capture trainee video (for side-by-side comparison review).
        if (reviewRecordingEnabled && MovementVideoRecorder.isSupported() && videoRef.current) {
          try {
            const recorder = new MovementVideoRecorder(videoRef.current, {
              frameRate: 30,
            });
            recorder.start();
            traineeRecorderRef.current = recorder;
          } catch (err) {
            console.warn("Trainee video recording unavailable:", err);
            traineeRecorderRef.current = null;
          }
        }

        const stopTracking = await mediaPipeService.startMovementTracking(
          videoRef.current,
          (landmarks, timestamp) => {
            publishLandmarks(landmarks);
            movementAttemptRef.current.push({ timestamp, landmarks });
            if (traineeRecorderRef.current) {
              traineeRecorderRef.current.pushLandmarks(landmarks);
            }
          },
          {
            duration: activity.duration || 10000,
            onComplete: async () => {
              try {
                setPracticeState("processing");

                // Finalize trainee video recording (best effort).
                let traineeVideoUrl: string | null = null;
                if (traineeRecorderRef.current) {
                  try {
                    const result = await traineeRecorderRef.current.stop();
                    if (result.blob.size > 0) {
                      traineeVideoUrl = URL.createObjectURL(result.blob);
                    }
                  } catch (err) {
                    console.warn("Failed to finalize trainee recording:", err);
                  } finally {
                    traineeRecorderRef.current = null;
                  }
                }

                stopPractice();

                if (traineeVideoUrl) {
                  setTraineeRecordingUrl(traineeVideoUrl);
                }

                const result = comparisonService.compareMovementSequence(
                  activity.movementData ?? [],
                  movementAttemptRef.current,
                  difficulty
                );
                setComparisonResult(result);

                setSession((prev) => {
                  const newAttempts = prev.attempts + 1;
                  const newSuccessful = result.isMatch
                    ? prev.successfulMatches + 1
                    : prev.successfulMatches;
                  const newTotalScore = prev.totalScore + result.score;
                  const newBestScore = Math.max(prev.bestScore, result.score);
                  return {
                    ...prev,
                    attempts: newAttempts,
                    successfulMatches: newSuccessful,
                    totalScore: newTotalScore,
                    bestScore: newBestScore,
                  };
                });

                setPracticeState("completed");
              } catch (error) {
                if (traineeRecorderRef.current) {
                  traineeRecorderRef.current.cancel();
                  traineeRecorderRef.current = null;
                }
                stopPractice();
                const message =
                  error instanceof Error
                    ? error.message
                    : "Failed to score movement";
                handleError(message);
              }
            },
            onError: (error) => {
              if (traineeRecorderRef.current) {
                traineeRecorderRef.current.cancel();
                traineeRecorderRef.current = null;
              }
              stopPractice();
              handleError(error.message);
            },
          }
        );
        stopTrackingRef.current = stopTracking;
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to start practice";
      stopPractice();
      handleError(message);
    }
  }, [
    activity,
    practiceState,
    clearError,
    handleError,
    stopPractice,
    difficulty,
    publishLandmarks,
    reviewRecordingEnabled,
  ]);

  const testCamera = useCallback(async () => {
    if (!videoRef.current) return;

    try {
      setIsCameraTesting(true);
      clearError();

      await mediaPipeService.initializePoseLandmarker();
      await webcamService.startVideoStream(videoRef.current);

      await new Promise(resolve => setTimeout(resolve, 100));

      const video = videoRef.current;
      if (!video || video.videoWidth === 0) {
        throw new Error("Video stream not ready.");
      }

      const stopTracking = await mediaPipeService.startMovementTracking(
        video,
        publishLandmarks,
        {
          duration: Infinity,
          onError: (error) => {
            setError(error.message);
            stopCameraTest();
          },
        }
      );

      stopTrackingRef.current = stopTracking;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to test camera";
      handleError(message);
      setIsCameraTesting(false);
    }
  }, [clearError, handleError, publishLandmarks]);

  const stopCameraTest = useCallback(() => {
    if (stopTrackingRef.current) {
      stopTrackingRef.current();
      stopTrackingRef.current = null;
    }
    setIsCameraTesting(false);
    setCurrentLandmarks([]);
    webcamService.stopVideoStream();
    isInitializedRef.current = false;
  }, []);

  const renderResultSection = () => {
    if (!comparisonResult) return null;

    const percentage = Math.round(comparisonResult.score * 100);
    const isSuccess = comparisonResult.isMatch;
    const colorClass = isSuccess ? "text-green-600" : "text-yellow-600";
    const bgClass = isSuccess ? "bg-green-50" : "bg-yellow-50";
    const borderClass = isSuccess ? "border-green-200" : "border-yellow-200";

    return (
      <div className={`mt-8 bg-white p-6 rounded-lg shadow-xl ${borderClass} border-2`}>
        <div className="text-center mb-4">
          <h3 className={`text-2xl font-bold ${colorClass} mb-2`}>
            {isSuccess ? "Excellent!" : "Good Try!"}
          </h3>
          <div className={`text-4xl font-bold ${colorClass}`}>
            {percentage}%
          </div>
          <p className="text-gray-600 mt-2">
            {activity?.type === "pose" ? "Best score" : "Accuracy Score"}
          </p>
        </div>

        {comparisonResult.feedback && comparisonResult.feedback.length > 0 && (
          <div className={`mb-4 p-3 rounded ${bgClass}`}>
             <p className="font-medium mb-1 text-gray-800">Feedback:</p>
             <ul className="list-disc list-inside text-sm text-gray-700">
               {comparisonResult.feedback.map((item, idx) => (
                 <li key={idx}>{item}</li>
               ))}
             </ul>
          </div>
        )}

        <div className="flex gap-3 justify-center">
           <button
              onClick={() => onComplete?.(comparisonResult.score)}
              className="px-6 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
           >
             Approve and save
           </button>
           <button
             onClick={resetPractice}
             className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
           >
             Retry
           </button>
        </div>
      </div>
    );
  };

  if (practiceState === "loading") {
    return (
      <div className={`flex items-center justify-center min-h-96 ${className}`}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading activity...</p>
        </div>
      </div>
    );
  }

  if (practiceState === "error" || !activity) {
    return (
      <div className={`max-w-4xl mx-auto p-6 ${className}`}>
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex">
            <div className="text-red-400 mr-3">⚠️</div>
            <div>
              <h3 className="text-sm font-medium text-red-800">Error</h3>
              <p className="text-sm text-red-700 mt-1">
                {error || "Failed to load activity"}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Determine if buttons should be disabled
  const isInteractionDisabled =
    practiceState === "countdown" ||
    practiceState === "practicing" ||
    practiceState === "processing";

  return (
    <div className={`max-w-7xl mx-auto p-4 sm:p-6 ${className}`}>
      <div className="bg-white rounded-lg shadow-lg overflow-hidden">
        {/* Header */}
        <div className="bg-gray-50 px-6 py-4 border-b flex justify-between items-center flex-wrap gap-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              {activity.name}
            </h2>
            <p className="text-gray-600">
              {activity.type === "pose" ? "Match the pose" : "Follow the movement"}
            </p>
          </div>

          <div className="flex items-center space-x-4">
            <div className="bg-white px-3 py-1 rounded border border-gray-200 text-sm">
               <span className="text-gray-500">Best:</span>
               <span className="ml-1 font-bold text-blue-600">{Math.round(session.bestScore * 100)}%</span>
            </div>
          </div>
        </div>

        <div className="p-6">
          {/* Difficulty Selector */}
          <div className="mb-6 flex justify-center">
             <div className="inline-flex bg-gray-100 p-1 rounded-lg">
               {(["soft", "medium", "hard"] as DifficultyLevel[]).map((level) => (
                  <button
                    key={level}
                    onClick={() => handleDifficultyChange(level)}
                    disabled={isInteractionDisabled}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                       difficulty === level
                         ? "bg-white text-blue-600 shadow-sm"
                         : "text-gray-500 hover:text-gray-700"
                    } ${isInteractionDisabled ? "opacity-50 cursor-not-allowed" : ""}`}
                  >
                    {level === "soft" ? "Easy" : level.charAt(0).toUpperCase() + level.slice(1)}
                  </button>
               ))}
             </div>
          </div>

          {/* Main Comparison Area */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
             {/* Original Activity Image / Movement Playback */}
             <div className="flex flex-col">
                <h3 className="text-lg font-medium text-gray-900 mb-3">
                  {activity.type === "movement" ? "Target Movement" : "Target Pose"}
                </h3>
                <div className="relative aspect-video bg-gray-100 rounded-lg overflow-hidden border border-gray-200 shadow-inner">
                   {activity.type === "movement" ? (
                      <VideoReferencePlayer activity={activity} loop autoPlay />
                   ) : activity.imageData ? (
                      <PoseImageWithOverlay
                        src={activity.imageData}
                        alt="Target Pose"
                        landmarks={activity.poseData}
                        mirrorImage
                        mirrorOverlay
                      />
                   ) : (
                      <div className="flex items-center justify-center h-full text-gray-400">
                        No image available
                      </div>
                   )}
                </div>
             </div>

             {/* Practice Area */}
             <div className="flex flex-col">
                <h3 className="text-lg font-medium text-gray-900 mb-3">
                  {activity.type === "movement" ? "Your Movement" : "Your Pose"}
                </h3>
                <div className="relative aspect-video bg-black rounded-lg overflow-hidden shadow-inner">

                   {/* Trainee's recorded video playback (movement, completed) */}
                   {activity.type === "movement" &&
                    practiceState === "completed" &&
                    traineeRecordingUrl ? (
                      <video
                        src={traineeRecordingUrl}
                        controls
                        loop
                        playsInline
                        className="w-full h-full object-contain bg-black"
                        data-testid="trainee-recording"
                      />
                   ) : (
                     <>
                   {/* Camera View */}
                   <div className={`${capturedImage ? 'hidden' : 'block'} w-full h-full`}>
                      <WebcamPreview
                        ref={videoRef}
                        isActive={true}
                        showLandmarks={true}
                        landmarks={currentLandmarks}
                        isRecording={isTracking}
                        forceShowVideo={practiceState === "countdown" || practiceState === "practicing"}
                        onVideoReady={handleVideoReady}
                        onError={handleError}
                        className="w-full h-full"
                      />
                   </div>

                   {/* Captured Image View (Result) */}
                   {capturedImage && (
                      <div className="absolute inset-0 z-10 bg-black">
                         <PoseImageWithOverlay
                           src={capturedImage}
                           alt="Your Attempt"
                           landmarks={currentLandmarks}
                           mirrorOverlay
                         />
                      </div>
                   )}

                   {/* Countdown Overlay - translucent so camera shows through */}
                   {practiceState === "countdown" && countdown !== null && (
                      <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/30 pointer-events-none">
                         <div
                           className="text-9xl font-bold text-white animate-pulse drop-shadow-lg"
                           style={{ textShadow: "0 2px 12px rgba(0,0,0,0.8)" }}
                         >
                           {countdown === 0 ? "POSE!" : countdown}
                         </div>
                      </div>
                   )}

                   {activity.type === "pose" && practiceState === "practicing" && (
                     <div
                       className="absolute inset-x-0 top-0 z-20 flex justify-center p-4 pointer-events-none"
                       aria-live="polite"
                     >
                       <div className="rounded-lg bg-black/70 px-5 py-3 text-center text-white shadow-lg backdrop-blur-sm">
                         <div className="text-sm font-medium uppercase tracking-wide">
                           Live score · {evaluationSecondsRemaining}s
                         </div>
                         <div className="mt-1 text-4xl font-bold">
                           {liveScore === null ? "—" : `${Math.round(liveScore * 100)}%`}
                         </div>
                         <div className="mt-1 text-sm text-blue-200">
                           Best: {Math.round(bestLiveScore * 100)}%
                         </div>
                       </div>
                     </div>
                   )}
                     </>
                   )}
                </div>
             </div>
          </div>

          {/* Result Section - Shown below both windows */}
          {practiceState === "completed" && renderResultSection()}

          {diagnosticsEnabled && (
            <PerformancePanel
              metrics={diagnostics.monitor}
              uiFps={diagnostics.uiFps}
              width={videoRef.current?.videoWidth ?? 0}
              height={videoRef.current?.videoHeight ?? 0}
              delegate={MEDIAPIPE_CONFIG.baseOptions.delegate}
              recordingEnabled={diagnostics.recordingEnabled}
              retainedFrames={diagnostics.memory.historySize}
              retainedBytes={diagnostics.memory.estimatedMemory}
            />
          )}

          {/* Controls */}
          <div className="mt-8 flex justify-center gap-4">
             {practiceState === "ready" && !isCameraTesting && (
                <>
                  <button
                    onClick={testCamera}
                    className="px-6 py-3 bg-gray-100 text-gray-700 rounded-md font-medium hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500"
                  >
                    Test Camera
                  </button>
                  <button
                    onClick={startPractice}
                    className="px-8 py-3 bg-blue-600 text-white rounded-md font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-lg transform transition hover:scale-105"
                  >
                    Start Practice
                  </button>
                </>
             )}

             {isCameraTesting && (
                <button
                  onClick={stopCameraTest}
                  className="px-6 py-3 bg-red-600 text-white rounded-md font-medium hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"
                >
                  Stop Camera Test
                </button>
             )}

             {(practiceState === "countdown" || practiceState === "practicing") && (
                <button
                  onClick={resetPractice} // Stops and resets
                  className="px-6 py-3 bg-red-600 text-white rounded-md font-medium hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"
                >
                  Cancel
                </button>
             )}
          </div>

          {/* Tips */}
          <div className="mt-10 bg-blue-50 p-4 rounded-md border border-blue-100">
             <h4 className="font-medium text-blue-800 mb-2">💡 Pro Tips:</h4>
             <ul className="text-sm text-blue-700 space-y-1 ml-4 list-disc">
                <li>Ensure your whole body is visible in the camera frame.</li>
                <li>Lighting should be bright enough for accurate detection.</li>
                <li>After the countdown, improve your pose during the 5-second scoring window.</li>
                <li>Your highest score and its matching photo will be saved.</li>
                <li>Check the target image on the left and mirror it.</li>
             </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PracticeInterface;
