import type { Activity } from '../types';
import { ActivityError } from '../types';

/**
 * Storage interface that can be implemented by different storage backends
 * (LocalStorage, SessionStorage, Backend API, etc.)
 */
export interface IStorageService {
  saveActivity(activity: Activity): Promise<void>;
  getActivity(id: string): Promise<Activity | null>;
  getAllActivities(): Promise<Activity[]>;
  deleteActivity(id: string): Promise<void>;
  clearAll(): Promise<void>;
}

/**
 * LocalStorage implementation of the storage service
 * This can be easily swapped with a backend API implementation
 */
export class LocalStorageService implements IStorageService {
  private readonly STORAGE_KEY = 'gymparrot_activities';
  private readonly METADATA_KEY = 'gymparrot_metadata';

  /**
   * Save an activity to LocalStorage
   */
  async saveActivity(activity: Activity): Promise<void> {
    try {
      const activities = await this.getAllActivities();
      
      // Check if activity already exists and update it, otherwise add new
      const existingIndex = activities.findIndex(a => a.id === activity.id);
      if (existingIndex >= 0) {
        activities[existingIndex] = activity;
      } else {
        activities.push(activity);
      }

      // Save to localStorage
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(activities));
      
      // Update metadata
      await this.updateMetadata();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new ActivityError(`Failed to save activity to storage: ${message}`, 'STORAGE_SAVE_FAILED');
    }
  }

  /**
   * Get a single activity by ID
   */
  async getActivity(id: string): Promise<Activity | null> {
    try {
      const activities = await this.getAllActivities();
      const activity = activities.find(a => a.id === id);
      
      if (!activity) {
        return null;
      }

      // Parse dates back to Date objects
      return this.deserializeActivity(activity);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new ActivityError(`Failed to get activity from storage: ${message}`, 'STORAGE_GET_FAILED');
    }
  }

  /**
   * Get all activities from LocalStorage
   */
  async getAllActivities(): Promise<Activity[]> {
    try {
      const data = localStorage.getItem(this.STORAGE_KEY);
      
      if (!data) {
        return [];
      }

      const activities = JSON.parse(data) as Activity[];
      
      // Parse dates back to Date objects
      return activities.map(activity => this.deserializeActivity(activity));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new ActivityError(`Failed to load activities from storage: ${message}`, 'STORAGE_LOAD_FAILED');
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
      
      // Update metadata
      await this.updateMetadata();
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
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new ActivityError(`Failed to clear storage: ${message}`, 'STORAGE_CLEAR_FAILED');
    }
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
}

// Export the storage service instance
// To switch to backend storage, simply change this to:
// export default new BackendStorageService('https://your-api.com/api');
export default new LocalStorageService();
