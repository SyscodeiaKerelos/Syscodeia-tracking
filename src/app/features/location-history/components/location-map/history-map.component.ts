import { 
  Component, 
  OnInit, 
  OnDestroy, 
  ViewChild, 
  ElementRef,
  signal, 
  computed, 
  effect, 
  inject,
  input,
  output
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { GoogleMapsModule, MapInfoWindow } from '@angular/google-maps';
import { ButtonModule } from 'primeng/button';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { TooltipModule } from 'primeng/tooltip';
import { TagModule } from 'primeng/tag';
import { Subject, takeUntil } from 'rxjs';
import { LocationHistoryService } from '../../services/location-history.service';
import { 
  LocationPoint, 
  EnhancedLocationPoint } from '../../models/location-history.interface';

// Map component internal interfaces
interface MapMarkerData {
  position: google.maps.LatLngLiteral;
  title: string;
  options: google.maps.MarkerOptions;
  data: EnhancedLocationPoint;
}

interface MapPolylineData {
  path: google.maps.LatLngLiteral[];
  options: google.maps.PolylineOptions;
}

/**
 * History Map Component with Angular 19 Signals
 * Displays location data on Google Maps with markers, polylines, and interactive features
 */
@Component({
  selector: 'app-history-map',
  standalone: true,
  imports: [
    CommonModule,
    GoogleMapsModule,
    ButtonModule,
    ProgressSpinnerModule,
    TooltipModule,
    TagModule
  ],
  template: `
    <div class="history-map-container">
      <!-- Map Header -->
      <div class="map-header mb-4">
        <div class="flex flex-wrap align-items-center justify-content-between gap-3">
          <div class="flex align-items-center gap-3">
            <h3 class="text-xl font-semibold text-gray-800 m-0">
              Location Map
              <span class="text-sm font-normal text-gray-500 ml-2" *ngIf="totalPoints()">
                ({{ totalPoints() }} points)
              </span>
            </h3>
            <p-tag 
              *ngIf="selectedDate()" 
              [value]="formatSelectedDate()" 
              severity="info" 
              icon="pi pi-calendar">
            </p-tag>
          </div>
          
          <div class="flex align-items-center gap-2">
            <!-- Map Controls -->
            <button 
              pButton 
              type="button" 
              icon="pi pi-search-plus" 
              class="p-button-outlined p-button-sm"
              (click)="fitMapToBounds()"
              [disabled]="!hasData() || loading()"
              pTooltip="Fit to bounds"
              tooltipPosition="top">
            </button>
            
            <button 
              pButton 
              type="button" 
              [icon]="showPolyline() ? 'pi pi-eye-slash' : 'pi pi-eye'"
              class="p-button-outlined p-button-sm"
              (click)="togglePolyline()"
              [disabled]="!hasData() || loading()"
              [pTooltip]="showPolyline() ? 'Hide path' : 'Show path'"
              tooltipPosition="top">
            </button>
            
            <button 
              pButton 
              type="button" 
              [icon]="showMarkers() ? 'pi pi-map-marker' : 'pi pi-circle'"
              class="p-button-outlined p-button-sm"
              (click)="toggleMarkers()"
              [disabled]="!hasData() || loading()"
              [pTooltip]="showMarkers() ? 'Hide markers' : 'Show markers'"
              tooltipPosition="top">
            </button>
            
            <button 
              pButton 
              type="button" 
              icon="pi pi-refresh" 
              class="p-button-outlined p-button-sm"
              (click)="refreshMap()"
              [loading]="loading()"
              [disabled]="!canRefresh()"
              pTooltip="Refresh map"
              tooltipPosition="top">
            </button>
          </div>
        </div>
      </div>

      <!-- Map Container -->
      <div class="map-wrapper" [class.loading]="loading()">
        <google-map
          #googleMap
          [height]="mapHeight()"
          [width]="'100%'"
          [center]="mapCenter()"
          [zoom]="mapZoom()"
          [options]="mapOptions"
          (mapClick)="onMapClick($event)"
          (mapRightclick)="onMapRightClick($event)"
          *ngIf="!loading() && hasData(); else loadingTemplate">
          
          <!-- Polyline for path -->
          <map-polyline
            *ngIf="showPolyline() && polylineData()"
            [path]="polylineData()?.path || []"
            [options]="polylineOptions">
          </map-polyline>
          
          <!-- Markers for location points -->
          <ng-container *ngIf="showMarkers()">
            <map-marker
              *ngFor="let marker of visibleMarkers(); trackBy: trackByMarker; let i = index"
              [position]="marker.position"
              [title]="marker.title"
              [options]="marker.options"
              (mapClick)="onMarkerClick(marker, i)"
              #mapMarker>
            </map-marker>
          </ng-container>
          
          <!-- Start marker -->
          <map-marker
            *ngIf="startMarker()"
            [position]="startMarker()!.position"
            [title]="startMarker()!.title"
            [options]="startMarkerOptions"
            (mapClick)="onStartMarkerClick()"
            #startMapMarker>
          </map-marker>
          
          <!-- End marker -->
          <map-marker
            *ngIf="endMarker()"
            [position]="endMarker()!.position"
            [title]="endMarker()!.title"
            [options]="endMarkerOptions"
            (mapClick)="onEndMarkerClick()"
            #endMapMarker>
          </map-marker>
          
          <!-- Info Window -->
          <map-info-window
            #infoWindow
            [options]="infoWindowOptions">
            <div class="info-window-content" *ngIf="selectedMarkerData()">
              <div class="font-semibold text-gray-800 mb-2">
                {{ selectedMarkerData()?.title }}
              </div>
              <div class="space-y-1 text-sm">
                <div class="flex justify-content-between">
                  <span class="text-gray-600">Time:</span>
                  <span class="font-medium">{{ formatMarkerTime(selectedMarkerData()?.data) }}</span>
                </div>
                <div class="flex justify-content-between">
                  <span class="text-gray-600">Coordinates:</span>
                  <span class="font-medium font-mono text-xs">
                    {{ formatCoordinates(selectedMarkerData()?.position) }}
                  </span>
                </div>
                <div class="flex justify-content-between" *ngIf="selectedMarkerData()?.data?.speedKmh">
                  <span class="text-gray-600">Speed:</span>
                  <span class="font-medium">{{ selectedMarkerData()?.data?.speedKmh }} km/h</span>
                </div>
                <div class="flex justify-content-between" *ngIf="selectedMarkerData()?.data?.directionText">
                  <span class="text-gray-600">Direction:</span>
                  <span class="font-medium">{{ selectedMarkerData()?.data?.directionText }}</span>
                </div>
                <div class="flex justify-content-between" *ngIf="selectedMarkerData()?.data?.altitude">
                  <span class="text-gray-600">Altitude:</span>
                  <span class="font-medium">{{ selectedMarkerData()?.data?.altitude }} m</span>
                </div>
              </div>
              <div class="mt-3 pt-2 border-top-1 border-gray-200">
                <button 
                  pButton 
                  type="button" 
                  label="Copy Coordinates" 
                  icon="pi pi-copy" 
                  class="p-button-text p-button-sm w-full"
                  (click)="copyMarkerCoordinates()">
                </button>
              </div>
            </div>
          </map-info-window>
        </google-map>

        <!-- Loading Template -->
        <ng-template #loadingTemplate>
          <div class="map-loading" [style.height]="mapHeight()">
            <div class="loading-content" *ngIf="loading()">
              <p-progressSpinner 
                [style]="{ width: '50px', height: '50px' }"
                strokeWidth="4"
                animationDuration="1s">
              </p-progressSpinner>
              <p class="text-gray-600 mt-3">Loading map data...</p>
            </div>
            
            <!-- No Data Template -->
            <div class="no-data-content" *ngIf="!loading() && !hasData()">
              <i class="pi pi-map text-6xl text-gray-300 mb-4"></i>
              <h4 class="text-gray-600 mb-2">No Location Data</h4>
              <p class="text-gray-500">
                {{ getNoDataMessage() }}
              </p>
            </div>
          </div>
        </ng-template>
      </div>

      <!-- Map Statistics -->
      <div class="map-statistics mt-4" *ngIf="hasData() && statistics()">
        <div class="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div class="stat-item">
            <div class="stat-value">{{ formatDistance(statistics()?.totalDistance || 0) }}</div>
            <div class="stat-label">Total Distance</div>
          </div>
          <div class="stat-item">
            <div class="stat-value">{{ formatDuration(statistics()?.duration || 0) }}</div>
            <div class="stat-label">Duration</div>
          </div>
          <div class="stat-item">
            <div class="stat-value">{{ Math.round(statistics()?.maxSpeed || 0) }} km/h</div>
            <div class="stat-label">Max Speed</div>
          </div>
          <div class="stat-item">
            <div class="stat-value">{{ Math.round(statistics()?.averageSpeed || 0) }} km/h</div>
            <div class="stat-label">Avg Speed</div>
          </div>
          <div class="stat-item">
            <div class="stat-value">{{ totalPoints() }}</div>
            <div class="stat-label">Data Points</div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .history-map-container {
      background: white;
      border-radius: 8px;
      padding: 1.5rem;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }

    .map-header {
      border-bottom: 1px solid #e5e7eb;
      padding-bottom: 1rem;
    }

    .map-wrapper {
      position: relative;
      border-radius: 8px;
      overflow: hidden;
      border: 1px solid #e5e7eb;
    }

    .map-wrapper.loading {
      background: #f9fafb;
    }

    .map-loading {
      display: flex;
      align-items: center;
      justify-content: center;
      background: #f9fafb;
      border: 2px dashed #e5e7eb;
      border-radius: 8px;
    }

    .loading-content,
    .no-data-content {
      text-align: center;
      padding: 2rem;
    }

    .map-statistics {
      border-top: 1px solid #e5e7eb;
      padding-top: 1rem;
    }

    .stat-item {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 0.75rem;
      text-align: center;
    }

    .stat-value {
      font-size: 1.25rem;
      font-weight: 700;
      color: #1e293b;
      line-height: 1;
    }

    .stat-label {
      font-size: 0.75rem;
      color: #64748b;
      margin-top: 0.25rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .info-window-content {
      min-width: 250px;
      padding: 0.5rem;
    }

    :deep(.gm-style-iw) {
      border-radius: 8px;
    }

    :deep(.gm-style-iw-d) {
      overflow: hidden !important;
    }

    @media (max-width: 768px) {
      .history-map-container {
        padding: 1rem;
      }
      
      .map-header .flex {
        flex-direction: column;
        align-items: stretch;
      }
      
      .map-statistics .grid {
        grid-template-columns: repeat(2, 1fr);
      }
      
      .info-window-content {
        min-width: 200px;
      }
    }

    @media (max-width: 640px) {
      .map-statistics .grid {
        grid-template-columns: 1fr;
      }
    }
  `]
})
export class HistoryMapComponent implements OnInit, OnDestroy {
  readonly Math = Math;
  @ViewChild('googleMap') googleMap!: ElementRef;
  @ViewChild('infoWindow') infoWindow!: MapInfoWindow;
  
  private readonly destroy$ = new Subject<void>();
  private readonly locationService = inject(LocationHistoryService);

  // Input/Output signals
  readonly height = input('500px');
  readonly showControls = input(true);
  readonly markerClicked = output<LocationPoint>();
  readonly coordinatesCopied = output<{ lat: number; lng: number }>();

  // Component state signals
  private readonly _mapCenter = signal<google.maps.LatLngLiteral>({ lat: 0, lng: 0 });
  private readonly _mapZoom = signal(10);
  private readonly _showPolyline = signal(true);
  private readonly _showMarkers = signal(true);
  private readonly _selectedMarkerData = signal<MapMarkerData | null>(null);
  private readonly _visibleMarkers = signal<MapMarkerData[]>([]);
  private readonly _polylineData = signal<MapPolylineData | null>(null);
  private readonly _startMarker = signal<MapMarkerData | null>(null);
  private readonly _endMarker = signal<MapMarkerData | null>(null);

  // Service state signals
  readonly locationData = this.locationService.enhancedLocationData;
  readonly loading = this.locationService.loading;
  readonly selectedDate = this.locationService.selectedDate;
  readonly statistics = this.locationService.statistics;

  // Computed signals
  readonly mapHeight = computed(() => this.height());
  readonly mapCenter = computed(() => this._mapCenter());
  readonly mapZoom = computed(() => this._mapZoom());
  readonly showPolyline = computed(() => this._showPolyline());
  readonly showMarkers = computed(() => this._showMarkers());
  readonly selectedMarkerData = computed(() => this._selectedMarkerData());
  readonly visibleMarkers = computed(() => this._visibleMarkers());
  readonly polylineData = computed(() => this._polylineData());
  readonly startMarker = computed(() => this._startMarker());
  readonly endMarker = computed(() => this._endMarker());
  
  readonly hasData = computed(() => this.locationData().length > 0);
  readonly totalPoints = computed(() => this.locationData().length);
  readonly canRefresh = computed(() => {
    const device = this.locationService.selectedDevice();
    const date = this.selectedDate();
    return device !== null && date !== null;
  });

  // Map configuration
  readonly mapOptions: google.maps.MapOptions = {
    mapTypeId: google.maps.MapTypeId.ROADMAP,
    zoomControl: true,
    scrollwheel: true,
    disableDoubleClickZoom: false,
    maxZoom: 20,
    minZoom: 3,
    streetViewControl: true,
    fullscreenControl: true,
    mapTypeControl: true,
    styles: [
      {
        featureType: 'poi',
        elementType: 'labels',
        stylers: [{ visibility: 'off' }]
      }
    ]
  };

  readonly polylineOptions: google.maps.PolylineOptions = {
    strokeColor: '#3b82f6',
    strokeOpacity: 0.8,
    strokeWeight: 3,
    geodesic: true,
    icons: [
      {
        icon: {
          path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
          scale: 3,
          strokeColor: '#1e40af',
          strokeWeight: 2,
          fillColor: '#3b82f6',
          fillOpacity: 1
        },
        offset: '100%',
        repeat: '100px'
      }
    ]
  };

  readonly markerOptions: google.maps.MarkerOptions = {
    icon: {
      path: google.maps.SymbolPath.CIRCLE,
      scale: 4,
      fillColor: '#3b82f6',
      fillOpacity: 0.8,
      strokeColor: '#1e40af',
      strokeWeight: 1
    },
    optimized: true
  };

  readonly startMarkerOptions: google.maps.MarkerOptions = {
    icon: {
      path: google.maps.SymbolPath.CIRCLE,
      scale: 8,
      fillColor: '#10b981',
      fillOpacity: 1,
      strokeColor: '#047857',
      strokeWeight: 2
    },
    zIndex: 1000
  };

  readonly endMarkerOptions: google.maps.MarkerOptions = {
    icon: {
      path: google.maps.SymbolPath.CIRCLE,
      scale: 8,
      fillColor: '#ef4444',
      fillOpacity: 1,
      strokeColor: '#dc2626',
      strokeWeight: 2
    },
    zIndex: 1000
  };

  readonly infoWindowOptions: google.maps.InfoWindowOptions = {
    disableAutoPan: false,
    maxWidth: 300,
    pixelOffset: new google.maps.Size(0, -10)
  };

  constructor() {
    // Effect to update map when location data changes
    effect(() => {
      const data = this.locationData();
      if (data.length > 0) {
        this.updateMapData(data);
      } else {
        this.clearMapData();
      }
    });
  }

  ngOnInit(): void {
    this.initializeMap();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onMapClick(event: google.maps.MapMouseEvent): void {
    if (this.infoWindow) {
      this.infoWindow.close();
    }
    this._selectedMarkerData.set(null);
  }

  onMapRightClick(event: google.maps.MapMouseEvent): void {
    // Could implement context menu here
  }

  onMarkerClick(marker: MapMarkerData, index: number): void {
    this._selectedMarkerData.set(marker);
    this.markerClicked.emit(marker.data);
    
    if (this.infoWindow) {
      this.infoWindow.open();
    }
  }

  onStartMarkerClick(): void {
    const startMarker = this.startMarker();
    if (startMarker) {
      this._selectedMarkerData.set(startMarker);
      if (this.infoWindow) {
        this.infoWindow.open();
      }
    }
  }

  onEndMarkerClick(): void {
    const endMarker = this.endMarker();
    if (endMarker) {
      this._selectedMarkerData.set(endMarker);
      if (this.infoWindow) {
        this.infoWindow.open();
      }
    }
  }

  fitMapToBounds(): void {
    const data = this.locationData();
    if (data.length === 0) return;

    const bounds = new google.maps.LatLngBounds();
    data.forEach(point => {
      bounds.extend({ lat: point.lat, lng: point.lng });
    });

    if (this.googleMap?.googleMap) {
      this.googleMap.googleMap.fitBounds(bounds);
    }
  }

  togglePolyline(): void {
    this._showPolyline.set(!this.showPolyline());
  }

  toggleMarkers(): void {
    this._showMarkers.set(!this.showMarkers());
  }

  refreshMap(): void {
    this.locationService.refreshData().pipe(
      takeUntil(this.destroy$)
    ).subscribe();
  }

  copyMarkerCoordinates(): void {
    const marker = this.selectedMarkerData();
    if (!marker) return;

    const coordinates = `${marker.position.lat}, ${marker.position.lng}`;
    navigator.clipboard.writeText(coordinates).then(() => {
      this.coordinatesCopied.emit(marker.position);
      if (this.infoWindow) {
        this.infoWindow.close();
      }
    }).catch(err => {
      console.error('Failed to copy coordinates:', err);
    });
  }

  trackByMarker(index: number, marker: MapMarkerData): string {
    return `${marker.position.lat}-${marker.position.lng}-${index}`;
  }

  // Formatting methods

  formatSelectedDate(): string {
    const date = this.selectedDate();
    if (!date) return '';
    
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  }

  formatDistance(meters: number): string {
    if (meters < 1000) {
      return `${Math.round(meters)} m`;
    }
    return `${(meters / 1000).toFixed(2)} km`;
  }

  formatDuration(milliseconds: number): string {
    const hours = Math.floor(milliseconds / (1000 * 60 * 60));
    const minutes = Math.floor((milliseconds % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  }

  formatMarkerTime(data: EnhancedLocationPoint | undefined): string {
    if (!data) return '';
    return new Date(data.utcTime).toLocaleString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  }

  formatCoordinates(position: google.maps.LatLngLiteral | undefined): string {
    if (!position) return '';
    return `${position.lat.toFixed(6)}, ${position.lng.toFixed(6)}`;
  }

  getNoDataMessage(): string {
    const device = this.locationService.selectedDevice();
    const date = this.selectedDate();
    
    if (!device) {
      return 'Please select a device to view location data on the map.';
    }
    
    if (!date) {
      return 'Please select a date to view location data on the map.';
    }
    
    return 'No location data available for the selected date.';
  }

  // Private methods

  private initializeMap(): void {
    // Set default center (could be user's location or a default location)
    this._mapCenter.set({ lat: 37.7749, lng: -122.4194 }); // San Francisco default
    this._mapZoom.set(10);
  }

  private updateMapData(data: EnhancedLocationPoint[]): void {
    if (data.length === 0) {
      this.clearMapData();
      return;
    }

    // Update map center and zoom
    this.updateMapBounds(data);
    
    // Create markers
    this.createMarkers(data);
    
    // Create polyline
    this.createPolyline(data);
    
    // Create start/end markers
    this.createStartEndMarkers(data);
  }

  private updateMapBounds(data: EnhancedLocationPoint[]): void {
    const bounds = new google.maps.LatLngBounds();
    data.forEach(point => {
      bounds.extend({ lat: point.lat, lng: point.lng });
    });

    const center = bounds.getCenter();
    this._mapCenter.set({ lat: center.lat(), lng: center.lng() });
    
    // Calculate appropriate zoom level
    const ne = bounds.getNorthEast();
    const sw = bounds.getSouthWest();
    const latDiff = ne.lat() - sw.lat();
    const lngDiff = ne.lng() - sw.lng();
    const maxDiff = Math.max(latDiff, lngDiff);
    
    let zoom = 15;
    if (maxDiff > 0.1) zoom = 10;
    else if (maxDiff > 0.01) zoom = 13;
    else if (maxDiff > 0.001) zoom = 16;
    
    this._mapZoom.set(zoom);
  }

  private createMarkers(data: EnhancedLocationPoint[]): void {
    // Create markers for every nth point to avoid overcrowding
    const step = Math.max(1, Math.floor(data.length / 50)); // Max 50 markers
    const markers: MapMarkerData[] = [];

    for (let i = 0; i < data.length; i += step) {
      const point = data[i];
      const marker: MapMarkerData = {
        position: { lat: point.lat, lng: point.lng },
        title: `Point ${i + 1} - ${point.formattedTime}`,
        options: {
          ...this.markerOptions,
          icon: {
            ...this.markerOptions.icon,
            fillColor: this.getSpeedColor(point.speedKmh || 0)
          }
        },
        data: point
      };
      markers.push(marker);
    }

    this._visibleMarkers.set(markers);
  }

  private createPolyline(data: EnhancedLocationPoint[]): void {
    const path = data.map(point => ({ lat: point.lat, lng: point.lng }));
    
    const polylineData: MapPolylineData = {
      path,
      options: this.polylineOptions
    };
    
    this._polylineData.set(polylineData);
  }

  private createStartEndMarkers(data: EnhancedLocationPoint[]): void {
    if (data.length === 0) return;

    const startPoint = data[0];
    const endPoint = data[data.length - 1];

    // Start marker
    this._startMarker.set({
      position: { lat: startPoint.lat, lng: startPoint.lng },
      title: `Start - ${startPoint.formattedTime}`,
      options: this.startMarkerOptions,
      data: startPoint
    });

    // End marker (only if different from start)
    if (data.length > 1) {
      this._endMarker.set({
        position: { lat: endPoint.lat, lng: endPoint.lng },
        title: `End - ${endPoint.formattedTime}`,
        options: this.endMarkerOptions,
        data: endPoint
      });
    }
  }

  private clearMapData(): void {
    this._visibleMarkers.set([]);
    this._polylineData.set(null);
    this._startMarker.set(null);
    this._endMarker.set(null);
    this._selectedMarkerData.set(null);
  }

  private getSpeedColor(speed: number): string {
    if (speed === 0) return '#6b7280'; // Gray for stationary
    if (speed < 5) return '#10b981'; // Green for slow
    if (speed < 30) return '#3b82f6'; // Blue for normal
    if (speed < 60) return '#f59e0b'; // Yellow for fast
    return '#ef4444'; // Red for very fast
  }

  private calculateTotalDistance(data: LocationPoint[]): number {
    let totalDistance = 0;
    
    for (let i = 1; i < data.length; i++) {
      const prev = data[i - 1];
      const curr = data[i];
      totalDistance += this.haversineDistance(
        { lat: prev.lat, lng: prev.lng },
        { lat: curr.lat, lng: curr.lng }
      );
    }
    
    return totalDistance;
  }

  private haversineDistance(
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
}