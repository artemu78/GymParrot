import type { ActivityService as IActivityService } from './index'
import type { PoseLandmark, TimestampedLandmarks, Activity, ActivityMetadata } from '../types'
import { ActivityError } from '../types'
import { validateActivity, validateActivityMetadata } from '../utils/validation'
import { ERROR_MESSAGES } from '../utils/constants'

// Mock DynamoDB implementation for now - in production this would use AWS SDK
interface ActivityRecord {
  PK: string // "ACTIVITY#${activityId}"
  SK: string // "METADATA" or "DATA#${timestamp}"
  GSI1PK: string // "ACTIVITIES"
  GSI1SK: string // "${createdAt}#${activityId}"
  
  id: string
  type: 'pose' | 'movement'
  name: string
  createdBy: string
  createdAt: string
  duration?: number
  isPublic: boolean
  landmarks?: PoseLandmark[] | TimestampedLandmarks[]
}

export class ActivityService implements IActivityService {
  private activities: Map<string, Activity> = new Map()
  private nextId = 1

  async createPoseActivity(landmarks: PoseLandmark[], metadata: ActivityMetadata): Promise<string> {
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
        landmarks: [...landmarks] // Deep copy
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

  async createMovementActivity(landmarkSequence: TimestampedLandmarks[], metadata: ActivityMetadata): Promise<string> {
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
      // In production, this would query DynamoDB with GSI
      const activities = Array.from(this.activities.values())
      
      // Filter to only public activities (in production, this would be done in the query)
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

      const activity = this.activities.get(id)
      
      if (!activity) {
        throw new ActivityError('Activity not found', 'NOT_FOUND')
      }

      // Return deep copy to prevent external modification
      return {
        ...activity,
        landmarks: Array.isArray(activity.landmarks) 
          ? activity.landmarks.map(item => 
              'timestamp' in item 
                ? { timestamp: item.timestamp, landmarks: [...item.landmarks] }
                : { ...item }
            )
          : []
      }

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

      // In production, this would save to DynamoDB
      // For now, store in memory with deep copy
      const activityCopy: Activity = {
        ...activity,
        landmarks: Array.isArray(activity.landmarks) 
          ? activity.landmarks.map(item => 
              'timestamp' in item 
                ? { timestamp: item.timestamp, landmarks: [...item.landmarks] }
                : { ...item }
            )
          : []
      }

      this.activities.set(activity.id, activityCopy)

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
      const activities = Array.from(this.activities.values())
      
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
      const activities = Array.from(this.activities.values())
      
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

      if (!this.activities.has(id)) {
        throw new ActivityError('Activity not found', 'NOT_FOUND')
      }

      this.activities.delete(id)

    } catch (error) {
      if (error instanceof ActivityError) {
        throw error
      }
      const message = error instanceof Error ? error.message : 'Unknown error'
      throw new ActivityError(`Failed to delete activity: ${message}`, 'DELETE_FAILED')
    }
  }

  // Get activity statistics
  getActivityStats(): {
    totalActivities: number
    poseActivities: number
    movementActivities: number
    publicActivities: number
    privateActivities: number
  } {
    const activities = Array.from(this.activities.values())
    
    return {
      totalActivities: activities.length,
      poseActivities: activities.filter(a => a.type === 'pose').length,
      movementActivities: activities.filter(a => a.type === 'movement').length,
      publicActivities: activities.filter(a => a.isPublic).length,
      privateActivities: activities.filter(a => !a.isPublic).length
    }
  }

  // Clear all activities (for testing)
  clearAll(): void {
    this.activities.clear()
    this.nextId = 1
  }
}

// Export singleton instance
export default new ActivityService()