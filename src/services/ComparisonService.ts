import type { ComparisonService as IComparisonService } from './index'
import type { PoseLandmark, TimestampedLandmarks, ComparisonResult, DifficultyLevel } from '../types'
import { DIFFICULTY_THRESHOLDS } from '../utils/constants'

export class ComparisonService implements IComparisonService {
  
  comparePoses(recorded: PoseLandmark[], current: PoseLandmark[], difficulty: DifficultyLevel): ComparisonResult {
    try {
      // Validate inputs
      if (!Array.isArray(recorded) || !Array.isArray(current)) {
        return {
          isMatch: false,
          score: 0,
          feedback: ['Invalid pose data provided'],
          suggestions: ['Ensure both poses have valid landmark data']
        }
      }

      if (recorded.length === 0 || current.length === 0) {
        return {
          isMatch: false,
          score: 0,
          feedback: ['Missing pose landmarks'],
          suggestions: ['Ensure pose is detected properly']
        }
      }

      // Calculate similarity score
      const score = this.calculateSimilarityScore(recorded, current)
      const threshold = DIFFICULTY_THRESHOLDS[difficulty]
      const isMatch = score >= threshold

      // Generate feedback and suggestions
      const feedback = this.generatePoseFeedback(recorded, current, score, threshold)
      const suggestions = this.generatePoseSuggestions(recorded, current, difficulty)

      return {
        isMatch,
        score,
        feedback,
        suggestions
      }

    } catch (error) {
      return {
        isMatch: false,
        score: 0,
        feedback: ['Error comparing poses'],
        suggestions: ['Try again with better lighting and pose visibility']
      }
    }
  }

  compareMovementSequence(
    recorded: TimestampedLandmarks[], 
    current: TimestampedLandmarks[], 
    difficulty: DifficultyLevel
  ): ComparisonResult {
    try {
      // Validate inputs
      if (!Array.isArray(recorded) || !Array.isArray(current)) {
        return {
          isMatch: false,
          score: 0,
          feedback: ['Invalid movement data provided'],
          suggestions: ['Ensure both movements have valid sequence data']
        }
      }

      if (recorded.length === 0 || current.length === 0) {
        return {
          isMatch: false,
          score: 0,
          feedback: ['Missing movement data'],
          suggestions: ['Complete the full movement sequence']
        }
      }

      // Normalize sequences to same length for comparison
      const normalizedRecorded = this.normalizeSequenceLength(recorded, current.length)
      const normalizedCurrent = this.normalizeSequenceLength(current, recorded.length)

      // Calculate frame-by-frame similarity
      const frameScores: number[] = []
      const minLength = Math.min(normalizedRecorded.length, normalizedCurrent.length)

      for (let i = 0; i < minLength; i++) {
        const frameScore = this.calculateSimilarityScore(
          normalizedRecorded[i].landmarks,
          normalizedCurrent[i].landmarks
        )
        frameScores.push(frameScore)
      }

      // Calculate overall score with temporal weighting
      const overallScore = this.calculateTemporalScore(frameScores)
      const threshold = DIFFICULTY_THRESHOLDS[difficulty]
      const isMatch = overallScore >= threshold

      // Generate feedback and suggestions
      const feedback = this.generateMovementFeedback(frameScores, overallScore, threshold)
      const suggestions = this.generateMovementSuggestions(recorded, current, difficulty)

      return {
        isMatch,
        score: overallScore,
        feedback,
        suggestions
      }

    } catch (error) {
      return {
        isMatch: false,
        score: 0,
        feedback: ['Error comparing movement sequences'],
        suggestions: ['Try performing the movement more slowly and clearly']
      }
    }
  }

  calculateSimilarityScore(pose1: PoseLandmark[], pose2: PoseLandmark[]): number {
    if (!pose1 || !pose2 || pose1.length === 0 || pose2.length === 0) {
      return 0
    }

    // Use the minimum length to avoid index errors
    const minLength = Math.min(pose1.length, pose2.length)
    let totalDistance = 0
    let validComparisons = 0

    // Key landmarks for pose comparison (more important body parts)
    const keyLandmarkIndices = [
      0,   // nose
      11, 12, // shoulders
      13, 14, // elbows
      15, 16, // wrists
      23, 24, // hips
      25, 26, // knees
      27, 28  // ankles
    ]

    // Calculate weighted distance
    for (let i = 0; i < minLength; i++) {
      const landmark1 = pose1[i]
      const landmark2 = pose2[i]

      // Validate landmark data
      if (!landmark1 || !landmark2 || 
          typeof landmark1.x !== 'number' || typeof landmark1.y !== 'number' || typeof landmark1.z !== 'number' ||
          typeof landmark2.x !== 'number' || typeof landmark2.y !== 'number' || typeof landmark2.z !== 'number' ||
          isNaN(landmark1.x) || isNaN(landmark1.y) || isNaN(landmark1.z) ||
          isNaN(landmark2.x) || isNaN(landmark2.y) || isNaN(landmark2.z)) {
        continue
      }

      // Skip if either landmark has very low visibility
      if ((landmark1.visibility || 1) < 0.3 || (landmark2.visibility || 1) < 0.3) {
        continue
      }

      // Calculate Euclidean distance in 3D space
      const dx = landmark1.x - landmark2.x
      const dy = landmark1.y - landmark2.y
      const dz = landmark1.z - landmark2.z
      const distance = Math.sqrt(dx * dx + dy * dy + dz * dz)

      // Skip if distance calculation resulted in NaN
      if (isNaN(distance)) {
        continue
      }

      // Apply weight based on landmark importance
      const weight = keyLandmarkIndices.includes(i) ? 2.0 : 1.0
      totalDistance += distance * weight
      validComparisons += weight
    }

    if (validComparisons === 0) {
      return 0
    }

    // Convert distance to similarity score (0-1 range)
    const averageDistance = totalDistance / validComparisons
    const maxExpectedDistance = 0.5 // Reasonable maximum distance for pose similarity
    const similarity = Math.max(0, 1 - (averageDistance / maxExpectedDistance))

    return Math.min(1, similarity)
  }

  // Private helper methods

  private normalizeSequenceLength(sequence: TimestampedLandmarks[], targetLength: number): TimestampedLandmarks[] {
    if (sequence.length === targetLength) {
      return sequence
    }

    const normalized: TimestampedLandmarks[] = []
    const ratio = sequence.length / targetLength

    for (let i = 0; i < targetLength; i++) {
      const sourceIndex = Math.floor(i * ratio)
      const clampedIndex = Math.min(sourceIndex, sequence.length - 1)
      normalized.push({
        timestamp: sequence[clampedIndex].timestamp,
        landmarks: [...sequence[clampedIndex].landmarks]
      })
    }

    return normalized
  }

  private calculateTemporalScore(frameScores: number[]): number {
    if (frameScores.length === 0) return 0

    // Apply temporal weighting - middle frames are more important
    const weights: number[] = []
    const length = frameScores.length

    for (let i = 0; i < length; i++) {
      // Bell curve weighting - higher weight in the middle
      const normalizedPosition = (i / (length - 1)) * 2 - 1 // -1 to 1
      const weight = Math.exp(-(normalizedPosition * normalizedPosition) * 2) // Gaussian
      weights.push(weight)
    }

    // Calculate weighted average
    let weightedSum = 0
    let totalWeight = 0

    for (let i = 0; i < frameScores.length; i++) {
      weightedSum += frameScores[i] * weights[i]
      totalWeight += weights[i]
    }

    return totalWeight > 0 ? weightedSum / totalWeight : 0
  }

  private generatePoseFeedback(
    recorded: PoseLandmark[], 
    current: PoseLandmark[], 
    score: number, 
    threshold: number
  ): string[] {
    const feedback: string[] = []

    if (score >= threshold) {
      feedback.push(`Great job! Pose similarity: ${(score * 100).toFixed(1)}%`)
    } else {
      feedback.push(`Pose similarity: ${(score * 100).toFixed(1)}% (target: ${(threshold * 100).toFixed(1)}%)`)
    }

    // Analyze specific body parts
    const bodyPartFeedback = this.analyzeBodyPartDifferences(recorded, current)
    feedback.push(...bodyPartFeedback)

    return feedback
  }

  private generateMovementFeedback(
    frameScores: number[], 
    overallScore: number, 
    threshold: number
  ): string[] {
    const feedback: string[] = []

    if (overallScore >= threshold) {
      feedback.push(`Excellent movement! Overall similarity: ${(overallScore * 100).toFixed(1)}%`)
    } else {
      feedback.push(`Movement similarity: ${(overallScore * 100).toFixed(1)}% (target: ${(threshold * 100).toFixed(1)}%)`)
    }

    // Analyze movement phases
    const phaseAnalysis = this.analyzeMovementPhases(frameScores)
    feedback.push(...phaseAnalysis)

    return feedback
  }

  private generatePoseSuggestions(
    recorded: PoseLandmark[], 
    current: PoseLandmark[], 
    difficulty: DifficultyLevel
  ): string[] {
    const suggestions: string[] = []

    // Analyze major differences and provide specific suggestions
    const differences = this.findMajorDifferences(recorded, current)
    
    if (differences.arms) {
      suggestions.push('Adjust your arm position to match the target pose')
    }
    
    if (differences.legs) {
      suggestions.push('Check your leg positioning and stance')
    }
    
    if (differences.torso) {
      suggestions.push('Align your torso and spine position')
    }

    if (differences.head) {
      suggestions.push('Adjust your head position and gaze direction')
    }

    // Difficulty-specific suggestions
    if (difficulty === 'hard') {
      suggestions.push('Focus on precise positioning - small adjustments matter')
    } else if (difficulty === 'soft') {
      suggestions.push('Get the general pose shape right - precision will come with practice')
    }

    return suggestions.length > 0 ? suggestions : ['Keep practicing to improve your pose accuracy']
  }

  private generateMovementSuggestions(
    recorded: TimestampedLandmarks[], 
    current: TimestampedLandmarks[], 
    difficulty: DifficultyLevel
  ): string[] {
    const suggestions: string[] = []

    // Analyze timing and rhythm
    if (current.length < recorded.length * 0.8) {
      suggestions.push('Try to complete the full movement sequence')
    } else if (current.length > recorded.length * 1.2) {
      suggestions.push('The movement seems too slow - try to match the target pace')
    }

    // Movement-specific suggestions
    suggestions.push('Focus on smooth, controlled movements')
    suggestions.push('Try to maintain consistent timing throughout the sequence')

    if (difficulty === 'hard') {
      suggestions.push('Pay attention to precise timing and form details')
    }

    return suggestions
  }

  private analyzeBodyPartDifferences(recorded: PoseLandmark[], current: PoseLandmark[]): string[] {
    const feedback: string[] = []
    const minLength = Math.min(recorded.length, current.length)

    // Define body part landmark ranges
    const bodyParts = {
      head: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
      arms: [11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22],
      torso: [11, 12, 23, 24],
      legs: [23, 24, 25, 26, 27, 28, 29, 30, 31, 32]
    }

    for (const [partName, indices] of Object.entries(bodyParts)) {
      let partDistance = 0
      let validComparisons = 0

      for (const index of indices) {
        if (index < minLength) {
          const landmark1 = recorded[index]
          const landmark2 = current[index]

          if ((landmark1.visibility || 1) >= 0.5 && (landmark2.visibility || 1) >= 0.5) {
            const dx = landmark1.x - landmark2.x
            const dy = landmark1.y - landmark2.y
            const dz = landmark1.z - landmark2.z
            partDistance += Math.sqrt(dx * dx + dy * dy + dz * dz)
            validComparisons++
          }
        }
      }

      if (validComparisons > 0) {
        const averageDistance = partDistance / validComparisons
        if (averageDistance > 0.15) { // Threshold for significant difference
          feedback.push(`${partName.charAt(0).toUpperCase() + partName.slice(1)} positioning needs adjustment`)
        }
      }
    }

    return feedback
  }

  private analyzeMovementPhases(frameScores: number[]): string[] {
    const feedback: string[] = []
    const length = frameScores.length

    if (length < 3) return feedback

    // Analyze beginning, middle, and end phases
    const beginningScore = frameScores.slice(0, Math.floor(length / 3)).reduce((a, b) => a + b, 0) / Math.floor(length / 3)
    const middleScore = frameScores.slice(Math.floor(length / 3), Math.floor(2 * length / 3)).reduce((a, b) => a + b, 0) / Math.floor(length / 3)
    const endScore = frameScores.slice(Math.floor(2 * length / 3)).reduce((a, b) => a + b, 0) / (length - Math.floor(2 * length / 3))

    if (beginningScore < 0.6) {
      feedback.push('Work on your starting position')
    }
    
    if (middleScore < 0.6) {
      feedback.push('Focus on the middle phase of the movement')
    }
    
    if (endScore < 0.6) {
      feedback.push('Pay attention to your ending position')
    }

    return feedback
  }

  private findMajorDifferences(recorded: PoseLandmark[], current: PoseLandmark[]): {
    arms: boolean
    legs: boolean
    torso: boolean
    head: boolean
  } {
    const minLength = Math.min(recorded.length, current.length)
    const differences = { arms: false, legs: false, torso: false, head: false }

    // Define landmark groups
    const groups = {
      head: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
      arms: [11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22],
      torso: [11, 12, 23, 24],
      legs: [23, 24, 25, 26, 27, 28, 29, 30, 31, 32]
    }

    for (const [groupName, indices] of Object.entries(groups)) {
      let groupDistance = 0
      let validComparisons = 0

      for (const index of indices) {
        if (index < minLength) {
          const landmark1 = recorded[index]
          const landmark2 = current[index]

          if ((landmark1.visibility || 1) >= 0.5 && (landmark2.visibility || 1) >= 0.5) {
            const dx = landmark1.x - landmark2.x
            const dy = landmark1.y - landmark2.y
            const dz = landmark1.z - landmark2.z
            groupDistance += Math.sqrt(dx * dx + dy * dy + dz * dz)
            validComparisons++
          }
        }
      }

      if (validComparisons > 0) {
        const averageDistance = groupDistance / validComparisons
        differences[groupName as keyof typeof differences] = averageDistance > 0.15
      }
    }

    return differences
  }
}

// Export singleton instance
export default new ComparisonService()