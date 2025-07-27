import { PoseLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";
import type { MediaPipeService as IMediaPipeService } from "./index";
import type { PoseLandmark, TimestampedLandmarks } from "../types";
import { MediaPipeError } from "../types";
import { MEDIAPIPE_CONFIG, ERROR_MESSAGES } from "../utils/constants";

export declare class PoseLandmarkerResult {
  /**
   * Pose landmarks of detected poses.
   * @export
   */
  readonly landmarks: any[][];
  /**
   * Pose landmarks in world coordinates of detected poses.
   * @export
   */
  readonly worldLandmarks: any[][];
  /**
   * Segmentation mask for the detected pose.
   * @export
   */
  readonly segmentationMasks?: any[] | undefined;
  constructor(
    /**
     * Pose landmarks of detected poses.
     * @export
     */
    landmarks: any[][],
    /**
     * Pose landmarks in world coordinates of detected poses.
     * @export
     */
    worldLandmarks: any[][],
    /**
     * Segmentation mask for the detected pose.
     * @export
     */
    segmentationMasks?: any[] | undefined
  );
  /**
   * Frees the resources held by the segmentation masks.
   * @export
   */
  close(): void;
}

export class MediaPipeService implements IMediaPipeService {
  private poseLandmarker: PoseLandmarker | null = null;
  private isInitialized = false;

  async initializePoseLandmarker(): Promise<PoseLandmarker> {
    try {
      if (this.poseLandmarker && this.isInitialized) {
        return this.poseLandmarker;
      }

      // Initialize the MediaPipe vision tasks
      const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22-rc.20250304/wasm"
      );

      // Create PoseLandmarker with configuration
      this.poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: MEDIAPIPE_CONFIG.baseOptions.modelAssetPath,
          delegate: MEDIAPIPE_CONFIG.baseOptions.delegate as any,
        },
        runningMode: MEDIAPIPE_CONFIG.runningMode as any,
        numPoses: MEDIAPIPE_CONFIG.numPoses,
      });

      this.isInitialized = true;
      return this.poseLandmarker;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      throw new MediaPipeError(
        `${ERROR_MESSAGES.MEDIAPIPE_INIT_FAILED}: ${message}`,
        "INIT_FAILED"
      );
    }
  }

  async detectPoseFromVideo(
    video: HTMLVideoElement
  ): Promise<PoseLandmarkerResult> {
    if (!this.poseLandmarker || !this.isInitialized) {
      await this.initializePoseLandmarker();
    }

    try {
      const timestamp = performance.now();
      const result = this.poseLandmarker!.detectForVideo(video, timestamp);

      if (!result) {
        throw new MediaPipeError(
          ERROR_MESSAGES.POSE_DETECTION_FAILED,
          "DETECTION_FAILED"
        );
      }

      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      throw new MediaPipeError(
        `${ERROR_MESSAGES.POSE_DETECTION_FAILED}: ${message}`,
        "DETECTION_FAILED"
      );
    }
  }

  async detectSinglePose(
    video: HTMLVideoElement
  ): Promise<PoseLandmarkerResult> {
    if (!this.poseLandmarker || !this.isInitialized) {
      await this.initializePoseLandmarker();
    }

    try {
      // Ensure video is ready for detection
      if (video.readyState < 2) {
        throw new MediaPipeError(
          "Video not ready for pose detection",
          "VIDEO_NOT_READY"
        );
      }

      const timestamp = performance.now();
      const result = this.poseLandmarker!.detectForVideo(video, timestamp);

      if (!result) {
        throw new MediaPipeError(
          ERROR_MESSAGES.POSE_DETECTION_FAILED,
          "DETECTION_FAILED"
        );
      }

      // Validate that we have pose landmarks
      if (!result.landmarks || result.landmarks.length === 0) {
        throw new MediaPipeError(
          "No pose detected in video frame",
          "NO_POSE_DETECTED"
        );
      }

      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      throw new MediaPipeError(
        `${ERROR_MESSAGES.POSE_DETECTION_FAILED}: ${message}`,
        "DETECTION_FAILED"
      );
    }
  }

  extractLandmarks(result: PoseLandmarkerResult): PoseLandmark[] {
    try {
      if (!result.landmarks || result.landmarks.length === 0) {
        return [];
      }

      // Get the first pose landmarks (we configured for numPoses: 1)
      const landmarks = result.landmarks[0];

      return landmarks.map((landmark) =>
        this.normalizeLandmark({
          x: landmark.x,
          y: landmark.y,
          z: landmark.z,
          visibility: landmark.visibility,
        })
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      throw new MediaPipeError(
        `Failed to extract landmarks: ${message}`,
        "EXTRACTION_FAILED"
      );
    }
  }

  // Normalize landmark coordinates and validate data
  private normalizeLandmark(landmark: PoseLandmark): PoseLandmark {
    return {
      x: Math.max(0, Math.min(1, landmark.x)), // Clamp to [0, 1]
      y: Math.max(0, Math.min(1, landmark.y)), // Clamp to [0, 1]
      z: landmark.z, // Z can be negative (depth)
      visibility:
        landmark.visibility !== undefined
          ? Math.max(0, Math.min(1, landmark.visibility))
          : undefined,
    };
  }

  // Validate pose landmarks for quality
  validatePoseQuality(landmarks: PoseLandmark[]): {
    isValid: boolean;
    issues: string[];
  } {
    const issues: string[] = [];

    if (landmarks.length === 0) {
      return { isValid: false, issues: ["No landmarks detected"] };
    }

    // Check for expected number of landmarks (MediaPipe pose has 33 landmarks)
    if (landmarks.length !== 33) {
      issues.push(`Expected 33 landmarks, got ${landmarks.length}`);
    }

    // Check visibility of key landmarks (nose, shoulders, hips)
    const keyLandmarkIndices = [0, 11, 12, 23, 24]; // nose, shoulders, hips
    const lowVisibilityLandmarks = keyLandmarkIndices.filter((index) => {
      const landmark = landmarks[index];
      return (
        landmark &&
        (landmark.visibility === undefined || landmark.visibility < 0.5)
      );
    });

    if (lowVisibilityLandmarks.length > 2) {
      issues.push("Too many key landmarks have low visibility");
    }

    // Check for reasonable coordinate ranges
    const invalidCoords = landmarks.filter(
      (landmark) =>
        landmark.x < 0 || landmark.x > 1 || landmark.y < 0 || landmark.y > 1
    );

    if (invalidCoords.length > 0) {
      issues.push("Some landmarks have invalid coordinates");
    }

    return {
      isValid: issues.length === 0,
      issues,
    };
  }

  // Get pose confidence score based on landmark visibility
  getPoseConfidence(landmarks: PoseLandmark[]): number {
    if (landmarks.length === 0) return 0;

    const visibilityScores = landmarks
      .map((landmark) => landmark.visibility || 0)
      .filter((visibility) => visibility > 0);

    if (visibilityScores.length === 0) return 0;

    return (
      visibilityScores.reduce((sum, score) => sum + score, 0) /
      visibilityScores.length
    );
  }

  // Start continuous movement tracking
  async startMovementTracking(
    video: HTMLVideoElement,
    onPoseDetected: (landmarks: PoseLandmark[], timestamp: number) => void,
    options: {
      duration?: number;
      frameRate?: number;
      onProgress?: (elapsed: number, total: number) => void;
      onComplete?: () => void;
      onError?: (error: MediaPipeError) => void;
    } = {}
  ): Promise<() => void> {
    if (!this.poseLandmarker || !this.isInitialized) {
      await this.initializePoseLandmarker();
    }

    const {
      duration = 30000, // 30 seconds default
      frameRate = 30,
      onProgress,
      onComplete,
      onError,
    } = options;

    let isTracking = true;
    let animationFrameId: number;
    const startTime = performance.now();
    const frameInterval = 1000 / frameRate;

    let lastFrameTime = 0;

    const trackFrame = (currentTime: number) => {
      if (!isTracking) return;

      // Control frame rate
      if (currentTime - lastFrameTime < frameInterval) {
        animationFrameId = requestAnimationFrame(trackFrame);
        return;
      }

      lastFrameTime = currentTime;
      const elapsed = currentTime - startTime;

      try {
        // Check if duration exceeded
        if (elapsed >= duration) {
          isTracking = false;
          onComplete?.();
          return;
        }

        // Detect pose
        const result = this.poseLandmarker!.detectForVideo(video, currentTime);

        if (result && result.landmarks && result.landmarks.length > 0) {
          const landmarks = this.extractLandmarks(result);
          onPoseDetected(landmarks, elapsed);
        }

        // Report progress
        onProgress?.(elapsed, duration);

        // Continue tracking
        if (isTracking) {
          animationFrameId = requestAnimationFrame(trackFrame);
        }
      } catch (error) {
        isTracking = false;
        const mediaError =
          error instanceof MediaPipeError
            ? error
            : new MediaPipeError(
                `Movement tracking failed: ${error}`,
                "TRACKING_FAILED"
              );
        onError?.(mediaError);
      }
    };

    // Start tracking
    animationFrameId = requestAnimationFrame(trackFrame);

    // Return stop function
    return () => {
      isTracking = false;
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }

  // Record movement sequence with automatic timestamping
  async recordMovementSequence(
    video: HTMLVideoElement,
    duration: number = 30000,
    options: {
      frameRate?: number;
      onProgress?: (elapsed: number, total: number) => void;
      minPoseConfidence?: number;
    } = {}
  ): Promise<TimestampedLandmarks[]> {
    const { frameRate = 30, onProgress, minPoseConfidence = 0.5 } = options;

    const sequence: TimestampedLandmarks[] = [];
    let isRecording = true;

    return new Promise((resolve, reject) => {
      const stopTracking = this.startMovementTracking(
        video,
        (landmarks, timestamp) => {
          // Only record poses with sufficient confidence
          const confidence = this.getPoseConfidence(landmarks);
          if (confidence >= minPoseConfidence) {
            sequence.push({
              timestamp,
              landmarks: landmarks.map((l) => ({ ...l })), // Deep copy
            });
          }
        },
        {
          duration,
          frameRate,
          onProgress,
          onComplete: () => {
            isRecording = false;
            resolve(sequence);
          },
          onError: (error) => {
            isRecording = false;
            reject(error);
          },
        }
      ).catch(reject);

      // Handle promise-based stop function
      if (stopTracking instanceof Promise) {
        stopTracking.then((stopFn) => {
          // Store stop function for potential early termination
          (resolve as any).stopFn = stopFn;
        });
      }
    });
  }

  // Validate movement sequence quality
  validateMovementSequence(sequence: TimestampedLandmarks[]): {
    isValid: boolean;
    issues: string[];
    stats: {
      totalFrames: number;
      duration: number;
      averageConfidence: number;
      frameRate: number;
    };
  } {
    const issues: string[] = [];

    if (sequence.length === 0) {
      return {
        isValid: false,
        issues: ["No movement data recorded"],
        stats: {
          totalFrames: 0,
          duration: 0,
          averageConfidence: 0,
          frameRate: 0,
        },
      };
    }

    // Calculate stats
    const totalFrames = sequence.length;
    const duration =
      sequence[sequence.length - 1].timestamp - sequence[0].timestamp;
    const frameRate = totalFrames / (duration / 1000);

    const confidenceScores = sequence.map((frame) =>
      this.getPoseConfidence(frame.landmarks)
    );
    const averageConfidence =
      confidenceScores.reduce((sum, score) => sum + score, 0) /
      confidenceScores.length;

    // Validate minimum duration
    if (duration < 1000) {
      // Less than 1 second
      issues.push("Movement sequence too short (minimum 1 second)");
    }

    // Validate frame rate
    if (frameRate < 10) {
      issues.push("Frame rate too low for smooth movement tracking");
    }

    // Validate confidence
    if (averageConfidence < 0.5) {
      issues.push("Average pose confidence too low");
    }

    // Check for gaps in tracking
    const timeGaps = [];
    for (let i = 1; i < sequence.length; i++) {
      const gap = sequence[i].timestamp - sequence[i - 1].timestamp;
      if (gap > 200) {
        // More than 200ms gap
        timeGaps.push(gap);
      }
    }

    if (timeGaps.length > sequence.length * 0.1) {
      // More than 10% gaps
      issues.push("Too many gaps in movement tracking");
    }

    return {
      isValid: issues.length === 0,
      issues,
      stats: {
        totalFrames,
        duration,
        averageConfidence,
        frameRate,
      },
    };
  }

  // Cleanup method to properly dispose of resources
  dispose(): void {
    if (this.poseLandmarker) {
      this.poseLandmarker.close();
      this.poseLandmarker = null;
      this.isInitialized = false;
    }
  }
}

// Export singleton instance
export default new MediaPipeService();
