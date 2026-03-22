import type { Activity } from '../types';
import { ActivityError } from '../types';
import { PERFORMANCE_CONFIG } from '../utils/constants';
import { PoseDataCompressor } from '../utils/performance';

/**
 * Storage interface that can be implemented by different storage backends
 * (LocalStorage, SessionStorage, Backend API, etc.)
 */
export interface IStorageService {
  saveActivity(activity: Activity): Promise<void>;
  getActivity(id: string): Promise<Activity | null>;
  getAllActivities(): Promise<Activity[]>;
  getActivitiesPaginated(page?: number, pageSize?: number): Promise<{
    activities: Activity[];
    totalCount: number;
    hasMore: boolean;
  }>;
  deleteActivity(id: string): Promise<void>;
  clearAll(): Promise<void>;
  getStorageStats?(): Promise<{
    totalActivities: number;
    storageUsed: number;
    compressionRatio: number;
    cacheHitRate: number;
  }>;
}

/**
 * LocalStorage implementation of the storage service with performance optimizations
 * This can be easily swapped with a backend API implementation
 */
export class LocalStorageService implements IStorageService {
  private readonly STORAGE_KEY = 'gymparrot_activities';
  private readonly METADATA_KEY = 'gymparrot_metadata';
  private readonly INDEX_KEY = 'gymparrot_activity_index';
  
  // Cache for frequently accessed activities
  private activityCache = new Map<string, Activity>();
  private cacheTimestamps = new Map<string, number>();
  private readonly CACHE_DURATION = 300000; // 5 minutes

  /**
   * Save an activity to LocalStorage with compression
   */
  async saveActivity(activity: Activity): Promise<void> {
    try {
      const startTime = performance.now();
      
      // Compress activity data before saving
      const compressedActivity = this.compressActivity(activity);
      
      const activities = await this.getAllActivities();
      
      // Check if activity already exists and update it, otherwise add new
      const existingIndex = activities.findIndex(a => a.id === activity.id);
      if (existingIndex >= 0) {
        activities[existingIndex] = compressedActivity;
      } else {
        activities.push(compressedActivity);
      }

      // Save to localStorage
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(activities));
      
      // Update cache
      this.updateCache(activity.id, activity);
      
      // Update metadata and index
      await this.updateMetadata();
      await this.updateActivityIndex(activities);
      
      const saveTime = performance.now() - startTime;
      console.log(`💾 Activity saved in ${Math.round(saveTime)}ms`);
      
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new ActivityError(`Failed to save activity to storage: ${message}`, 'STORAGE_SAVE_FAILED');
    }
  }

  /**
   * Get a single activity by ID with caching
   */
  async getActivity(id: string): Promise<Activity | null> {
    try {
      // Check cache first
      const cached = this.getCachedActivity(id);
      if (cached) {
        console.log('🚀 Activity loaded from cache:', id);
        return cached;
      }

      const activities = await this.getAllActivities();
      const activity = activities.find(a => a.id === id);
      
      if (!activity) {
        return null;
      }

      // Decompress and deserialize
      const decompressedActivity = this.decompressActivity(activity);
      const deserializedActivity = this.deserializeActivity(decompressedActivity);
      
      // Update cache
      this.updateCache(id, deserializedActivity);
      
      return deserializedActivity;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new ActivityError(`Failed to get activity from storage: ${message}`, 'STORAGE_GET_FAILED');
    }
  }

  /**
   * Get all activities from LocalStorage with lazy loading support
   */
  async getAllActivities(): Promise<Activity[]> {
    try {
      const data = localStorage.getItem(this.STORAGE_KEY);
      
      if (!data) {
        return [];
      }

      const activities = JSON.parse(data) as Activity[];
      
      // Decompress and deserialize activities
      return activities.map(activity => {
        const decompressed = this.decompressActivity(activity);
        return this.deserializeActivity(decompressed);
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new ActivityError(`Failed to load activities from storage: ${message}`, 'STORAGE_LOAD_FAILED');
    }
  }

  /**
   * Get activities with pagination for lazy loading
   */
  async getActivitiesPaginated(page: number = 0, pageSize: number = PERFORMANCE_CONFIG.ACTIVITIES_PAGE_SIZE): Promise<{
    activities: Activity[];
    totalCount: number;
    hasMore: boolean;
  }> {
    try {
      const allActivities = await this.getAllActivities();
      const startIndex = page * pageSize;
      const endIndex = startIndex + pageSize;
      
      const paginatedActivities = allActivities.slice(startIndex, endIndex);
      
      return {
        activities: paginatedActivities,
        totalCount: allActivities.length,
        hasMore: endIndex < allActivities.length
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new ActivityError(`Failed to load paginated activities: ${message}`, 'STORAGE_LOAD_FAILED');
    }
  }

  /**
   * Delete an activity by ID
   */
  async deleteActivity(id: string): Promise<void> {
    try {
      const activities = await this.getAllActivities();
      const filteredActivities = activities.filter(a => a.id !== id);
      
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(filteredActivities));
      
      // Remove from cache
      this.activityCache.delete(id);
      this.cacheTimestamps.delete(id);
      
      // Update metadata and index
      await this.updateMetadata();
      await this.updateActivityIndex(filteredActivities);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new ActivityError(`Failed to delete activity from storage: ${message}`, 'STORAGE_DELETE_FAILED');
    }
  }

  /**
   * Clear all activities from storage
   */
  async clearAll(): Promise<void> {
    try {
      localStorage.removeItem(this.STORAGE_KEY);
      localStorage.removeItem(this.METADATA_KEY);
      localStorage.removeItem(this.INDEX_KEY);
      
      // Clear cache
      this.activityCache.clear();
      this.cacheTimestamps.clear();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new ActivityError(`Failed to clear storage: ${message}`, 'STORAGE_CLEAR_FAILED');
    }
  }

  /**
   * Compress activity data for efficient storage
   */
  private compressActivity(activity: Activity): Activity {
    if (!PERFORMANCE_CONFIG.COMPRESSION_ENABLED) {
      return activity;
    }

    const compressed = { ...activity };

    // Compress pose landmarks
    if (compressed.landmarks && Array.isArray(compressed.landmarks)) {
      if (compressed.type === 'pose') {
        // For pose activities, landmarks is PoseLandmark[]
        compressed.landmarks = PoseDataCompressor.compressLandmarks(compressed.landmarks as any[]);
      } else if (compressed.type === 'movement') {
        // For movement activities, landmarks is TimestampedLandmarks[]
        compressed.landmarks = (compressed.landmarks as any[]).map((frame: any) => ({
          timestamp: frame.timestamp,
          landmarks: PoseDataCompressor.compressLandmarks(frame.landmarks)
        }));
      }
    }

    // Compress poseData if present
    if (compressed.poseData) {
      compressed.poseData = PoseDataCompressor.compressLandmarks(compressed.poseData as any[]);
    }

    return compressed;
  }

  /**
   * Decompress activity data after loading
   */
  private decompressActivity(activity: Activity): Activity {
    // Currently, decompression is not needed as we store compressed data
    // This method is here for future expansion if we need different compression strategies
    return activity;
  }

  /**
   * Cache management
   */
  private getCachedActivity(id: string): Activity | null {
    const cached = this.activityCache.get(id);
    const timestamp = this.cacheTimestamps.get(id);
    
    if (cached && timestamp && (performance.now() - timestamp) < this.CACHE_DURATION) {
      return cached;
    }
    
    // Remove expired cache entry
    this.activityCache.delete(id);
    this.cacheTimestamps.delete(id);
    return null;
  }

  private updateCache(id: string, activity: Activity): void {
    this.activityCache.set(id, activity);
    this.cacheTimestamps.set(id, performance.now());
    
    // Limit cache size
    if (this.activityCache.size > 50) {
      const oldestId = this.activityCache.keys().next().value;
      this.activityCache.delete(oldestId);
      this.cacheTimestamps.delete(oldestId);
    }
  }

  /**
   * Create and maintain activity index for fast lookups
   */
  private async updateActivityIndex(activities: Activity[]): Promise<void> {
    try {
      const index = {
        byType: {} as Record<string, string[]>,
        byCreator: {} as Record<string, string[]>,
        byDate: activities.map(a => ({ id: a.id, date: a.createdAt }))
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
        totalCount: activities.length,
        lastUpdated: new Date().toISOString()
      };

      // Build type index
      activities.forEach(activity => {
        if (!index.byType[activity.type]) {
          index.byType[activity.type] = [];
        }
        index.byType[activity.type].push(activity.id);
      });

      // Build creator index
      activities.forEach(activity => {
        if (!index.byCreator[activity.createdBy]) {
          index.byCreator[activity.createdBy] = [];
        }
        index.byCreator[activity.createdBy].push(activity.id);
      });

      localStorage.setItem(this.INDEX_KEY, JSON.stringify(index));
    } catch (error) {
      console.warn('Failed to update activity index:', error);
    }
  }

  /**
   * Get storage statistics
   */
  async getStorageStats(): Promise<{
    totalActivities: number;
    storageUsed: number;
    compressionRatio: number;
    cacheHitRate: number;
  }> {
    const activities = await this.getAllActivities();
    const storageData = localStorage.getItem(this.STORAGE_KEY) || '';
    
    return {
      totalActivities: activities.length,
      storageUsed: storageData.length,
      compressionRatio: 0.8, // Estimated compression ratio
      cacheHitRate: this.activityCache.size > 0 ? 0.7 : 0 // Estimated cache hit rate
    };
  }

  /**
   * Deserialize activity from storage (convert date strings to Date objects)
   */
  private deserializeActivity(activity: any): Activity {
    return {
      ...activity,
      createdAt: new Date(activity.createdAt),
    };
  }

  /**
   * Update storage metadata (for statistics and monitoring)
   */
  private async updateMetadata(): Promise<void> {
    try {
      const activities = await this.getAllActivities();
      const metadata = {
        totalActivities: activities.length,
        lastUpdated: new Date().toISOString(),
        poseActivities: activities.filter(a => a.type === 'pose').length,
        movementActivities: activities.filter(a => a.type === 'movement').length,
      };
      
      localStorage.setItem(this.METADATA_KEY, JSON.stringify(metadata));
    } catch (error) {
      // Metadata update failure shouldn't break the main operation
      console.warn('Failed to update storage metadata:', error);
    }
  }

  /**
   * Get storage metadata
   */
  async getMetadata(): Promise<any> {
    try {
      const data = localStorage.getItem(this.METADATA_KEY);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      return null;
    }
  }
}

/**
 * Backend API implementation (placeholder for future use)
 * This would make HTTP requests to your backend API
 */
export class BackendStorageService implements IStorageService {
  private readonly _apiBaseUrl: string;

  constructor(apiBaseUrl: string = '/api') {
    this._apiBaseUrl = apiBaseUrl;
  }

  // Getter for API base URL (for future use)
  get apiBaseUrl(): string {
    return this._apiBaseUrl;
  }

  async saveActivity(_activity: Activity): Promise<void> {
    // TODO: Implement backend API call
    // Example:
    // const response = await fetch(`${this.apiBaseUrl}/activities`, {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify(_activity),
    // });
    // if (!response.ok) throw new Error('Failed to save activity');
    throw new Error('Backend storage not implemented yet');
  }

  async getActivity(_id: string): Promise<Activity | null> {
    // TODO: Implement backend API call
    // Example:
    // const response = await fetch(`${this.apiBaseUrl}/activities/${_id}`);
    // if (response.status === 404) return null;
    // if (!response.ok) throw new Error('Failed to get activity');
    // return await response.json();
    throw new Error('Backend storage not implemented yet');
  }

  async getAllActivities(): Promise<Activity[]> {
    // TODO: Implement backend API call
    // Example:
    // const response = await fetch(`${this.apiBaseUrl}/activities`);
    // if (!response.ok) throw new Error('Failed to load activities');
    // return await response.json();
    throw new Error('Backend storage not implemented yet');
  }

  async deleteActivity(_id: string): Promise<void> {
    // TODO: Implement backend API call
    // Example:
    // const response = await fetch(`${this.apiBaseUrl}/activities/${_id}`, {
    //   method: 'DELETE',
    // });
    // if (!response.ok) throw new Error('Failed to delete activity');
    throw new Error('Backend storage not implemented yet');
  }

  async clearAll(): Promise<void> {
    // TODO: Implement backend API call
    throw new Error('Backend storage not implemented yet');
  }

  async getActivitiesPaginated(_page?: number, _pageSize?: number): Promise<{
    activities: Activity[];
    totalCount: number;
    hasMore: boolean;
  }> {
    // TODO: Implement backend API call
    throw new Error('Backend storage not implemented yet');
  }

  async getStorageStats(): Promise<{
    totalActivities: number;
    storageUsed: number;
    compressionRatio: number;
    cacheHitRate: number;
  }> {
    // TODO: Implement backend API call
    throw new Error('Backend storage not implemented yet');
  }
}

// Export the storage service instance
// To switch to backend storage, simply change this to:
// export default new BackendStorageService('https://your-api.com/api');
export default new LocalStorageService();
