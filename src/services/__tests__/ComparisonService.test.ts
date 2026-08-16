import { describe, it, expect, beforeEach } from 'vitest'
import { ComparisonService } from '../ComparisonService'
import type { PoseLandmark, TimestampedLandmarks } from '../../types'
import {
  mirrorPose,
  standingPose,
  transformPose,
} from './fixtures/poseLandmarks'

describe('ComparisonService', () => {
  let service: ComparisonService

  beforeEach(() => {
    service = new ComparisonService()
  })

  // Helper function to create test landmarks
  const createTestLandmarks = (baseX = 0.5, baseY = 0.5, baseZ = 0.1): PoseLandmark[] => {
    return Array.from({ length: 33 }, (_, i) => ({
      x: baseX + (i * 0.01),
      y: baseY + (i * 0.005),
      z: baseZ,
      visibility: 0.9
    }))
  }

  const createTestSequence = (frames = 30, baseX = 0.5): TimestampedLandmarks[] => {
    return Array.from({ length: frames }, (_, i) => ({
      timestamp: i * 33.33,
      landmarks: createTestLandmarks(baseX + Math.sin(i * 0.1) * 0.05, 0.5, 0.1)
    }))
  }

  const bendLegs = (landmarks: PoseLandmark[], amount = 0.25) => {
    const changed = landmarks.map((landmark) => ({ ...landmark }))
    for (const index of [25, 27, 29, 31]) {
      if (changed[index]) changed[index].x += amount
    }
    for (const index of [26, 28, 30, 32]) {
      if (changed[index]) changed[index].x -= amount
    }
    return changed
  }

  describe('calculateSimilarityScore', () => {
    it('scores a translated and scaled real pose above a different pose', () => {
      const original = standingPose()
      const equivalent = transformPose(original, 0.65, 0.18, 0.12)
      const incorrect = standingPose()
      incorrect[25].x += 0.3
      incorrect[26].x -= 0.3

      expect(service.calculateSimilarityScore(original, equivalent)).toBeGreaterThan(0.95)
      expect(service.calculateSimilarityScore(original, incorrect)).toBeLessThan(
        service.calculateSimilarityScore(original, equivalent),
      )
    })

    it('uses normalized poses for score, feedback, and suggestions', () => {
      const original = standingPose()
      const equivalent = transformPose(original, 0.65, 0.18, 0.12)

      const result = service.comparePoses(original, equivalent, 'hard')

      expect(result.score).toBeGreaterThan(0.95)
      expect(result.feedback).not.toEqual(
        expect.arrayContaining([
          expect.stringMatching(/positioning needs adjustment/i),
        ]),
      )
      expect(result.suggestions).not.toEqual(
        expect.arrayContaining([
          expect.stringMatching(
            /adjust your arm|leg positioning|align your torso|adjust your head/i,
          ),
        ]),
      )
    })

    it('compares mirrored runtime poses when requested', () => {
      const original = standingPose()
      const mirrored = mirrorPose(original)

      const result = service.comparePoses(original, mirrored, 'hard', true)

      expect(result.isMatch).toBe(true)
      expect(result.score).toBeGreaterThan(0.95)
    })

    it('rejects anchor-only coordinate data with insufficient landmark coverage', () => {
      const original = standingPose()
      const anchorOnly = standingPose().map((landmark, index) => ({
        ...landmark,
        x: [11, 12, 23, 24].includes(index) ? landmark.x : Number.NaN,
      }))

      const result = service.comparePoses(original, anchorOnly, 'soft')

      expect(result.isMatch).toBe(false)
      expect(result.score).toBe(0)
    })
    it('should return 1.0 for identical poses', () => {
      const landmarks = createTestLandmarks()
      const score = service.calculateSimilarityScore(landmarks, landmarks)
      
      expect(score).toBeCloseTo(1.0, 2)
    })

    it('should return 0 for empty arrays', () => {
      const score = service.calculateSimilarityScore([], [])
      expect(score).toBe(0)
    })

    it('should return 0 for null/undefined inputs', () => {
      const landmarks = createTestLandmarks()
      
      expect(service.calculateSimilarityScore(null as any, landmarks)).toBe(0)
      expect(service.calculateSimilarityScore(landmarks, undefined as any)).toBe(0)
    })

    it('should handle different array lengths', () => {
      const landmarks1 = createTestLandmarks().slice(0, 25)
      const landmarks2 = createTestLandmarks()
      
      const score = service.calculateSimilarityScore(landmarks1, landmarks2)
      expect(score).toBeGreaterThan(0)
      expect(score).toBeLessThanOrEqual(1)
    })

    it('should return lower score for different poses', () => {
      const landmarks1 = createTestLandmarks(0.5, 0.5, 0.1)
      const landmarks2 = bendLegs(landmarks1) // Different joint shape
      
      const score = service.calculateSimilarityScore(landmarks1, landmarks2)
      expect(score).toBeLessThan(0.8)
      expect(score).toBeGreaterThan(0)
    })

    it('should ignore landmarks with low visibility', () => {
      const landmarks1 = createTestLandmarks()
      const landmarks2 = createTestLandmarks()
      
      // Set low visibility for some landmarks
      landmarks2[0].visibility = 0.1
      landmarks2[1].visibility = 0.2
      
      const score = service.calculateSimilarityScore(landmarks1, landmarks2)
      expect(score).toBeGreaterThan(0.8) // Should still be high since low visibility landmarks are ignored
    })
  })

  describe('comparePoses', () => {
    it('evaluates a pose when one torso anchor has low visibility', () => {
      const recorded = standingPose()
      const current = standingPose()
      current[23].visibility = 0.1

      const result = service.comparePoses(recorded, current, 'soft')

      expect(result.isMatch).toBe(true)
      expect(result.score).toBeGreaterThan(0.95)
      expect(result.feedback).not.toEqual(
        expect.arrayContaining([expect.stringMatching(/cannot evaluate/i)]),
      )
    })

    it('ignores off-screen landmark estimates that are not drawn in the overlay', () => {
      const recorded = standingPose()
      const current = transformPose(standingPose(), 0.7, 0.12, 0.08)

      for (let index = 18; index < 33; index++) {
        recorded[index] = {
          ...recorded[index],
          x: -10 - index,
          y: 10 + index,
          z: 20,
          visibility: 0.1,
        }
        current[index] = {
          ...current[index],
          x: 10 + index,
          y: -10 - index,
          z: -20,
          visibility: 0.1,
        }
      }

      const result = service.comparePoses(recorded, current, 'medium')

      expect(result.score).toBeGreaterThan(0.8)
    })

    it('scores static pose shape from visible 2D geometry rather than depth noise', () => {
      const recorded = standingPose()
      const current = standingPose().map((landmark, index) => ({
        ...landmark,
        z: index % 2 === 0 ? 2 : -2,
      }))

      const result = service.comparePoses(recorded, current, 'medium')

      expect(result.score).toBeGreaterThan(0.95)
    })

    it('should return match for identical poses on soft difficulty', () => {
      const landmarks = createTestLandmarks()
      const result = service.comparePoses(landmarks, landmarks, 'soft')
      
      expect(result.isMatch).toBe(true)
      expect(result.score).toBeCloseTo(1.0, 1)
      expect(result.feedback.some(f => f.includes('Great job!'))).toBe(true)
      expect(result.suggestions).toBeDefined()
    })

    it('should return match for similar poses on soft difficulty', () => {
      const landmarks1 = createTestLandmarks(0.5, 0.5, 0.1)
      const landmarks2 = createTestLandmarks(0.52, 0.51, 0.11) // Slightly different
      
      const result = service.comparePoses(landmarks1, landmarks2, 'soft')
      
      expect(result.isMatch).toBe(true)
      expect(result.score).toBeGreaterThan(0.7)
    })

    it('should not match different poses on hard difficulty', () => {
      const landmarks1 = createTestLandmarks(0.5, 0.5, 0.1)
      const landmarks2 = bendLegs(landmarks1, 0.35) // Different pose
      
      const result = service.comparePoses(landmarks1, landmarks2, 'hard')
      
      expect(result.isMatch).toBe(false)
      expect(result.score).toBeLessThan(0.9)
      expect(result.feedback[0]).toContain('Pose similarity:')
    })

    it('should handle invalid inputs gracefully', () => {
      const result = service.comparePoses([], [], 'medium')
      
      expect(result.isMatch).toBe(false)
      expect(result.score).toBe(0)
      expect(result.feedback).toContain('Missing pose landmarks')
      expect(result.suggestions).toContain('Ensure pose is detected properly')
    })

    it('should provide different thresholds for different difficulties', () => {
      const landmarks1 = createTestLandmarks(0.5, 0.5, 0.1)
      const landmarks2 = bendLegs(landmarks1, 0.15) // Moderately different
      
      const softResult = service.comparePoses(landmarks1, landmarks2, 'soft')
      const mediumResult = service.comparePoses(landmarks1, landmarks2, 'medium')
      const hardResult = service.comparePoses(landmarks1, landmarks2, 'hard')
      
      // Same score, different match results based on thresholds
      expect(softResult.score).toEqual(mediumResult.score)
      expect(mediumResult.score).toEqual(hardResult.score)
      
      // But different match results
      expect(softResult.isMatch).toBe(true)
      expect(hardResult.isMatch).toBe(false)
    })

    it('should provide specific body part feedback', () => {
      const landmarks1 = createTestLandmarks()
      const landmarks2 = createTestLandmarks()
      
      // Modify arm positions significantly
      landmarks2[13].x += 0.3 // Left elbow - larger change
      landmarks2[14].x += 0.3 // Right elbow - larger change
      landmarks2[15].x += 0.3 // Left wrist
      landmarks2[16].x += 0.3 // Right wrist
      
      const result = service.comparePoses(landmarks1, landmarks2, 'medium')
      
      // Should provide basic feedback
      expect(result.feedback.length).toBeGreaterThan(0)
      expect(result.suggestions.length).toBeGreaterThan(0)
      expect(result.score).toBeLessThan(0.9) // Should be lower due to differences
    })
  })

  describe('compareMovementSequence', () => {
    it('should return match for identical sequences', () => {
      const sequence = createTestSequence(30)
      const result = service.compareMovementSequence(sequence, sequence, 'medium')
      
      expect(result.isMatch).toBe(true)
      expect(result.score).toBeCloseTo(1.0, 1)
      expect(result.feedback.some(f => f.includes('Excellent movement!'))).toBe(true)
    })

    it('should handle sequences of different lengths', () => {
      const sequence1 = createTestSequence(30)
      const sequence2 = createTestSequence(45) // Different length
      
      const result = service.compareMovementSequence(sequence1, sequence2, 'medium')
      
      expect(result.score).toBeGreaterThan(0)
      expect(result.score).toBeLessThanOrEqual(1)
    })

    it('should return lower score for different movements', () => {
      const sequence1 = createTestSequence(30, 0.5)
      const sequence2 = createTestSequence(30).map((frame) => ({
        ...frame,
        landmarks: bendLegs(frame.landmarks),
      }))
      
      const result = service.compareMovementSequence(sequence1, sequence2, 'medium')
      
      expect(result.score).toBeLessThan(0.8)
    })

    it('should handle empty sequences gracefully', () => {
      const result = service.compareMovementSequence([], [], 'medium')
      
      expect(result.isMatch).toBe(false)
      expect(result.score).toBe(0)
      expect(result.feedback).toContain('Missing movement data')
    })

    it('should provide movement-specific feedback', () => {
      const sequence1 = createTestSequence(30)
      const sequence2 = createTestSequence(15) // Much shorter sequence
      
      const result = service.compareMovementSequence(sequence1, sequence2, 'medium')
      
      expect(result.suggestions.some(s => s.includes('complete the full movement'))).toBe(true)
    })

    it('should apply temporal weighting correctly', () => {
      const sequence1 = createTestSequence(30)
      const middleDifference = createTestSequence(30)
      const edgeDifference = createTestSequence(30)
      
      // Make the middle frames very different
      for (let i = 10; i < 20; i++) {
        middleDifference[i].landmarks = bendLegs(createTestLandmarks(), 0.5)
      }
      // Change the same number of frames at the less important edges.
      for (const index of [0, 1, 2, 3, 4, 25, 26, 27, 28, 29]) {
        edgeDifference[index].landmarks = bendLegs(createTestLandmarks(), 0.5)
      }

      const middleResult = service.compareMovementSequence(
        sequence1,
        middleDifference,
        'medium',
      )
      const edgeResult = service.compareMovementSequence(
        sequence1,
        edgeDifference,
        'medium',
      )
      
      expect(middleResult.score).toBeLessThan(edgeResult.score)
    })
  })

  describe('difficulty levels', () => {
    it('should use correct thresholds for each difficulty', () => {
      const landmarks1 = createTestLandmarks()
      const landmarks2 = bendLegs(landmarks1, 0.15) // Moderately different
      
      const softResult = service.comparePoses(landmarks1, landmarks2, 'soft')
      const mediumResult = service.comparePoses(landmarks1, landmarks2, 'medium')
      const hardResult = service.comparePoses(landmarks1, landmarks2, 'hard')
      
      // Soft should be most lenient
      expect(softResult.isMatch).toBe(true)
      
      // Hard should be most strict
      expect(hardResult.isMatch).toBe(false)
      
      // Medium should be in between
      const mediumMatch = mediumResult.isMatch
      expect(typeof mediumMatch).toBe('boolean')
    })
  })

  describe('feedback generation', () => {
    it('should provide encouraging feedback for good matches', () => {
      const landmarks = createTestLandmarks()
      const result = service.comparePoses(landmarks, landmarks, 'medium')
      
      expect(result.feedback.some(f => f.includes('Great job!'))).toBe(true)
    })

    it('should provide constructive feedback for poor matches', () => {
      const landmarks1 = createTestLandmarks()
      const landmarks2 = createTestLandmarks(0.7, 0.3, 0.2)
      
      const result = service.comparePoses(landmarks1, landmarks2, 'medium')
      
      expect(result.feedback.length).toBeGreaterThan(0)
      expect(result.suggestions.length).toBeGreaterThan(0)
    })

    it('should provide difficulty-specific suggestions', () => {
      const landmarks1 = createTestLandmarks()
      const landmarks2 = createTestLandmarks(0.6, 0.4, 0.2)
      
      const hardResult = service.comparePoses(landmarks1, landmarks2, 'hard')
      const softResult = service.comparePoses(landmarks1, landmarks2, 'soft')
      
      expect(hardResult.suggestions.some(s => s.includes('precise'))).toBe(true)
      expect(softResult.suggestions.some(s => s.includes('general'))).toBe(true)
    })
  })

  describe('error handling', () => {
    it('should handle malformed landmark data', () => {
      const malformedLandmarks = [
        { x: 'invalid', y: 0.5, z: 0.1 },
        { x: 0.5, y: null, z: 0.1 }
      ] as any

      const result = service.comparePoses(malformedLandmarks, createTestLandmarks(), 'medium')
      
      expect(result.isMatch).toBe(false)
      expect(result.score).toBe(0)
    })

    it('should handle exceptions gracefully', () => {
      // Force an error by passing invalid data
      const result = service.comparePoses(null as any, undefined as any, 'medium')
      
      expect(result.isMatch).toBe(false)
      expect(result.score).toBe(0)
      expect(result.feedback).toContain('Invalid pose data provided')
    })
  })
})
