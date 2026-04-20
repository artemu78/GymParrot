import type React from "react";
import MovementPlayback from "../MovementPlayback";
import type { TimestampedLandmarks } from "../../types";

interface MovementReviewViewProps {
  videoUrl: string | null;
  sequence: TimestampedLandmarks[];
}

/**
 * Lets the trainer review the recorded reference video (with landmarks baked
 * in) before saving the activity. Falls back to the animated-skeleton
 * playback when MediaRecorder wasn't available.
 */
const MovementReviewView: React.FC<MovementReviewViewProps> = ({
  videoUrl,
  sequence,
}) => {
  const hasVideo = Boolean(videoUrl);

  return (
    <div
      className="flex flex-col items-center w-full max-w-xl"
      data-testid="movement-review-view"
    >
      <div className="bg-blue-50 border border-blue-200 rounded-md p-4 w-full mb-3">
        <div className="flex items-center mb-1">
          <svg
            className="h-5 w-5 text-blue-600 mr-2"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
              clipRule="evenodd"
            />
          </svg>
          <span className="font-medium text-blue-800">
            Review the recorded movement
          </span>
        </div>
        <p className="text-sm text-blue-700">
          Play it back. If it looks good, approve to save the activity.
          Otherwise retake.
        </p>
      </div>

      <div className="relative w-full aspect-video bg-black rounded-lg overflow-hidden border border-gray-200 shadow-inner">
        {hasVideo ? (
          <video
            src={videoUrl ?? undefined}
            controls
            loop
            playsInline
            className="w-full h-full object-contain bg-black"
            data-testid="movement-review-video"
          />
        ) : (
          <MovementPlayback sequence={sequence} autoPlay loop />
        )}
      </div>

      {!hasVideo && (
        <p className="text-xs text-gray-500 mt-2">
          Video recording was not available in this browser — only the
          landmark-based animated preview is shown. The activity will still be
          saved with landmark data.
        </p>
      )}
    </div>
  );
};

export default MovementReviewView;
