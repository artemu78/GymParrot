import type { ActivityService as IActivityService } from './index'
import type { PoseLandmark, TimestampedLandmarks, Activity, ActivityMetadata } from '../types'
import { ActivityError } from '../types'
import { validateActivity, validateActivityMetadata } from '../utils/validation'
import { ERROR_MESSAGES } from '../utils/constants'
import storageService from './StorageService'
import videoBlobStore from './VideoBlobStore'

export interface MovementVideoInput {
  blob: Blob
  mimeType: string
}

export class ActivityService implements IActivityService {
  private nextId = 1

  constructor() {
    // Initialize nextId from existing activities in storage
    this.initializeNextId();
  }

  private async initializeNextId(): Promise<void> {
    try {
      const activities = await storageService.getAllActivities();
      if (activities.length > 0) {
        // Extract numeric IDs and find the highest
        const ids = activities.map(a => {
          const match = a.id.match(/\d+$/);
          return match ? parseInt(match[0], 10) : 0;
        });
        this.nextId = Math.max(...ids) + 1;
      }
    } catch (error) {
      console.warn('Failed to initialize nextId from storage:', error);
    }
  }

  async createPoseActivity(landmarks: PoseLandmark[], metadata: ActivityMetadata, imageData?: string): Promise<string> {
    try {
      // Validate inputs
      if (!Array.isArray(landmarks) || landmarks.length === 0) {
        throw new ActivityError('Invalid landmarks data', 'INVALID_LANDMARKS')
      }

      if (!validateActivityMetadata(metadata)) {
        throw new ActivityError('Invalid activity metadata', 'INVALID_METADATA')
      }

      if (metadata.type !== 'pose') {
        throw new ActivityError('Activity type must be "pose" for pose activities', 'INVALID_TYPE')
      }

      // Create activity
      const activityId = `pose_${this.nextId++}`
      const activity: Activity = {
        id: activityId,
        type: 'pose',
        name: metadata.name,
        createdBy: metadata.createdBy,
        createdAt: new Date(),
        isPublic: metadata.isPublic,
        imageData: imageData,
        landmarks: [...landmarks], // Deep copy
        poseData: [...landmarks] // Store separately as poseData for compatibility
      }

      // Validate complete activity
      if (!validateActivity(activity)) {
        throw new ActivityError('Created activity failed validation', 'VALIDATION_FAILED')
      }

      // Store activity
      await this.saveActivity(activity)

      return activityId

    } catch (error) {
      if (error instanceof ActivityError) {
        throw error
      }
      const message = error instanceof Error ? error.message : 'Unknown error'
      throw new ActivityError(`${ERROR_MESSAGES.ACTIVITY_SAVE_FAILED}: ${message}`, 'SAVE_FAILED')
    }
  }

  async createMovementActivity(
    landmarkSequence: TimestampedLandmarks[],
    metadata: ActivityMetadata,
    video?: MovementVideoInput
  ): Promise<string> {
    try {
      // Validate inputs
      if (!Array.isArray(landmarkSequence) || landmarkSequence.length === 0) {
        throw new ActivityError('Invalid landmark sequence data', 'INVALID_SEQUENCE')
      }

      if (!validateActivityMetadata(metadata)) {
        throw new ActivityError('Invalid activity metadata', 'INVALID_METADATA')
      }

      if (metadata.type !== 'movement') {
        throw new ActivityError('Activity type must be "movement" for movement activities', 'INVALID_TYPE')
      }

      // Validate sequence structure
      for (const frame of landmarkSequence) {
        if (typeof frame.timestamp !== 'number' || !Array.isArray(frame.landmarks)) {
          throw new ActivityError('Invalid landmark sequence structure', 'INVALID_SEQUENCE_STRUCTURE')
        }
      }

      // Create activity
      const activityId = `movement_${this.nextId++}`
      const activity: Activity = {
        id: activityId,
        type: 'movement',
        name: metadata.name,
        createdBy: metadata.createdBy,
        createdAt: new Date(),
        duration: metadata.duration,
        isPublic: metadata.isPublic,
        landmarks: landmarkSequence.map(frame => ({
          timestamp: frame.timestamp,
          landmarks: [...frame.landmarks] // Deep copy
        }))
      }

      // Persist video blob (if provided) in the dedicated blob store. We do
      // this before saving the activity so the stored activity points at a
      // real blob id. LocalStorage can't hold video; IndexedDB (default blob
      // store) can, and swapping to a cloud backend is a one-line change.
      if (video && video.blob && video.blob.size > 0) {
        const videoBlobId = `${activityId}_video`
        await videoBlobStore.save(videoBlobId, video.blob)
        activity.videoBlobId = videoBlobId
        activity.videoMimeType = video.mimeType
      }

      // Validate complete activity
      if (!validateActivity(activity)) {
        throw new ActivityError('Created activity failed validation', 'VALIDATION_FAILED')
      }

      // Store activity
      await this.saveActivity(activity)

      return activityId

    } catch (error) {
      if (error instanceof ActivityError) {
        throw error
      }
      const message = error instanceof Error ? error.message : 'Unknown error'
      throw new ActivityError(`${ERROR_MESSAGES.ACTIVITY_SAVE_FAILED}: ${message}`, 'SAVE_FAILED')
    }
  }

  async getActivities(): Promise<Activity[]> {
    try {
      // Get all activities from storage
      const activities = await storageService.getAllActivities();
      
      // Filter to only public activities
      return activities
        .filter(activity => activity.isPublic)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()) // Most recent first

    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      throw new ActivityError(`${ERROR_MESSAGES.ACTIVITY_LOAD_FAILED}: ${message}`, 'LOAD_FAILED')
    }
  }

  async getActivityById(id: string): Promise<Activity> {
    try {
      if (!id || typeof id !== 'string') {
        throw new ActivityError('Invalid activity ID', 'INVALID_ID')
      }

      const activity = await storageService.getActivity(id);
      
      if (!activity) {
        throw new ActivityError('Activity not found', 'NOT_FOUND')
      }

      // Return deep copy to prevent external modification
      const landmarks = Array.isArray(activity.landmarks)
        ? activity.landmarks.map(item =>
            'timestamp' in item
              ? { timestamp: item.timestamp, landmarks: [...item.landmarks] } as TimestampedLandmarks
              : { ...item } as PoseLandmark
          )
        : [];

      // Ensure type-specific accessors (poseData / movementData) are populated
      // when loading from storage, since only `landmarks` is persisted.
      const hydrated: Activity = {
        ...activity,
        landmarks: landmarks as typeof activity.landmarks,
      };

      if (activity.type === 'movement') {
        const hasValidSequence =
          Array.isArray(hydrated.movementData) && hydrated.movementData.length > 0;
        if (!hasValidSequence) {
          hydrated.movementData = (landmarks as TimestampedLandmarks[]).map(
            (frame) => ({
              timestamp: frame.timestamp,
              landmarks: [...frame.landmarks],
            })
          );
        }
      } else if (activity.type === 'pose') {
        const hasValidPose =
          Array.isArray(hydrated.poseData) && hydrated.poseData.length > 0;
        if (!hasValidPose) {
          hydrated.poseData = (landmarks as PoseLandmark[]).map((lm) => ({ ...lm }));
        }
      }

      return hydrated;

    } catch (error) {
      if (error instanceof ActivityError) {
        throw error
      }
      const message = error instanceof Error ? error.message : 'Unknown error'
      throw new ActivityError(`Failed to get activity: ${message}`, 'GET_FAILED')
    }
  }

  async saveActivity(activity: Activity): Promise<void> {
    try {
      // Validate activity before saving
      if (!validateActivity(activity)) {
        throw new ActivityError('Activity validation failed', 'VALIDATION_FAILED')
      }

      // Save to storage service (LocalStorage or Backend API)
      const landmarks = Array.isArray(activity.landmarks) 
        ? activity.landmarks.map(item => 
            'timestamp' in item 
              ? { timestamp: item.timestamp, landmarks: [...item.landmarks] } as TimestampedLandmarks
              : { ...item } as PoseLandmark
          )
        : [];

      const activityCopy: Activity = {
        ...activity,
        landmarks: landmarks as typeof activity.landmarks
      }

      await storageService.saveActivity(activityCopy);

    } catch (error) {
      if (error instanceof ActivityError) {
        throw error
      }
      const message = error instanceof Error ? error.message : 'Unknown error'
      throw new ActivityError(`${ERROR_MESSAGES.ACTIVITY_SAVE_FAILED}: ${message}`, 'SAVE_FAILED')
    }
  }

  // Additional utility methods

  async getActivitiesByCreator(createdBy: string): Promise<Activity[]> {
    try {
      const activities = await storageService.getAllActivities();
      
      return activities
        .filter(activity => activity.createdBy === createdBy)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())

    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      throw new ActivityError(`Failed to get activities by creator: ${message}`, 'GET_FAILED')
    }
  }

  async getActivitiesByType(type: 'pose' | 'movement'): Promise<Activity[]> {
    try {
      const activities = await storageService.getAllActivities();
      
      return activities
        .filter(activity => activity.type === type && activity.isPublic)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())

    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      throw new ActivityError(`Failed to get activities by type: ${message}`, 'GET_FAILED')
    }
  }

  async deleteActivity(id: string): Promise<void> {
    try {
      if (!id || typeof id !== 'string') {
        throw new ActivityError('Invalid activity ID', 'INVALID_ID')
      }

      const activity = await storageService.getActivity(id);
      if (!activity) {
        throw new ActivityError('Activity not found', 'NOT_FOUND')
      }

      if (activity.videoBlobId) {
        try {
          await videoBlobStore.remove(activity.videoBlobId);
        } catch (error) {
          console.warn('Failed to delete video blob:', error);
        }
      }

      await storageService.deleteActivity(id);

    } catch (error) {
      if (error instanceof ActivityError) {
        throw error
      }
      const message = error instanceof Error ? error.message : 'Unknown error'
      throw new ActivityError(`Failed to delete activity: ${message}`, 'DELETE_FAILED')
    }
  }

  // Get activity statistics
  async getActivityStats(): Promise<{
    totalActivities: number
    poseActivities: number
    movementActivities: number
    publicActivities: number
    privateActivities: number
  }> {
    const activities = await storageService.getAllActivities();
    
    return {
      totalActivities: activities.length,
      poseActivities: activities.filter(a => a.type === 'pose').length,
      movementActivities: activities.filter(a => a.type === 'movement').length,
      publicActivities: activities.filter(a => a.isPublic).length,
      privateActivities: activities.filter(a => !a.isPublic).length
    }
  }

  // Clear all activities (for testing)
  async clearAll(): Promise<void> {
    await storageService.clearAll();
    this.nextId = 1;
  }
}

// Export singleton instance
export default new ActivityService()