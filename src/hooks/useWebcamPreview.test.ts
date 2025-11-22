import { renderHook, act, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import useWebcamPreview from './useWebcamPreview'
import { webcamService } from '../services'

// Mock webcamService
vi.mock('../services', () => ({
  webcamService: {
    startVideoStream: vi.fn(),
    stopVideoStream: vi.fn(),
  }
}))

describe('useWebcamPreview', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Ensure startVideoStream returns a resolved promise by default
    vi.mocked(webcamService.startVideoStream).mockResolvedValue(undefined)
  })

  it('should initialize with default state', () => {
    const { result } = renderHook(() => useWebcamPreview())

    expect(result.current.isActive).toBe(false)
    expect(result.current.isReady).toBe(false)
    expect(result.current.error).toBe(null)
    expect(result.current.landmarks).toEqual([])
    expect(result.current.videoRef.current).toBe(null)
  })

  it('should start camera successfully', async () => {
    const { result } = renderHook(() => useWebcamPreview())

    // Mock video element
    const mockVideo = document.createElement('video')
    // @ts-ignore - Assigning to readonly property for testing
    result.current.videoRef.current = mockVideo

    await act(async () => {
      await result.current.startCamera()
    })

    expect(webcamService.startVideoStream).toHaveBeenCalledWith(mockVideo)
    expect(result.current.isActive).toBe(true)
    expect(result.current.isReady).toBe(true)
    expect(result.current.error).toBe(null)
  })

  it('should handle start camera error', async () => {
    const onError = vi.fn()
    const errorMsg = 'Camera access denied'
    vi.mocked(webcamService.startVideoStream).mockRejectedValueOnce(new Error(errorMsg))

    const { result } = renderHook(() => useWebcamPreview({ onError }))

    // Mock video element
    const mockVideo = document.createElement('video')
    // @ts-ignore
    result.current.videoRef.current = mockVideo

    await act(async () => {
      await result.current.startCamera()
    })

    expect(result.current.isActive).toBe(false)
    expect(result.current.isReady).toBe(false)
    expect(result.current.error).toBe(errorMsg)
    expect(onError).toHaveBeenCalledWith(errorMsg)
  })

  it('should handle start camera when video ref is missing', async () => {
    const onError = vi.fn()
    const { result } = renderHook(() => useWebcamPreview({ onError }))

    await act(async () => {
      await result.current.startCamera()
    })

    expect(webcamService.startVideoStream).not.toHaveBeenCalled()
    expect(result.current.error).toBe('Video element not available')
    expect(onError).toHaveBeenCalledWith('Video element not available')
  })

  it('should stop camera successfully', async () => {
    const { result } = renderHook(() => useWebcamPreview())

    // First start the camera to set state
    const mockVideo = document.createElement('video')
    // @ts-ignore
    result.current.videoRef.current = mockVideo

    await act(async () => {
      await result.current.startCamera()
    })

    expect(result.current.isActive).toBe(true)

    act(() => {
      result.current.stopCamera()
    })

    expect(webcamService.stopVideoStream).toHaveBeenCalled()
    expect(result.current.isActive).toBe(false)
    expect(result.current.isReady).toBe(false)
    expect(result.current.landmarks).toEqual([])
  })

  it('should update landmarks', () => {
    const { result } = renderHook(() => useWebcamPreview())
    const mockLandmarks = [{ x: 0, y: 0, z: 0 }] as any

    act(() => {
      result.current.updateLandmarks(mockLandmarks)
    })

    expect(result.current.landmarks).toBe(mockLandmarks)
  })

  it('should clear error', async () => {
    const onError = vi.fn()
    const errorMsg = 'Initial error'
    vi.mocked(webcamService.startVideoStream).mockRejectedValueOnce(new Error(errorMsg))

    const { result } = renderHook(() => useWebcamPreview({ onError }))

    const mockVideo = document.createElement('video')
    // @ts-ignore
    result.current.videoRef.current = mockVideo

    // Trigger error
    await act(async () => {
      await result.current.startCamera()
    })

    expect(result.current.error).toBe(errorMsg)

    // Clear error
    act(() => {
      result.current.clearError()
    })

    expect(result.current.error).toBe(null)
  })

  it('should cleanup on unmount', () => {
    const { unmount } = renderHook(() => useWebcamPreview())

    unmount()

    expect(webcamService.stopVideoStream).toHaveBeenCalled()
  })

  // Note: Auto-start functionality depends on ref mutation which is hard to test with renderHook alone
  // without a proper component wrapper or mocking useRef.
  // We can try to verify it triggers if we can mock the ref state.
  it('should auto-start camera if video ref is available initially', async () => {
     // To test autoStart, we need videoRef.current to be populated when the effect runs.
     // We can't easily achieve this with renderHook unless we modify the hook or use a wrapper that attaches ref.
     // However, the hook creates the ref.
     // So we will skip this specific test case for now or we'd need to mock React.useRef which is invasive.
     // Instead, we can test that if we force a re-render with populated ref, it starts.

     const { result, rerender } = renderHook(({ autoStart }) => useWebcamPreview({ autoStart }), {
        initialProps: { autoStart: true }
     })

     const mockVideo = document.createElement('video')
     // @ts-ignore
     result.current.videoRef.current = mockVideo

     // Changing the ref does not trigger re-render.
     // Changing props does.
     // Let's toggle autoStart off then on?

     rerender({ autoStart: false })
     rerender({ autoStart: true })

     await waitFor(() => {
       expect(webcamService.startVideoStream).toHaveBeenCalledWith(mockVideo)
     })

     expect(result.current.isActive).toBe(true)
  })
})
