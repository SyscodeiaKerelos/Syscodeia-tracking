export interface Coordinates {
  lat: number;
  lng: number;
}

export interface MapMarker {
  position: Coordinates;
  title?: string;
  icon?: string;
  draggable?: boolean;
  label?: string;
  data?: any; // Custom data to be associated with the marker
}

export interface MapPolyline {
  path: Coordinates[];
  strokeColor?: string;
  strokeOpacity?: number;
  strokeWeight?: number;
}

export interface MapConfig {
  center: Coordinates;
  zoom: number;
  mapTypeId?: string; // 'roadmap' | 'satellite' | 'hybrid' | 'terrain'
  disableDefaultUI?: boolean;
  markers?: MapMarker[];
  polylines?: MapPolyline[];
  fitBounds?: boolean;
  maxZoom?: number;
  minZoom?: number;
  styles?: any[];
  showInfoWindow?: boolean;
  height?: string;
} 