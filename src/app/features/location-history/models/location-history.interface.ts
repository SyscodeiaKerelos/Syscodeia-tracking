// Core location point interface
export interface LocationPoint {
  utcTime: string;
  lat: number;
  lng: number;
  speed: number;
  alt: number;
  dir: number;
  timestamp: string;
  heading: number;
  info: unknown[];
}

// Enhanced location point with computed properties
export interface EnhancedLocationPoint extends LocationPoint {
  formattedTime: string;
  speedKmh: number;
  directionText: string;
  distanceFromPrevious?: number;
}

// API request interfaces
export interface LocationHistoryQuery {
  targetId: number;
  year: number;
  month: number;
  day?: number;
}

export interface DateRangeQuery {
  deviceId: string;
  fromDate: string; // ISO 8601 format
  toDate: string;   // ISO 8601 format
}

// API response interfaces
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

// Calendar component interfaces
export interface CalendarDay {
  date: Date;
  day: number;
  hasData: boolean;
  isSelected: boolean;
  isCurrentMonth: boolean;
  isToday?: boolean;
  isWeekend?: boolean;
}

export interface CalendarMonth {
  year: number;
  month: number;
  days: CalendarDay[];
  availableDates: Set<number>;
}

// Map component interfaces
export interface MapMarker {
  position: google.maps.LatLngLiteral;
  title: string;
  icon?: google.maps.Icon | google.maps.Symbol | string;
  type: 'start' | 'end' | 'waypoint' | 'stop';
  timestamp?: string;
  speed?: number;
}

export interface MapRoute {
  path: google.maps.LatLngLiteral[];
  options: google.maps.PolylineOptions;
  distance: number;
  duration: number;
}

// Table component interfaces
export interface TableColumn {
  field: keyof EnhancedLocationPoint;
  header: string;
  sortable: boolean;
  type?: 'text' | 'number' | 'date' | 'speed' | 'direction';
  width?: string;
  format?: (value: unknown) => string;
}

export interface TableExportOptions {
  filename: string;
  format: 'csv' | 'json' | 'excel';
  includeHeaders: boolean;
  dateRange?: {
    start: Date;
    end: Date;
  };
}

// Cache interfaces
export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
  accessCount: number;
  lastAccessed: number;
}

export interface CacheConfig {
  maxSize: number;
  defaultTtl: number;
  cleanupInterval: number;
  enableMetrics: boolean;
}

export interface CacheMetrics {
  hits: number;
  misses: number;
  evictions: number;
  size: number;
  hitRate: number;
}

// Service state interfaces
export interface LocationHistoryState {
  selectedDevice: number | null;
  selectedDate: Date | null;
  availableDates: Map<string, number[]>;
  locationData: LocationPoint[];
  loading: boolean;
  error: string | null;
  lastUpdated: Date | null;
}

// View mode and UI state
export type ViewMode = 'map' | 'table' | 'split';

export interface UIState {
  viewMode: ViewMode;
  sidebarCollapsed: boolean;
  mapFullscreen: boolean;
  tablePageSize: number;
  selectedLocationIndex: number | null;
}

// Analytics and statistics
export interface LocationStatistics {
  totalPoints: number;
  totalDistance: number;
  maxSpeed: number;
  averageSpeed: number;
  duration: number;
  startTime: Date;
  endTime: Date;
  bounds: google.maps.LatLngBounds;
}

// Device information
export interface DeviceInfo {
  id: number;
  name: string;
  type: string;
  lastSeen: Date;
  isOnline: boolean;
  batteryLevel?: number;
}

// Error handling
export interface LocationHistoryError {
  code: string;
  message: string;
  details?: unknown;
  timestamp: Date;
  retryable: boolean;
}

// Utility types for Angular 19
export type LoadingState = 'idle' | 'loading' | 'success' | 'error';

export interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  lastUpdated: Date | null;
}

// Signal-based state for Angular 19
export interface LocationHistorySignals {
  selectedDevice: number | null;
  selectedDate: Date | null;
  locationData: LocationPoint[];
  loading: boolean;
  error: string | null;
  statistics: LocationStatistics | null;
}

// Modern TypeScript utility types
export type PartialLocationPoint = Partial<LocationPoint>;
export type RequiredLocationFields = Required<Pick<LocationPoint, 'lat' | 'lng' | 'utcTime'>>;
export type LocationPointUpdate = Partial<LocationPoint> & RequiredLocationFields;

// Event types for component communication
export interface LocationSelectedEvent {
  location: LocationPoint;
  index: number;
  source: 'map' | 'table';
}

export interface DateSelectedEvent {
  date: Date;
  hasData: boolean;
  source: 'calendar' | 'navigation';
}

export interface ViewModeChangedEvent {
  previousMode: ViewMode;
  newMode: ViewMode;
  timestamp: Date;
}