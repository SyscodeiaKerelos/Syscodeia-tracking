import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, forkJoin, map, switchMap, catchError, of } from 'rxjs';
import { environment } from '../../../environments/environment';
import { UserService } from './user.service';

// API Response interface
export interface ApiResponse<T> {
  data: T;
  code: number;
  message: string;
}

// Device interfaces based on actual API response
export interface DeviceApiData {
  id: number;
  firstName: string;
  lastName: string;
  targetType: number;
  lat: string | number; // API returns as string
  lng: string | number; // API returns as string
  utcTime: string;
  utcTimestamp: string;
  battery: number;
  strap: number | null;
  avatar: string;
  icon?: string;
  imei?: string;
  model?: string;
  statusUtctimestamp?: string;
  serverUrl?: string;
}

export interface LocationApiData {
  utcTime: string;
  lat: number;
  lng: number;
  speed: number;
  alt: number;
  dir: number;
  timestamp: string;
  utc: number;
  heading: number;
  info: any[];
}

export interface DeviceInfoApiData {
  id: number;
  firstName: string;
  lastName: string;
  imei: string;
  lat: number;
  lng: number;
  battery: number;
  strap: number;
  signal: number;
  heartrate: number;
  bloodoxygen: number;
  temperature: number;
  steps: number;
  systolic: number;
  diastolic: number;
  avatar: string;
  utcTimestamp: string;
}

export interface IndoorLocationApiData {
  x: number;
  y: number;
  utcTime: string;
  utcTimestamp: string;
  siteName: string;
  floorName: string;
  map: string;
  height: number;
  width: number;
}

// Our internal interfaces
export interface Device {
  id: string;
  name: string;
  type?: string;
  status?: string;
  lastSeen?: Date;
  targetId?: string;
  userId?: string;
  battery?: number;
  avatar?: string;
}

export interface DeviceLocation {
  deviceId: string;
  latitude: number;
  longitude: number;
  timestamp: Date;
  accuracy?: number;
  speed?: number;
  heading?: number;
  targetId?: string;
  altitude?: number;
  direction?: number;
}

export interface DeviceWithLocation extends Device {
  location?: DeviceLocation;
}

@Injectable({
  providedIn: 'root'
})
export class DeviceService {
  private readonly API_BASE_URL = environment.traxbeanApiUrl;

  constructor(
    private http: HttpClient,
    private userService: UserService
  ) {}

    getDevices(userId?: number): Observable<Device[]> {
    const payload = {
      type: 0,
      userId: userId || this.userService.getUserIdAsNumber() || 1
    };


    
    return this.http.post<ApiResponse<DeviceApiData[]>>(`${this.API_BASE_URL}/app/traxbean/listTarget`, payload)
      .pipe(
        map(response => {
          // Check if API call was successful
          if (response.code !== 200) {
            throw new Error(response.message || 'Failed to fetch devices');
          }
          
          // Transform API response to our Device interface
          if (response.data && Array.isArray(response.data)) {
            return response.data.map((item: DeviceApiData) => ({
              id: item.id.toString(),
              name: `${item.firstName} ${item.lastName}`.trim(),
              type: this.getDeviceTypeString(item.targetType),
              status: this.getDeviceStatus(item.statusUtctimestamp || item.utcTimestamp),
              lastSeen: new Date(item.utcTime),
              targetId: item.id.toString(),
              userId: (userId || this.userService.getUserIdAsNumber() || 1).toString(),
              battery: item.battery,
              avatar: item.avatar || item.icon
            }));
          }
          return [];
        })
      );
  }

  getDeviceLocation(targetId: string): Observable<DeviceLocation> {
    const now = new Date();
    const startTime = new Date(now.getTime() - 60 * 60 * 1000); // 1 hour ago for recent data
    
    const payload = {
      targetId: parseInt(targetId),
      startTime: startTime.toISOString(),
      endTime: now.toISOString()
    };

    return this.http.post<ApiResponse<LocationApiData[]>>(`${this.API_BASE_URL}/app/traxbean/tracking`, payload)
      .pipe(
        map(response => {
          // Check if API call was successful
          if (response.code !== 200) {
            throw new Error(response.message || `Failed to get location for device ${targetId}`);
          }
          
          // Get the latest location from tracking data
          if (response.data && Array.isArray(response.data) && response.data.length > 0) {
            const latestPoint = response.data[response.data.length - 1];
            return {
              deviceId: targetId,
              latitude: latestPoint.lat,
              longitude: latestPoint.lng,
              timestamp: new Date(latestPoint.utcTime),
              speed: latestPoint.speed,
              heading: latestPoint.heading,
              targetId: targetId,
              altitude: latestPoint.alt,
              direction: latestPoint.dir
            };
          }
          throw new Error(`No location data found for device ${targetId}`);
        })
      );
  }

  // New method to extract location directly from device data
  private extractLocationFromDevice(device: DeviceApiData): DeviceLocation | null {
    // Check if device has valid coordinates
    if (device.lat && device.lng) {
      const lat = typeof device.lat === 'string' ? parseFloat(device.lat) : device.lat;
      const lng = typeof device.lng === 'string' ? parseFloat(device.lng) : device.lng;
      
      // Validate coordinates
      if (!isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0) {
        return {
          deviceId: device.id.toString(),
          latitude: lat,
          longitude: lng,
          timestamp: new Date(device.utcTime),
          targetId: device.id.toString()
        };
      }
    }
    return null;
  }

    getAllDevicesWithLocations(): Observable<DeviceWithLocation[]> {
    const payload = {
      type: 0,
      userId: this.userService.getUserIdAsNumber() || 1
    };
    
    return this.http.post<ApiResponse<DeviceApiData[]>>(`${this.API_BASE_URL}/app/traxbean/listTarget`, payload)
      .pipe(
        map(response => {
          // Check if API call was successful
          if (response.code !== 200) {
            throw new Error(response.message || 'Failed to fetch devices');
          }
          
          // Transform API response to our DeviceWithLocation interface
          if (response.data && Array.isArray(response.data)) {
            return response.data.map((item: DeviceApiData) => {
              const device: Device = {
                id: item.id.toString(),
                name: `${item.firstName} ${item.lastName}`.trim(),
                type: this.getDeviceTypeString(item.targetType),
                status: this.getDeviceStatus(item.statusUtctimestamp || item.utcTimestamp),
                lastSeen: new Date(item.utcTime),
                targetId: item.id.toString(),
                userId: (this.userService.getUserIdAsNumber() || 1).toString(),
                battery: item.battery,
                avatar: item.avatar || item.icon
              };
              
              // Extract location directly from device data
              const location = this.extractLocationFromDevice(item) || undefined;
              
              return { ...device, location };
            });
          }
          return [];
        })
      );
  }

  getDeviceInfo(targetId: string): Observable<DeviceInfoApiData> {
    const payload = { targetId: parseInt(targetId) };
    return this.http.post<ApiResponse<DeviceInfoApiData[]>>(`${this.API_BASE_URL}/app/traxbean/getTargetInfo`, payload)
      .pipe(
        map(response => {
          if (response.code !== 200) {
            throw new Error(response.message || 'Failed to get device info');
          }
          if (response.data && Array.isArray(response.data) && response.data.length > 0) {
            return response.data[0];
          }
          throw new Error(`No device info found for ${targetId}`);
        })
      );
  }

  getIndoorLocation(targetId: string): Observable<IndoorLocationApiData> {
    const payload = { targetId: parseInt(targetId) };
    return this.http.post<ApiResponse<IndoorLocationApiData>>(`${this.API_BASE_URL}/app/traxbean/getGeoLocationLK`, payload)
      .pipe(
        map(response => {
          if (response.code !== 200) {
            throw new Error(response.message || 'Failed to get indoor location');
          }
          return response.data;
        })
      );
  }

  // Historical data methods based on API specification
  checkPlaybackAvailability(targetId: string, year: number, month: number): Observable<number[]> {
    const payload = { targetId: parseInt(targetId), year, month };
    return this.http.post<ApiResponse<number[]>>(`${this.API_BASE_URL}/app/traxbean/playbackExist`, payload)
      .pipe(
        map(response => {
          if (response.code !== 200) {
            throw new Error(response.message || 'Failed to check playback availability');
          }
          return response.data || [];
        })
      );
  }

  getPlaybackData(targetId: string, year: number, month: number, day: number): Observable<LocationApiData[]> {
    const payload = { targetId: parseInt(targetId), year, month, day };
    return this.http.post<ApiResponse<LocationApiData[]>>(`${this.API_BASE_URL}/app/traxbean/playback`, payload)
      .pipe(
        map(response => {
          if (response.code !== 200) {
            throw new Error(response.message || 'Failed to get playback data');
          }
          return response.data || [];
        })
      );
  }

  // Helper methods
  private getDeviceTypeString(targetType: number): string {
    const types: { [key: number]: string } = {
      1: 'Wearable',
      2: 'Vehicle',
      3: 'Asset',
      4: 'Mobile'
    };
    return types[targetType] || 'Device';
  }

  private getDeviceStatus(utcTimestamp: string): string {
    const lastUpdate = new Date(parseInt(utcTimestamp));
    const now = new Date();
    const diffMinutes = (now.getTime() - lastUpdate.getTime()) / (1000 * 60);
    
    if (diffMinutes < 5) return 'online';
    if (diffMinutes < 30) return 'recent';
    return 'offline';
  }
} 