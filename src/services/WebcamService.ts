import type { WebcamService as IWebcamService } from './index'
import { WebcamError } from '../types'
import { ERROR_MESSAGES } from '../utils/constants'

export class WebcamService implements IWebcamService {
  private currentStream: MediaStream | null = null
  private currentVideoElement: HTMLVideoElement | null = null

  async requestCameraAccess(): Promise<MediaStream> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          frameRate: { ideal: 30 }
        },
        audio: false
      })

      this.currentStream = stream
      return stream

    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
          throw new WebcamError(ERROR_MESSAGES.CAMERA_PERMISSION_DENIED, 'PERMISSION_DENIED')
        }
        if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
          throw new WebcamError(ERROR_MESSAGES.CAMERA_NOT_AVAILABLE, 'DEVICE_NOT_FOUND')
        }
      }
      
      const message = error instanceof Error ? error.message : 'Unknown error'
      throw new WebcamError(`Camera access failed: ${message}`, 'ACCESS_FAILED')
    }
  }

  async startVideoStream(videoElement: HTMLVideoElement): Promise<void> {
    try {
      let stream = this.currentStream

      // Request camera access if we don't have a stream
      if (!stream) {
        stream = await this.requestCameraAccess()
      }

      // Set up video element
      videoElement.srcObject = stream
      videoElement.autoplay = true
      videoElement.playsInline = true
      videoElement.muted = true

      // Wait for video to be ready
      await new Promise<void>((resolve, reject) => {
        const handleLoadedData = () => {
          videoElement.removeEventListener('loadeddata', handleLoadedData)
          videoElement.removeEventListener('error', handleError)
          resolve()
        }

        const handleError = (event: Event) => {
          videoElement.removeEventListener('loadeddata', handleLoadedData)
          videoElement.removeEventListener('error', handleError)
          reject(new Error('Video element failed to load'))
        }

        videoElement.addEventListener('loadeddata', handleLoadedData)
        videoElement.addEventListener('error', handleError)

        // Start playing the video
        videoElement.play().catch(reject)
      })

      this.currentVideoElement = videoElement

    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      throw new WebcamError(`Failed to start video stream: ${message}`, 'STREAM_FAILED')
    }
  }

  stopVideoStream(): void {
    try {
      // Stop all tracks in the current stream
      if (this.currentStream) {
        this.currentStream.getTracks().forEach(track => {
          track.stop()
        })
        this.currentStream = null
      }

      // Clear video element
      if (this.currentVideoElement) {
        this.currentVideoElement.srcObject = null
        this.currentVideoElement.pause()
        this.currentVideoElement = null
      }

    } catch (error) {
      console.warn('Error stopping video stream:', error)
    }
  }

  async checkCameraPermissions(): Promise<boolean> {
    try {
      // Check if navigator.permissions is available
      if (!navigator.permissions) {
        // Fallback: try to access camera to check permissions
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: true })
          stream.getTracks().forEach(track => track.stop())
          return true
        } catch {
          return false
        }
      }

      // Use permissions API if available
      const permission = await navigator.permissions.query({ name: 'camera' as PermissionName })
      return permission.state === 'granted'

    } catch (error) {
      console.warn('Error checking camera permissions:', error)
      return false
    }
  }

  // Get current stream info
  getStreamInfo(): { width: number; height: number; frameRate: number } | null {
    if (!this.currentStream) return null

    const videoTrack = this.currentStream.getVideoTracks()[0]
    if (!videoTrack) return null

    const settings = videoTrack.getSettings()
    return {
      width: settings.width || 0,
      height: settings.height || 0,
      frameRate: settings.frameRate || 0
    }
  }

  // Check if camera is currently active
  isActive(): boolean {
    return this.currentStream !== null && 
           this.currentStream.getVideoTracks().some(track => track.readyState === 'live')
  }

  // Cleanup method
  dispose(): void {
    this.stopVideoStream()
  }
}

// Export singleton instance
export default new WebcamService()