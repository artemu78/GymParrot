/**
 * Performance monitoring and optimization utilities
 */

import { PERFORMANCE_CONFIG, PERFORMANCE_THRESHOLDS } from './constants';

export interface PerformanceMetrics {
  fps: number;
  averageFrameTime: number;
  memoryUsage: number;
  droppedFrames: number;
  totalFrames: number;
  timestamp: number;
}

export interface FrameTimingInfo {
  frameStart: number;
  processingTime: number;
  shouldSkip: boolean;
}

/**
 * Performance monitor for tracking real-time metrics
 */
export class PerformanceMonitor {
  private frameTimes: number[] = [];
  private droppedFrames = 0;
  private totalFrames = 0;
  private lastLogTime = 0;
  private isMonitoring = false;

  /**
   * Start performance monitoring
   */
  start(): void {
    this.isMonitoring = true;
    this.frameTimes = [];
    this.droppedFrames = 0;
    this.totalFrames = 0;
    this.lastLogTime = performance.now();
  }

  /**
   * Stop performance monitoring
   */
  stop(): void {
    this.isMonitoring = false;
  }

  /**
   * Record frame timing information
   */
  recordFrame(processingTime: number, wasSkipped: boolean = false): void {
    if (!this.isMonitoring) return;

    this.totalFrames++;
    
    if (wasSkipped) {
      this.droppedFrames++;
      return;
    }

    // Keep only recent frame times for FPS calculation
    this.frameTimes.push(processingTime);
    if (this.frameTimes.length > PERFORMANCE_CONFIG.FPS_SAMPLE_SIZE) {
      this.frameTimes.shift();
    }

    // Log performance metrics periodically
    const now = performance.now();
    if (now - this.lastLogTime >= PERFORMANCE_CONFIG.PERFORMANCE_LOG_INTERVAL) {
      this.logMetrics();
      this.lastLogTime = now;
    }
  }

  /**
   * Get current performance metrics
   */
  getMetrics(): PerformanceMetrics {
    const averageFrameTime = this.frameTimes.length > 0 
      ? this.frameTimes.reduce((sum, time) => sum + time, 0) / this.frameTimes.length
      : 0;

    const fps = averageFrameTime > 0 ? 1000 / averageFrameTime : 0;

    return {
      fps,
      averageFrameTime,
      memoryUsage: this.getMemoryUsage(),
      droppedFrames: this.droppedFrames,
      totalFrames: this.totalFrames,
      timestamp: performance.now(),
    };
  }

  /**
   * Check if frame should be skipped based on performance
   */
  shouldSkipFrame(lastFrameTime: number): boolean {
    return lastFrameTime > PERFORMANCE_CONFIG.FRAME_SKIP_THRESHOLD;
  }

  /**
   * Get memory usage estimate
   */
  private getMemoryUsage(): number {
    // Use performance.memory if available (Chrome)
    if ('memory' in performance) {
      return (performance as any).memory.usedJSHeapSize;
    }
    
    // Fallback estimation based on frame history
    return this.frameTimes.length * 1024; // Rough estimate
  }

  /**
   * Log performance metrics to console
   */
  private logMetrics(): void {
    if (!PERFORMANCE_CONFIG.ENABLE_PERFORMANCE_MONITORING) return;

    const metrics = this.getMetrics();
    
    console.log('🔍 Performance Metrics:', {
      fps: Math.round(metrics.fps * 10) / 10,
      avgFrameTime: Math.round(metrics.averageFrameTime * 10) / 10 + 'ms',
      memoryUsage: Math.round(metrics.memoryUsage / 1024 / 1024 * 10) / 10 + 'MB',
      droppedFrames: metrics.droppedFrames,
      dropRate: Math.round((metrics.droppedFrames / metrics.totalFrames) * 100) + '%'
    });

    // Warn about performance issues
    if (metrics.fps < PERFORMANCE_THRESHOLDS.LOW_FPS_WARNING) {
      console.warn('⚠️ Low FPS detected:', metrics.fps);
    }
    
    if (metrics.memoryUsage > PERFORMANCE_THRESHOLDS.HIGH_MEMORY_WARNING) {
      console.warn('⚠️ High memory usage detected:', Math.round(metrics.memoryUsage / 1024 / 1024) + 'MB');
    }
    
    if (metrics.averageFrameTime > PERFORMANCE_THRESHOLDS.SLOW_PROCESSING_WARNING) {
      console.warn('⚠️ Slow frame processing detected:', metrics.averageFrameTime + 'ms');
    }
  }
}

/**
 * Frame rate controller for smooth pose tracking
 */
export class FrameRateController {
  private targetFps: number;
  private frameInterval: number;
  private lastFrameTime = 0;
  private frameCount = 0;
  private startTime = 0;

  constructor(targetFps: number = PERFORMANCE_CONFIG.TARGET_FPS) {
    this.targetFps = Math.max(PERFORMANCE_CONFIG.MIN_FPS, 
                             Math.min(PERFORMANCE_CONFIG.MAX_FPS, targetFps));
    this.frameInterval = 1000 / this.targetFps;
  }

  /**
   * Check if it's time for the next frame
   */
  shouldProcessFrame(currentTime: number): boolean {
    if (this.startTime === 0) {
      this.startTime = currentTime;
      this.lastFrameTime = currentTime;
      return true;
    }

    const timeSinceLastFrame = currentTime - this.lastFrameTime;
    
    if (timeSinceLastFrame >= this.frameInterval) {
      this.lastFrameTime = currentTime;
      this.frameCount++;
      return true;
    }
    
    return false;
  }

  /**
   * Get current actual FPS
   */
  getCurrentFPS(): number {
    const elapsed = performance.now() - this.startTime;
    return elapsed > 0 ? (this.frameCount * 1000) / elapsed : 0;
  }

  /**
   * Reset the frame rate controller
   */
  reset(): void {
    this.lastFrameTime = 0;
    this.frameCount = 0;
    this.startTime = 0;
  }

  /**
   * Adjust target FPS based on performance
   */
  adjustTargetFPS(currentFPS: number): void {
    if (currentFPS < this.targetFps * 0.8) {
      // Reduce target FPS if we're consistently missing frames
      this.targetFps = Math.max(PERFORMANCE_CONFIG.MIN_FPS, this.targetFps - 2);
      this.frameInterval = 1000 / this.targetFps;
      console.log('🎯 Adjusted target FPS to:', this.targetFps);
    } else if (currentFPS > this.targetFps * 1.1 && this.targetFps < PERFORMANCE_CONFIG.MAX_FPS) {
      // Increase target FPS if we have headroom
      this.targetFps = Math.min(PERFORMANCE_CONFIG.MAX_FPS, this.targetFps + 2);
      this.frameInterval = 1000 / this.targetFps;
      console.log('🎯 Adjusted target FPS to:', this.targetFps);
    }
  }
}

/**
 * Memory manager for continuous video processing
 */
export class MemoryManager {
  private poseHistory: any[] = [];
  private lastCleanup = 0;
  private memoryWarningShown = false;

  /**
   * Add pose data to history with automatic cleanup
   */
  addPoseData(poseData: any): void {
    this.poseHistory.push({
      data: poseData,
      timestamp: performance.now()
    });

    // Limit history size
    if (this.poseHistory.length > PERFORMANCE_CONFIG.MAX_POSE_HISTORY) {
      this.poseHistory.shift();
    }

    // Periodic cleanup
    const now = performance.now();
    if (now - this.lastCleanup >= PERFORMANCE_CONFIG.MEMORY_CLEANUP_INTERVAL) {
      this.cleanup();
      this.lastCleanup = now;
    }
  }

  /**
   * Clean up old pose data and check memory usage
   */
  cleanup(): void {
    const now = performance.now();
    const maxAge = 60000; // Keep poses for max 1 minute

    // Remove old poses
    this.poseHistory = this.poseHistory.filter(
      pose => now - pose.timestamp < maxAge
    );

    // Check memory usage
    this.checkMemoryUsage();

    console.log('🧹 Memory cleanup completed. Poses in history:', this.poseHistory.length);
  }

  /**
   * Force cleanup of all pose history
   */
  forceCleanup(): void {
    this.poseHistory = [];
    this.memoryWarningShown = false;
    
    // Force garbage collection if available
    if ('gc' in window) {
      (window as any).gc();
    }
    
    console.log('🧹 Forced memory cleanup completed');
  }

  /**
   * Get memory usage statistics
   */
  getMemoryStats(): { historySize: number; estimatedMemory: number } {
    const estimatedMemory = this.poseHistory.length * 1024; // Rough estimate
    
    return {
      historySize: this.poseHistory.length,
      estimatedMemory
    };
  }

  /**
   * Check memory usage and warn if high
   */
  private checkMemoryUsage(): void {
    if ('memory' in performance) {
      const memoryInfo = (performance as any).memory;
      const usedMemory = memoryInfo.usedJSHeapSize;
      
      if (usedMemory > PERFORMANCE_THRESHOLDS.HIGH_MEMORY_WARNING && !this.memoryWarningShown) {
        console.warn('⚠️ High memory usage detected. Consider reducing tracking duration or quality.');
        this.memoryWarningShown = true;
      }
    }
  }
}

/**
 * Pose data compression utilities
 */
export class PoseDataCompressor {
  /**
   * Compress pose landmarks by reducing precision
   */
  static compressLandmarks(landmarks: any[]): any[] {
    if (!PERFORMANCE_CONFIG.COMPRESSION_ENABLED) {
      return landmarks;
    }

    return landmarks.map(landmark => ({
      x: Number(landmark.x.toFixed(PERFORMANCE_CONFIG.LANDMARK_PRECISION)),
      y: Number(landmark.y.toFixed(PERFORMANCE_CONFIG.LANDMARK_PRECISION)),
      z: Number(landmark.z.toFixed(PERFORMANCE_CONFIG.LANDMARK_PRECISION)),
      visibility: landmark.visibility !== undefined 
        ? Number(landmark.visibility.toFixed(PERFORMANCE_CONFIG.LANDMARK_PRECISION))
        : undefined
    }));
  }

  /**
   * Compress image data with specified quality
   */
  static compressImage(canvas: HTMLCanvasElement, quality: number = PERFORMANCE_CONFIG.IMAGE_QUALITY): string {
    return canvas.toDataURL('image/jpeg', quality);
  }

  /**
   * Estimate compressed data size
   */
  static estimateCompressedSize(landmarks: any[]): number {
    const compressed = this.compressLandmarks(landmarks);
    return JSON.stringify(compressed).length;
  }

  /**
   * Calculate compression ratio
   */
  static getCompressionRatio(original: any[], compressed: any[]): number {
    const originalSize = JSON.stringify(original).length;
    const compressedSize = JSON.stringify(compressed).length;
    return originalSize > 0 ? compressedSize / originalSize : 1;
  }
}

// Export singleton instances
export const performanceMonitor = new PerformanceMonitor();
export const memoryManager = new MemoryManager();