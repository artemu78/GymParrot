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
  TimestampedLandmarks,
} from "../types";

interface PracticeInterfaceProps {
  activityId: string;
  onComplete?: (score: number) => void;
  onError?: (error: string) => void;
  className?: string;
}

type PracticeState = "loading" | "ready" | "practicing" | "completed" | "error";

interface PracticeSession {
  startTime: number;
  attempts: number;
  successfulMatches: number;
  totalScore: number;
  bestScore: number;
}

const PracticeInterface: React.FC<PracticeInterfaceProps> = ({
  activityId,
  onComplete,
  onError,
  className = "",
}) => {
  const [activity, setActivity] = useState<Activity | null>(null);
  const [practiceState, setPracticeState] = useState<PracticeState>("loading");
  const [difficulty, setDifficulty] = useState<DifficultyLevel>("medium");
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

  const videoRef = useRef<HTMLVideoElement>(null);
  const stopTrackingRef = useRef<(() => void) | null>(null);
  const isInitializedRef = useRef<boolean>(false);

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

  const handleVideoReady = useCallback(
    async (video: HTMLVideoElement) => {
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
    [handleError]
  );

  const startPractice = useCallback(async () => {
    if (!videoRef.current || !activity || practiceState !== "ready") return;

    try {
      setPracticeState("practicing");
      setIsTracking(true);
      clearError();

      // Reset session for new practice
      setSession({
        startTime: Date.now(),
        attempts: 0,
        successfulMatches: 0,
        totalScore: 0,
        bestScore: 0,
      });

      if (activity.type === "pose") {
        // Start continuous pose comparison for pose activities
        const stopTracking = await mediaPipeService.startMovementTracking(
          videoRef.current,
          async (landmarks, timestamp) => {
            setCurrentLandmarks(landmarks);

            if (activity.poseData) {
              // Compare current pose with target pose
              const result = await comparisonService.comparePoses(
                landmarks,
                activity.poseData,
                difficulty
              );

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
            }
          },
          {
            duration: 60000, // 1 minute practice session
            onComplete: () => {
              setPracticeState("completed");
              setIsTracking(false);
              const finalScore = session.bestScore;
              onComplete?.(finalScore);
            },
            onError: (error) => {
              handleError(error.message);
              setIsTracking(false);
            },
          }
        );

        stopTrackingRef.current = stopTracking;
      } else if (activity.type === "movement" && activity.movementData) {
        // Start movement sequence comparison
        const stopTracking = await mediaPipeService.startMovementTracking(
          videoRef.current,
          (landmarks, timestamp) => {
            setCurrentLandmarks(landmarks);
          },
          {
            duration: activity.duration || 10000,
            onComplete: async () => {
              try {
                // Compare recorded movement with target movement
                const recordedSequence: TimestampedLandmarks[] = [];
                // This would be populated during tracking - simplified for now

                const result = await comparisonService.compareMovementSequence(
                  recordedSequence,
                  activity.movementData!,
                  difficulty
                );

                setComparisonResult(result);
                setPracticeState("completed");
                setIsTracking(false);

                // Update final session stats
                setSession((prev) => ({
                  ...prev,
                  attempts: prev.attempts + 1,
                  successfulMatches: result.isMatch
                    ? prev.successfulMatches + 1
                    : prev.successfulMatches,
                  totalScore: prev.totalScore + result.score,
                  bestScore: Math.max(prev.bestScore, result.score),
                }));

                onComplete?.(result.score);
              } catch (error) {
                const message =
                  error instanceof Error
                    ? error.message
                    : "Failed to compare movement";
                handleError(message);
                setIsTracking(false);
              }
            },
            onError: (error) => {
              handleError(error.message);
              setIsTracking(false);
            },
          }
        );

        stopTrackingRef.current = stopTracking;
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to start practice";
      handleError(message);
      setIsTracking(false);
    }
  }, [
    videoRef,
    activity,
    practiceState,
    difficulty,
    clearError,
    handleError,
    session.bestScore,
    onComplete,
  ]);

  const stopPractice = useCallback(() => {
    if (stopTrackingRef.current) {
      stopTrackingRef.current();
      stopTrackingRef.current = null;
    }
    setIsTracking(false);
    setPracticeState("ready");
    setComparisonResult(null);
  }, []);

  const resetPractice = useCallback(() => {
    stopPractice();
    setSession({
      startTime: Date.now(),
      attempts: 0,
      successfulMatches: 0,
      totalScore: 0,
      bestScore: 0,
    });
    setComparisonResult(null);
  }, [stopPractice]);

  const getDifficultyColor = (level: DifficultyLevel) => {
    switch (level) {
      case "easy":
        return "text-green-600 bg-green-100";
      case "medium":
        return "text-yellow-600 bg-yellow-100";
      case "hard":
        return "text-red-600 bg-red-100";
      default:
        return "text-gray-600 bg-gray-100";
    }
  };

  const getMatchFeedback = () => {
    if (!comparisonResult) return null;

    if (comparisonResult.isMatch) {
      return (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded">
          <div className="flex items-center">
            <svg
              className="w-5 h-5 mr-2"
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
              Great match! Score: {Math.round(comparisonResult.score * 100)}%
            </span>
          </div>
        </div>
      );
    } else {
      return (
        <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded">
          <div className="flex items-center mb-2">
            <svg
              className="w-5 h-5 mr-2"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                clipRule="evenodd"
              />
            </svg>
            <span className="font-medium">
              Keep trying! Score: {Math.round(comparisonResult.score * 100)}%
            </span>
          </div>
          {comparisonResult.feedback &&
            comparisonResult.feedback.length > 0 && (
              <div className="text-sm">
                <p className="font-medium mb-1">Suggestions:</p>
                <ul className="list-disc list-inside space-y-1">
                  {comparisonResult.feedback.map((suggestion, index) => (
                    <li key={index}>{suggestion}</li>
                  ))}
                </ul>
              </div>
            )}
        </div>
      );
    }
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

  return (
    <div className={`max-w-6xl mx-auto p-6 ${className}`}>
      <div className="bg-white rounded-lg shadow-lg overflow-hidden">
        {/* Header */}
        <div className="bg-gray-50 px-6 py-4 border-b">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">
                Practice: {activity.name}
              </h2>
              <p className="text-gray-600 mt-1">
                {activity.type === "pose"
                  ? "Hold the target pose"
                  : "Follow the movement sequence"}
              </p>
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-sm text-gray-600">
                <span className="font-medium">Success Rate:</span>{" "}
                {session.attempts > 0
                  ? Math.round(
                      (session.successfulMatches / session.attempts) * 100
                    )
                  : 0}
                %
              </div>
              <div className="text-sm text-gray-600">
                <span className="font-medium">Best Score:</span>{" "}
                {Math.round(session.bestScore * 100)}%
              </div>
            </div>
          </div>
        </div>

        <div className="p-6">
          {/* Difficulty Selection */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Difficulty Level
            </label>
            <div className="flex space-x-3">
              {(["easy", "medium", "hard"] as DifficultyLevel[]).map(
                (level) => (
                  <button
                    key={level}
                    onClick={() => setDifficulty(level)}
                    disabled={isTracking}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                      difficulty === level
                        ? getDifficultyColor(level)
                        : "text-gray-600 bg-gray-100 hover:bg-gray-200"
                    } ${isTracking ? "opacity-50 cursor-not-allowed" : ""}`}
                  >
                    {level.charAt(0).toUpperCase() + level.slice(1)}
                  </button>
                )
              )}
            </div>
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

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Camera Preview */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Your Performance
              </h3>
              <WebcamPreview
                ref={videoRef}
                isActive={true}
                showLandmarks={true}
                landmarks={currentLandmarks}
                isRecording={isTracking}
                onVideoReady={handleVideoReady}
                onError={handleError}
                width={640}
                height={480}
              />
            </div>

            {/* Feedback and Controls */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Feedback
              </h3>

              {/* Real-time Feedback */}
              <div className="mb-6">{getMatchFeedback()}</div>

              {/* Practice Controls */}
              <div className="space-y-4">
                {practiceState === "ready" && (
                  <button
                    onClick={startPractice}
                    className="w-full px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 font-medium"
                  >
                    Start Practice
                  </button>
                )}

                {practiceState === "practicing" && (
                  <div className="space-y-3">
                    <button
                      onClick={stopPractice}
                      className="w-full px-6 py-3 bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 font-medium"
                    >
                      Stop Practice
                    </button>
                    <button
                      onClick={resetPractice}
                      className="w-full px-6 py-3 bg-gray-600 text-white rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 font-medium"
                    >
                      Reset Session
                    </button>
                  </div>
                )}

                {practiceState === "completed" && (
                  <div className="space-y-3">
                    <div className="bg-green-50 border border-green-200 rounded-md p-4">
                      <h4 className="text-lg font-medium text-green-800 mb-2">
                        Practice Complete!
                      </h4>
                      <div className="text-sm text-green-700 space-y-1">
                        <p>
                          <span className="font-medium">Final Score:</span>{" "}
                          {Math.round(session.bestScore * 100)}%
                        </p>
                        <p>
                          <span className="font-medium">Total Attempts:</span>{" "}
                          {session.attempts}
                        </p>
                        <p>
                          <span className="font-medium">
                            Successful Matches:
                          </span>{" "}
                          {session.successfulMatches}
                        </p>
                        <p>
                          <span className="font-medium">Success Rate:</span>{" "}
                          {session.attempts > 0
                            ? Math.round(
                                (session.successfulMatches / session.attempts) *
                                  100
                              )
                            : 0}
                          %
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={resetPractice}
                      className="w-full px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 font-medium"
                    >
                      Practice Again
                    </button>
                  </div>
                )}
              </div>

              {/* Session Stats */}
              <div className="mt-6 p-4 bg-gray-50 rounded-md">
                <h4 className="text-sm font-medium text-gray-900 mb-3">
                  Session Statistics
                </h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Attempts:</span>
                    <span className="ml-2 font-medium">{session.attempts}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Matches:</span>
                    <span className="ml-2 font-medium">
                      {session.successfulMatches}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-600">Best Score:</span>
                    <span className="ml-2 font-medium">
                      {Math.round(session.bestScore * 100)}%
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-600">Avg Score:</span>
                    <span className="ml-2 font-medium">
                      {session.attempts > 0
                        ? Math.round(
                            (session.totalScore / session.attempts) * 100
                          )
                        : 0}
                      %
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Instructions */}
          <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-md">
            <h3 className="text-sm font-medium text-blue-800 mb-2">
              How to Practice:
            </h3>
            <ul className="text-sm text-blue-700 space-y-1">
              {activity.type === "pose" ? (
                <>
                  <li>• Select your preferred difficulty level</li>
                  <li>• Click "Start Practice" to begin pose detection</li>
                  <li>• Position yourself to match the target pose</li>
                  <li>• Watch for real-time feedback and scoring</li>
                  <li>• Try to maintain the pose for consistent matches</li>
                </>
              ) : (
                <>
                  <li>• Select your preferred difficulty level</li>
                  <li>• Click "Start Practice" to begin movement tracking</li>
                  <li>• Follow the movement sequence as closely as possible</li>
                  <li>• Complete the full sequence within the time limit</li>
                  <li>• Review your performance summary at the end</li>
                </>
              )}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PracticeInterface;
