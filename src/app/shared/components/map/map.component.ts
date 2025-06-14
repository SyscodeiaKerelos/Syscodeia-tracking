import { Component, EventEmitter, Input, OnChanges, OnDestroy, OnInit, Output, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GoogleMapsModule, MapInfoWindow, MapMarker as GoogleMapMarker } from '@angular/google-maps';
import { Coordinates, MapConfig, MapMarker, MapPolyline } from '../../interfaces/map.interface';

@Component({
  selector: 'app-map',
  templateUrl: './map.component.html',
  styleUrls: ['./map.component.scss'],
  standalone: true,
  imports: [CommonModule, GoogleMapsModule]
})
export class MapComponent implements OnInit, OnChanges {
  @Input() config!: MapConfig;
  @Output() mapReady = new EventEmitter<google.maps.Map>();
  @Output() markerClick = new EventEmitter<{ marker: any, data: any }>();
  @Output() mapClick = new EventEmitter<google.maps.MapMouseEvent>();
  @Output() boundsChanged = new EventEmitter<google.maps.LatLngBounds>();
  @Output() markerDragEnd = new EventEmitter<{ marker: any, position: Coordinates }>();

  // Google Maps properties
  center: google.maps.LatLngLiteral = { lat: 0, lng: 0 };
  zoom = 4;
  options: google.maps.MapOptions = {};
  markers: any[] = [];
  polylineOptions: google.maps.PolylineOptions[] = [];
  polylinePaths: google.maps.LatLngLiteral[][] = [];

  // Tracking map instance
  mapInstance: google.maps.Map | null = null;

  constructor() { }

  ngOnInit(): void {
    this.initializeMapConfig();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['config'] && !changes['config'].firstChange) {
      this.initializeMapConfig();
    }
  }

  /**
   * Initialize map configuration based on input config
   */
  private initializeMapConfig(): void {
    if (!this.config) return;

    // Set center and zoom
    this.center = this.config.center;
    this.zoom = this.config.zoom;

    // Set map options
    this.options = {
      mapTypeId: this.config.mapTypeId || 'roadmap',
      disableDefaultUI: this.config.disableDefaultUI,
      maxZoom: this.config.maxZoom,
      minZoom: this.config.minZoom,
      styles: this.config.styles as google.maps.MapTypeStyle[]
    };

    // Configure markers
    this.setupMarkers();
    
    // Configure polylines
    this.setupPolylines();
  }

  /**
   * Handle when the map is initialized and ready
   */
  onMapInitialized(map: google.maps.Map): void {
    this.mapInstance = map;
    this.mapReady.emit(map);

    // If fitBounds is enabled and we have markers or polylines, fit the map to show all
    if (this.config.fitBounds && (this.markers.length > 0 || this.polylinePaths.length > 0)) {
      this.fitBoundsToMarkers(map);
    }
  }

  /**
   * Handle marker click event
   */
  onMarkerClicked(marker: GoogleMapMarker, index: number): void {
    if (!marker) return;
    
    const markerData = this.markers[index]?.data;
    this.markerClick.emit({ 
      marker: marker,
      data: markerData
    });
  }

  /**
   * Handle map click event
   */
  onMapClicked(event: google.maps.MapMouseEvent): void {
    this.mapClick.emit(event);
  }

  /**
   * Handle map bounds changed event
   */
  onBoundsChanged(): void {
    if (!this.mapInstance) return;
    
    const bounds = this.mapInstance.getBounds();
    if (bounds) {
      this.boundsChanged.emit(bounds);
    }
  }

  /**
   * Setup markers from configuration
   */
  private setupMarkers(): void {
    this.markers = [];
    
    if (!this.config.markers) return;
    
    this.markers = this.config.markers.map(marker => ({
      position: marker.position,
      title: marker.title,
      options: {
        icon: marker.icon,
        draggable: marker.draggable,
        label: marker.label
      },
      data: marker.data
    }));
  }

  /**
   * Setup polylines from configuration
   */
  private setupPolylines(): void {
    this.polylineOptions = [];
    this.polylinePaths = [];
    
    if (!this.config.polylines) return;
    
    this.config.polylines.forEach(polyline => {
      this.polylinePaths.push(polyline.path);
      this.polylineOptions.push({
        strokeColor: polyline.strokeColor || '#FF0000',
        strokeOpacity: polyline.strokeOpacity || 1.0,
        strokeWeight: polyline.strokeWeight || 2
      });
    });
  }

  /**
   * Fit map bounds to include all markers and polyline points
   */
  private fitBoundsToMarkers(map: google.maps.Map): void {
    const bounds = new google.maps.LatLngBounds();
    
    // Add markers to bounds
    if (this.config.markers) {
      this.config.markers.forEach(marker => {
        bounds.extend(marker.position);
      });
    }
    
    // Add polyline points to bounds
    if (this.config.polylines) {
      this.config.polylines.forEach(polyline => {
        polyline.path.forEach(point => {
          bounds.extend(point);
        });
      });
    }
    
    map.fitBounds(bounds);
  }

  /**
   * Handle when a marker is dragged
   */
  onMarkerDragEnd(event: any, index: number): void {
    if (!event || !event.latLng) return;
    
    const position = { 
      lat: event.latLng.lat(), 
      lng: event.latLng.lng() 
    };
    
    const marker = this.markers[index];
    if (!marker) return;
    
    this.markerDragEnd.emit({ 
      marker: event.target,
      position
    });
  }
} 