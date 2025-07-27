import { describe, it, expect, beforeEach } from 'vitest'
import { ActivityService } from '../ActivityService'
import { ActivityError } from '../../types'
import type { PoseLandmark, TimestampedLandmarks, ActivityMetadata } from '../../types'

describe('ActivityService', () => {
  let service: ActivityService

  beforeEach(() => {
    service = new ActivityService()
    service.clearAll() // Reset state between tests
  })

  const mockPoseLandmarks: PoseLandmark[] = [
    { x: 0.5, y: 0.5, z: 0.1, visibility: 0.9 },
    { x: 0.6, y: 0.4, z: 0.2, visibility: 0.8 }
  ]

  const mockMovementSequence: TimestampedLandmarks[] = [
    { timestamp: 0, landmarks: mockPoseLandmarks },
    { timestamp: 33, landmarks: mockPoseLandmarks },
    { timestamp: 66, landmarks: mockPoseLandmarks }
  ]

  const mockPoseMetadata: ActivityMetadata = {
    name: 'Test Pose',
    type: 'pose',
    createdBy: 'testuser',
    isPublic: true
  }

  const mockMovementMetadata: ActivityMetadata = {
    name: 'Test Movement',
    type: 'movement',
    createdBy: 'testuser',
    duration: 3000,
    isPublic: true
  }

  describe('createPoseActivity', () => {
    it('should create pose activity successfully', async () => {
      const activityId = await service.createPoseActivity(mockPoseLandmarks, mockPoseMetadata)

      expect(activityId).toMatch(/^pose_\d+$/)
      
      const activity = await service.getActivityById(activityId)
      expect(activity.type).toBe('pose')
      expect(activity.name).toBe('Test Pose')
      expect(activity.createdBy).toBe('testuser')
      expect(activity.landmarks).toHaveLength(2)
    })

    it('should throw error for empty landmarks', async () => {
      await expect(service.createPoseActivity([], mockPoseMetadata))
        .rejects.toThrow(ActivityError)
    })

    it('should throw error for invalid landmarks', async () => {
      await expect(service.createPoseActivity('invalid' as any, mockPoseMetadata))
        .rejects.toThrow(ActivityError)
    })

    it('should throw error for invalid metadata', async () => {
      await expect(service.createPoseActivity(mockPoseLandmarks, {} as any))
        .rejects.toThrow(ActivityError)
    })

    it('should throw error for wrong activity type', async () => {
      const wrongMetadata = { ...mockPoseMetadata, type: 'movement' as const }
      
      await expect(service.createPoseActivity(mockPoseLandmarks, wrongMetadata))
        .rejects.toThrow(ActivityError)
    })
  })

  describe('createMovementActivity', () => {
    it('should create movement activity successfully', async () => {
      const activityId = await service.createMovementActivity(mockMovementSequence, mockMovementMetadata)

      expect(activityId).toMatch(/^movement_\d+$/)
      
      const activity = await service.getActivityById(activityId)
      expect(activity.type).toBe('movement')
      expect(activity.name).toBe('Test Movement')
      expect(activity.duration).toBe(3000)
      expect(activity.landmarks).toHaveLength(3)
    })

    it('should throw error for empty sequence', async () => {
      await expect(service.createMovementActivity([], mockMovementMetadata))
        .rejects.toThrow(ActivityError)
    })

    it('should throw error for invalid sequence', async () => {
      await expect(service.createMovementActivity('invalid' as any, mockMovementMetadata))
        .rejects.toThrow(ActivityError)
    })

    it('should throw error for invalid sequence structure', async () => {
      const invalidSequence = [
        { timestamp: 'invalid', landmarks: mockPoseLandmarks }
      ] as any

      await expect(service.createMovementActivity(invalidSequence, mockMovementMetadata))
        .rejects.toThrow(ActivityError)
    })

    it('should throw error for wrong activity type', async () => {
      const wrongMetadata = { ...mockMovementMetadata, type: 'pose' as const }
      
      await expect(service.createMovementActivity(mockMovementSequence, wrongMetadata))
        .rejects.toThrow(ActivityError)
    })
  })

  describe('getActivities', () => {
    it('should return empty array when no activities exist', async () => {
      const activities = await service.getActivities()
      expect(activities).toEqual([])
    })

    it('should return only public activities', async () => {
      // Create public activity
      const publicId = await service.createPoseActivity(mockPoseLandmarks, mockPoseMetadata)
      
      // Create private activity
      const privateMetadata = { ...mockPoseMetadata, isPublic: false }
      await service.createPoseActivity(mockPoseLandmarks, privateMetadata)

      const activities = await service.getActivities()
      
      expect(activities).toHaveLength(1)
      expect(activities[0].id).toBe(publicId)
      expect(activities[0].isPublic).toBe(true)
    })

    it('should return activities sorted by creation date (newest first)', async () => {
      const id1 = await service.createPoseActivity(mockPoseLandmarks, { ...mockPoseMetadata, name: 'First' })
      
      // Small delay to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 10))
      
      const id2 = await service.createPoseActivity(mockPoseLandmarks, { ...mockPoseMetadata, name: 'Second' })

      const activities = await service.getActivities()
      
      expect(activities).toHaveLength(2)
      expect(activities[0].id).toBe(id2) // Newest first
      expect(activities[1].id).toBe(id1)
    })
  })

  describe('getActivityById', () => {
    it('should return activity by ID', async () => {
      const activityId = await service.createPoseActivity(mockPoseLandmarks, mockPoseMetadata)
      
      const activity = await service.getActivityById(activityId)
      
      expect(activity.id).toBe(activityId)
      expect(activity.name).toBe('Test Pose')
    })

    it('should throw error for invalid ID', async () => {
      await expect(service.getActivityById(''))
        .rejects.toThrow(ActivityError)
      
      await expect(service.getActivityById(null as any))
        .rejects.toThrow(ActivityError)
    })

    it('should throw error for non-existent activity', async () => {
      await expect(service.getActivityById('nonexistent'))
        .rejects.toThrow(ActivityError)
    })

    it('should return deep copy to prevent external modification', async () => {
      const activityId = await service.createPoseActivity(mockPoseLandmarks, mockPoseMetadata)
      
      const activity1 = await service.getActivityById(activityId)
      const activity2 = await service.getActivityById(activityId)
      
      // Modify one copy
      if (Array.isArray(activity1.landmarks) && !('timestamp' in activity1.landmarks[0])) {
        (activity1.landmarks[0] as PoseLandmark).x = 0.999
      }
      
      // Other copy should be unchanged
      if (Array.isArray(activity2.landmarks) && !('timestamp' in activity2.landmarks[0])) {
        expect((activity2.landmarks[0] as PoseLandmark).x).toBe(0.5)
      }
    })
  })

  describe('saveActivity', () => {
    it('should save valid activity', async () => {
      const activity = {
        id: 'test_activity',
        type: 'pose' as const,
        name: 'Test Activity',
        createdBy: 'testuser',
        createdAt: new Date(),
        isPublic: true,
        landmarks: mockPoseLandmarks
      }

      await expect(service.saveActivity(activity)).resolves.not.toThrow()
      
      const retrieved = await service.getActivityById('test_activity')
      expect(retrieved.name).toBe('Test Activity')
    })

    it('should throw error for invalid activity', async () => {
      const invalidActivity = {
        id: '', // Invalid empty ID
        type: 'pose' as const,
        name: 'Test',
        createdBy: 'testuser',
        createdAt: new Date(),
        isPublic: true,
        landmarks: mockPoseLandmarks
      }

      await expect(service.saveActivity(invalidActivity))
        .rejects.toThrow(ActivityError)
    })
  })

  describe('getActivitiesByCreator', () => {
    it('should return activities by specific creator', async () => {
      const user1Metadata = { ...mockPoseMetadata, createdBy: 'user1' }
      const user2Metadata = { ...mockPoseMetadata, createdBy: 'user2' }

      const id1 = await service.createPoseActivity(mockPoseLandmarks, user1Metadata)
      await service.createPoseActivity(mockPoseLandmarks, user2Metadata)

      const user1Activities = await service.getActivitiesByCreator('user1')
      
      expect(user1Activities).toHaveLength(1)
      expect(user1Activities[0].id).toBe(id1)
      expect(user1Activities[0].createdBy).toBe('user1')
    })

    it('should return empty array for non-existent creator', async () => {
      const activities = await service.getActivitiesByCreator('nonexistent')
      expect(activities).toEqual([])
    })
  })

  describe('getActivitiesByType', () => {
    it('should return activities by type', async () => {
      const poseId = await service.createPoseActivity(mockPoseLandmarks, mockPoseMetadata)
      await service.createMovementActivity(mockMovementSequence, mockMovementMetadata)

      const poseActivities = await service.getActivitiesByType('pose')
      
      expect(poseActivities).toHaveLength(1)
      expect(poseActivities[0].id).toBe(poseId)
      expect(poseActivities[0].type).toBe('pose')
    })

    it('should only return public activities', async () => {
      // Create private pose activity
      const privateMetadata = { ...mockPoseMetadata, isPublic: false }
      await service.createPoseActivity(mockPoseLandmarks, privateMetadata)

      const poseActivities = await service.getActivitiesByType('pose')
      
      expect(poseActivities).toHaveLength(0)
    })
  })

  describe('deleteActivity', () => {
    it('should delete existing activity', async () => {
      const activityId = await service.createPoseActivity(mockPoseLandmarks, mockPoseMetadata)
      
      await service.deleteActivity(activityId)
      
      await expect(service.getActivityById(activityId))
        .rejects.toThrow(ActivityError)
    })

    it('should throw error for invalid ID', async () => {
      await expect(service.deleteActivity(''))
        .rejects.toThrow(ActivityError)
    })

    it('should throw error for non-existent activity', async () => {
      await expect(service.deleteActivity('nonexistent'))
        .rejects.toThrow(ActivityError)
    })
  })

  describe('getActivityStats', () => {
    it('should return correct statistics', async () => {
      await service.createPoseActivity(mockPoseLandmarks, mockPoseMetadata)
      await service.createMovementActivity(mockMovementSequence, mockMovementMetadata)
      
      const privateMetadata = { ...mockPoseMetadata, isPublic: false }
      await service.createPoseActivity(mockPoseLandmarks, privateMetadata)

      const stats = service.getActivityStats()
      
      expect(stats.totalActivities).toBe(3)
      expect(stats.poseActivities).toBe(2)
      expect(stats.movementActivities).toBe(1)
      expect(stats.publicActivities).toBe(2)
      expect(stats.privateActivities).toBe(1)
    })

    it('should return zero stats for empty service', () => {
      const stats = service.getActivityStats()
      
      expect(stats.totalActivities).toBe(0)
      expect(stats.poseActivities).toBe(0)
      expect(stats.movementActivities).toBe(0)
      expect(stats.publicActivities).toBe(0)
      expect(stats.privateActivities).toBe(0)
    })
  })

  describe('clearAll', () => {
    it('should clear all activities', async () => {
      await service.createPoseActivity(mockPoseLandmarks, mockPoseMetadata)
      await service.createMovementActivity(mockMovementSequence, mockMovementMetadata)

      service.clearAll()

      const activities = await service.getActivities()
      expect(activities).toHaveLength(0)
      
      const stats = service.getActivityStats()
      expect(stats.totalActivities).toBe(0)
    })
  })
})