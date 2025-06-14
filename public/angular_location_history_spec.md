# Angular Location History Implementation - Technical Specification

## Executive Summary
Implement location history visualization within your existing Angular 19.2.10 + PrimeNG + Google Maps architecture. This specification follows your established patterns: feature-based organization, service-driven state management, and PrimeNG component integration.

---

## Architecture Integration Strategy

### Feature Module Structure
Following your established directory patterns:

```typescript
src/app/features/location-history/
├── components/
│   ├── calendar-selector/
│   │   ├── calendar-selector.component.ts
│   │   ├── calendar-selector.component.html
│   │   └── calendar-selector.component.scss
│   ├── location-table/
│   │   ├── location-table.component.ts
│   │   ├── location-table.component.html
│   │   └── location-table.component.scss
│   └── history-map/
│       ├── history-map.component.ts
│       ├── history-map.component.html
│       └── history-map.component.scss
├── services/
│   ├── location-history.service.ts
│   └── location-cache.service.ts
├── models/
│   └── location-history.interface.ts
├── location-history-routing.module.ts
└── location-history.module.ts
```

### Core Data Models
```typescript
// src/app/features/location-history/models/location-history.interface.ts
export interface LocationPoint {
  utcTime: string;
  lat: number;
  lng: number;
  speed: number;
  alt: number;
  dir: number;
  timestamp: string;
  heading: number;
  info: any[];
}

export interface LocationHistoryQuery {
  targetId: number;
  year: number;
  month: number;
  day?: number;
}

export interface AvailableDatesResponse {
  data: number[];
  code: number;
  message: string;
}

export interface LocationDataResponse {
  data: LocationPoint[];
  code: number;
  message: string;
}

export interface CalendarDay {
  date: Date;
  day: number;
  hasData: boolean;
  isSelected: boolean;
  isCurrentMonth: boolean;
}
```

---

## Service Layer Architecture

### Primary Location History Service
```typescript
// src/app/features/location-history/services/location-history.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, combineLatest, of } from 'rxjs';
import { map, switchMap, catchError, tap, shareReplay } from 'rxjs/operators';
import { environment } from '../../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class LocationHistoryService {
  private readonly apiUrl = environment.apiUrl;
  
  // Reactive state management following your patterns
  private selectedDeviceSubject = new BehaviorSubject<number | null>(null);
  private selectedDateSubject = new BehaviorSubject<Date | null>(null);
  private availableDatesSubject = new BehaviorSubject<Map<string, number[]>>(new Map());
  private locationDataSubject = new BehaviorSubject<LocationPoint[]>([]);
  private loadingSubject = new BehaviorSubject<boolean>(false);

  // Public observables
  public selectedDevice$ = this.selectedDeviceSubject.asObservable();
  public selectedDate$ = this.selectedDateSubject.asObservable();
  public availableDates$ = this.availableDatesSubject.asObservable();
  public locationData$ = this.locationDataSubject.asObservable();
  public loading$ = this.loadingSubject.asObservable();

  constructor(
    private http: HttpClient,
    private cacheService: LocationCacheService
  ) {}

  /**
   * Get available dates for device and month
   * Implements caching strategy per your performance rules
   */
  getAvailableDates(targetId: number, year: number, month: number): Observable<number[]> {
    const cacheKey = `${targetId}-${year}-${month}`;
    
    // Check cache first
    const cached = this.cacheService.getAvailableDates(cacheKey);
    if (cached) {
      return of(cached);
    }

    this.loadingSubject.next(true);
    
    return this.http.post<AvailableDatesResponse>(`${this.apiUrl}/app/traxbean/playbackExist`, {
      targetId,
      year,
      month
    }).pipe(
      map(response => response.data),
      tap(dates => {
        // Update cache and state
        this.cacheService.setAvailableDates(cacheKey, dates);
        const currentMap = this.availableDatesSubject.value;
        currentMap.set(cacheKey, dates);
        this.availableDatesSubject.next(new Map(currentMap));
      }),
      catchError(error => {
        console.error('Error fetching available dates:', error);
        return of([]);
      }),
      tap(() => this.loadingSubject.next(false)),
      shareReplay(1)
    );
  }

  /**
   * Get location data for specific date
   * Implements intelligent prefetching per requirements
   */
  getLocationData(targetId: number, date: Date): Observable<LocationPoint[]> {
    const cacheKey = `${targetId}-${date.toDateString()}`;
    
    // Check cache first
    const cached = this.cacheService.getLocationData(cacheKey);
    if (cached) {
      this.locationDataSubject.next(cached);
      return of(cached);
    }

    this.loadingSubject.next(true);
    
    return this.http.post<LocationDataResponse>(`${this.apiUrl}/app/traxbean/playback`, {
      targetId,
      year: date.getFullYear(),
      month: date.getMonth() + 1,
      day: date.getDate()
    }).pipe(
      map(response => response.data),
      tap(locations => {
        // Update cache and state
        this.cacheService.setLocationData(cacheKey, locations);
        this.locationDataSubject.next(locations);
        
        // Prefetch adjacent dates for better UX
        this.prefetchAdjacentDates(targetId, date);
      }),
      catchError(error => {
        console.error('Error fetching location data:', error);
        this.locationDataSubject.next([]);
        return of([]);
      }),
      tap(() => this.loadingSubject.next(false)),
      shareReplay(1)
    );
  }

  /**
   * Set selected device and date
   */
  setSelectedDevice(deviceId: number): void {
    this.selectedDeviceSubject.next(deviceId);
  }

  setSelectedDate(date: Date): void {
    this.selectedDateSubject.next(date);
  }

  /**
   * Intelligent prefetching strategy
   */
  private prefetchAdjacentDates(targetId: number, currentDate: Date): void {
    const prefetchDays = [-1, 1]; // Previous and next day
    
    prefetchDays.forEach(offset => {
      const adjacentDate = new Date(currentDate);
      adjacentDate.setDate(adjacentDate.getDate() + offset);
      
      const cacheKey = `${targetId}-${adjacentDate.toDateString()}`;
      if (!this.cacheService.getLocationData(cacheKey)) {
        // Prefetch without updating UI state
        this.http.post<LocationDataResponse>(`${this.apiUrl}/app/traxbean/playback`, {
          targetId,
          year: adjacentDate.getFullYear(),
          month: adjacentDate.getMonth() + 1,
          day: adjacentDate.getDate()
        }).pipe(
          map(response => response.data),
          tap(locations => this.cacheService.setLocationData(cacheKey, locations)),
          catchError(() => of([]))
        ).subscribe();
      }
    });
  }
}
```

### Caching Service
```typescript
// src/app/features/location-history/services/location-cache.service.ts
import { Injectable } from '@angular/core';
import { LocationPoint } from '../models/location-history.interface';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

@Injectable({
  providedIn: 'root'
})
export class LocationCacheService {
  private readonly AVAILABLE_DATES_TTL = 3600000; // 1 hour
  private readonly LOCATION_DATA_TTL = 86400000;  // 24 hours
  private readonly MAX_CACHE_SIZE = 100;

  private availableDatesCache = new Map<string, CacheEntry<number[]>>();
  private locationDataCache = new Map<string, CacheEntry<LocationPoint[]>>();

  /**
   * Cache management with TTL and LRU eviction
   */
  getAvailableDates(key: string): number[] | null {
    return this.getCachedData(this.availableDatesCache, key);
  }

  setAvailableDates(key: string, data: number[]): void {
    this.setCachedData(this.availableDatesCache, key, data, this.AVAILABLE_DATES_TTL);
  }

  getLocationData(key: string): LocationPoint[] | null {
    return this.getCachedData(this.locationDataCache, key);
  }

  setLocationData(key: string, data: LocationPoint[]): void {
    this.setCachedData(this.locationDataCache, key, data, this.LOCATION_DATA_TTL);
  }

  private getCachedData<T>(cache: Map<string, CacheEntry<T>>, key: string): T | null {
    const entry = cache.get(key);
    if (!entry) return null;

    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      cache.delete(key);
      return null;
    }

    return entry.data;
  }

  private setCachedData<T>(
    cache: Map<string, CacheEntry<T>>, 
    key: string, 
    data: T, 
    ttl: number
  ): void {
    // LRU eviction if cache is full
    if (cache.size >= this.MAX_CACHE_SIZE) {
      const firstKey = cache.keys().next().value;
      cache.delete(firstKey);
    }

    cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    });
  }

  clearCache(): void {
    this.availableDatesCache.clear();
    this.locationDataCache.clear();
  }
}
```

---

## Component Implementation

### Smart Calendar Component
```typescript
// src/app/features/location-history/components/calendar-selector/calendar-selector.component.ts
import { Component, OnInit, OnDestroy, Input, Output, EventEmitter } from '@angular/core';
import { Subject, combineLatest } from 'rxjs';
import { takeUntil, distinctUntilChanged } from 'rxjs/operators';
import { LocationHistoryService } from '../../services/location-history.service';
import { CalendarDay } from '../../models/location-history.interface';

@Component({
  selector: 'app-calendar-selector',
  templateUrl: './calendar-selector.component.html',
  styleUrls: ['./calendar-selector.component.scss']
})
export class CalendarSelectorComponent implements OnInit, OnDestroy {
  @Input() targetId!: number;
  @Output() dateSelected = new EventEmitter<Date>();

  currentMonth = new Date();
  calendarDays: CalendarDay[] = [];
  loading$ = this.locationHistoryService.loading$;
  
  private destroy$ = new Subject<void>();

  constructor(private locationHistoryService: LocationHistoryService) {}

  ngOnInit(): void {
    this.initializeCalendar();
    this.subscribeToAvailableDates();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Initialize calendar grid with PrimeNG-compatible structure
   */
  private initializeCalendar(): void {
    this.generateCalendarDays();
    this.loadAvailableDates();
  }

  /**
   * Generate calendar days for current month
   */
  private generateCalendarDays(): void {
    const year = this.currentMonth.getFullYear();
    const month = this.currentMonth.getMonth();
    
    // Get first day of month and calculate grid
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());

    this.calendarDays = [];
    const currentDate = new Date(startDate);

    // Generate 42 days (6 weeks)
    for (let i = 0; i < 42; i++) {
      this.calendarDays.push({
        date: new Date(currentDate),
        day: currentDate.getDate(),
        hasData: false,
        isSelected: false,
        isCurrentMonth: currentDate.getMonth() === month
      });
      currentDate.setDate(currentDate.getDate() + 1);
    }
  }

  /**
   * Load available dates from API
   */
  private loadAvailableDates(): void {
    if (!this.targetId) return;

    const year = this.currentMonth.getFullYear();
    const month = this.currentMonth.getMonth() + 1;

    this.locationHistoryService.getAvailableDates(this.targetId, year, month)
      .pipe(takeUntil(this.destroy$))
      .subscribe(availableDays => {
        this.updateCalendarAvailability(availableDays);
      });
  }

  /**
   * Subscribe to available dates changes
   */
  private subscribeToAvailableDates(): void {
    this.locationHistoryService.availableDates$
      .pipe(
        takeUntil(this.destroy$),
        distinctUntilChanged()
      )
      .subscribe(availableDatesMap => {
        const year = this.currentMonth.getFullYear();
        const month = this.currentMonth.getMonth() + 1;
        const key = `${this.targetId}-${year}-${month}`;
        
        const availableDays = availableDatesMap.get(key);
        if (availableDays) {
          this.updateCalendarAvailability(availableDays);
        }
      });
  }

  /**
   * Update calendar days with data availability
   */
  private updateCalendarAvailability(availableDays: number[]): void {
    const availableSet = new Set(availableDays);
    
    this.calendarDays.forEach(day => {
      if (day.isCurrentMonth) {
        day.hasData = availableSet.has(day.day);
      }
    });
  }

  /**
   * Handle date selection
   */
  onDateSelect(day: CalendarDay): void {
    if (!day.hasData || !day.isCurrentMonth) return;

    // Update selection state
    this.calendarDays.forEach(d => d.isSelected = false);
    day.isSelected = true;

    // Emit selected date
    this.dateSelected.emit(day.date);
    this.locationHistoryService.setSelectedDate(day.date);
  }

  /**
   * Navigate between months
   */
  previousMonth(): void {
    this.currentMonth.setMonth(this.currentMonth.getMonth() - 1);
    this.initializeCalendar();
  }

  nextMonth(): void {
    this.currentMonth.setMonth(this.currentMonth.getMonth() + 1);
    this.initializeCalendar();
  }

  /**
   * Get month/year display string
   */
  get monthYearDisplay(): string {
    return this.currentMonth.toLocaleDateString('en-US', { 
      month: 'long', 
      year: 'numeric' 
    });
  }
}
```

### Location Data Table Component
```typescript
// src/app/features/location-history/components/location-table/location-table.component.ts
import { Component, OnInit, OnDestroy } from '@angular/core';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { LocationHistoryService } from '../../services/location-history.service';
import { LocationPoint } from '../../models/location-history.interface';

@Component({
  selector: 'app-location-table',
  templateUrl: './location-table.component.html',
  styleUrls: ['./location-table.component.scss']
})
export class LocationTableComponent implements OnInit, OnDestroy {
  locationData: LocationPoint[] = [];
  loading$ = this.locationHistoryService.loading$;
  
  // PrimeNG Table configuration
  rows = 25;
  totalRecords = 0;
  cols = [
    { field: 'utcTime', header: 'Time', sortable: true },
    { field: 'lat', header: 'Latitude', sortable: true },
    { field: 'lng', header: 'Longitude', sortable: true },
    { field: 'speed', header: 'Speed (km/h)', sortable: true },
    { field: 'heading', header: 'Direction', sortable: true }
  ];

  private destroy$ = new Subject<void>();

  constructor(private locationHistoryService: LocationHistoryService) {}

  ngOnInit(): void {
    this.subscribeToLocationData();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Subscribe to location data changes
   */
  private subscribeToLocationData(): void {
    this.locationHistoryService.locationData$
      .pipe(takeUntil(this.destroy$))
      .subscribe(data => {
        this.locationData = data.map(point => ({
          ...point,
          formattedTime: new Date(point.utcTime).toLocaleString(),
          speedKmh: Math.round(point.speed * 3.6), // Convert m/s to km/h
          directionText: this.getDirectionText(point.heading)
        }));
        this.totalRecords = this.locationData.length;
      });
  }

  /**
   * Convert heading to cardinal direction
   */
  private getDirectionText(heading: number): string {
    const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    const index = Math.round(heading / 45) % 8;
    return directions[index];
  }

  /**
   * Export to CSV functionality
   */
  exportToCsv(): void {
    const csvContent = this.generateCsvContent();
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `location-history-${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  }

  /**
   * Generate CSV content
   */
  private generateCsvContent(): string {
    const headers = this.cols.map(col => col.header).join(',');
    const rows = this.locationData.map(point => 
      `"${point.formattedTime}","${point.lat}","${point.lng}","${point.speedKmh}","${point.directionText}"`
    );
    
    return [headers, ...rows].join('\n');
  }
}
```

### Google Maps Integration Component
```typescript
// src/app/features/location-history/components/history-map/history-map.component.ts
import { Component, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { GoogleMap } from '@angular/google-maps';
import { Subject, combineLatest } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { LocationHistoryService } from '../../services/location-history.service';
import { LocationPoint } from '../../models/location-history.interface';

@Component({
  selector: 'app-history-map',
  templateUrl: './history-map.component.html',
  styleUrls: ['./history-map.component.scss']
})
export class HistoryMapComponent implements OnInit, OnDestroy {
  @ViewChild(GoogleMap) map!: GoogleMap;

  // Google Maps configuration
  center: google.maps.LatLngLiteral = { lat: 0, lng: 0 };
  zoom = 13;
  options: google.maps.MapOptions = {
    mapTypeId: 'roadmap',
    disableDefaultUI: false,
    clickableIcons: false,
    disableDoubleClickZoom: false,
  };

  // Map data
  markers: google.maps.MarkerOptions[] = [];
  polylineOptions: google.maps.PolylineOptions = {
    strokeColor: '#FF0000',
    strokeOpacity: 1.0,
    strokeWeight: 3,
  };
  polylinePath: google.maps.LatLngLiteral[] = [];

  loading$ = this.locationHistoryService.loading$;
  
  private destroy$ = new Subject<void>();

  constructor(private locationHistoryService: LocationHistoryService) {}

  ngOnInit(): void {
    this.subscribeToLocationData();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Subscribe to location data and update map
   */
  private subscribeToLocationData(): void {
    this.locationHistoryService.locationData$
      .pipe(takeUntil(this.destroy$))
      .subscribe(locations => {
        if (locations.length > 0) {
          this.updateMapData(locations);
          this.fitMapToBounds(locations);
        }
      });
  }

  /**
   * Update map markers and route
   */
  private updateMapData(locations: LocationPoint[]): void {
    // Create markers for start and end points
    this.markers = [];
    
    if (locations.length > 0) {
      // Start marker
      this.markers.push({
        position: { lat: locations[0].lat, lng: locations[0].lng },
        title: `Start: ${new Date(locations[0].utcTime).toLocaleTimeString()}`,
        icon: {
          url: 'assets/icons/start-marker.png',
          scaledSize: new google.maps.Size(32, 32)
        }
      });

      // End marker (if different from start)
      if (locations.length > 1) {
        const lastLocation = locations[locations.length - 1];
        this.markers.push({
          position: { lat: lastLocation.lat, lng: lastLocation.lng },
          title: `End: ${new Date(lastLocation.utcTime).toLocaleTimeString()}`,
          icon: {
            url: 'assets/icons/end-marker.png',
            scaledSize: new google.maps.Size(32, 32)
          }
        });
      }
    }

    // Create polyline path
    this.polylinePath = locations.map(location => ({
      lat: location.lat,
      lng: location.lng
    }));

    // Update map center
    if (locations.length > 0) {
      this.center = { lat: locations[0].lat, lng: locations[0].lng };
    }
  }

  /**
   * Fit map bounds to show all location points
   */
  private fitMapToBounds(locations: LocationPoint[]): void {
    if (locations.length === 0) return;

    const bounds = new google.maps.LatLngBounds();
    locations.forEach(location => {
      bounds.extend({ lat: location.lat, lng: location.lng });
    });

    // Use timeout to ensure map is rendered
    setTimeout(() => {
      if (this.map.googleMap) {
        this.map.googleMap.fitBounds(bounds);
        
        // Ensure minimum zoom level
        const listener = this.map.googleMap.addListener('bounds_changed', () => {
          if (this.map.googleMap!.getZoom()! > 18) {
            this.map.googleMap!.setZoom(18);
          }
          google.maps.event.removeListener(listener);
        });
      }
    }, 100);
  }

  /**
   * Calculate total distance traveled
   */
  getTotalDistance(): string {
    if (this.polylinePath.length < 2) return '0 km';

    let totalDistance = 0;
    for (let i = 1; i < this.polylinePath.length; i++) {
      const distance = this.calculateDistance(
        this.polylinePath[i - 1],
        this.polylinePath[i]
      );
      totalDistance += distance;
    }

    return `${(totalDistance / 1000).toFixed(2)} km`;
  }

  /**
   * Calculate distance between two points using Haversine formula
   */
  private calculateDistance(point1: google.maps.LatLngLiteral, point2: google.maps.LatLngLiteral): number {
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
}
```

---

## Module Configuration

### Feature Module
```typescript
// src/app/features/location-history/location-history.module.ts
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GoogleMapsModule } from '@angular/google-maps';

// PrimeNG modules
import { TableModule } from 'primeng/table';
import { CalendarModule } from 'primeng/calendar';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { ProgressBarModule } from 'primeng/progressbar';
import { TooltipModule } from 'primeng/tooltip';

import { LocationHistoryRoutingModule } from './location-history-routing.module';
import { CalendarSelectorComponent } from './components/calendar-selector/calendar-selector.component';
import { LocationTableComponent } from './components/location-table/location-table.component';
import { HistoryMapComponent } from './components/history-map/history-map.component';
import { LocationHistoryPageComponent } from './location-history-page.component';

@NgModule({
  declarations: [
    CalendarSelectorComponent,
    LocationTableComponent,
    HistoryMapComponent,
    LocationHistoryPageComponent
  ],
  imports: [
    CommonModule,
    GoogleMapsModule,
    LocationHistoryRoutingModule,
    // PrimeNG modules
    TableModule,
    CalendarModule,
    ButtonModule,
    CardModule,
    ProgressBarModule,
    TooltipModule
  ]
})
export class LocationHistoryModule { }
```

### Routing Module
```typescript
// src/app/features/location-history/location-history-routing.module.ts
import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { LocationHistoryPageComponent } from './location-history-page.component';
import { AuthGuard } from '../../core/guards/auth.guard';

const routes: Routes = [
  {
    path: '',
    component: LocationHistoryPageComponent,
    canActivate: [AuthGuard]
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class LocationHistoryRoutingModule { }
```

---

## Integration with App Module

### Lazy Loading Configuration
```typescript
// src/app/app-routing.module.ts
const routes: Routes = [
  // ... existing routes
  {
    path: 'location-history',
    loadChildren: () => import('./features/location-history/location-history.module')
      .then(m => m.LocationHistoryModule),
    canActivate: [AuthGuard]
  }
];
```

### Environment Configuration
```typescript
// src/environments/environment.ts
export const environment = {
  production: false,
  apiUrl: 'https://napi.5gcity.com',
  googleMapsApiKey: 'YOUR_GOOGLE_MAPS_API_KEY'
};
```

---

## Implementation Strategy & Timeline

### Phase 1: Service Layer Foundation (Week 1)
- [ ] Create location history service with RxJS patterns
- [ ] Implement caching service with TTL management
- [ ] Set up data models and interfaces
- [ ] Add HTTP interceptor integration
- [ ] Unit test service layer (>90% coverage)

### Phase 2: Calendar Component (Week 2)
- [ ] Build smart calendar with PrimeNG styling
- [ ] Implement data availability visualization
- [ ] Add month navigation with prefetching
- [ ] Integrate with accessibility standards
- [ ] Mobile-responsive design testing

### Phase 3: Data Table Component (Week 3)
- [ ] Implement PrimeNG table with virtual scrolling
- [ ] Add sorting, filtering, and pagination
- [ ] Build CSV export functionality
- [ ] Performance optimization for large datasets
- [ ] Component unit tests

### Phase 4: Google Maps Integration (Week 4)
- [ ] Integrate @angular/google-maps wrapper
- [ ] Implement route visualization with polylines
- [ ] Add marker clustering for dense data
- [ ] Build map controls and interaction handlers
- [ ] Distance calculation and analytics

### Phase 5: Integration & Optimization (Week 5)
- [ ] Page component integration
- [ ] Error boundary implementation
- [ ] Performance profiling and optimization
- [ ] E2E testing with Protractor/Cypress
- [ ] Production deployment preparation

---

## Performance Optimization Strategies

### RxJS Optimization Patterns
```typescript
// Efficient subscription management
private readonly destroy$ = new Subject<void>();

// Combine multiple observables efficiently
combineLatest([
  this.locationHistoryService.selectedDevice$,
  this.locationHistoryService.selectedDate$
]).pipe(
  takeUntil(this.destroy$),
  debounceTime(300),
  distinctUntilChanged(),
  switchMap(([deviceId, date]) => 
    this.locationHistoryService.getLocationData(deviceId, date)
  )
).subscribe();
```

### Change Detection Optimization
```typescript
@Component({
  selector: 'app-location-table',
  changeDetection: ChangeDetectionStrategy.OnPush
})
```

### Bundle Optimization
- Lazy load feature module
- Tree-shake unused PrimeNG components
- Implement virtual scrolling for large datasets
- Use OnPush change detection strategy

This implementation follows your established Angular patterns while delivering enterprise-grade location history visualization with optimal performance and maintainability.