import { Injectable, signal, computed, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { 
  Observable, 
  BehaviorSubject, 
  combineLatest, 
  of, 
  EMPTY,
  timer,
  merge
} from 'rxjs';
import { 
  map, 
  switchMap, 
  catchError, 
  tap, 
  shareReplay, 
  debounceTime,
  distinctUntilChanged,
  retry,
  timeout,
  finalize
} from 'rxjs/operators';
import { toSignal } from '@angular/core/rxjs-interop';
import { environment } from '../../../../environments/environment';
import { LocationCacheService } from './location-cache.service';
import {
  LocationPoint,
  EnhancedLocationPoint,
  LocationHistoryQuery,
  DateRangeQuery,
  AvailableDatesResponse,
  LocationDataResponse,
  LocationHistoryState,
  LocationStatistics,
  DeviceInfo,
  LocationHistoryError,
  AsyncState
} from '../models/location-history.interface';

/**
 * Location History Service with Angular 19 Signals
 * Implements reactive state management and intelligent caching
 */
@Injectable({
  providedIn: 'root'
})
export class LocationHistoryService {
  private readonly http = inject(HttpClient);
  private readonly cacheService = inject(LocationCacheService);
  private readonly apiUrl = environment.apiUrl;

  // Traditional BehaviorSubjects for complex state management
  private readonly selectedDeviceSubject = new BehaviorSubject<number | null>(null);
  private readonly selectedDateSubject = new BehaviorSubject<Date | null>(null);
  private readonly availableDatesSubject = new BehaviorSubject<Map<string, number[]>>(new Map());
  private readonly locationDataSubject = new BehaviorSubject<LocationPoint[]>([]);
  private readonly loadingSubject = new BehaviorSubject<boolean>(false);
  private readonly errorSubject = new BehaviorSubject<string | null>(null);

  // Angular 19 Signals for reactive state
  private readonly _devices = signal<DeviceInfo[]>([]);
  private readonly _statistics = signal<LocationStatistics | null>(null);
  private readonly _lastUpdated = signal<Date | null>(null);

  // Convert Observables to Signals using toSignal
  public readonly selectedDevice = toSignal(this.selectedDeviceSubject.asObservable());
  public readonly selectedDate = toSignal(this.selectedDateSubject.asObservable());
  public readonly locationData = toSignal(this.locationDataSubject.asObservable(), { initialValue: [] });
  public readonly loading = toSignal(this.loadingSubject.asObservable(), { initialValue: false });
  public readonly error = toSignal(this.errorSubject.asObservable());

  // Computed signals for derived state
  public readonly devices = computed(() => this._devices());
  public readonly statistics = computed(() => this._statistics());
  public readonly lastUpdated = computed(() => this._lastUpdated());
  
  public readonly hasData = computed(() => this.locationData().length > 0);
  public readonly isReady = computed(() => 
    this.selectedDevice() !== null && this.selectedDate() !== null
  );

  // Enhanced location data with computed properties
  public readonly enhancedLocationData = computed(() => {
    const data = this.locationData();
    return this.enhanceLocationData(data);
  });

  // Public observables for backward compatibility
  public readonly selectedDevice$ = this.selectedDeviceSubject.asObservable();
  public readonly selectedDate$ = this.selectedDateSubject.asObservable();
  public readonly availableDates$ = this.availableDatesSubject.asObservable();
  public readonly locationData$ = this.locationDataSubject.asObservable();
  public readonly loading$ = this.loadingSubject.asObservable();
  public readonly error$ = this.errorSubject.asObservable();

  // Combined state observable
  public readonly state$ = combineLatest([
    this.selectedDevice$,
    this.selectedDate$,
    this.locationData$,
    this.loading$,
    this.error$
  ]).pipe(
    map(([device, date, data, loading, error]) => ({
      selectedDevice: device,
      selectedDate: date,
      locationData: data,
      loading,
      error,
      hasData: data.length > 0,
      isReady: device !== null && date !== null
    })),
    shareReplay(1)
  );

  constructor() {
    this.initializeDevices();
  }

  /**
   * Get available dates for device and month with caching
   */
  getAvailableDates(targetId: number, year: number, month: number): Observable<number[]> {
    const cacheKey = `${targetId}-${year}-${month}`;
    
    // Check cache first
    const cached = this.cacheService.getAvailableDates(cacheKey);
    if (cached) {
      this.updateAvailableDatesState(cacheKey, cached);
      return of(cached);
    }

    this.setLoading(true);
    this.clearError();
    
    return this.http.post<AvailableDatesResponse>(
      `${this.apiUrl}/app/traxbean/playbackExist`,
      { targetId, year, month }
    ).pipe(
      timeout(10000), // 10 second timeout
      retry({ count: 2, delay: 1000 }), // Retry twice with 1 second delay
      map(response => {
        if (response.code !== 200) {
          throw new Error(response.message || 'Failed to fetch available dates');
        }
        return response.data || [];
      }),
      tap(dates => {
        // Update cache and state
        this.cacheService.setAvailableDates(cacheKey, dates);
        this.updateAvailableDatesState(cacheKey, dates);
      }),
      catchError(error => {
        this.handleError('Failed to load available dates', error);
        return of([]);
      }),
      finalize(() => this.setLoading(false)),
      shareReplay(1)
    );
  }

  /**
   * Get location data for specific date with intelligent caching
   */
  getLocationData(targetId: number, date: Date): Observable<LocationPoint[]> {
    const cacheKey = `${targetId}-${date.toDateString()}`;
    
    // Check cache first
    const cached = this.cacheService.getLocationData(cacheKey);
    if (cached) {
      this.updateLocationDataState(cached);
      return of(cached);
    }

    this.setLoading(true);
    this.clearError();
    
    return this.http.post<LocationDataResponse>(
      `${this.apiUrl}/app/traxbean/playback`,
      {
        targetId,
        year: date.getFullYear(),
        month: date.getMonth() + 1,
        day: date.getDate()
      }
    ).pipe(
      timeout(15000), // 15 second timeout for location data
      retry({ count: 2, delay: 2000 }),
      map(response => {
        if (response.code !== 200) {
          throw new Error(response.message || 'Failed to fetch location data');
        }
        return response.data || [];
      }),
      tap(locations => {
        // Update cache and state
        this.cacheService.setLocationData(cacheKey, locations);
        this.updateLocationDataState(locations);
        this.updateStatistics(locations);
        this._lastUpdated.set(new Date());
        
        // Prefetch adjacent dates for better UX
        this.prefetchAdjacentDates(targetId, date);
      }),
      catchError(error => {
        this.handleError('Failed to load location data', error);
        this.updateLocationDataState([]);
        return of([]);
      }),
      finalize(() => this.setLoading(false)),
      shareReplay(1)
    );
  }

  /**
   * Get location data for date range (Angular 19 modern API)
   */
  getLocationDataRange(query: DateRangeQuery): Observable<LocationPoint[]> {
    this.setLoading(true);
    this.clearError();

    return this.http.post<LocationDataResponse>(
      `${this.apiUrl}/app/traxbean/tracking`,
      query
    ).pipe(
      timeout(20000),
      retry({ count: 2, delay: 2000 }),
      map(response => {
        if (response.code !== 200) {
          throw new Error(response.message || 'Failed to fetch location data');
        }
        return response.data || [];
      }),
      tap(locations => {
        this.updateLocationDataState(locations);
        this.updateStatistics(locations);
        this._lastUpdated.set(new Date());
      }),
      catchError(error => {
        this.handleError('Failed to load location data range', error);
        return of([]);
      }),
      finalize(() => this.setLoading(false)),
      shareReplay(1)
    );
  }

  /**
   * Set selected device
   */
  setSelectedDevice(deviceId: number | null): void {
    this.selectedDeviceSubject.next(deviceId);
    this.clearError();
  }

  /**
   * Set selected date
   */
  setSelectedDate(date: Date | null): void {
    this.selectedDateSubject.next(date);
    this.clearError();
  }

  /**
   * Load devices list
   */
  loadDevices(): Observable<DeviceInfo[]> {
    // This would typically call an API endpoint
    // For now, returning mock data
    const mockDevices: DeviceInfo[] = [
      {
        id: 1,
        name: 'Device 001',
        type: 'GPS Tracker',
        lastSeen: new Date(),
        isOnline: true,
        batteryLevel: 85
      },
      {
        id: 2,
        name: 'Device 002',
        type: 'Mobile Phone',
        lastSeen: new Date(Date.now() - 3600000),
        isOnline: false,
        batteryLevel: 42
      }
    ];

    this._devices.set(mockDevices);
    return of(mockDevices);
  }

  /**
   * Clear all data and reset state
   */
  clearData(): void {
    this.selectedDeviceSubject.next(null);
    this.selectedDateSubject.next(null);
    this.locationDataSubject.next([]);
    this.availableDatesSubject.next(new Map());
    this._statistics.set(null);
    this._lastUpdated.set(null);
    this.clearError();
    this.cacheService.clearAll();
  }

  /**
   * Refresh current data
   */
  refreshData(): Observable<LocationPoint[]> {
    const device = this.selectedDevice();
    const date = this.selectedDate();
    
    if (!device || !date) {
      return EMPTY;
    }

    // Clear cache for current selection
    const cacheKey = `${device}-${date.toDateString()}`;
    this.cacheService.clearAll(); // Force refresh
    
    return this.getLocationData(device, date);
  }

  // Private helper methods

  private enhanceLocationData(data: LocationPoint[]): EnhancedLocationPoint[] {
    return data.map((point, index) => {
      const enhanced: EnhancedLocationPoint = {
        ...point,
        formattedTime: new Date(point.utcTime).toLocaleString(),
        speedKmh: Math.round(point.speed * 3.6), // Convert m/s to km/h
        directionText: this.getDirectionText(point.heading)
      };

      // Calculate distance from previous point
      if (index > 0) {
        const prevPoint = data[index - 1];
        enhanced.distanceFromPrevious = this.calculateDistance(
          { lat: prevPoint.lat, lng: prevPoint.lng },
          { lat: point.lat, lng: point.lng }
        );
      }

      return enhanced;
    });
  }

  private getDirectionText(heading: number): string {
    const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    const index = Math.round(heading / 45) % 8;
    return directions[index];
  }

  private calculateDistance(
    point1: { lat: number; lng: number },
    point2: { lat: number; lng: number }
  ): number {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = point1.lat * Math.PI / 180;
    const φ2 = point2.lat * Math.PI / 180;
    const Δφ = (point2.lat - point1.lat) * Math.PI / 180;
    const Δλ = (point2.lng - point1.lng) * Math.PI / 180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c;
  }

  private updateStatistics(locations: LocationPoint[]): void {
    if (locations.length === 0) {
      this._statistics.set(null);
      return;
    }

    const enhanced = this.enhanceLocationData(locations);
    const speeds = enhanced.map(p => p.speedKmh).filter(s => s > 0);
    const distances = enhanced.map(p => p.distanceFromPrevious || 0);
    
    const totalDistance = distances.reduce((sum, d) => sum + d, 0);
    const maxSpeed = speeds.length > 0 ? Math.max(...speeds) : 0;
    const averageSpeed = speeds.length > 0 ? speeds.reduce((sum, s) => sum + s, 0) / speeds.length : 0;
    
    const startTime = new Date(locations[0].utcTime);
    const endTime = new Date(locations[locations.length - 1].utcTime);
    const duration = endTime.getTime() - startTime.getTime();

    // Calculate bounds
    const lats = locations.map(l => l.lat);
    const lngs = locations.map(l => l.lng);
    const bounds = new google.maps.LatLngBounds(
      { lat: Math.min(...lats), lng: Math.min(...lngs) },
      { lat: Math.max(...lats), lng: Math.max(...lngs) }
    );

    this._statistics.set({
      totalPoints: locations.length,
      totalDistance,
      maxSpeed,
      averageSpeed,
      duration,
      startTime,
      endTime,
      bounds
    });
  }

  private prefetchAdjacentDates(targetId: number, currentDate: Date): void {
    const prefetchDays = [-1, 1]; // Previous and next day
    
    prefetchDays.forEach(offset => {
      const adjacentDate = new Date(currentDate);
      adjacentDate.setDate(adjacentDate.getDate() + offset);
      
      const cacheKey = `${targetId}-${adjacentDate.toDateString()}`;
      if (!this.cacheService.hasLocationData(cacheKey)) {
        // Prefetch without updating UI state
        timer(1000).pipe( // Delay prefetch to not interfere with current request
          switchMap(() => this.http.post<LocationDataResponse>(
            `${this.apiUrl}/app/traxbean/playback`,
            {
              targetId,
              year: adjacentDate.getFullYear(),
              month: adjacentDate.getMonth() + 1,
              day: adjacentDate.getDate()
            }
          )),
          map(response => response.data || []),
          tap(locations => this.cacheService.setLocationData(cacheKey, locations)),
          catchError(() => of([]))
        ).subscribe();
      }
    });
  }

  private updateAvailableDatesState(cacheKey: string, dates: number[]): void {
    const currentMap = this.availableDatesSubject.value;
    currentMap.set(cacheKey, dates);
    this.availableDatesSubject.next(new Map(currentMap));
  }

  private updateLocationDataState(locations: LocationPoint[]): void {
    this.locationDataSubject.next(locations);
  }

  private setLoading(loading: boolean): void {
    this.loadingSubject.next(loading);
  }

  private clearError(): void {
    this.errorSubject.next(null);
  }

  private handleError(message: string, error: any): void {
    console.error(message, error);
    this.errorSubject.next(message);
  }

  private initializeDevices(): void {
    this.loadDevices().subscribe();
  }
}