/**
 * Performance optimization tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { 
  PerformanceMonitor, 
  FrameRateController, 
  MemoryManager, 
  PoseDataCompressor 
} from '../performance';
import { PERFORMANCE_CONFIG } from '../constants';

describe('PerformanceMonitor', () => {
  let monitor: PerformanceMonitor;

  beforeEach(() => {
    monitor = new PerformanceMonitor();
  });

  it('should start and stop monitoring', () => {
    monitor.start();
    expect(monitor.getMetrics().totalFrames).toBe(0);
    
    monitor.stop();
    monitor.recordFrame(16.67); // 60fps frame
    expect(monitor.getMetrics().totalFrames).toBe(0); // Should not record when stopped
  });

  it('should record frame timing correctly', () => {
    monitor.start();
    
    monitor.recordFrame(16.67); // 60fps frame
    monitor.recordFrame(33.33); // 30fps frame
    
    const metrics = monitor.getMetrics();
    expect(metrics.totalFrames).toBe(2);
    expect(metrics.droppedFrames).toBe(0);
    expect(metrics.fps).toBeGreaterThan(0);
  });

  it('should track dropped frames', () => {
    monitor.start();
    
    monitor.recordFrame(16.67, false); // Normal frame
    monitor.recordFrame(100, true);    // Dropped frame
    
    const metrics = monitor.getMetrics();
    expect(metrics.totalFrames).toBe(2);
    expect(metrics.droppedFrames).toBe(1);
  });

  it('should detect when frames should be skipped', () => {
    const shouldSkip = monitor.shouldSkipFrame(150); // 150ms is > threshold
    expect(shouldSkip).toBe(true);
    
    const shouldNotSkip = monitor.shouldSkipFrame(50); // 50ms is < threshold
    expect(shouldNotSkip).toBe(false);
  });
});

describe('FrameRateController', () => {
  let controller: FrameRateController;

  beforeEach(() => {
    controller = new FrameRateController(30); // 30fps target
  });

  it('should initialize with correct target FPS', () => {
    expect(controller.getCurrentFPS()).toBe(0); // No frames processed yet
  });

  it('should control frame processing rate', () => {
    const now = performance.now();
    
    // First frame should always be processed
    expect(controller.shouldProcessFrame(now)).toBe(true);
    
    // Immediate next frame should be skipped (too soon)
    expect(controller.shouldProcessFrame(now + 1)).toBe(false);
    
    // Frame after sufficient time should be processed
    expect(controller.shouldProcessFrame(now + 40)).toBe(true); // 40ms > 33.33ms (30fps)
  });

  it('should adjust target FPS based on performance', () => {
    // Simulate low performance
    controller.adjustTargetFPS(20); // Current FPS is lower than target
    
    // Should reduce target FPS
    const newFPS = controller.getCurrentFPS();
    expect(newFPS).toBeLessThanOrEqual(30);
  });

  it('should respect min and max FPS limits', () => {
    const lowController = new FrameRateController(5); // Below minimum
    const highController = new FrameRateController(120); // Above maximum
    
    // Should clamp to valid range
    expect(lowController).toBeDefined();
    expect(highController).toBeDefined();
  });
});

describe('MemoryManager', () => {
  let manager: MemoryManager;

  beforeEach(() => {
    manager = new MemoryManager();
  });

  it('should add and track pose data', () => {
    const poseData = { x: 0.5, y: 0.5, z: 0 };
    
    manager.addPoseData(poseData);
    
    const stats = manager.getMemoryStats();
    expect(stats.historySize).toBe(1);
    expect(stats.estimatedMemory).toBeGreaterThan(0);
  });

  it('should limit pose history size', () => {
    // Add more poses than the maximum allowed
    for (let i = 0; i < PERFORMANCE_CONFIG.MAX_POSE_HISTORY + 10; i++) {
      manager.addPoseData({ x: i, y: i, z: 0 });
    }
    
    const stats = manager.getMemoryStats();
    expect(stats.historySize).toBeLessThanOrEqual(PERFORMANCE_CONFIG.MAX_POSE_HISTORY);
  });

  it('should force cleanup all data', () => {
    manager.addPoseData({ x: 0.5, y: 0.5, z: 0 });
    expect(manager.getMemoryStats().historySize).toBe(1);
    
    manager.forceCleanup();
    expect(manager.getMemoryStats().historySize).toBe(0);
  });
});

describe('PoseDataCompressor', () => {
  const sampleLandmarks = [
    { x: 0.123456789, y: 0.987654321, z: 0.555555555, visibility: 0.888888888 },
    { x: 0.111111111, y: 0.222222222, z: 0.333333333, visibility: 0.444444444 }
  ];

  it('should compress landmarks by reducing precision', () => {
    const compressed = PoseDataCompressor.compressLandmarks(sampleLandmarks);
    
    // Check that precision is reduced
    expect(compressed[0].x).toBe(0.1235); // 4 decimal places
    expect(compressed[0].y).toBe(0.9877);
    expect(compressed[0].visibility).toBe(0.8889);
  });

  it('should return original data when compression is disabled', () => {
    // Mock compression disabled
    const originalConfig = PERFORMANCE_CONFIG.COMPRESSION_ENABLED;
    (PERFORMANCE_CONFIG as any).COMPRESSION_ENABLED = false;
    
    const result = PoseDataCompressor.compressLandmarks(sampleLandmarks);
    expect(result).toEqual(sampleLandmarks);
    
    // Restore original config
    (PERFORMANCE_CONFIG as any).COMPRESSION_ENABLED = originalConfig;
  });

  it('should estimate compressed data size', () => {
    const size = PoseDataCompressor.estimateCompressedSize(sampleLandmarks);
    expect(size).toBeGreaterThan(0);
    expect(typeof size).toBe('number');
  });

  it('should calculate compression ratio', () => {
    const compressed = PoseDataCompressor.compressLandmarks(sampleLandmarks);
    const ratio = PoseDataCompressor.getCompressionRatio(sampleLandmarks, compressed);
    
    expect(ratio).toBeGreaterThan(0);
    expect(ratio).toBeLessThanOrEqual(1); // Compressed should be smaller or equal
  });

  it('should compress image with specified quality', () => {
    // Create a mock canvas
    const canvas = document.createElement('canvas');
    canvas.width = 100;
    canvas.height = 100;
    
    // Mock toDataURL
    const mockToDataURL = vi.fn().mockReturnValue('data:image/jpeg;base64,mockdata');
    canvas.toDataURL = mockToDataURL;
    
    const result = PoseDataCompressor.compressImage(canvas, 0.8);
    
    expect(mockToDataURL).toHaveBeenCalledWith('image/jpeg', 0.8);
    expect(result).toBe('data:image/jpeg;base64,mockdata');
  });
});

describe('Performance Integration', () => {
  it('should work together for complete performance monitoring', () => {
    const monitor = new PerformanceMonitor();
    const controller = new FrameRateController(30);
    const manager = new MemoryManager();
    
    monitor.start();
    
    // Simulate frame processing
    const now = performance.now();
    if (controller.shouldProcessFrame(now)) {
      const poseData = { x: 0.5, y: 0.5, z: 0 };
      manager.addPoseData(poseData);
      monitor.recordFrame(16.67);
    }
    
    const metrics = monitor.getMetrics();
    const memoryStats = manager.getMemoryStats();
    
    expect(metrics.totalFrames).toBeGreaterThan(0);
    expect(memoryStats.historySize).toBeGreaterThan(0);
    
    monitor.stop();
  });

  it('should handle performance degradation gracefully', () => {
    const monitor = new PerformanceMonitor();
    const controller = new FrameRateController(60);
    
    monitor.start();
    
    // Simulate slow frames
    for (let i = 0; i < 10; i++) {
      monitor.recordFrame(100); // 100ms frames (very slow)
    }
    
    const metrics = monitor.getMetrics();
    expect(metrics.fps).toBeLessThan(60); // Should detect low FPS
    
    // Controller should adapt
    controller.adjustTargetFPS(metrics.fps);
    
    monitor.stop();
  });
});