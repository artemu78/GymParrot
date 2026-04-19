import { expect, afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";
import * as matchers from "@testing-library/jest-dom/matchers";

// Extend Vitest's expect with testing-library matchers
expect.extend(matchers);

// Mock IntersectionObserver for tests
global.IntersectionObserver = vi.fn().mockImplementation(function (
  this: unknown,
  _callback: IntersectionObserverCallback,
) {
  return {
    observe: vi.fn(),
    disconnect: vi.fn(),
    unobserve: vi.fn(),
  };
}) as unknown as typeof IntersectionObserver;

// Mock ResizeObserver for tests
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  disconnect: vi.fn(),
  unobserve: vi.fn(),
}));

// Mock performance.memory for tests
Object.defineProperty(performance, 'memory', {
  value: {
    usedJSHeapSize: 1024 * 1024, // 1MB
    totalJSHeapSize: 10 * 1024 * 1024, // 10MB
    jsHeapSizeLimit: 100 * 1024 * 1024, // 100MB
  },
  writable: true,
});

// Mock MediaStream API for webcam tests
global.MediaStream = vi.fn().mockImplementation(() => ({
  getTracks: vi.fn(() => []),
  getVideoTracks: vi.fn(() => []),
  getAudioTracks: vi.fn(() => []),
}));

// Mock getUserMedia
Object.defineProperty(navigator, 'mediaDevices', {
  value: {
    getUserMedia: vi.fn(),
  },
  writable: true,
});

// Mock HTMLVideoElement properties
Object.defineProperty(HTMLVideoElement.prototype, 'videoWidth', {
  value: 640,
  writable: true,
});

Object.defineProperty(HTMLVideoElement.prototype, 'videoHeight', {
  value: 480,
  writable: true,
});

Object.defineProperty(HTMLVideoElement.prototype, 'readyState', {
  value: 4, // HAVE_ENOUGH_DATA
  writable: true,
});

// Mock canvas toDataURL
HTMLCanvasElement.prototype.toDataURL = vi.fn(() => 'data:image/jpeg;base64,mockdata');

// Mock requestAnimationFrame and cancelAnimationFrame
global.requestAnimationFrame = vi.fn((callback: FrameRequestCallback) => {
  return setTimeout(() => callback(performance.now()), 16) as unknown as number; // ~60fps
}) as unknown as typeof requestAnimationFrame;

global.cancelAnimationFrame = vi.fn((id: number) => {
  clearTimeout(id as unknown as NodeJS.Timeout);
});

// Cleanup after each test case
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
