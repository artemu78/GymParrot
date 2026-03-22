import React, { useState, useCallback, useRef, useEffect } from "react";
import WebcamPreview from "./WebcamPreview";
import {
  mediaPipeService,
  webcamService,
  comparisonService,
  activityService,
} from "../services";
import type {
  PoseLandmark,
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
}

const PoseLandmarkOverlay: React.FC<PoseLandmarkOverlayProps> = ({
  landmarks,
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
      viewBox="0 0 1 1"
      preserveAspectRatio="xMidYMid slice"
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
            x1={startLandmark.x}
            y1={startLandmark.y}
            x2={endLandmark.x}
            y2={endLandmark.y}
            stroke="#00ff00"
            strokeWidth="0.003"
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
            cx={landmark.x}
            cy={landmark.y}
            r="0.005"
            fill="#ff0000"
            opacity="0.9"
          />
        );
      })}
    </svg>
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
}

type PracticeState =
  | "loading"
  | "ready"
  | "countdown"
  | "practicing"
  | "processing" // New state for analyzing result
  | "completed"
  | "error";

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

  // New states for the requested features
  const [countdown, setCountdown] = useState<number | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const stopTrackingRef = useRef<(() => void) | null>(null);
  const isInitializedRef = useRef<boolean>(false);

  // Ref to access latest landmarks in callbacks without triggering effects
  const currentLandmarksRef = useRef<PoseLandmark[]>([]);

  // Sync ref with state
  useEffect(() => {
    currentLandmarksRef.current = currentLandmarks;
  }, [currentLandmarks]);

  // Update internal difficulty state when prop changes
  useEffect(() => {
    setDifficulty(initialDifficulty);
  }, [initialDifficulty]);

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
    stopPractice();
    setPracticeState("ready");
    setCountdown(null);
    setCapturedImage(null);
    setComparisonResult(null);
    setCurrentLandmarks([]);
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

  const handleCaptureAndCompare = useCallback(async () => {
    if (!videoRef.current || !activity) return;

    try {
      setPracticeState("processing");

      // 1. Capture Image
      const video = videoRef.current;
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        // Mirror the image to match the preview
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(video, 0, 0);
        setCapturedImage(canvas.toDataURL("image/jpeg"));
      }

      // 2. Capture Landmarks & Stop Tracking
      // Use ref to get latest landmarks
      const capturedLandmarks = [...currentLandmarksRef.current];
      console.log("📸 Captured landmarks for comparison:", capturedLandmarks?.length || 0);

      // Stop tracking and camera
      stopPractice();

      // 3. Compare
      if (activity.type === "pose" && activity.poseData) {
        console.log("🔍 Comparing poses - target landmarks:", activity.poseData?.length || 0, "captured landmarks:", capturedLandmarks?.length || 0);
        const result = await comparisonService.comparePoses(
          activity.poseData,
          capturedLandmarks,
          difficulty
        );
        console.log("📊 Comparison result:", result);

        setComparisonResult(result);

        // Update session stats
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
        // Don't call onComplete here - let user see results and choose to finish
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to process result";
      handleError(message);
    }
  }, [activity, difficulty, handleError, stopPractice]);

  // Countdown logic
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (practiceState === "countdown" && countdown !== null) {
      if (countdown > 0) {
        timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      } else {
        // Countdown finished, trigger capture
        // We use the stable callback
        handleCaptureAndCompare();
      }
    }
    return () => clearTimeout(timer);
  }, [practiceState, countdown, handleCaptureAndCompare]);

  const startPractice = useCallback(async () => {
    if (!videoRef.current || !activity || practiceState !== "ready") return;

    try {
      clearError();
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
          (landmarks) => {
            setCurrentLandmarks(landmarks);
          },
          {
            duration: Infinity,
            onError: (error) => {
              console.error("Tracking error", error);
            }
          }
        );
        stopTrackingRef.current = stopTracking;

      } else if (activity.type === "movement" && activity.movementData) {
        // Original logic for movement
        setPracticeState("practicing");
        setIsTracking(true);

        const stopTracking = await mediaPipeService.startMovementTracking(
          videoRef.current,
          (landmarks) => {
            setCurrentLandmarks(landmarks);
          },
          {
            duration: activity.duration || 10000,
            onComplete: async () => {
              stopPractice();
              setPracticeState("completed");
            },
            onError: (error) => {
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
  }, [activity, practiceState, clearError, handleError, stopPractice]);

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
        (landmarks) => {
          setCurrentLandmarks(landmarks);
        },
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
  }, [clearError, handleError]);

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
          <p className="text-gray-600 mt-2">Accuracy Score</p>
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
             onClick={resetPractice}
             className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
           >
             Try Again
           </button>
           <button
              onClick={() => onComplete?.(comparisonResult.score)}
              className="px-6 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 transition-colors"
           >
             Finish
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
             {/* Original Activity Image */}
             <div className="flex flex-col">
                <h3 className="text-lg font-medium text-gray-900 mb-3">Target Pose</h3>
                <div className="relative aspect-video bg-gray-100 rounded-lg overflow-hidden border border-gray-200 shadow-inner">
                   {activity.imageData ? (
                      <>
                        <img
                          src={activity.imageData}
                          alt="Target Pose"
                          className="w-full h-full object-contain"
                        />
                        {activity.poseData && activity.poseData.length > 0 ? (
                          <PoseLandmarkOverlay landmarks={activity.poseData} />
                        ) : null}
                      </>
                   ) : (
                      <div className="flex items-center justify-center h-full text-gray-400">
                        No image available
                      </div>
                   )}
                </div>
             </div>

             {/* Practice Area */}
             <div className="flex flex-col">
                <h3 className="text-lg font-medium text-gray-900 mb-3">Your Pose</h3>
                <div className="relative aspect-video bg-black rounded-lg overflow-hidden shadow-inner">

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
                         <img
                           src={capturedImage}
                           alt="Your Attempt"
                           className="w-full h-full object-contain"
                           // No mirror here because image is already mirrored during capture
                         />
                         {/* Render captured pose landmarks - mirrored to match the image */}
                         {currentLandmarks && currentLandmarks.length > 0 && (
                           <div className="absolute inset-0" style={{ transform: "scaleX(-1)" }}>
                             <PoseLandmarkOverlay landmarks={currentLandmarks} />
                           </div>
                         )}
                      </div>
                   )}

                   {/* Countdown Overlay */}
                   {practiceState === "countdown" && countdown !== null && (
                      <div className="absolute inset-0 z-20 flex items-center justify-center bg-opacity-40">
                         <div className="text-9xl font-bold text-white animate-pulse">
                           {countdown === 0 ? "POSE!" : countdown}
                         </div>
                      </div>
                   )}

                </div>
             </div>
          </div>

          {/* Result Section - Shown below both windows */}
          {practiceState === "completed" && renderResultSection()}

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
                <li>Hold the pose steady when the countdown reaches 0.</li>
                <li>Check the target image on the left and mirror it.</li>
             </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PracticeInterface;
