# Storage Service Documentation

## Overview

The Storage Service provides an abstraction layer for persisting activities. It currently uses LocalStorage but can easily be switched to a backend API.

## Architecture

```
ActivityService (Business Logic)
        ↓
IStorageService (Interface)
        ↓
LocalStorageService OR BackendStorageService (Implementation)
```

## Current Implementation: LocalStorage

Activities are stored in the browser's LocalStorage with the key `gymparrot_activities`.

### Features:
- ✅ Automatic serialization/deserialization
- ✅ Metadata tracking (total activities, last updated, etc.)
- ✅ Full CRUD operations
- ✅ Persistent across browser sessions
- ✅ No backend required

### Limitations:
- Storage limited to ~5-10MB per domain
- Data is local to the browser (not synced across devices)
- No authentication or user management

## Switching to Backend Storage

To switch from LocalStorage to a backend API, follow these steps:

### 1. Update the export in `src/services/StorageService.ts`

**Current (LocalStorage):**
```typescript
export default new LocalStorageService();
```

**Change to (Backend API):**
```typescript
export default new BackendStorageService('https://your-api.com/api');
```

### 2. Implement the Backend API endpoints

The `BackendStorageService` expects these endpoints:

#### POST `/api/activities`
Create or update an activity
```typescript
Request Body: Activity
Response: { success: boolean }
```

#### GET `/api/activities/:id`
Get a single activity by ID
```typescript
Response: Activity | 404
```

#### GET `/api/activities`
Get all activities
```typescript
Response: Activity[]
```

#### DELETE `/api/activities/:id`
Delete an activity
```typescript
Response: { success: boolean }
```

### 3. Implement the Backend Methods

Update the placeholder methods in `BackendStorageService`:

```typescript
async saveActivity(activity: Activity): Promise<void> {
  const response = await fetch(`${this.apiBaseUrl}/activities`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${getAuthToken()}` // Add auth if needed
    },
    body: JSON.stringify(activity),
  });
  
  if (!response.ok) {
    throw new ActivityError('Failed to save activity', 'SAVE_FAILED');
  }
}

async getActivity(id: string): Promise<Activity | null> {
  const response = await fetch(`${this.apiBaseUrl}/activities/${id}`, {
    headers: {
      'Authorization': `Bearer ${getAuthToken()}`
    }
  });
  
  if (response.status === 404) return null;
  if (!response.ok) throw new ActivityError('Failed to get activity', 'GET_FAILED');
  
  const activity = await response.json();
  return {
    ...activity,
    createdAt: new Date(activity.createdAt) // Parse date
  };
}

async getAllActivities(): Promise<Activity[]> {
  const response = await fetch(`${this.apiBaseUrl}/activities`, {
    headers: {
      'Authorization': `Bearer ${getAuthToken()}`
    }
  });
  
  if (!response.ok) throw new ActivityError('Failed to load activities', 'LOAD_FAILED');
  
  const activities = await response.json();
  return activities.map((activity: any) => ({
    ...activity,
    createdAt: new Date(activity.createdAt)
  }));
}

async deleteActivity(id: string): Promise<void> {
  const response = await fetch(`${this.apiBaseUrl}/activities/${id}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${getAuthToken()}`
    }
  });
  
  if (!response.ok) throw new ActivityError('Failed to delete activity', 'DELETE_FAILED');
}
```

## Hybrid Approach (Optional)

You can also implement a hybrid approach that uses LocalStorage as a cache:

```typescript
export class HybridStorageService implements IStorageService {
  private localStorage = new LocalStorageService();
  private backendStorage = new BackendStorageService();

  async saveActivity(activity: Activity): Promise<void> {
    // Save to both
    await this.localStorage.saveActivity(activity);
    try {
      await this.backendStorage.saveActivity(activity);
    } catch (error) {
      console.warn('Backend save failed, using local cache', error);
    }
  }

  async getActivity(id: string): Promise<Activity | null> {
    // Try local first, then backend
    const local = await this.localStorage.getActivity(id);
    if (local) return local;
    
    return await this.backendStorage.getActivity(id);
  }

  // ... implement other methods
}
```

## Testing

The storage service is automatically tested through the ActivityService tests. No changes to tests are needed when switching storage backends.

## Migration

To migrate existing LocalStorage data to a backend:

```typescript
import storageService from './services/StorageService';
import { BackendStorageService } from './services/StorageService';

async function migrateToBackend() {
  const localService = new LocalStorageService();
  const backendService = new BackendStorageService('https://your-api.com/api');
  
  const activities = await localService.getAllActivities();
  
  for (const activity of activities) {
    await backendService.saveActivity(activity);
  }
  
  console.log(`Migrated ${activities.length} activities to backend`);
}
```

## Best Practices

1. **Always use the abstraction**: Import from `services/index.ts`, not directly from `StorageService.ts`
2. **Handle errors gracefully**: Storage operations can fail (network issues, quota exceeded, etc.)
3. **Consider offline support**: Implement a service worker or cache strategy for offline functionality
4. **Add authentication**: Secure your backend API with proper authentication
5. **Implement pagination**: For large datasets, implement pagination in the backend API
