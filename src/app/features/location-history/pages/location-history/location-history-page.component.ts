import { 
  Component, 
  OnInit, 
  OnDestroy, 
  signal, 
  computed, 
  effect, 
  inject
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import { ProgressBarModule } from 'primeng/progressbar';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { DividerModule } from 'primeng/divider';
import { TabViewModule } from 'primeng/tabview';
import { SkeletonModule } from 'primeng/skeleton';
import { Subject, takeUntil, debounceTime, distinctUntilChanged } from 'rxjs';
import { toSignal } from '@angular/core/rxjs-interop';

import { LocationHistoryService } from '../../services/location-history.service';
import { CalendarSelectorComponent } from '../../components/calendar-selector/calendar-selector.component';
import { LocationTableComponent } from '../../components/location-table/location-table.component';
import { HistoryMapComponent } from '../../components/location-map/history-map.component';
import { 
  LocationPoint, 
  DeviceInfo, 
  LocationStatistics 
} from '../../models/location-history.interface';

/**
 * Location History Page Component with Angular 19 Signals
 * Main container component that orchestrates all location history functionality
 */
@Component({
  selector: 'app-location-history-page',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    ToastModule,
    ProgressBarModule,
    ButtonModule,
    CardModule,
    DividerModule,
    TabViewModule,
    SkeletonModule,
    CalendarSelectorComponent,
    LocationTableComponent,
    HistoryMapComponent
  ],
  template: `
    <div class="location-history-page">
      <!-- Page Header -->
      <div class="page-header mb-6">
        <div class="flex flex-wrap align-items-center justify-content-between gap-4">
          <div>
            <h1 class="text-3xl font-bold text-gray-900 m-0">
              Location History
            </h1>
            <p class="text-gray-600 mt-1 mb-0">
              View and analyze location tracking data
            </p>
          </div>
          
          <div class="flex align-items-center gap-3">
            <!-- Status Indicator -->
            <div class="status-indicator" *ngIf="selectedDevice()">
              <div class="flex align-items-center gap-2">
                <div class="status-dot" 
                     [class.online]="getSelectedDeviceInfo()?.isOnline"
                     [class.offline]="!getSelectedDeviceInfo()?.isOnline">
                </div>
                <span class="text-sm font-medium">
                  {{ getSelectedDeviceInfo()?.isOnline ? 'Online' : 'Offline' }}
                </span>
              </div>
            </div>
            
            <!-- Last Updated -->
            <div class="last-updated text-sm text-gray-500" *ngIf="lastUpdated()">
              Updated: {{ formatLastUpdated() }}
            </div>
            
            <!-- Clear Data Button -->
            <button 
              pButton 
              type="button" 
              label="Clear" 
              icon="pi pi-times" 
              class="p-button-outlined p-button-sm"
              (click)="clearAllData()"
              [disabled]="!hasAnyData()"
              pTooltip="Clear all selections and data"
              tooltipPosition="bottom">
            </button>
          </div>
        </div>
        
        <!-- Progress Bar -->
        <p-progressBar 
          *ngIf="loading()" 
          mode="indeterminate" 
          [style]="{ height: '3px', marginTop: '1rem' }">
        </p-progressBar>
      </div>

      <!-- Main Content -->
      <div class="main-content">
        <div class="grid grid-cols-12 gap-6">
          <!-- Sidebar - Calendar and Device Selection -->
          <div class="col-span-12 lg:col-span-4 xl:col-span-3">
            <div class="sidebar-content space-y-6">
              <!-- Calendar Selector -->
              <app-calendar-selector
                [initialDevice]="initialDevice()"
                [initialDate]="initialDate()"
                (deviceSelected)="onDeviceSelected($event)"
                (dateSelected)="onDateSelected($event)">
              </app-calendar-selector>
              
              <!-- Quick Stats -->
              <div class="quick-stats" *ngIf="hasLocationData() && statistics()">
                <p-card header="Quick Stats" [style]="{ height: 'fit-content' }">
                  <div class="stats-grid">
                    <div class="stat-item">
                      <div class="stat-icon">
                        <i class="pi pi-map-marker text-blue-500"></i>
                      </div>
                      <div class="stat-content">
                        <div class="stat-value">{{ statistics()?.totalPoints }}</div>
                        <div class="stat-label">Points</div>
                      </div>
                    </div>
                    
                    <div class="stat-item">
                      <div class="stat-icon">
                        <i class="pi pi-clock text-green-500"></i>
                      </div>
                      <div class="stat-content">
                        <div class="stat-value">{{ formatDuration(statistics()?.duration || 0) }}</div>
                        <div class="stat-label">Duration</div>
                      </div>
                    </div>
                    
                    <div class="stat-item">
                      <div class="stat-icon">
                        <i class="pi pi-send text-purple-500"></i>
                      </div>
                      <div class="stat-content">
                        <div class="stat-value">{{ formatDistance(statistics()?.totalDistance || 0) }}</div>
                        <div class="stat-label">Distance</div>
                      </div>
                    </div>
                    
                    <div class="stat-item">
                      <div class="stat-icon">
                        <i class="pi pi-gauge text-orange-500"></i>
                      </div>
                      <div class="stat-content">
                        <div class="stat-value">{{ Math.round(statistics()?.averageSpeed || 0) }}</div>
                        <div class="stat-label">Avg Speed (km/h)</div>
                      </div>
                    </div>
                  </div>
                </p-card>
              </div>
              
              <!-- Device Info -->
              <div class="device-info" *ngIf="selectedDevice() && getSelectedDeviceInfo()">
                <p-card header="Device Information">
                  <div class="device-details">
                    <div class="detail-row">
                      <span class="detail-label">Name:</span>
                      <span class="detail-value">{{ getSelectedDeviceInfo()?.name }}</span>
                    </div>
                    <div class="detail-row">
                      <span class="detail-label">Type:</span>
                      <span class="detail-value">{{ getSelectedDeviceInfo()?.type }}</span>
                    </div>
                    <div class="detail-row">
                      <span class="detail-label">Status:</span>
                      <span class="detail-value" 
                            [class.text-green-600]="getSelectedDeviceInfo()?.isOnline"
                            [class.text-red-600]="!getSelectedDeviceInfo()?.isOnline">
                        {{ getSelectedDeviceInfo()?.isOnline ? 'Online' : 'Offline' }}
                      </span>
                    </div>
                    <div class="detail-row" *ngIf="getSelectedDeviceInfo()?.batteryLevel">
                      <span class="detail-label">Battery:</span>
                      <span class="detail-value">{{ getSelectedDeviceInfo()?.batteryLevel }}%</span>
                    </div>
                    <div class="detail-row">
                      <span class="detail-label">Last Seen:</span>
                      <span class="detail-value text-sm">
                        {{ formatLastSeen(getSelectedDeviceInfo()?.lastSeen) }}
                      </span>
                    </div>
                  </div>
                </p-card>
              </div>
            </div>
          </div>
          
          <!-- Main Content Area -->
          <div class="col-span-12 lg:col-span-8 xl:col-span-9">
            <div class="main-panel">
              <!-- Content Tabs -->
              <p-tabView 
                [(activeIndex)]="activeTabIndex"
                [scrollable]="true"
                *ngIf="hasLocationData(); else noDataTemplate">
                
                <!-- Map Tab -->
                <p-tabPanel header="Map View" leftIcon="pi pi-map">
                  <app-history-map
                    [height]="'600px'"
                    [showControls]="true"
                    (markerClicked)="onMapMarkerClicked($event)"
                    (coordinatesCopied)="onCoordinatesCopied($event)">
                  </app-history-map>
                </p-tabPanel>
                
                <!-- Table Tab -->
                <p-tabPanel header="Table View" leftIcon="pi pi-table">
                  <app-location-table
                    [showActions]="true"
                    [pageSize]="25"
                    (pointSelected)="onTablePointSelected($event)"
                    (coordinatesCopied)="onCoordinatesCopied($event)">
                  </app-location-table>
                </p-tabPanel>
                
                <!-- Analytics Tab -->
                <p-tabPanel header="Analytics" leftIcon="pi pi-chart-line">
                  <div class="analytics-content">
                    <div class="analytics-header mb-4">
                      <h3 class="text-xl font-semibold text-gray-800 m-0">
                        Movement Analytics
                      </h3>
                      <p class="text-gray-600 mt-1">
                        Detailed analysis of location and movement patterns
                      </p>
                    </div>
                    
                    <!-- Analytics Cards -->
                    <div class="analytics-grid grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      <!-- Time Analysis -->
                      <div class="analytics-card">
                        <div class="card-header">
                          <i class="pi pi-clock text-blue-500"></i>
                          <h4>Time Analysis</h4>
                        </div>
                        <div class="card-content" *ngIf="statistics()">
                          <div class="metric">
                            <span class="metric-label">Start Time:</span>
                            <span class="metric-value">{{ formatTime(statistics()?.startTime) }}</span>
                          </div>
                          <div class="metric">
                            <span class="metric-label">End Time:</span>
                            <span class="metric-value">{{ formatTime(statistics()?.endTime) }}</span>
                          </div>
                          <div class="metric">
                            <span class="metric-label">Total Duration:</span>
                            <span class="metric-value">{{ formatDuration(statistics()?.duration || 0) }}</span>
                          </div>
                        </div>
                      </div>
                      
                      <!-- Speed Analysis -->
                      <div class="analytics-card">
                        <div class="card-header">
                          <i class="pi pi-gauge text-green-500"></i>
                          <h4>Speed Analysis</h4>
                        </div>
                        <div class="card-content" *ngIf="statistics()">
                          <div class="metric">
                            <span class="metric-label">Max Speed:</span>
                            <span class="metric-value">{{ Math.round(statistics()?.maxSpeed || 0) }} km/h</span>
                          </div>
                          <div class="metric">
                            <span class="metric-label">Avg Speed:</span>
                            <span class="metric-value">{{ Math.round(statistics()?.averageSpeed || 0) }} km/h</span>
                          </div>
                          <div class="metric">
                            <span class="metric-label">Data Points:</span>
                            <span class="metric-value">{{ statistics()?.totalPoints }}</span>
                          </div>
                        </div>
                      </div>
                      
                      <!-- Distance Analysis -->
                      <div class="analytics-card">
                        <div class="card-header">
                          <i class="pi pi-send text-purple-500"></i>
                          <h4>Distance Analysis</h4>
                        </div>
                        <div class="card-content" *ngIf="statistics()">
                          <div class="metric">
                            <span class="metric-label">Total Distance:</span>
                            <span class="metric-value">{{ formatDistance(statistics()?.totalDistance || 0) }}</span>
                          </div>
                          <div class="metric">
                            <span class="metric-label">Straight Line:</span>
                            <span class="metric-value">{{ calculateStraightLineDistance() }}</span>
                          </div>
                          <div class="metric">
                            <span class="metric-label">Efficiency:</span>
                            <span class="metric-value">{{ calculateRouteEfficiency() }}%</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <!-- Additional Analytics -->
                    <div class="additional-analytics mt-6">
                      <p-card header="Movement Patterns">
                        <div class="patterns-content">
                          <p class="text-gray-600 mb-4">
                            Advanced analytics and movement pattern analysis will be displayed here.
                          </p>
                          <div class="coming-soon">
                            <i class="pi pi-cog text-4xl text-gray-300 mb-2"></i>
                            <p class="text-gray-500">Advanced analytics coming soon...</p>
                          </div>
                        </div>
                      </p-card>
                    </div>
                  </div>
                </p-tabPanel>
              </p-tabView>
              
              <!-- No Data Template -->
              <ng-template #noDataTemplate>
                <div class="no-data-state">
                  <div class="no-data-content">
                    <div class="no-data-icon">
                      <i class="pi pi-map text-6xl text-gray-300"></i>
                    </div>
                    <h3 class="text-xl font-semibold text-gray-700 mb-2">
                      {{ getNoDataTitle() }}
                    </h3>
                    <p class="text-gray-500 mb-4">
                      {{ getNoDataMessage() }}
                    </p>
                    <div class="no-data-actions" *ngIf="canShowInstructions()">
                      <div class="instructions">
                        <div class="instruction-step">
                          <div class="step-number">1</div>
                          <div class="step-content">
                            <h4>Select a Device</h4>
                            <p>Choose a device from the dropdown in the calendar panel</p>
                          </div>
                        </div>
                        <div class="instruction-step">
                          <div class="step-number">2</div>
                          <div class="step-content">
                            <h4>Pick a Date</h4>
                            <p>Select a date with available data (highlighted in green)</p>
                          </div>
                        </div>
                        <div class="instruction-step">
                          <div class="step-number">3</div>
                          <div class="step-content">
                            <h4>View Data</h4>
                            <p>Explore location data in map, table, or analytics view</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </ng-template>
            </div>
          </div>
        </div>
      </div>
      
      <!-- Toast Messages -->
      <p-toast position="top-right" [life]="3000"></p-toast>
    </div>
  `,
  styles: [`
    .location-history-page {
      min-height: 100vh;
      background: #f8fafc;
      padding: 2rem;
    }

    .page-header {
      background: white;
      border-radius: 12px;
      padding: 2rem;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
      border: 1px solid #e2e8f0;
    }

    .status-indicator .status-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #ef4444;
    }

    .status-indicator .status-dot.online {
      background: #10b981;
    }

    .sidebar-content {
      position: sticky;
      top: 2rem;
    }

    .main-panel {
      background: white;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
      border: 1px solid #e2e8f0;
      min-height: 700px;
    }

    .quick-stats .stats-grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: 1rem;
    }

    .stat-item {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.75rem;
      background: #f8fafc;
      border-radius: 6px;
      border: 1px solid #e2e8f0;
    }

    .stat-icon {
      font-size: 1.25rem;
    }

    .stat-content {
      flex: 1;
    }

    .stat-value {
      font-size: 1.125rem;
      font-weight: 700;
      color: #1e293b;
      line-height: 1;
    }

    .stat-label {
      font-size: 0.75rem;
      color: #64748b;
      margin-top: 0.125rem;
    }

    .device-details {
      space-y: 0.75rem;
    }

    .detail-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0.5rem 0;
      border-bottom: 1px solid #f1f5f9;
    }

    .detail-row:last-child {
      border-bottom: none;
    }

    .detail-label {
      font-weight: 500;
      color: #64748b;
      font-size: 0.875rem;
    }

    .detail-value {
      font-weight: 600;
      color: #1e293b;
      font-size: 0.875rem;
    }

    .no-data-state {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 600px;
      padding: 3rem;
    }

    .no-data-content {
      text-align: center;
      max-width: 500px;
    }

    .no-data-icon {
      margin-bottom: 1.5rem;
    }

    .instructions {
      text-align: left;
      margin-top: 2rem;
    }

    .instruction-step {
      display: flex;
      align-items: flex-start;
      gap: 1rem;
      margin-bottom: 1.5rem;
    }

    .step-number {
      width: 2rem;
      height: 2rem;
      background: #3b82f6;
      color: white;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 700;
      font-size: 0.875rem;
      flex-shrink: 0;
    }

    .step-content h4 {
      margin: 0 0 0.25rem 0;
      font-weight: 600;
      color: #1e293b;
    }

    .step-content p {
      margin: 0;
      color: #64748b;
      font-size: 0.875rem;
    }

    .analytics-content {
      padding: 1.5rem;
    }

    .analytics-card {
      background: white;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 1.5rem;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    }

    .analytics-card .card-header {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin-bottom: 1rem;
    }

    .analytics-card .card-header h4 {
      margin: 0;
      font-size: 1rem;
      font-weight: 600;
      color: #1e293b;
    }

    .analytics-card .card-header i {
      font-size: 1.25rem;
    }

    .analytics-card .metric {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0.5rem 0;
      border-bottom: 1px solid #f1f5f9;
    }

    .analytics-card .metric:last-child {
      border-bottom: none;
    }

    .analytics-card .metric-label {
      font-size: 0.875rem;
      color: #64748b;
    }

    .analytics-card .metric-value {
      font-weight: 600;
      color: #1e293b;
      font-size: 0.875rem;
    }

    .patterns-content {
      text-align: center;
      padding: 2rem;
    }

    .coming-soon {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.5rem;
      margin-top: 2rem;
    }

    :deep(.p-tabview .p-tabview-nav) {
      background: #f8fafc;
      border-bottom: 1px solid #e2e8f0;
    }

    :deep(.p-tabview .p-tabview-nav li .p-tabview-nav-link) {
      border: none;
      background: transparent;
      color: #64748b;
      font-weight: 500;
    }

    :deep(.p-tabview .p-tabview-nav li.p-highlight .p-tabview-nav-link) {
      background: white;
      color: #3b82f6;
      border-bottom: 2px solid #3b82f6;
    }

    :deep(.p-card .p-card-header) {
      background: #f8fafc;
      border-bottom: 1px solid #e2e8f0;
      font-weight: 600;
      color: #1e293b;
    }

    @media (max-width: 1024px) {
      .location-history-page {
        padding: 1rem;
      }
      
      .page-header {
        padding: 1.5rem;
      }
      
      .grid {
        grid-template-columns: 1fr;
      }
      
      .sidebar-content {
        position: static;
      }
    }

    @media (max-width: 640px) {
      .analytics-grid {
        grid-template-columns: 1fr !important;
      }
      
      .page-header .flex {
        flex-direction: column;
        align-items: stretch;
      }
    }
  `]
})
export class LocationHistoryPageComponent implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();
  private readonly locationService = inject(LocationHistoryService);
  private readonly messageService = inject(MessageService);

  // Component state signals
  private readonly _initialDevice = signal<number | null>(null);
  private readonly _initialDate = signal<Date | null>(null);
  private readonly _activeTabIndex = signal(0);

  // Service state signals
  readonly devices = this.locationService.devices;
  readonly selectedDevice = this.locationService.selectedDevice;
  readonly selectedDate = this.locationService.selectedDate;
  readonly locationData = this.locationService.enhancedLocationData;
  readonly loading = this.locationService.loading;
  readonly statistics = this.locationService.statistics;
  readonly lastUpdated = this.locationService.lastUpdated;
  readonly error = this.locationService.error;

  // Computed signals
  readonly initialDevice = computed(() => this._initialDevice());
  readonly initialDate = computed(() => this._initialDate());
  readonly hasLocationData = computed(() => this.locationData().length > 0);
  readonly hasAnyData = computed(() => 
    this.selectedDevice() !== null || this.selectedDate() !== null || this.hasLocationData()
  );

  // Component properties
  activeTabIndex = 0;
  
  // Make Math available in template
  readonly Math = Math;

  constructor() {
    // Effect to handle error messages
    effect(() => {
      const error = this.error();
      if (error) {
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: error,
          life: 5000
        });
      }
    });

    // Effect to show success messages
    effect(() => {
      const data = this.locationData();
      const prevLength = this.locationData().length;
      
      if (data.length > 0 && prevLength === 0) {
        this.messageService.add({
          severity: 'success',
          summary: 'Data Loaded',
          detail: `Successfully loaded ${data.length} location points`,
          life: 3000
        });
      }
    });
  }

  ngOnInit(): void {
    this.initializeComponent();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onDeviceSelected(deviceId: number): void {
    this.locationService.setSelectedDevice(deviceId);
    this.messageService.add({
      severity: 'info',
      summary: 'Device Selected',
      detail: `Selected device: ${this.getDeviceName(deviceId)}`,
      life: 2000
    });
  }

  onDateSelected(date: Date): void {
    this.locationService.setSelectedDate(date);
    
    // Load location data for the selected date
    const deviceId = this.selectedDevice();
    if (deviceId) {
      this.locationService.getLocationData(deviceId, date).pipe(
        takeUntil(this.destroy$)
      ).subscribe();
    }
    
    this.messageService.add({
      severity: 'info',
      summary: 'Date Selected',
      detail: `Selected date: ${date.toLocaleDateString()}`,
      life: 2000
    });
  }

  onMapMarkerClicked(point: LocationPoint): void {
    // Switch to table tab and highlight the point
    this.activeTabIndex = 1;
    
    this.messageService.add({
      severity: 'info',
      summary: 'Point Selected',
      detail: `Selected point at ${new Date(point.utcTime).toLocaleTimeString()}`,
      life: 2000
    });
  }

  onTablePointSelected(point: LocationPoint): void {
    // Switch to map tab and center on the point
    this.activeTabIndex = 0;
    
    this.messageService.add({
      severity: 'info',
      summary: 'Point Selected',
      detail: `Showing point on map`,
      life: 2000
    });
  }

  onCoordinatesCopied(coordinates: { lat: number; lng: number }): void {
    this.messageService.add({
      severity: 'success',
      summary: 'Coordinates Copied',
      detail: `Copied: ${coordinates.lat.toFixed(6)}, ${coordinates.lng.toFixed(6)}`,
      life: 3000
    });
  }

  clearAllData(): void {
    this.locationService.clearData();
    this.activeTabIndex = 0;
    
    this.messageService.add({
      severity: 'info',
      summary: 'Data Cleared',
      detail: 'All selections and data have been cleared',
      life: 2000
    });
  }

  // Helper methods

  getSelectedDeviceInfo(): DeviceInfo | undefined {
    const deviceId = this.selectedDevice();
    if (!deviceId) return undefined;
    return this.devices().find(device => device.id === deviceId);
  }

  getDeviceName(deviceId: number): string {
    const device = this.devices().find(d => d.id === deviceId);
    return device?.name || `Device ${deviceId}`;
  }

  formatLastUpdated(): string {
    const lastUpdated = this.lastUpdated();
    if (!lastUpdated) return '';
    
    return lastUpdated.toLocaleString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  }

  formatLastSeen(date: Date | undefined): string {
    if (!date) return 'Unknown';
    
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  }

  formatTime(date: Date | undefined): string {
    if (!date) return '';
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  formatDuration(milliseconds: number): string {
    const hours = Math.floor(milliseconds / (1000 * 60 * 60));
    const minutes = Math.floor((milliseconds % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  }

  formatDistance(meters: number): string {
    if (meters < 1000) {
      return `${Math.round(meters)} m`;
    }
    return `${(meters / 1000).toFixed(2)} km`;
  }

  calculateStraightLineDistance(): string {
    const data = this.locationData();
    if (data.length < 2) return '0 m';
    
    const start = data[0];
    const end = data[data.length - 1];
    
    const distance = this.haversineDistance(
      { lat: start.lat, lng: start.lng },
      { lat: end.lat, lng: end.lng }
    );
    
    return this.formatDistance(distance);
  }

  calculateRouteEfficiency(): number {
    const stats = this.statistics();
    if (!stats || stats.totalDistance === 0) return 0;
    
    const data = this.locationData();
    if (data.length < 2) return 0;
    
    const start = data[0];
    const end = data[data.length - 1];
    
    const straightLine = this.haversineDistance(
      { lat: start.lat, lng: start.lng },
      { lat: end.lat, lng: end.lng }
    );
    
    return Math.round((straightLine / stats.totalDistance) * 100);
  }

  getNoDataTitle(): string {
    if (!this.selectedDevice()) {
      return 'Welcome to Location History';
    }
    
    if (!this.selectedDate()) {
      return 'Select a Date';
    }
    
    return 'No Location Data';
  }

  getNoDataMessage(): string {
    if (!this.selectedDevice()) {
      return 'Get started by selecting a device and date to view location tracking data.';
    }
    
    if (!this.selectedDate()) {
      return 'Choose a date from the calendar to view location data for the selected device.';
    }
    
    return 'No location data is available for the selected device and date.';
  }

  canShowInstructions(): boolean {
    return !this.selectedDevice() || !this.selectedDate();
  }

  // Private methods

  private initializeComponent(): void {
    // Could initialize with URL parameters or saved preferences
    // For now, just ensure the service is ready
    this.locationService.loadDevices().pipe(
      takeUntil(this.destroy$)
    ).subscribe();
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