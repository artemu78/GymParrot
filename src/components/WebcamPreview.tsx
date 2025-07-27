import React, { useRef, useEffect, useState, useCallback } from "react";
import type { PoseLandmark } from "../types";

interface WebcamPreviewProps {
  isActive?: boolean;
  showLandmarks?: boolean;
  landmarks?: PoseLandmark[];
  isRecording?: boolean;
  recordingProgress?: number;
  onVideoReady?: (video: HTMLVideoElement) => void;
  onError?: (error: string) => void;
  className?: string;
  width?: number;
  height?: number;
}

interface RecordingIndicatorProps {
  isRecording: boolean;
  progress?: number;
}

const RecordingIndicator: React.FC<RecordingIndicatorProps> = ({
  isRecording,
  progress = 0,
}) => {
  if (!isRecording) return null;

  return (
    <div className="absolute top-4 left-4 flex items-center space-x-2 bg-red-600 text-white px-3 py-2 rounded-lg shadow-lg">
      <div className="w-3 h-3 bg-white rounded-full animate-pulse" />
      <span className="text-sm font-medium">Recording</span>
      {progress > 0 && (
        <div className="w-16 h-1 bg-red-400 rounded-full overflow-hidden">
          <div
            className="h-full bg-white transition-all duration-300"
            style={{ width: `${progress * 100}%` }}
          />
        </div>
      )}
    </div>
  );
};

interface PoseLandmarkOverlayProps {
  landmarks: PoseLandmark[];
  videoWidth: number;
  videoHeight: number;
}

const PoseLandmarkOverlay: React.FC<PoseLandmarkOverlayProps> = ({
  landmarks,
  videoWidth,
  videoHeight,
}) => {
  if (!landmarks || landmarks.length === 0) return null;

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
      className="absolute inset-0 pointer-events-none"
      width={videoWidth}
      height={videoHeight}
      viewBox={`0 0 ${videoWidth} ${videoHeight}`}
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
            x1={startLandmark.x * videoWidth}
            y1={startLandmark.y * videoHeight}
            x2={endLandmark.x * videoWidth}
            y2={endLandmark.y * videoHeight}
            stroke="#00ff00"
            strokeWidth="2"
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
            cx={landmark.x * videoWidth}
            cy={landmark.y * videoHeight}
            r="3"
            fill="#ff0000"
            opacity="0.9"
          />
        );
      })}
    </svg>
  );
};

const WebcamPreview = React.forwardRef<HTMLVideoElement, WebcamPreviewProps>(
  (
    {
      isActive = false,
      showLandmarks = false,
      landmarks = [],
      isRecording = false,
      recordingProgress = 0,
      onVideoReady,
      onError,
      className = "",
      width = 640,
      height = 480,
    },
    ref
  ) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [videoReady, setVideoReady] = useState(false);
    const [actualDimensions, setActualDimensions] = useState({ width, height });

    // Combine internal ref with forwarded ref
    const combinedRef = useCallback(
      (node: HTMLVideoElement | null) => {
        videoRef.current = node;
        if (typeof ref === "function") {
          ref(node);
        } else if (ref) {
          ref.current = node;
        }
      },
      [ref]
    );

    const handleVideoReady = useCallback(() => {
      const video = videoRef.current;
      if (!video) return;

      setVideoReady(true);

      // Update actual dimensions based on video
      setActualDimensions({
        width: video.videoWidth || width,
        height: video.videoHeight || height,
      });

      onVideoReady?.(video);
    }, [onVideoReady, width, height]);

    const handleVideoError = useCallback(
      (error: string) => {
        setVideoReady(false);
        onError?.(error);
      },
      [onError]
    );

    useEffect(() => {
      const video = videoRef.current;
      if (!video) return;

      const handleLoadedData = () => {
        if (!videoReady) {
          // Only call if not already ready
          handleVideoReady();
        }
      };

      const handleError = () => {
        handleVideoError("Video failed to load");
      };

      const handleLoadedMetadata = () => {
        // Update dimensions when metadata is loaded
        setActualDimensions({
          width: video.videoWidth || width,
          height: video.videoHeight || height,
        });
      };

      video.addEventListener("loadeddata", handleLoadedData);
      video.addEventListener("error", handleError);
      video.addEventListener("loadedmetadata", handleLoadedMetadata);

      return () => {
        video.removeEventListener("loadeddata", handleLoadedData);
        video.removeEventListener("error", handleError);
        video.removeEventListener("loadedmetadata", handleLoadedMetadata);
      };
    }, [handleVideoReady, handleVideoError, width, height, videoReady]);

    // Reset videoReady when component becomes inactive
    useEffect(() => {
      if (!isActive) {
        setVideoReady(false);
      }
    }, [isActive]);

    return (
      <div
        ref={containerRef}
        className={`relative bg-gray-900 rounded-lg overflow-hidden ${className}`}
        style={{ width, height }}
      >
        {/* Video element */}
        <video
          ref={combinedRef}
          className="w-full h-full object-cover"
          autoPlay
          playsInline
          muted
          style={{
            transform: "scaleX(-1)", // Mirror the video for better UX
            width: "100%",
            height: "100%",
          }}
        />

        {/* Pose landmarks overlay */}
        {videoReady && showLandmarks && landmarks.length > 0 && (
          <div className="absolute inset-0" style={{ transform: "scaleX(-1)" }}>
            <PoseLandmarkOverlay
              landmarks={landmarks}
              videoWidth={actualDimensions.width}
              videoHeight={actualDimensions.height}
            />
          </div>
        )}

        {/* Recording indicator */}
        <RecordingIndicator
          isRecording={isRecording}
          progress={recordingProgress}
        />

        {/* Status overlay */}
        {!videoReady && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-800 bg-opacity-75">
            <div className="text-center text-white">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-2" />
              <p className="text-sm">Initializing camera...</p>
            </div>
          </div>
        )}

        {/* Inactive state overlay */}
        {!isActive && videoReady && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-800 bg-opacity-50">
            <div className="text-center text-white">
              <div className="w-16 h-16 rounded-full border-4 border-white border-opacity-50 flex items-center justify-center mx-auto mb-2">
                <div className="w-6 h-6 bg-white rounded-full opacity-50" />
              </div>
              <p className="text-sm">Camera ready</p>
            </div>
          </div>
        )}
      </div>
    );
  }
);

WebcamPreview.displayName = "WebcamPreview";

export default WebcamPreview;
