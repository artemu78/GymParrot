import React from "react";
import type { RecordingState } from "./types";
import ReviewSection from "./ReviewSection";

interface ActionButtonsProps {
  recordingState: RecordingState;
  canStartRecording: boolean;
  isCameraActive: boolean;
  isCapturing: boolean;
  activityType?: "pose" | "movement";
  onStartRecording: () => void;
  onToggleCamera: () => void;
  onStopRecording: () => void;
  onApprovePose: () => void;
  onRetakePose: () => void;
  onResetForm: () => void;
}

const ActionButtons: React.FC<ActionButtonsProps> = ({
  recordingState,
  canStartRecording,
  isCameraActive,
  isCapturing,
  onStartRecording,
  onToggleCamera,
  onStopRecording,
  onApprovePose,
  onRetakePose,
  onResetForm,
}) => {
  const isRecording = recordingState === "recording";
  const isCountdown = recordingState === "countdown";
  const isProcessing = recordingState === "processing";

  return (
    <div className="flex justify-center space-x-4">
      {recordingState === "idle" && (
        <>
          <button
            onClick={onStartRecording}
            disabled={!canStartRecording}
            className="px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            data-testid="start-recording-button"
          >
            Start Recording
          </button>
          <button
            onClick={onToggleCamera}
            className={`px-6 py-3 text-white rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 font-medium ${
              isCameraActive
                ? "bg-red-600 hover:bg-red-700 focus:ring-red-500"
                : "bg-gray-600 hover:bg-gray-700 focus:ring-gray-500"
            }`}
          >
            {isCameraActive ? "Turn Off Camera" : "Test Camera"}
          </button>
        </>
      )}

      {(isRecording || isCountdown || isCapturing) && (
        <button
          onClick={onStopRecording}
          className="px-6 py-3 bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 font-medium"
          disabled={isCapturing}
        >
          {isCountdown ? "Cancel" : isCapturing ? "Capturing..." : "Stop Recording"}
        </button>
      )}

      {recordingState === "reviewing" && (
        <ReviewSection onApprove={onApprovePose} onRetake={onRetakePose} />
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
            <span className="font-medium">Activity Created Successfully!</span>
          </div>
          <button
            onClick={onResetForm}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 font-medium"
          >
            Create Another
          </button>
        </div>
      )}

      {recordingState === "error" && (
        <button
          onClick={onResetForm}
          className="px-6 py-3 bg-gray-600 text-white rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 font-medium"
        >
          Try Again
        </button>
      )}
    </div>
  );
};

export default ActionButtons;
