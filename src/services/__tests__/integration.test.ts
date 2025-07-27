import { describe, it, expect, beforeEach } from 'vitest'
import { ActivityService } from '../ActivityService'
import type { PoseLandmark, TimestampedLandmarks } from '../../types'

describe('Service Integration', () => {
  let activityService: ActivityService

  beforeEach(() => {
    activityService = new ActivityService()
    activityService.clearAll()
  })

  it('should create and retrieve pose activity end-to-end', async () => {
    // Simulate pose landmarks from MediaPipe
    const landmarks: PoseLandmark[] = Array.from({ length: 33 }, (_, i) => ({
      x: 0.5 + (i * 0.01), // Slight variation
      y: 0.5 + (i * 0.005),
      z: 0.1,
      visibility: 0.9
    }))

    // Create activity
    const activityId = await activityService.createPoseActivity(landmarks, {
      name: 'Warrior Pose',
      type: 'pose',
      createdBy: 'yoga_instructor',
      isPublic: true
    })

    // Retrieve and verify
    const activity = await activityService.getActivityById(activityId)
    
    expect(activity.type).toBe('pose')
    expect(activity.name).toBe('Warrior Pose')
    expect(activity.landmarks).toHaveLength(33)
    
    // Verify landmarks structure
    const firstLandmark = activity.landmarks[0] as PoseLandmark
    expect(firstLandmark).toHaveProperty('x')
    expect(firstLandmark).toHaveProperty('y')
    expect(firstLandmark).toHaveProperty('z')
    expect(firstLandmark).toHaveProperty('visibility')
  })

  it('should create and retrieve movement activity end-to-end', async () => {
    // Simulate movement sequence from continuous tracking
    const sequence: TimestampedLandmarks[] = []
    
    for (let i = 0; i < 90; i++) { // 3 seconds at 30fps
      const landmarks: PoseLandmark[] = Array.from({ length: 33 }, (_, j) => ({
        x: 0.5 + Math.sin(i * 0.1) * 0.1, // Simulate movement
        y: 0.5 + Math.cos(i * 0.1) * 0.1,
        z: 0.1,
        visibility: 0.9
      }))

      sequence.push({
        timestamp: i * 33.33, // ~30fps
        landmarks
      })
    }

    // Create movement activity
    const activityId = await activityService.createMovementActivity(sequence, {
      name: 'Push-up Exercise',
      type: 'movement',
      createdBy: 'fitness_trainer',
      duration: 3000,
      isPublic: true
    })

    // Retrieve and verify
    const activity = await activityService.getActivityById(activityId)
    
    expect(activity.type).toBe('movement')
    expect(activity.name).toBe('Push-up Exercise')
    expect(activity.duration).toBe(3000)
    expect(activity.landmarks).toHaveLength(90)
    
    // Verify sequence structure
    const firstFrame = activity.landmarks[0] as TimestampedLandmarks
    expect(firstFrame).toHaveProperty('timestamp')
    expect(firstFrame).toHaveProperty('landmarks')
    expect(firstFrame.landmarks).toHaveLength(33)
  })

  it('should handle multiple activities and filtering', async () => {
    // Create various activities
    const poseId1 = await activityService.createPoseActivity(
      [{ x: 0.5, y: 0.5, z: 0.1, visibility: 0.9 }],
      { name: 'Tree Pose', type: 'pose', createdBy: 'user1', isPublic: true }
    )

    const poseId2 = await activityService.createPoseActivity(
      [{ x: 0.6, y: 0.4, z: 0.2, visibility: 0.8 }],
      { name: 'Mountain Pose', type: 'pose', createdBy: 'user2', isPublic: false }
    )

    const movementId = await activityService.createMovementActivity(
      [{ timestamp: 0, landmarks: [{ x: 0.5, y: 0.5, z: 0.1, visibility: 0.9 }] }],
      { name: 'Jumping Jacks', type: 'movement', createdBy: 'user1', duration: 2000, isPublic: true }
    )

    // Test public activities filtering
    const publicActivities = await activityService.getActivities()
    expect(publicActivities).toHaveLength(2)
    expect(publicActivities.map(a => a.id)).toContain(poseId1)
    expect(publicActivities.map(a => a.id)).toContain(movementId)
    expect(publicActivities.map(a => a.id)).not.toContain(poseId2)

    // Test filtering by type
    const poseActivities = await activityService.getActivitiesByType('pose')
    expect(poseActivities).toHaveLength(1)
    expect(poseActivities[0].id).toBe(poseId1)

    const movementActivities = await activityService.getActivitiesByType('movement')
    expect(movementActivities).toHaveLength(1)
    expect(movementActivities[0].id).toBe(movementId)

    // Test filtering by creator
    const user1Activities = await activityService.getActivitiesByCreator('user1')
    expect(user1Activities).toHaveLength(2)
    expect(user1Activities.map(a => a.id)).toContain(poseId1)
    expect(user1Activities.map(a => a.id)).toContain(movementId)

    // Test statistics
    const stats = activityService.getActivityStats()
    expect(stats.totalActivities).toBe(3)
    expect(stats.poseActivities).toBe(2)
    expect(stats.movementActivities).toBe(1)
    expect(stats.publicActivities).toBe(2)
    expect(stats.privateActivities).toBe(1)
  })

  it('should maintain data integrity across operations', async () => {
    const originalLandmarks: PoseLandmark[] = [
      { x: 0.5, y: 0.5, z: 0.1, visibility: 0.9 }
    ]

    // Create activity
    const activityId = await activityService.createPoseActivity(originalLandmarks, {
      name: 'Test Pose',
      type: 'pose',
      createdBy: 'testuser',
      isPublic: true
    })

    // Modify original landmarks
    originalLandmarks[0].x = 0.999

    // Retrieved activity should be unchanged
    const activity = await activityService.getActivityById(activityId)
    const retrievedLandmarks = activity.landmarks as PoseLandmark[]
    
    expect(retrievedLandmarks[0].x).toBe(0.5) // Original value preserved
    
    // Modify retrieved landmarks
    retrievedLandmarks[0].x = 0.111

    // Second retrieval should still have original value
    const activity2 = await activityService.getActivityById(activityId)
    const retrievedLandmarks2 = activity2.landmarks as PoseLandmark[]
    
    expect(retrievedLandmarks2[0].x).toBe(0.5) // Still original value
  })
})