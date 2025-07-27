import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { MediaPipeService } from '../MediaPipeService'
import { MediaPipeError } from '../../types'

// Mock MediaPipe tasks-vision
vi.mock('@mediapipe/tasks-vision', () => ({
  PoseLandmarker: {
    createFromOptions: vi.fn()
  },
  FilesetResolver: {
    forVisionTasks: vi.fn()
  }
}))

describe('MediaPipeService', () => {
  let service: MediaPipeService
  let mockPoseLandmarker: any
  let mockVideo: HTMLVideoElement

  beforeEach(() => {
    service = new MediaPipeService()
    
    // Mock PoseLandmarker instance
    mockPoseLandmarker = {
      detectForVideo: vi.fn(),
      close: vi.fn()
    }

    // Mock video element
    mockVideo = {
      readyState: 4, // Default to HAVE_ENOUGH_DATA
      play: vi.fn().mockResolvedValue(undefined),
      pause: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    } as any

    // Reset mocks
    vi.clearAllMocks()
  })

  afterEach(() => {
    service.dispose()
  })

  describe('initializePoseLandmarker', () => {
    it('should initialize PoseLandmarker successfully', async () => {
      const { PoseLandmarker, FilesetResolver } = await import('@mediapipe/tasks-vision')
      
      vi.mocked(FilesetResolver.forVisionTasks).mockResolvedValue({} as any)
      vi.mocked(PoseLandmarker.createFromOptions).mockResolvedValue(mockPoseLandmarker)

      const result = await service.initializePoseLandmarker()

      expect(FilesetResolver.forVisionTasks).toHaveBeenCalledWith(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22-rc.20250304/wasm'
      )
      expect(PoseLandmarker.createFromOptions).toHaveBeenCalled()
      expect(result).toBe(mockPoseLandmarker)
    })

    it('should return existing instance if already initialized', async () => {
      const { PoseLandmarker, FilesetResolver } = await import('@mediapipe/tasks-vision')
      
      vi.mocked(FilesetResolver.forVisionTasks).mockResolvedValue({} as any)
      vi.mocked(PoseLandmarker.createFromOptions).mockResolvedValue(mockPoseLandmarker)

      // Initialize first time
      await service.initializePoseLandmarker()
      
      // Initialize second time - should return cached instance
      const result = await service.initializePoseLandmarker()

      expect(PoseLandmarker.createFromOptions).toHaveBeenCalledTimes(1)
      expect(result).toBe(mockPoseLandmarker)
    })

    it('should throw MediaPipeError on initialization failure', async () => {
      const { FilesetResolver } = await import('@mediapipe/tasks-vision')
      
      vi.mocked(FilesetResolver.forVisionTasks).mockRejectedValue(new Error('Network error'))

      await expect(service.initializePoseLandmarker()).rejects.toThrow(MediaPipeError)
    })
  })

  describe('detectPoseFromVideo', () => {
    beforeEach(async () => {
      const { PoseLandmarker, FilesetResolver } = await import('@mediapipe/tasks-vision')
      
      vi.mocked(FilesetResolver.forVisionTasks).mockResolvedValue({} as any)
      vi.mocked(PoseLandmarker.createFromOptions).mockResolvedValue(mockPoseLandmarker)
    })

    it('should detect pose from video successfully', async () => {
      const mockResult = {
        landmarks: [[{ x: 0.5, y: 0.5, z: 0.1, visibility: 0.9 }]],
        worldLandmarks: []
      }
      
      mockPoseLandmarker.detectForVideo.mockReturnValue(mockResult)

      const result = await service.detectPoseFromVideo(mockVideo)

      expect(mockPoseLandmarker.detectForVideo).toHaveBeenCalledWith(
        mockVideo,
        expect.any(Number)
      )
      expect(result).toBe(mockResult)
    })

    it('should initialize if not already initialized', async () => {
      const mockResult = {
        landmarks: [[{ x: 0.5, y: 0.5, z: 0.1, visibility: 0.9 }]],
        worldLandmarks: []
      }
      
      mockPoseLandmarker.detectForVideo.mockReturnValue(mockResult)

      await service.detectPoseFromVideo(mockVideo)

      expect(mockPoseLandmarker.detectForVideo).toHaveBeenCalled()
    })

    it('should throw MediaPipeError on detection failure', async () => {
      mockPoseLandmarker.detectForVideo.mockImplementation(() => {
        throw new Error('Detection failed')
      })

      await expect(service.detectPoseFromVideo(mockVideo)).rejects.toThrow(MediaPipeError)
    })
  })

  describe('detectSinglePose', () => {
    beforeEach(async () => {
      const { PoseLandmarker, FilesetResolver } = await import('@mediapipe/tasks-vision')
      
      vi.mocked(FilesetResolver.forVisionTasks).mockResolvedValue({} as any)
      vi.mocked(PoseLandmarker.createFromOptions).mockResolvedValue(mockPoseLandmarker)
    })

    it('should detect single pose successfully', async () => {
      const mockResult = {
        landmarks: [[{ x: 0.5, y: 0.5, z: 0.1, visibility: 0.9 }]],
        worldLandmarks: []
      }
      
      mockPoseLandmarker.detectForVideo.mockReturnValue(mockResult)
      mockVideo.readyState = 4 // HAVE_ENOUGH_DATA

      const result = await service.detectSinglePose(mockVideo)

      expect(result).toBe(mockResult)
    })

    it('should throw error when video not ready', async () => {
      const notReadyVideo = { ...mockVideo, readyState: 1 } // HAVE_METADATA

      await expect(service.detectSinglePose(notReadyVideo)).rejects.toThrow(MediaPipeError)
    })

    it('should throw error when no pose detected', async () => {
      const mockResult = {
        landmarks: [],
        worldLandmarks: []
      }
      
      mockPoseLandmarker.detectForVideo.mockReturnValue(mockResult)

      await expect(service.detectSinglePose(mockVideo)).rejects.toThrow(MediaPipeError)
    })
  })

  describe('extractLandmarks', () => {
    it('should extract and normalize landmarks successfully', () => {
      const mockResult = {
        landmarks: [[
          { x: 0.5, y: 0.5, z: 0.1, visibility: 0.9 },
          { x: 1.2, y: -0.1, z: 0.2, visibility: 1.5 } // Out of bounds values
        ]],
        worldLandmarks: []
      }

      const landmarks = service.extractLandmarks(mockResult)

      expect(landmarks).toHaveLength(2)
      expect(landmarks[0]).toEqual({
        x: 0.5,
        y: 0.5,
        z: 0.1,
        visibility: 0.9
      })
      // Check normalization
      expect(landmarks[1]).toEqual({
        x: 1.0, // Clamped to 1
        y: 0.0, // Clamped to 0
        z: 0.2,
        visibility: 1.0 // Clamped to 1
      })
    })

    it('should return empty array for no landmarks', () => {
      const mockResult = {
        landmarks: [],
        worldLandmarks: []
      }

      const landmarks = service.extractLandmarks(mockResult)

      expect(landmarks).toEqual([])
    })

    it('should throw MediaPipeError on extraction failure', () => {
      const mockResult = null as any

      expect(() => service.extractLandmarks(mockResult)).toThrow(MediaPipeError)
    })
  })

  describe('validatePoseQuality', () => {
    it('should validate good quality pose', () => {
      const landmarks = Array.from({ length: 33 }, (_, i) => ({
        x: 0.5,
        y: 0.5,
        z: 0.1,
        visibility: 0.9
      }))

      const result = service.validatePoseQuality(landmarks)

      expect(result.isValid).toBe(true)
      expect(result.issues).toHaveLength(0)
    })

    it('should detect invalid landmark count', () => {
      const landmarks = [{ x: 0.5, y: 0.5, z: 0.1, visibility: 0.9 }]

      const result = service.validatePoseQuality(landmarks)

      expect(result.isValid).toBe(false)
      expect(result.issues).toContain('Expected 33 landmarks, got 1')
    })

    it('should detect low visibility key landmarks', () => {
      const landmarks = Array.from({ length: 33 }, (_, i) => ({
        x: 0.5,
        y: 0.5,
        z: 0.1,
        visibility: [0, 11, 12, 23, 24].includes(i) ? 0.3 : 0.9 // Low visibility for key landmarks
      }))

      const result = service.validatePoseQuality(landmarks)

      expect(result.isValid).toBe(false)
      expect(result.issues).toContain('Too many key landmarks have low visibility')
    })

    it('should detect invalid coordinates', () => {
      const landmarks = Array.from({ length: 33 }, (_, i) => ({
        x: i === 0 ? -0.1 : 0.5, // Invalid x coordinate for first landmark
        y: 0.5,
        z: 0.1,
        visibility: 0.9
      }))

      const result = service.validatePoseQuality(landmarks)

      expect(result.isValid).toBe(false)
      expect(result.issues).toContain('Some landmarks have invalid coordinates')
    })
  })

  describe('getPoseConfidence', () => {
    it('should calculate confidence from visibility scores', () => {
      const landmarks = [
        { x: 0.5, y: 0.5, z: 0.1, visibility: 0.9 },
        { x: 0.5, y: 0.5, z: 0.1, visibility: 0.7 },
        { x: 0.5, y: 0.5, z: 0.1, visibility: 0.8 }
      ]

      const confidence = service.getPoseConfidence(landmarks)

      expect(confidence).toBeCloseTo(0.8) // (0.9 + 0.7 + 0.8) / 3
    })

    it('should return 0 for empty landmarks', () => {
      const confidence = service.getPoseConfidence([])
      expect(confidence).toBe(0)
    })

    it('should handle landmarks without visibility', () => {
      const landmarks = [
        { x: 0.5, y: 0.5, z: 0.1 },
        { x: 0.5, y: 0.5, z: 0.1, visibility: 0.8 }
      ]

      const confidence = service.getPoseConfidence(landmarks)

      expect(confidence).toBe(0.8) // Only count landmarks with visibility
    })
  })

  describe('dispose', () => {
    it('should properly dispose of resources', async () => {
      const { PoseLandmarker, FilesetResolver } = await import('@mediapipe/tasks-vision')
      
      vi.mocked(FilesetResolver.forVisionTasks).mockResolvedValue({} as any)
      vi.mocked(PoseLandmarker.createFromOptions).mockResolvedValue(mockPoseLandmarker)

      await service.initializePoseLandmarker()
      service.dispose()

      expect(mockPoseLandmarker.close).toHaveBeenCalled()
    })
  })

  describe('startMovementTracking', () => {
    beforeEach(async () => {
      const { PoseLandmarker, FilesetResolver } = await import('@mediapipe/tasks-vision')
      
      vi.mocked(FilesetResolver.forVisionTasks).mockResolvedValue({} as any)
      vi.mocked(PoseLandmarker.createFromOptions).mockResolvedValue(mockPoseLandmarker)

      // Mock requestAnimationFrame
      global.requestAnimationFrame = vi.fn((callback) => {
        setTimeout(() => callback(performance.now()), 16)
        return 1
      })
      global.cancelAnimationFrame = vi.fn()
    })

    it('should start movement tracking successfully', async () => {
      const mockResult = {
        landmarks: [[{ x: 0.5, y: 0.5, z: 0.1, visibility: 0.9 }]],
        worldLandmarks: []
      }
      
      mockPoseLandmarker.detectForVideo.mockReturnValue(mockResult)

      const onPoseDetected = vi.fn()
      const onComplete = vi.fn()

      const stopTracking = await service.startMovementTracking(
        mockVideo,
        onPoseDetected,
        { duration: 100, onComplete }
      )

      // Wait for tracking to complete
      await new Promise(resolve => setTimeout(resolve, 150))

      expect(onPoseDetected).toHaveBeenCalled()
      expect(onComplete).toHaveBeenCalled()
      expect(typeof stopTracking).toBe('function')
    })

    it('should handle tracking errors', async () => {
      mockPoseLandmarker.detectForVideo.mockImplementation(() => {
        throw new Error('Detection failed')
      })

      const onError = vi.fn()

      await service.startMovementTracking(
        mockVideo,
        vi.fn(),
        { duration: 100, onError }
      )

      // Wait for error to be triggered
      await new Promise(resolve => setTimeout(resolve, 50))

      expect(onError).toHaveBeenCalled()
    })

    it('should allow early stopping', async () => {
      const mockResult = {
        landmarks: [[{ x: 0.5, y: 0.5, z: 0.1, visibility: 0.9 }]],
        worldLandmarks: []
      }
      
      mockPoseLandmarker.detectForVideo.mockReturnValue(mockResult)

      const onComplete = vi.fn()

      const stopTracking = await service.startMovementTracking(
        mockVideo,
        vi.fn(),
        { duration: 1000, onComplete }
      )

      // Stop tracking early
      stopTracking()

      // Wait and verify completion wasn't called
      await new Promise(resolve => setTimeout(resolve, 100))
      expect(onComplete).not.toHaveBeenCalled()
    })
  })

  describe('recordMovementSequence', () => {
    beforeEach(async () => {
      const { PoseLandmarker, FilesetResolver } = await import('@mediapipe/tasks-vision')
      
      vi.mocked(FilesetResolver.forVisionTasks).mockResolvedValue({} as any)
      vi.mocked(PoseLandmarker.createFromOptions).mockResolvedValue(mockPoseLandmarker)

      global.requestAnimationFrame = vi.fn((callback) => {
        setTimeout(() => callback(performance.now()), 16)
        return 1
      })
    })

    it('should record movement sequence', async () => {
      const mockResult = {
        landmarks: [[{ x: 0.5, y: 0.5, z: 0.1, visibility: 0.9 }]],
        worldLandmarks: []
      }
      
      mockPoseLandmarker.detectForVideo.mockReturnValue(mockResult)

      const sequence = await service.recordMovementSequence(mockVideo, 100)

      expect(Array.isArray(sequence)).toBe(true)
      expect(sequence.length).toBeGreaterThan(0)
      expect(sequence[0]).toHaveProperty('timestamp')
      expect(sequence[0]).toHaveProperty('landmarks')
    })

    it('should filter low confidence poses', async () => {
      const lowConfidenceResult = {
        landmarks: [[{ x: 0.5, y: 0.5, z: 0.1, visibility: 0.1 }]], // Low visibility
        worldLandmarks: []
      }
      
      mockPoseLandmarker.detectForVideo.mockReturnValue(lowConfidenceResult)

      const sequence = await service.recordMovementSequence(
        mockVideo, 
        100, 
        { minPoseConfidence: 0.5 }
      )

      // Should have fewer or no frames due to low confidence filtering
      expect(sequence.length).toBe(0)
    })
  })

  describe('validateMovementSequence', () => {
    it('should validate good movement sequence', () => {
      // Create a sequence with good frame rate (30 frames over 2 seconds)
      const sequence = Array.from({ length: 60 }, (_, i) => ({
        timestamp: i * 33.33, // ~30fps over 2 seconds
        landmarks: Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, z: 0.1, visibility: 0.9 }))
      }))

      const result = service.validateMovementSequence(sequence)

      // Debug: log issues if validation fails
      if (!result.isValid) {
        console.log('Validation issues:', result.issues)
        console.log('Stats:', result.stats)
      }

      expect(result.isValid).toBe(true)
      expect(result.stats.totalFrames).toBe(60)
      expect(result.stats.frameRate).toBeGreaterThan(25) // Should be around 30fps
    })

    it('should detect empty sequence', () => {
      const result = service.validateMovementSequence([])

      expect(result.isValid).toBe(false)
      expect(result.issues).toContain('No movement data recorded')
    })

    it('should detect short sequences', () => {
      const sequence = [
        {
          timestamp: 0,
          landmarks: [{ x: 0.5, y: 0.5, z: 0.1, visibility: 0.9 }]
        },
        {
          timestamp: 500, // Only 500ms
          landmarks: [{ x: 0.5, y: 0.5, z: 0.1, visibility: 0.9 }]
        }
      ]

      const result = service.validateMovementSequence(sequence)

      expect(result.isValid).toBe(false)
      expect(result.issues).toContain('Movement sequence too short (minimum 1 second)')
    })
  })
})