import { useState, useCallback, useEffect } from 'react'
import { webcamService } from '../services'
import type { PoseLandmark } from '../types'

interface UseWebcamPreviewOptions {
  autoStart?: boolean
  onError?: (error: string) => void
}

interface UseWebcamPreviewReturn {
  videoRef: React.RefCallback<HTMLVideoElement>
  isActive: boolean
  isReady: boolean
  error: string | null
  landmarks: PoseLandmark[]
  startCamera: () => Promise<void>
  stopCamera: () => void
  updateLandmarks: (newLandmarks: PoseLandmark[]) => void
  clearError: () => void
}

export default function useWebcamPreview(options: UseWebcamPreviewOptions = {}): UseWebcamPreviewReturn {
  const { autoStart = false, onError } = options
  
  const [videoElement, setVideoElement] = useState<HTMLVideoElement | null>(null)
  const [isActive, setIsActive] = useState(false)
  const [isReady, setIsReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [landmarks, setLandmarks] = useState<PoseLandmark[]>([])

  const videoRef = useCallback((node: HTMLVideoElement | null) => {
    setVideoElement(node)
  }, [])

  const clearError = useCallback(() => {
    setError(null)
  }, [])

  const handleError = useCallback((errorMessage: string) => {
    setError(errorMessage)
    setIsActive(false)
    setIsReady(false)
    onError?.(errorMessage)
  }, [onError])

  const startCamera = useCallback(async () => {
    if (!videoElement) {
      handleError('Video element not available')
      return
    }

    try {
      clearError()
      setIsActive(true)
      
      await webcamService.startVideoStream(videoElement)
      setIsReady(true)
      
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to start camera'
      handleError(message)
    }
  }, [videoElement, handleError, clearError])

  const stopCamera = useCallback(() => {
    try {
      webcamService.stopVideoStream()
      setIsActive(false)
      setIsReady(false)
      setLandmarks([])
    } catch (error) {
      console.warn('Error stopping camera:', error)
    }
  }, [])

  const updateLandmarks = useCallback((newLandmarks: PoseLandmark[]) => {
    setLandmarks(newLandmarks)
  }, [])

  // Auto-start camera if requested
  useEffect(() => {
    if (autoStart && videoElement && !isActive) {
      startCamera()
    }
  }, [autoStart, videoElement, isActive, startCamera])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCamera()
    }
  }, [stopCamera])

  return {
    videoRef,
    isActive,
    isReady,
    error,
    landmarks,
    startCamera,
    stopCamera,
    updateLandmarks,
    clearError
  }
}