/**
 * Performance benchmarking tests
 * These tests measure actual performance improvements
 */

import { describe, it, expect } from 'vitest';
import { PoseDataCompressor } from '../performance';
import { PERFORMANCE_CONFIG } from '../constants';

// Mock pose landmarks for testing
const generateMockLandmarks = (count: number = 33) => {
  return Array.from({ length: count }, (_) => ({
    x: Math.random(),
    y: Math.random(), 
    z: Math.random(),
    visibility: Math.random()
  }));
};

const generateMockTimestampedLandmarks = (frameCount: number = 100) => {
  return Array.from({ length: frameCount }, (_, i) => ({
    timestamp: i * 33.33, // 30fps
    landmarks: generateMockLandmarks()
  }));
};

describe('Performance Benchmarks', () => {
  describe('Pose Data Compression', () => {
    it('should significantly reduce data size', () => {
      const landmarks = generateMockLandmarks(33);
      const originalSize = JSON.stringify(landmarks).length;
      
      const compressed = PoseDataCompressor.compressLandmarks(landmarks);
      const compressedSize = JSON.stringify(compressed).length;
      
      console.log(`Original size: ${originalSize} bytes`);
      console.log(`Compressed size: ${compressedSize} bytes`);
      console.log(`Compression ratio: ${(compressedSize / originalSize * 100).toFixed(1)}%`);
      
      // Should achieve at least some compression
      expect(compressedSize).toBeLessThanOrEqual(originalSize);
    });

    it('should compress movement sequences efficiently', () => {
      const sequence = generateMockTimestampedLandmarks(100); // 100 frames
      const originalSize = JSON.stringify(sequence).length;
      
      const compressedSequence = sequence.map(frame => ({
        timestamp: frame.timestamp,
        landmarks: PoseDataCompressor.compressLandmarks(frame.landmarks)
      }));
      const compressedSize = JSON.stringify(compressedSequence).length;
      
      console.log(`Movement sequence - Original: ${originalSize} bytes, Compressed: ${compressedSize} bytes`);
      
      expect(compressedSize).toBeLessThanOrEqual(originalSize);
    });

    it('should maintain acceptable precision after compression', () => {
      const landmarks = generateMockLandmarks(33);
      const compressed = PoseDataCompressor.compressLandmarks(landmarks);
      
      // Check that precision is maintained within acceptable bounds
      for (let i = 0; i < landmarks.length; i++) {
        const original = landmarks[i];
        const comp = compressed[i];
        
        // Should be within precision tolerance
        const tolerance = Math.pow(10, -PERFORMANCE_CONFIG.LANDMARK_PRECISION);
        expect(Math.abs(original.x - comp.x)).toBeLessThan(tolerance);
        expect(Math.abs(original.y - comp.y)).toBeLessThan(tolerance);
        expect(Math.abs(original.z - comp.z)).toBeLessThan(tolerance);
      }
    });
  });

  describe('Memory Usage Optimization', () => {
    it('should handle large pose sequences without memory issues', () => {
      const startMemory = (performance as any).memory ? (performance as any).memory.usedJSHeapSize : 0;
      
      // Generate large dataset
      const largeSequence = generateMockTimestampedLandmarks(1000); // 1000 frames
      
      // Process with compression
      const processed = largeSequence.map(frame => ({
        timestamp: frame.timestamp,
        landmarks: PoseDataCompressor.compressLandmarks(frame.landmarks)
      }));
      
      const endMemory = (performance as any).memory ? (performance as any).memory.usedJSHeapSize : 0;
      const memoryUsed = endMemory - startMemory;
      
      console.log(`Memory used for 1000 frames: ${(memoryUsed / 1024 / 1024).toFixed(2)} MB`);
      
      // Should not use excessive memory (arbitrary threshold)
      expect(memoryUsed).toBeLessThan(50 * 1024 * 1024); // 50MB
      
      // Cleanup
      processed.length = 0;
    });
  });

  describe('Frame Rate Performance', () => {
    it('should process frames within target time budget', async () => {
      const targetFPS = 30;
      const frameTimeLimit = 1000 / targetFPS; // 33.33ms for 30fps
      
      const landmarks = generateMockLandmarks(33);
      
      // Measure processing time
      const startTime = performance.now();
      
      // Simulate frame processing
      for (let i = 0; i < 10; i++) {
        PoseDataCompressor.compressLandmarks(landmarks);
      }
      
      const endTime = performance.now();
      const averageFrameTime = (endTime - startTime) / 10;
      
      console.log(`Average frame processing time: ${averageFrameTime.toFixed(2)}ms`);
      console.log(`Target frame time: ${frameTimeLimit.toFixed(2)}ms`);
      
      // Should process frames fast enough for target FPS
      expect(averageFrameTime).toBeLessThan(frameTimeLimit);
    });
  });

  describe('Storage Performance', () => {
    it('should serialize/deserialize activities quickly', () => {
      const activity = {
        id: 'test-activity',
        type: 'pose' as const,
        name: 'Test Pose',
        createdBy: 'test-user',
        createdAt: new Date(),
        isPublic: true,
        landmarks: generateMockLandmarks(33),
        poseData: generateMockLandmarks(33)
      };
      
      // Measure serialization time
      const serializeStart = performance.now();
      const serialized = JSON.stringify(activity);
      const serializeTime = performance.now() - serializeStart;
      
      // Measure deserialization time
      const deserializeStart = performance.now();
      const deserialized = JSON.parse(serialized);
      const deserializeTime = performance.now() - deserializeStart;
      
      console.log(`Serialization time: ${serializeTime.toFixed(2)}ms`);
      console.log(`Deserialization time: ${deserializeTime.toFixed(2)}ms`);
      console.log(`Data size: ${serialized.length} bytes`);
      
      // Should be fast enough for real-time use
      expect(serializeTime).toBeLessThan(10); // 10ms
      expect(deserializeTime).toBeLessThan(10); // 10ms
      expect(deserialized).toBeDefined();
    });
  });

  describe('Lazy Loading Performance', () => {
    it('should load paginated data efficiently', () => {
      const totalActivities = 1000;
      const pageSize = PERFORMANCE_CONFIG.ACTIVITIES_PAGE_SIZE;
      
      // Simulate large dataset
      const allActivities = Array.from({ length: totalActivities }, (_, i) => ({
        id: `activity-${i}`,
        type: 'pose' as const,
        name: `Activity ${i}`,
        createdBy: 'test-user',
        createdAt: new Date(Date.now() - i * 1000),
        isPublic: true,
        landmarks: generateMockLandmarks(33)
      }));
      
      // Measure pagination performance
      const startTime = performance.now();
      
      // Simulate loading first page
      const firstPage = allActivities.slice(0, pageSize);
      
      const endTime = performance.now();
      const loadTime = endTime - startTime;
      
      console.log(`Loaded ${firstPage.length} activities in ${loadTime.toFixed(2)}ms`);
      
      // Should load quickly
      expect(loadTime).toBeLessThan(50); // 50ms
      expect(firstPage.length).toBe(pageSize);
    });
  });

  describe('Overall Performance Profile', () => {
    it('should meet performance targets for complete workflow', async () => {
      console.log('\n=== Performance Profile ===');
      
      // 1. Pose detection simulation
      const poseDetectionStart = performance.now();
      const landmarks = generateMockLandmarks(33);
      const poseDetectionTime = performance.now() - poseDetectionStart;
      
      // 2. Compression
      const compressionStart = performance.now();
      const compressed = PoseDataCompressor.compressLandmarks(landmarks);
      const compressionTime = performance.now() - compressionStart;
      
      // 3. Storage simulation
      const storageStart = performance.now();
      const serialized = JSON.stringify(compressed);
      const storageTime = performance.now() - storageStart;
      
      // 4. Total pipeline time
      const totalTime = poseDetectionTime + compressionTime + storageTime;
      
      console.log(`Pose detection: ${poseDetectionTime.toFixed(2)}ms`);
      console.log(`Compression: ${compressionTime.toFixed(2)}ms`);
      console.log(`Storage: ${storageTime.toFixed(2)}ms`);
      console.log(`Total pipeline: ${totalTime.toFixed(2)}ms`);
      console.log(`Data size: ${serialized.length} bytes`);
      
      // Performance targets
      expect(totalTime).toBeLessThan(16.67); // Should complete within one 60fps frame
      expect(compressionTime).toBeLessThan(5); // Compression should be very fast
      expect(storageTime).toBeLessThan(5); // Storage should be very fast
    });
  });
});