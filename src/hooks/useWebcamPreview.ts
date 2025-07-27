import { useState, useCallback, useRef, useEffect } from 'react'
import { webcamService } from '../services'
import type { PoseLandmark } from '../types'

interface UseWebcamPreviewOptions {
  autoStart?: boolean
  onError?: (error: string) => void
}

interface UseWebcamPreviewReturn {
  videoRef: React.RefObject<HTMLVideoElement>
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
  
  const videoRef = useRef<HTMLVideoElement>(null)
  const [isActive, setIsActive] = useState(false)
  const [isReady, setIsReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [landmarks, setLandmarks] = useState<PoseLandmark[]>([])

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
    if (!videoRef.current) {
      handleError('Video element not available')
      return
    }

    try {
      clearError()
      setIsActive(true)
      
      await webcamService.startVideoStream(videoRef.current)
      setIsReady(true)
      
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to start camera'
      handleError(message)
    }
  }, [handleError, clearError])

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
    if (autoStart && videoRef.current && !isActive) {
      startCamera()
    }
  }, [autoStart, startCamera, isActive])

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