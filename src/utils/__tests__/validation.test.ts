import { describe, it, expect } from 'vitest'
import { validatePoseData, normalizePoseData } from '../validation'
import type { PoseLandmark } from '../../types'

describe('Pose Validation Utils', () => {
  describe('validatePoseData', () => {
    it('should validate correct pose data', () => {
      const landmarks: PoseLandmark[] = Array.from({ length: 33 }, (_, i) => ({
        x: 0.5,
        y: 0.5,
        z: 0.1,
        visibility: 0.9
      }))

      const result = validatePoseData(landmarks)

      expect(result.isValid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should reject non-array input', () => {
      const result = validatePoseData('not an array' as any)

      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Landmarks must be an array')
    })

    it('should reject empty array', () => {
      const result = validatePoseData([])

      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Landmarks array cannot be empty')
    })

    it('should detect invalid landmark count', () => {
      const landmarks: PoseLandmark[] = [
        { x: 0.5, y: 0.5, z: 0.1, visibility: 0.9 }
      ]

      const result = validatePoseData(landmarks)

      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Expected 33 landmarks for complete pose, got 1')
    })

    it('should detect invalid landmarks', () => {
      const landmarks = [
        { x: 0.5, y: 0.5, z: 0.1, visibility: 0.9 },
        { x: 'invalid', y: 0.5, z: 0.1, visibility: 0.9 } // Invalid x coordinate
      ] as any

      const result = validatePoseData(landmarks)

      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Invalid landmark at index 1')
    })
  })

  describe('normalizePoseData', () => {
    it('should normalize landmarks within bounds', () => {
      const landmarks: PoseLandmark[] = [
        { x: 0.5, y: 0.5, z: 0.1, visibility: 0.9 },
        { x: 1.5, y: -0.2, z: -0.1, visibility: 1.2 }
      ]

      const normalized = normalizePoseData(landmarks)

      expect(normalized[0]).toEqual({
        x: 0.5,
        y: 0.5,
        z: 0.1,
        visibility: 0.9
      })

      expect(normalized[1]).toEqual({
        x: 1.0, // Clamped from 1.5
        y: 0.0, // Clamped from -0.2
        z: -0.1, // Z can be negative
        visibility: 1.0 // Clamped from 1.2
      })
    })

    it('should handle landmarks without visibility', () => {
      const landmarks: PoseLandmark[] = [
        { x: 0.5, y: 0.5, z: 0.1 }
      ]

      const normalized = normalizePoseData(landmarks)

      expect(normalized[0]).toEqual({
        x: 0.5,
        y: 0.5,
        z: 0.1,
        visibility: undefined
      })
    })

    it('should preserve valid values', () => {
      const landmarks: PoseLandmark[] = [
        { x: 0.0, y: 1.0, z: 0.0, visibility: 0.0 },
        { x: 1.0, y: 0.0, z: -1.0, visibility: 1.0 }
      ]

      const normalized = normalizePoseData(landmarks)

      expect(normalized).toEqual(landmarks)
    })
  })
})