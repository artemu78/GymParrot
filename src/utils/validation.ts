// Validation utilities for pose data and activities

import type { PoseLandmark, ActivityMetadata, Activity } from '../types'

export function validatePoseLandmark(landmark: unknown): landmark is PoseLandmark {
  if (!landmark || typeof landmark !== 'object') return false
  
  const l = landmark as Record<string, unknown>
  
  return (
    typeof l.x === 'number' &&
    typeof l.y === 'number' &&
    typeof l.z === 'number' &&
    (l.visibility === undefined || typeof l.visibility === 'number')
  )
}

export function validatePoseLandmarks(landmarks: unknown[]): landmarks is PoseLandmark[] {
  return Array.isArray(landmarks) && landmarks.every(validatePoseLandmark)
}

export function validateActivityMetadata(metadata: unknown): metadata is ActivityMetadata {
  if (!metadata || typeof metadata !== 'object') return false
  
  const m = metadata as Record<string, unknown>
  
  return (
    typeof m.name === 'string' &&
    m.name.trim().length > 0 &&
    (m.type === 'pose' || m.type === 'movement') &&
    typeof m.createdBy === 'string' &&
    m.createdBy.trim().length > 0 &&
    (m.duration === undefined || typeof m.duration === 'number') &&
    typeof m.isPublic === 'boolean'
  )
}

export function validateActivity(activity: unknown): activity is Activity {
  if (!activity || typeof activity !== 'object') return false
  
  const a = activity as Record<string, unknown>
  
  return (
    typeof a.id === 'string' &&
    a.id.trim().length > 0 &&
    (a.type === 'pose' || a.type === 'movement') &&
    typeof a.name === 'string' &&
    a.name.trim().length > 0 &&
    typeof a.createdBy === 'string' &&
    a.createdBy.trim().length > 0 &&
    a.createdAt instanceof Date &&
    (a.duration === undefined || typeof a.duration === 'number') &&
    typeof a.isPublic === 'boolean' &&
    Array.isArray(a.landmarks)
  )
}

export function sanitizeActivityName(name: string): string {
  return name.trim().slice(0, 100) // Limit to 100 characters
}

export function isValidDifficulty(difficulty: string): difficulty is 'soft' | 'medium' | 'hard' {
  return ['soft', 'medium', 'hard'].includes(difficulty)
}

export function validatePoseData(landmarks: PoseLandmark[]): { isValid: boolean; errors: string[] } {
  const errors: string[] = []

  if (!Array.isArray(landmarks)) {
    errors.push('Landmarks must be an array')
    return { isValid: false, errors }
  }

  if (landmarks.length === 0) {
    errors.push('Landmarks array cannot be empty')
    return { isValid: false, errors }
  }

  // Validate each landmark
  landmarks.forEach((landmark, index) => {
    if (!validatePoseLandmark(landmark)) {
      errors.push(`Invalid landmark at index ${index}`)
    }
  })

  // Check for reasonable pose structure (should have 33 landmarks for MediaPipe)
  if (landmarks.length !== 33) {
    errors.push(`Expected 33 landmarks for complete pose, got ${landmarks.length}`)
  }

  return {
    isValid: errors.length === 0,
    errors
  }
}

export function normalizePoseData(landmarks: PoseLandmark[]): PoseLandmark[] {
  return landmarks.map(landmark => ({
    x: Math.max(0, Math.min(1, landmark.x)),
    y: Math.max(0, Math.min(1, landmark.y)),
    z: landmark.z, // Z can be negative
    visibility: landmark.visibility !== undefined 
      ? Math.max(0, Math.min(1, landmark.visibility))
      : undefined
  }))
}