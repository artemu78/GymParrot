import type React from "react";
import { useEffect, useRef, useState } from "react";
import type { Activity, TimestampedLandmarks } from "../types";
import videoBlobStore from "../services/VideoBlobStore";
import MovementPlayback from "./MovementPlayback";

interface VideoReferencePlayerProps {
  activity: Activity;
  loop?: boolean;
  autoPlay?: boolean;
  controls?: boolean;
  className?: string;
}

/**
 * Plays back the reference recording for a movement activity. Prefers the
 * real recorded video (MediaRecorder output, with landmarks baked in); falls
 * back to the animated-skeleton playback when no video is available (older
 * activities or browsers without MediaRecorder support).
 */
const VideoReferencePlayer: React.FC<VideoReferencePlayerProps> = ({
  activity,
  loop = true,
  autoPlay = true,
  controls = true,
  className = "",
}) => {
  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const [videoResolveFailed, setVideoResolveFailed] = useState(false);
  const createdUrlRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const { videoBlobId, videoUrl } = activity;

    if (!videoBlobId && !videoUrl) {
      setVideoSrc(null);
      return;
    }

    if (videoUrl && !videoBlobId) {
      setVideoSrc(videoUrl);
      return;
    }

    (async () => {
      try {
        if (videoBlobId) {
          const url = await videoBlobStore.resolveUrl(videoBlobId);
          if (cancelled) {
            if (url) URL.revokeObjectURL(url);
            return;
          }
          if (url) {
            createdUrlRef.current = url;
            setVideoSrc(url);
          } else {
            setVideoResolveFailed(true);
          }
        }
      } catch (err) {
        console.warn("Failed to resolve reference video:", err);
        if (!cancelled) setVideoResolveFailed(true);
      }
    })();

    return () => {
      cancelled = true;
      if (createdUrlRef.current) {
        URL.revokeObjectURL(createdUrlRef.current);
        createdUrlRef.current = null;
      }
    };
  }, [activity]);

  const sequence: TimestampedLandmarks[] = activity.movementData ?? [];
  const shouldShowVideo = videoSrc && !videoResolveFailed;

  if (shouldShowVideo) {
    return (
      <video
        src={videoSrc}
        autoPlay={autoPlay}
        loop={loop}
        muted
        playsInline
        controls={controls}
        className={`w-full h-full object-contain bg-black ${className}`}
        data-testid="reference-video"
      />
    );
  }

  if (sequence.length > 0) {
    return (
      <MovementPlayback
        sequence={sequence}
        autoPlay={autoPlay}
        loop={loop}
        className={className}
      />
    );
  }

  return (
    <div
      className={`flex items-center justify-center h-full text-gray-400 ${className}`}
    >
      No reference available
    </div>
  );
};

export default VideoReferencePlayer;
