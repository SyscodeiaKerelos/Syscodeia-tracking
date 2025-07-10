import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GoogleMapsModule } from '@angular/google-maps';
import { CardModule } from 'primeng/card';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { MessageModule } from 'primeng/message';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { Router } from '@angular/router';
import { Subject, takeUntil, timer } from 'rxjs';
import { DeviceService, DeviceWithLocation } from '../../core/services/device.service';
import { AuthService } from '../../core/services/auth.service';
import { ErrorHandlerService } from '../../core/services/error-handler.service';
import { HeaderComponent, HeaderAction } from '../../shared/components/header/header.component';

@Component({
  selector: 'app-tracking',
  standalone: true,
  imports: [
    CommonModule,
    GoogleMapsModule,
    CardModule,
    TableModule,
    TagModule,
    MessageModule,
    ProgressSpinnerModule,
    ToastModule,
    HeaderComponent
  ],
  templateUrl: './tracking.component.html',
  styleUrl: './tracking.component.scss'
})
export class TrackingComponent implements OnInit, OnDestroy {
  devicesWithLocation: DeviceWithLocation[] = [];
  isLoading = false;
  apiStatusMessage = '';
  apiStatusSeverity: 'success' | 'info' | 'warn' | 'error' = 'info';
  
  headerActions: HeaderAction[] = [
    {
      label: 'Refresh',
      icon: 'pi pi-refresh',
      severity: 'primary',
      loading: false,
      action: () => this.loadDevices()
    },
    {
      label: 'Logout',
      icon: 'pi pi-sign-out',
      severity: 'secondary',
      loading: false,
      action: () => this.logout()
    }
  ];
  

  
  // Map configuration - Default to Dubai area based on device data
  mapCenter: google.maps.LatLngLiteral = { lat: 25.2834, lng: 55.5579 }; 
  mapZoom = 13;
  mapOptions: google.maps.MapOptions = {
    mapTypeId: 'roadmap',
    zoomControl: true,
    scrollwheel: true,
    disableDoubleClickZoom: false,
    maxZoom: 20,
    minZoom: 3,
  };

  private destroy$ = new Subject<void>();

  constructor(
    private deviceService: DeviceService,
    private authService: AuthService,
    private messageService: MessageService,
    private errorHandler: ErrorHandlerService,
    private router: Router
  ) {}

  ngOnInit(): void {
    // Check if user is authenticated using reactive state
    this.authService.isAuthenticated$.pipe(takeUntil(this.destroy$)).subscribe(isAuth => {
      if (!isAuth) {
        this.router.navigate(['/login']);
        return;
      }
    });

    // Check immediate authentication state
    if (!this.authService.isAuthenticated()) {
      this.router.navigate(['/login']);
      return;
    }

    this.loadDevices();
    
    // Auto-refresh every 15 seconds for more responsive updates
    timer(15000, 15000)
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        if (!this.isLoading) {
          this.loadDevices(true); // Silent refresh
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadDevices(silent: boolean = false): void {
    this.isLoading = true;
    // Update refresh button loading state
    const refreshAction = this.headerActions.find(action => action.label === 'Refresh');
    if (refreshAction) {
      refreshAction.loading = true;
    }
    
    if (!silent) {
      this.apiStatusMessage = '';
    }
    
    this.deviceService.getAllDevicesWithLocations().subscribe({
      next: (devices) => {
        this.devicesWithLocation = devices;
        this.updateMapCenter();
        this.isLoading = false;
        
        // Reset refresh button loading state
        if (refreshAction) {
          refreshAction.loading = false;
        }
        
        const devicesWithLocation = devices.filter(d => d.location).length;
        
        // Set success status for API connection
        if (!silent) {
          this.apiStatusSeverity = 'success';
          
          this.messageService.add({
            severity: 'success',
            summary: 'Devices Loaded',
            detail: `Found ${devices.length} devices (${devicesWithLocation} with location)`
          });
        }
      },
      error: (error) => {
        console.error('Failed to load devices:', error);
        this.isLoading = false;
        
        // Reset refresh button loading state
        if (refreshAction) {
          refreshAction.loading = false;
        }
        
        const apiError = this.errorHandler.handleApiError(error);
        
        // Set API status message based on error type
        if (apiError.code === 404) {
          this.apiStatusMessage = '⚠️ Traxbean API endpoints not accessible. The API may not be publicly available for external access.';
          this.apiStatusSeverity = 'warn';
        } else if (apiError.code === 0) {
          this.apiStatusMessage = '🚫 CORS Error: Cannot access Traxbean API from browser due to CORS restrictions.';
          this.apiStatusSeverity = 'error';
        } else if (apiError.code === 401) {
          this.apiStatusMessage = '🔒 Authentication failed. Please check your credentials.';
          this.apiStatusSeverity = 'error';
          this.logout();
        } else {
          this.apiStatusMessage = `❌ API Error: ${error.message}`;
          this.apiStatusSeverity = 'error';
        }
        
        this.messageService.add({
          severity: 'error',
          summary: 'Error Loading Devices',
          detail: apiError.userMessage
        });
      }
    });
  }

  updateMapCenter(): void {
    const devicesWithValidLocation = this.devicesWithLocation.filter(d => d.location);
    
    if (devicesWithValidLocation.length > 0) {
      // Calculate center based on all device locations
      const avgLat = devicesWithValidLocation.reduce((sum, d) => sum + d.location!.latitude, 0) / devicesWithValidLocation.length;
      const avgLng = devicesWithValidLocation.reduce((sum, d) => sum + d.location!.longitude, 0) / devicesWithValidLocation.length;
      
      this.mapCenter = { lat: avgLat, lng: avgLng };
      
      // Adjust zoom based on spread of devices and number of devices
      if (devicesWithValidLocation.length === 1) {
        this.mapZoom = 16; // Close zoom for single device
      } else if (devicesWithValidLocation.length <= 5) {
        this.mapZoom = 14; // Medium zoom for few devices
      } else {
        this.mapZoom = 12; // Wider zoom for many devices
      }
    }
  }

  getMarkerPosition(device: DeviceWithLocation): google.maps.LatLngLiteral {
    return {
      lat: device.location!.latitude,
      lng: device.location!.longitude
    };
  }

  getDevicesWithValidLocation(): DeviceWithLocation[] {
    return this.devicesWithLocation.filter(device => device.location);
  }

  getMarkerOptions(device: DeviceWithLocation): google.maps.MarkerOptions {
    const status = this.getDeviceStatus(device);
    
    return {
      title: `${device.name} - ${status}`,
      icon: {
        url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(this.getMarkerSvg(status, device))}`,
        scaledSize: new google.maps.Size(36, 48),
        anchor: new google.maps.Point(18, 48)
      }
    };
  }

  private getMarkerSvg(status: string, device: DeviceWithLocation): string {
    // Define colors based on device status
    let primaryColor: string;
    let shadowColor: string;
    
    switch (status) {
      case 'Online':
        primaryColor = '#10b981'; // Green
        shadowColor = '#059669';
        break;
      case 'Recent':
        primaryColor = '#f59e0b'; // Orange
        shadowColor = '#d97706';
        break;
      case 'Offline':
      default:
        primaryColor = '#ef4444'; // Red
        shadowColor = '#dc2626';
        break;
    }

    // Create a modern pin-style marker with device info
    return `
      <svg width="36" height="48" viewBox="0 0 36 48" xmlns="http://www.w3.org/2000/svg">
        <!-- Drop shadow -->
        <ellipse cx="18" cy="46" rx="8" ry="2" fill="rgba(0,0,0,0.2)"/>
        
        <!-- Main pin body -->
        <path d="M18 2 C10 2 4 8 4 16 C4 24 18 44 18 44 C18 44 32 24 32 16 C32 8 26 2 18 2 Z" 
              fill="${primaryColor}" stroke="white" stroke-width="2"/>
        
        <!-- Inner gradient effect -->
        <path d="M18 4 C11 4 6 9 6 16 C6 22 18 40 18 40 C18 40 30 22 30 16 C30 9 25 4 18 4 Z" 
              fill="url(#gradient-${status.toLowerCase()})"/>
        
        <!-- Center circle -->
        <circle cx="18" cy="16" r="8" fill="white" stroke="${shadowColor}" stroke-width="1.5"/>
        
        <!-- Status indicator -->
        <circle cx="18" cy="16" r="5" fill="${primaryColor}"/>
        
        <!-- Device type icon (simplified) -->
        <circle cx="18" cy="16" r="2" fill="white"/>
        
        <!-- Gradient definitions -->
        <defs>
          <linearGradient id="gradient-online" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#34d399"/>
            <stop offset="100%" stop-color="#059669"/>
          </linearGradient>
          <linearGradient id="gradient-recent" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#fbbf24"/>
            <stop offset="100%" stop-color="#d97706"/>
          </linearGradient>
          <linearGradient id="gradient-offline" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#f87171"/>
            <stop offset="100%" stop-color="#dc2626"/>
          </linearGradient>
        </defs>
      </svg>
    `;
  }

  onMarkerClick(device: DeviceWithLocation): void {
    let details = `Status: ${this.getDeviceStatus(device)}`;
    
    if (device.type) {
      details += `\nType: ${device.type}`;
    }
    
    if (device.battery !== undefined) {
      details += `\nBattery: ${device.battery}%`;
    }
    
    if (device.location) {
      details += `\nLocation: ${device.location.latitude.toFixed(6)}, ${device.location.longitude.toFixed(6)}`;
      if (device.location.speed !== undefined) {
        details += `\nSpeed: ${device.location.speed} km/h`;
      }
      if (device.location.altitude !== undefined) {
        details += `\nAltitude: ${device.location.altitude}m`;
      }
      details += `\nLast Update: ${device.location.timestamp.toLocaleString()}`;
    } else {
      details += '\nNo location data available';
    }

    this.messageService.add({
      severity: 'info',
      summary: device.name,
      detail: details
    });
  }

  getDeviceStatus(device: DeviceWithLocation): string {
    // Use the status from the device service if available
    if (device.status) {
      switch (device.status) {
        case 'online': return 'Online';
        case 'recent': return 'Recent';
        case 'offline': return 'Offline';
        default: return device.status;
      }
    }
    
    if (!device.location) return 'Offline';
    
    // Fallback: Consider device online if location was updated within last 10 minutes
    const now = new Date();
    const locationTime = new Date(device.location.timestamp);
    const diffMinutes = (now.getTime() - locationTime.getTime()) / (1000 * 60);
    
    return diffMinutes <= 10 ? 'Online' : 'Offline';
  }

  getStatusSeverity(device: DeviceWithLocation): 'success' | 'warning' | 'danger' {
    const status = this.getDeviceStatus(device);
    switch (status) {
      case 'Online': return 'success';
      case 'Recent': return 'warning';
      case 'Offline': return 'danger';
      default: return 'warning';
    }
  }

  getBatteryClass(battery: number): string {
    if (battery > 50) return 'battery-good';
    if (battery > 20) return 'battery-medium';
    return 'battery-low';
  }

  trackByDeviceId(index: number, device: DeviceWithLocation): string {
    return device.id;
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}