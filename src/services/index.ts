// Service interfaces and implementations for the activity system

import type { PoseLandmark, TimestampedLandmarks, Activity, ActivityMetadata, ComparisonResult, DifficultyLevel } from '../types'
import type { PoseLandmarker, PoseLandmarkerResult } from '@mediapipe/tasks-vision'

// Service implementations
export { MediaPipeService } from './MediaPipeService'
export { default as mediaPipeService } from './MediaPipeService'
export { WebcamService } from './WebcamService'
export { default as webcamService } from './WebcamService'
export { ActivityService } from './ActivityService'
export { default as activityService } from './ActivityService'
export { ComparisonService } from './ComparisonService'
export { default as comparisonService } from './ComparisonService'

export interface MediaPipeService {
  initializePoseLandmarker(): Promise<PoseLandmarker>
  detectPoseFromVideo(video: HTMLVideoElement): Promise<PoseLandmarkerResult>
  detectSinglePose(video: HTMLVideoElement): Promise<PoseLandmarkerResult>
  extractLandmarks(result: PoseLandmarkerResult): PoseLandmark[]
  startMovementTracking(
    video: HTMLVideoElement,
    onPoseDetected: (landmarks: PoseLandmark[], timestamp: number) => void,
    options?: {
      duration?: number
      frameRate?: number
      onProgress?: (elapsed: number, total: number) => void
      onComplete?: () => void
      onError?: (error: any) => void
    }
  ): Promise<() => void>
  recordMovementSequence(
    video: HTMLVideoElement,
    duration?: number,
    options?: {
      frameRate?: number
      onProgress?: (elapsed: number, total: number) => void
      minPoseConfidence?: number
    }
  ): Promise<TimestampedLandmarks[]>
  validateMovementSequence(sequence: TimestampedLandmarks[]): {
    isValid: boolean
    issues: string[]
    stats: {
      totalFrames: number
      duration: number
      averageConfidence: number
      frameRate: number
    }
  }
}

export interface ActivityService {
  createPoseActivity(landmarks: PoseLandmark[], metadata: ActivityMetadata): Promise<string>
  createMovementActivity(landmarkSequence: TimestampedLandmarks[], metadata: ActivityMetadata): Promise<string>
  getActivities(): Promise<Activity[]>
  getActivityById(id: string): Promise<Activity>
  saveActivity(activity: Activity): Promise<void>
}

export interface ComparisonService {
  comparePoses(recorded: PoseLandmark[], current: PoseLandmark[], difficulty: DifficultyLevel): ComparisonResult
  compareMovementSequence(recorded: TimestampedLandmarks[], current: TimestampedLandmarks[], difficulty: DifficultyLevel): ComparisonResult
  calculateSimilarityScore(pose1: PoseLandmark[], pose2: PoseLandmark[]): number
}

export interface WebcamService {
  requestCameraAccess(): Promise<MediaStream>
  startVideoStream(videoElement: HTMLVideoElement): Promise<void>
  stopVideoStream(): void
  checkCameraPermissions(): Promise<boolean>
}