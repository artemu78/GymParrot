import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { WebcamService } from '../WebcamService'
import { WebcamError } from '../../types'

// Mock MediaDevices API
const mockGetUserMedia = vi.fn()
const mockPermissionsQuery = vi.fn()

Object.defineProperty(global.navigator, 'mediaDevices', {
  value: {
    getUserMedia: mockGetUserMedia
  },
  writable: true
})

Object.defineProperty(global.navigator, 'permissions', {
  value: {
    query: mockPermissionsQuery
  },
  writable: true
})

// Mock MediaStream
class MockMediaStream {
  private tracks: MediaStreamTrack[] = []

  constructor(tracks: MediaStreamTrack[] = []) {
    this.tracks = tracks
  }

  getTracks() {
    return this.tracks
  }

  getVideoTracks() {
    return this.tracks.filter(track => track.kind === 'video')
  }
}

// Mock MediaStreamTrack
class MockMediaStreamTrack {
  kind: string
  readyState: string = 'live'
  
  constructor(kind: string = 'video') {
    this.kind = kind
  }

  stop = vi.fn()
  
  getSettings() {
    return {
      width: 640,
      height: 480,
      frameRate: 30
    }
  }
}

describe('WebcamService', () => {
  let service: WebcamService
  let mockVideoElement: HTMLVideoElement
  let mockStream: MockMediaStream
  let mockTrack: MockMediaStreamTrack

  beforeEach(() => {
    service = new WebcamService()
    
    // Create mock video element
    mockVideoElement = {
      srcObject: null,
      autoplay: false,
      playsInline: false,
      muted: false,
      play: vi.fn().mockResolvedValue(undefined),
      pause: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    } as any

    // Create mock stream and track
    mockTrack = new MockMediaStreamTrack('video')
    mockStream = new MockMediaStream([mockTrack])

    // Reset mocks
    vi.clearAllMocks()
  })

  afterEach(() => {
    service.dispose()
  })

  describe('requestCameraAccess', () => {
    it('should request camera access successfully', async () => {
      mockGetUserMedia.mockResolvedValue(mockStream)

      const result = await service.requestCameraAccess()

      expect(mockGetUserMedia).toHaveBeenCalledWith({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          frameRate: { ideal: 30 }
        },
        audio: false
      })
      expect(result).toBe(mockStream)
    })

    it('should throw WebcamError on permission denied', async () => {
      const permissionError = new Error('Permission denied')
      permissionError.name = 'NotAllowedError'
      mockGetUserMedia.mockRejectedValue(permissionError)

      await expect(service.requestCameraAccess()).rejects.toThrow(WebcamError)
      await expect(service.requestCameraAccess()).rejects.toThrow('Camera access denied')
    })

    it('should throw WebcamError on device not found', async () => {
      const deviceError = new Error('Device not found')
      deviceError.name = 'NotFoundError'
      mockGetUserMedia.mockRejectedValue(deviceError)

      await expect(service.requestCameraAccess()).rejects.toThrow(WebcamError)
      await expect(service.requestCameraAccess()).rejects.toThrow('Camera not available')
    })

    it('should throw WebcamError on unknown error', async () => {
      mockGetUserMedia.mockRejectedValue(new Error('Unknown error'))

      await expect(service.requestCameraAccess()).rejects.toThrow(WebcamError)
    })
  })

  describe('startVideoStream', () => {
    beforeEach(() => {
      mockGetUserMedia.mockResolvedValue(mockStream)
    })

    it('should start video stream successfully', async () => {
      // Mock successful video loading
      mockVideoElement.addEventListener.mockImplementation((event, handler) => {
        if (event === 'loadeddata') {
          setTimeout(() => handler(), 0)
        }
      })

      await service.startVideoStream(mockVideoElement)

      expect(mockVideoElement.srcObject).toBe(mockStream)
      expect(mockVideoElement.autoplay).toBe(true)
      expect(mockVideoElement.playsInline).toBe(true)
      expect(mockVideoElement.muted).toBe(true)
      expect(mockVideoElement.play).toHaveBeenCalled()
    })

    it('should request camera access if no current stream', async () => {
      mockVideoElement.addEventListener.mockImplementation((event, handler) => {
        if (event === 'loadeddata') {
          setTimeout(() => handler(), 0)
        }
      })

      await service.startVideoStream(mockVideoElement)

      expect(mockGetUserMedia).toHaveBeenCalled()
    })

    it('should use existing stream if available', async () => {
      // First request to establish stream
      await service.requestCameraAccess()
      vi.clearAllMocks()

      mockVideoElement.addEventListener.mockImplementation((event, handler) => {
        if (event === 'loadeddata') {
          setTimeout(() => handler(), 0)
        }
      })

      await service.startVideoStream(mockVideoElement)

      expect(mockGetUserMedia).not.toHaveBeenCalled()
      expect(mockVideoElement.srcObject).toBe(mockStream)
    })

    it('should throw WebcamError on video element error', async () => {
      mockVideoElement.addEventListener.mockImplementation((event, handler) => {
        if (event === 'error') {
          setTimeout(() => handler(new Event('error')), 0)
        }
      })

      await expect(service.startVideoStream(mockVideoElement)).rejects.toThrow(WebcamError)
    })
  })

  describe('stopVideoStream', () => {
    it('should stop video stream and clean up resources', async () => {
      mockGetUserMedia.mockResolvedValue(mockStream)
      await service.requestCameraAccess()

      mockVideoElement.addEventListener.mockImplementation((event, handler) => {
        if (event === 'loadeddata') {
          setTimeout(() => handler(), 0)
        }
      })
      await service.startVideoStream(mockVideoElement)

      service.stopVideoStream()

      expect(mockTrack.stop).toHaveBeenCalled()
      expect(mockVideoElement.srcObject).toBe(null)
      expect(mockVideoElement.pause).toHaveBeenCalled()
    })

    it('should handle cleanup gracefully when no stream exists', () => {
      expect(() => service.stopVideoStream()).not.toThrow()
    })
  })

  describe('checkCameraPermissions', () => {
    it('should return true when permission is granted', async () => {
      mockPermissionsQuery.mockResolvedValue({ state: 'granted' })

      const result = await service.checkCameraPermissions()

      expect(result).toBe(true)
      expect(mockPermissionsQuery).toHaveBeenCalledWith({ name: 'camera' })
    })

    it('should return false when permission is denied', async () => {
      mockPermissionsQuery.mockResolvedValue({ state: 'denied' })

      const result = await service.checkCameraPermissions()

      expect(result).toBe(false)
    })

    it('should fallback to getUserMedia when permissions API unavailable', async () => {
      // Remove permissions API
      Object.defineProperty(global.navigator, 'permissions', {
        value: undefined,
        writable: true
      })

      mockGetUserMedia.mockResolvedValue(mockStream)

      const result = await service.checkCameraPermissions()

      expect(result).toBe(true)
      expect(mockGetUserMedia).toHaveBeenCalledWith({ video: true })
    })

    it('should return false on fallback failure', async () => {
      Object.defineProperty(global.navigator, 'permissions', {
        value: undefined,
        writable: true
      })

      mockGetUserMedia.mockRejectedValue(new Error('Access denied'))

      const result = await service.checkCameraPermissions()

      expect(result).toBe(false)
    })
  })

  describe('getStreamInfo', () => {
    it('should return stream info when stream is active', async () => {
      mockGetUserMedia.mockResolvedValue(mockStream)
      await service.requestCameraAccess()

      const info = service.getStreamInfo()

      expect(info).toEqual({
        width: 640,
        height: 480,
        frameRate: 30
      })
    })

    it('should return null when no stream exists', () => {
      const info = service.getStreamInfo()
      expect(info).toBe(null)
    })
  })

  describe('isActive', () => {
    it('should return true when stream is active', async () => {
      mockGetUserMedia.mockResolvedValue(mockStream)
      await service.requestCameraAccess()

      expect(service.isActive()).toBe(true)
    })

    it('should return false when no stream exists', () => {
      expect(service.isActive()).toBe(false)
    })

    it('should return false when track is not live', async () => {
      mockTrack.readyState = 'ended'
      mockGetUserMedia.mockResolvedValue(mockStream)
      await service.requestCameraAccess()

      expect(service.isActive()).toBe(false)
    })
  })

  describe('dispose', () => {
    it('should clean up all resources', async () => {
      mockGetUserMedia.mockResolvedValue(mockStream)
      await service.requestCameraAccess()

      service.dispose()

      expect(mockTrack.stop).toHaveBeenCalled()
    })
  })
})