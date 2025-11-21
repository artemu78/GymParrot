import React from "react";
import type { PoseLandmark } from "../../types";

interface CapturedPoseViewProps {
  capturedImage: string;
  capturedLandmarks: PoseLandmark[];
}

const POSE_CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 7], [0, 4], [4, 5], [5, 6], [6, 8],
  [9, 10], [11, 12], [11, 13], [13, 15], [15, 17], [15, 19], [15, 21],
  [12, 14], [14, 16], [16, 18], [16, 20], [16, 22],
  [11, 23], [12, 24], [23, 24], [23, 25], [25, 27], [27, 29], [29, 31],
  [24, 26], [26, 28], [28, 30], [30, 32]
];

const CapturedPoseView: React.FC<CapturedPoseViewProps> = ({
  capturedImage,
  capturedLandmarks,
}) => {
  return (
    <>
      {/* Top Alert */}
      <div className="mb-3" style={{ width: 640 }}>
        <div className="bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg">
          <div className="flex items-center justify-center">
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
            <span className="text-sm font-medium">📸 Captured Photo with Pose Detection</span>
          </div>
        </div>
      </div>

      {/* Captured Image */}
      <div className="relative bg-gray-900 rounded-lg overflow-hidden shadow-xl border-4 border-blue-500" style={{ width: 640, height: 480 }}>
        <img
          src={capturedImage}
          alt="Captured pose"
          className="w-full h-full object-cover"
        />
        {/* Overlay landmarks */}
        {capturedLandmarks.length > 0 && (
          <div className="absolute inset-0">
            <svg
              className="absolute inset-0 pointer-events-none"
              width={640}
              height={480}
              viewBox="0 0 640 480"
            >
              {/* Draw connections */}
              {POSE_CONNECTIONS.map(([startIdx, endIdx], index) => {
                const startLandmark = capturedLandmarks[startIdx];
                const endLandmark = capturedLandmarks[endIdx];
                if (!startLandmark || !endLandmark || 
                    (startLandmark.visibility || 1) < 0.5 || 
                    (endLandmark.visibility || 1) < 0.5) {
                  return null;
                }
                return (
                  <line
                    key={index}
                    x1={startLandmark.x * 640}
                    y1={startLandmark.y * 480}
                    x2={endLandmark.x * 640}
                    y2={endLandmark.y * 480}
                    stroke="#00ff00"
                    strokeWidth="3"
                    opacity="0.8"
                  />
                );
              })}
              {/* Draw landmarks */}
              {capturedLandmarks.map((landmark, index) => {
                if ((landmark.visibility || 1) < 0.5) return null;
                return (
                  <circle
                    key={index}
                    cx={landmark.x * 640}
                    cy={landmark.y * 480}
                    r="4"
                    fill="#ff0000"
                    opacity="0.9"
                  />
                );
              })}
            </svg>
          </div>
        )}
      </div>

      {/* Bottom Alert */}
      <div className="mt-3" style={{ width: 640 }}>
        <div className="bg-green-600 text-white px-3 py-2 rounded-lg shadow-lg text-center">
          <span className="text-xs font-medium">✓ Pose landmarks detected and overlaid</span>
        </div>
      </div>
    </>
  );
};

export default CapturedPoseView;
