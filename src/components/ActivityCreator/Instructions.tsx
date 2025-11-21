import React from "react";
import type { ActivityType } from "../../types";

interface InstructionsProps {
  activityType: ActivityType;
  countdownDelay: number;
}

const Instructions: React.FC<InstructionsProps> = ({ activityType, countdownDelay }) => {
  return (
    <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-md">
      <h3 className="text-sm font-medium text-blue-800 mb-2">Instructions:</h3>
      <ul className="text-sm text-blue-700 space-y-1">
        {activityType === "pose" ? (
          <>
            <li>• Enter a name for your pose activity</li>
            <li>• Position yourself in front of the camera</li>
            <li>
              • Click "Start Recording" - you'll see a {countdownDelay}-second countdown
            </li>
            <li>• Hold your pose when the countdown reaches zero</li>
            <li>• Review the captured pose and approve or retake</li>
            <li>• Make sure your whole body is visible for best results</li>
          </>
        ) : (
          <>
            <li>• Enter a name for your movement activity</li>
            <li>• Choose the duration (10 or 30 seconds)</li>
            <li>• Position yourself in front of the camera</li>
            <li>• Click "Start Recording" and perform your movement</li>
            <li>• Keep your whole body visible throughout the movement</li>
          </>
        )}
      </ul>
    </div>
  );
};

export default Instructions;
