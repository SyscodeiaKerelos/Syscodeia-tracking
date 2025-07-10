import { 
  Component, 
  OnInit, 
  OnDestroy, 
  signal, 
  computed, 
  effect, 
  inject,
  input,
  output
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { DropdownModule } from 'primeng/dropdown';
import { TooltipModule } from 'primeng/tooltip';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { TagModule } from 'primeng/tag';
import { SkeletonModule } from 'primeng/skeleton';
import { Subject, takeUntil } from 'rxjs';
import { LocationHistoryService } from '../../services/location-history.service';
import { 
  LocationPoint, 
  EnhancedLocationPoint, 
  TableColumn 
} from '../../models/location-history.interface';

// Export format type
export type TableExportFormat = 'csv' | 'excel' | 'pdf';

// Extended table column interface for display purposes
export interface DisplayTableColumn {
  field: string;
  header: string;
  sortable: boolean;
  style?: { [key: string]: string };
  styleClass?: string;
  visible: boolean;
}

/**
 * Location Table Component with Angular 19 Signals
 * Displays location data in a sortable, filterable table with export capabilities
 */
@Component({
  selector: 'app-location-table',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TableModule,
    ButtonModule,
    InputTextModule,
    DropdownModule,
    TooltipModule,
    ProgressSpinnerModule,
    TagModule,
    SkeletonModule
  ],
  template: `
    <div class="location-table-container">
      <!-- Table Header -->
      <div class="table-header mb-4">
        <div class="flex flex-wrap align-items-center justify-content-between gap-3">
          <div class="flex align-items-center gap-3">
            <h3 class="text-xl font-semibold text-gray-800 m-0">
              Location Data
              <span class="text-sm font-normal text-gray-500 ml-2" *ngIf="totalRecords()">
                ({{ totalRecords() }} points)
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
            <!-- Export Dropdown -->
            <p-dropdown
              [options]="exportOptions"
              [ngModel]="selectedExportFormat()"
              placeholder="Export"
              (onChange)="onExportFormatChange($event)"
              [style]="{ width: '120px' }"
              [disabled]="!hasData() || loading()"
              pTooltip="Export table data"
              tooltipPosition="top">
              <ng-template pTemplate="selectedItem" let-selectedOption>
                <div class="flex align-items-center gap-2" *ngIf="selectedOption">
                  <i [class]="selectedOption.icon"></i>
                  <span>{{ selectedOption.label }}</span>
                </div>
              </ng-template>
              <ng-template pTemplate="item" let-option>
                <div class="flex align-items-center gap-2">
                  <i [class]="option.icon"></i>
                  <span>{{ option.label }}</span>
                </div>
              </ng-template>
            </p-dropdown>
            
            <!-- Refresh Button -->
            <button 
              pButton 
              type="button" 
              icon="pi pi-refresh" 
              class="p-button-outlined p-button-sm"
              (click)="refreshData()"
              [loading]="loading()"
              [disabled]="!canRefresh()"
              pTooltip="Refresh data"
              tooltipPosition="top">
            </button>
          </div>
        </div>
        
        <!-- Global Filter -->
        <div class="mt-3" *ngIf="hasData()">
          <span class="p-input-icon-left w-full">
            <i class="pi pi-search"></i>
            <input 
              pInputText 
              type="text" 
              [ngModel]="globalFilter()"
              (input)="onGlobalFilter($event)"
              placeholder="Search location data..."
              class="w-full"
              [disabled]="loading()" />
          </span>
        </div>
      </div>

      <!-- Data Table -->
      <p-table 
        #dt
        [value]="displayData()"
        [columns]="visibleColumns()"
        [loading]="loading()"
        [paginator]="true"
        [rows]="pageSize()"
        [rowsPerPageOptions]="rowsPerPageOptions"
        [totalRecords]="totalRecords()"
        [sortField]="defaultSortField"
        [sortOrder]="defaultSortOrder"
        [globalFilterFields]="globalFilterFields"
        [scrollable]="true"
        scrollHeight="500px"
        [resizableColumns]="true"
        [reorderableColumns]="true"
        styleClass="p-datatable-sm p-datatable-striped"
        [tableStyle]="{ 'min-width': '50rem' }"
        [showCurrentPageReport]="true"
        currentPageReportTemplate="Showing {first} to {last} of {totalRecords} entries"
        [exportFilename]="exportFilename()"
        *ngIf="!loading() && hasData(); else loadingTemplate">
        
        <!-- Dynamic Column Headers -->
        <ng-template pTemplate="header">
          <tr>
            <th *ngFor="let col of visibleColumns(); trackBy: trackByColumn" 
                [ngStyle]="col.style" 
                [ngClass]="col.styleClass"
                [pSortableColumn]="col.sortable ? col.field : undefined">
              {{ col.header }}
              <p-sortIcon *ngIf="col.sortable" [field]="col.field"></p-sortIcon>
            </th>
          </tr>
        </ng-template>
        
        <!-- Dynamic Column Bodies -->
        <ng-template pTemplate="body" let-rowData let-rowIndex="rowIndex">
          <tr>
            <td *ngFor="let col of visibleColumns(); trackBy: trackByColumn" [ngStyle]="col.style">
              
              <!-- Time Column -->
              <div *ngIf="col.field === 'formattedTime'" class="flex flex-column">
                <span class="font-medium">{{ formatTime(rowData.utcTime) }}</span>
                <small class="text-gray-500">{{ formatDate(rowData.utcTime) }}</small>
              </div>
              
              <!-- Latitude Column -->
              <span *ngIf="col.field === 'lat'">{{ formatCoordinate(rowData.lat, 'lat') }}</span>
              
              <!-- Longitude Column -->
              <span *ngIf="col.field === 'lng'">{{ formatCoordinate(rowData.lng, 'lng') }}</span>
              
              <!-- Speed Column -->
              <div *ngIf="col.field === 'speedKmh'" class="flex align-items-center gap-2">
                <span class="font-medium">{{ rowData.speedKmh || 0 }}</span>
                <small class="text-gray-500">km/h</small>
                <p-tag 
                  *ngIf="getSpeedCategory(rowData.speedKmh)"
                  [value]="getSpeedCategory(rowData.speedKmh)?.label"
                  [severity]="getSpeedCategory(rowData.speedKmh)?.severity"
                  [style]="{ fontSize: '0.7rem' }">
                </p-tag>
              </div>
              
              <!-- Direction Column -->
              <div *ngIf="col.field === 'directionText'" class="flex align-items-center gap-2">
                <i class="pi pi-compass text-blue-500"></i>
                <span>{{ rowData.directionText }}</span>
                <small class="text-gray-500">({{ rowData.heading }}°)</small>
              </div>
              
              <!-- Altitude Column -->
              <div *ngIf="col.field === 'alt'" class="flex align-items-center gap-2">
                <span>{{ formatAltitude(rowData.alt) }}</span>
                <small class="text-gray-500">m</small>
              </div>
              
              <!-- Accuracy Column -->
              <div *ngIf="col.field === 'accuracy'" class="flex align-items-center gap-2">
                <span>{{ formatAccuracy(getAccuracy(rowData)) }}</span>
                <p-tag 
                   [value]="getAccuracyCategory(getAccuracy(rowData)).label"
                   [severity]="getAccuracyCategory(getAccuracy(rowData)).severity"
                   [style]="{ fontSize: '0.7rem' }">
                </p-tag>
              </div>
              
              <!-- Distance Column -->
              <span *ngIf="col.field === 'distanceFromPrevious'">
                <span *ngIf="rowData.distanceFromPrevious; else noPrevious">
                  {{ formatDistance(rowData.distanceFromPrevious) }}
                </span>
                <ng-template #noPrevious>
                  <span class="text-gray-400">-</span>
                </ng-template>
              </span>
              
              <!-- Actions Column -->
              <div *ngIf="col.field === 'actions'" class="flex gap-1">
                <button 
                  pButton 
                  type="button" 
                  icon="pi pi-map-marker" 
                  class="p-button-text p-button-sm p-button-rounded"
                  (click)="showOnMap(rowData)"
                  pTooltip="Show on map"
                  tooltipPosition="top">
                </button>
                <button 
                  pButton 
                  type="button" 
                  icon="pi pi-copy" 
                  class="p-button-text p-button-sm p-button-rounded"
                  (click)="copyCoordinates(rowData)"
                  pTooltip="Copy coordinates"
                  tooltipPosition="top">
                </button>
              </div>
              
            </td>
          </tr>
        </ng-template>
      </p-table>

      <!-- Loading Template -->
      <ng-template #loadingTemplate>
        <div class="loading-container" *ngIf="loading()">
          <div class="text-center py-8">
            <p-progressSpinner 
              [style]="{ width: '50px', height: '50px' }"
              strokeWidth="4"
              animationDuration="1s">
            </p-progressSpinner>
            <p class="text-gray-600 mt-3">Loading location data...</p>
          </div>
        </div>
        
        <!-- No Data Template -->
        <div class="no-data-container" *ngIf="!loading() && !hasData()">
          <div class="text-center py-12">
            <i class="pi pi-map text-6xl text-gray-300 mb-4"></i>
            <h4 class="text-gray-600 mb-2">No Location Data</h4>
            <p class="text-gray-500">
              {{ getNoDataMessage() }}
            </p>
          </div>
        </div>
      </ng-template>

      <!-- Statistics Summary -->
      <div class="statistics-summary mt-4" *ngIf="hasData() && statistics()">
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div class="stat-card">
            <div class="stat-value">{{ statistics()?.totalPoints }}</div>
            <div class="stat-label">Total Points</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">{{ formatDistance(statistics()?.totalDistance || 0) }}</div>
            <div class="stat-label">Total Distance</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">{{ Math.round(statistics()?.maxSpeed || 0) }} km/h</div>
            <div class="stat-label">Max Speed</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">{{ Math.round(statistics()?.averageSpeed || 0) }} km/h</div>
            <div class="stat-label">Avg Speed</div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .location-table-container {
      background: white;
      border-radius: 8px;
      padding: 1.5rem;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }

    .table-header {
      border-bottom: 1px solid #e5e7eb;
      padding-bottom: 1rem;
    }

    .loading-container,
    .no-data-container {
      border: 2px dashed #e5e7eb;
      border-radius: 8px;
      background: #f9fafb;
    }

    .statistics-summary {
      border-top: 1px solid #e5e7eb;
      padding-top: 1rem;
    }

    .stat-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 1rem;
      text-align: center;
    }

    .stat-value {
      font-size: 1.5rem;
      font-weight: 700;
      color: #1e293b;
      line-height: 1;
    }

    .stat-label {
      font-size: 0.875rem;
      color: #64748b;
      margin-top: 0.25rem;
    }

    :deep(.p-datatable) {
      border-radius: 6px;
      overflow: hidden;
    }

    :deep(.p-datatable .p-datatable-thead > tr > th) {
      background: #f8fafc;
      border-color: #e2e8f0;
      font-weight: 600;
      color: #374151;
    }

    :deep(.p-datatable .p-datatable-tbody > tr:hover) {
      background: #f1f5f9;
    }

    :deep(.p-paginator) {
      border-top: 1px solid #e2e8f0;
      background: #f8fafc;
    }

    @media (max-width: 768px) {
      .location-table-container {
        padding: 1rem;
      }
      
      .table-header .flex {
        flex-direction: column;
        align-items: stretch;
      }
      
      .statistics-summary .grid {
        grid-template-columns: repeat(2, 1fr);
      }
    }

    @media (max-width: 640px) {
      .statistics-summary .grid {
        grid-template-columns: 1fr;
      }
    }
  `]
})
export class LocationTableComponent implements OnInit, OnDestroy {
  readonly Math = Math;
  private readonly destroy$ = new Subject<void>();
  private readonly locationService = inject(LocationHistoryService);

  // Input/Output signals
  readonly showActions = input(true);
  readonly pageSize = input(25);
  readonly pointSelected = output<LocationPoint>();
  readonly coordinatesCopied = output<{ lat: number; lng: number }>();

  // Component state signals
  private readonly _globalFilter = signal('');
  private readonly _selectedExportFormat = signal<TableExportFormat | null>(null);
  private readonly _visibleColumns = signal<DisplayTableColumn[]>([]);

  // Service state signals
  readonly locationData = this.locationService.enhancedLocationData;
  readonly loading = this.locationService.loading;
  readonly selectedDate = this.locationService.selectedDate;
  readonly statistics = this.locationService.statistics;

  // Computed signals
  readonly globalFilter = computed(() => this._globalFilter());
  readonly selectedExportFormat = computed(() => this._selectedExportFormat());
  readonly visibleColumns = computed(() => this._visibleColumns());
  
  readonly hasData = computed(() => this.locationData().length > 0);
  readonly totalRecords = computed(() => this.locationData().length);
  readonly canRefresh = computed(() => {
    const device = this.locationService.selectedDevice();
    const date = this.selectedDate();
    return device !== null && date !== null;
  });

  readonly displayData = computed(() => {
    const data = this.locationData();
    const filter = this.globalFilter().toLowerCase();
    
    if (!filter) {
      return data;
    }
    
    return data.filter(item => 
      this.globalFilterFields.some(field => {
        const value = this.getNestedProperty(item, field);
        return value?.toString().toLowerCase().includes(filter);
      })
    );
  });

  readonly exportFilename = computed(() => {
    const date = this.selectedDate();
    const device = this.locationService.selectedDevice();
    const dateStr = date ? date.toISOString().split('T')[0] : 'unknown';
    return `location-data-device${device}-${dateStr}`;
  });

  // Constants
  readonly rowsPerPageOptions = [10, 25, 50, 100];
  readonly defaultSortField = 'utcTime';
  readonly defaultSortOrder = -1; // Descending
  readonly globalFilterFields = [
    'formattedTime', 'lat', 'lng', 'speedKmh', 'directionText', 'alt'
  ];

  readonly exportOptions = [
    { label: 'CSV', value: 'csv' as TableExportFormat, icon: 'pi pi-file' },
    { label: 'Excel', value: 'excel' as TableExportFormat, icon: 'pi pi-file-excel' },
    { label: 'PDF', value: 'pdf' as TableExportFormat, icon: 'pi pi-file-pdf' }
  ];

  readonly defaultColumns: DisplayTableColumn[] = [
    {
      field: 'formattedTime',
      header: 'Time',
      sortable: true,
      style: { width: '150px' },
      visible: true
    },
    {
      field: 'lat',
      header: 'Latitude',
      sortable: true,
      style: { width: '120px' },
      visible: true
    },
    {
      field: 'lng',
      header: 'Longitude',
      sortable: true,
      style: { width: '120px' },
      visible: true
    },
    {
      field: 'speedKmh',
      header: 'Speed',
      sortable: true,
      style: { width: '100px' },
      visible: true
    },
    {
      field: 'directionText',
      header: 'Direction',
      sortable: true,
      style: { width: '100px' },
      visible: true
    },
    {
      field: 'alt',
      header: 'Altitude',
      sortable: true,
      style: { width: '100px' },
      visible: true
    },
    {
      field: 'accuracy',
      header: 'Accuracy',
      sortable: true,
      style: { width: '100px' },
      visible: true
    },
    {
      field: 'distanceFromPrevious',
      header: 'Distance',
      sortable: true,
      style: { width: '100px' },
      visible: true
    }
  ];

  readonly sortFields = [
    { label: 'Time', value: 'timestamp' },
    { label: 'Latitude', value: 'lat' },
    { label: 'Longitude', value: 'lng' },
    { label: 'Speed', value: 'speedKmh' },
    { label: 'Direction', value: 'heading' },
    { label: 'Altitude', value: 'alt' }
  ];

  // Component properties - removed duplicates, using signals instead

  constructor() {
    // Initialize visible columns
    effect(() => {
      const showActions = this.showActions();
      const columns = this.defaultColumns.filter(col => 
        col.field !== 'actions' || showActions
      );
      this._visibleColumns.set(columns);
    });
  }

  ngOnInit(): void {
    this.initializeComponent();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onGlobalFilter(event: Event): void {
    const target = event.target as HTMLInputElement;
    this._globalFilter.set(target.value);
  }

  onExportFormatChange(event: any): void {
    const format = event.value as TableExportFormat;
    this._selectedExportFormat.set(format);
    this.exportData(format);
  }

  refreshData(): void {
    this.locationService.refreshData().pipe(
      takeUntil(this.destroy$)
    ).subscribe();
  }

  showOnMap(point: LocationPoint): void {
    this.pointSelected.emit(point);
  }

  copyCoordinates(point: LocationPoint): void {
    const coordinates = `${point.lat}, ${point.lng}`;
    navigator.clipboard.writeText(coordinates).then(() => {
      this.coordinatesCopied.emit({ lat: point.lat, lng: point.lng });
    }).catch(err => {
      console.error('Failed to copy coordinates:', err);
    });
  }

  trackByColumn(index: number, column: DisplayTableColumn): string {
    return column.field;
  }

  // Formatting methods

  formatTime(utcTime: number): string {
    return new Date(utcTime).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  }

  formatDate(utcTime: number): string {
    return new Date(utcTime).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });
  }

  formatSelectedDate(): string {
    const date = this.selectedDate();
    if (!date) return '';
    
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  }

  formatCoordinate(value: number, type: 'lat' | 'lng'): string {
    const direction = type === 'lat' 
      ? (value >= 0 ? 'N' : 'S')
      : (value >= 0 ? 'E' : 'W');
    return `${Math.abs(value).toFixed(6)}° ${direction}`;
  }

  formatDistance(meters: number): string {
    if (meters < 1000) {
      return `${Math.round(meters)} m`;
    }
    return `${(meters / 1000).toFixed(2)} km`;
  }

  formatAltitude(altitude: number): string {
    return altitude ? Math.round(altitude).toString() : '0';
  }

  formatAccuracy(accuracy: number): string {
    return accuracy ? `±${Math.round(accuracy)} m` : 'Unknown';
  }

  getSpeedCategory(speed: number): { label: string; severity: string } | null {
    if (!speed || speed === 0) return null;
    
    if (speed < 5) return { label: 'Slow', severity: 'success' };
    if (speed < 30) return { label: 'Normal', severity: 'info' };
    if (speed < 60) return { label: 'Fast', severity: 'warning' };
    return { label: 'Very Fast', severity: 'danger' };
  }

  getAccuracyCategory(accuracy: number): { label: string; severity: string } {
    if (!accuracy) return { label: 'Unknown', severity: 'secondary' };
    
    if (accuracy <= 5) return { label: 'Excellent', severity: 'success' };
    if (accuracy <= 10) return { label: 'Good', severity: 'info' };
    if (accuracy <= 20) return { label: 'Fair', severity: 'warning' };
    return { label: 'Poor', severity: 'danger' };
  }

  getNoDataMessage(): string {
    const device = this.locationService.selectedDevice();
    const date = this.selectedDate();
    
    if (!device) {
      return 'Please select a device to view location data.';
    }
    
    if (!date) {
      return 'Please select a date to view location data.';
    }
    
    return 'No location data available for the selected date.';
  }

  getAccuracy(rowData: EnhancedLocationPoint): number {
    // Since accuracy is not in the base interface, we'll use a default or extract from info array
    return 0; // Default accuracy when not available
  }

  // Private methods

  private initializeComponent(): void {
    // Initialize with default columns
    this._visibleColumns.set(this.defaultColumns);
  }

  private exportData(format: TableExportFormat): void {
    const data = this.displayData();
    const filename = this.exportFilename();
    
    switch (format) {
      case 'csv':
        this.exportToCSV(data, filename);
        break;
      case 'excel':
        this.exportToExcel(data, filename);
        break;
      case 'pdf':
        this.exportToPDF(data, filename);
        break;
    }
    
    // Reset selection
    this._selectedExportFormat.set(null);
  }

  private exportToCSV(data: EnhancedLocationPoint[], filename: string): void {
    const headers = [
      'Time',
      'Latitude',
      'Longitude', 
      'Speed (km/h)',
      'Direction',
      'Heading (°)',
      'Altitude (m)',
      'Accuracy (m)',
      'Distance from Previous (m)'
    ];
    
    const csvContent = [
      headers.join(','),
      ...data.map(point => [
        `"${point.formattedTime}"`,
        point.lat,
        point.lng,
        point.speedKmh || 0,
        `"${point.directionText}"`,
        point.heading,
        point.alt || 0,
        this.getAccuracy(point),
        point.distanceFromPrevious || 0
      ].join(','))
    ].join('\n');
    
    this.downloadFile(csvContent, `${filename}.csv`, 'text/csv');
  }

  private exportToExcel(data: EnhancedLocationPoint[], filename: string): void {
    // This would require a library like xlsx
    // For now, export as CSV with .xlsx extension
    this.exportToCSV(data, filename);
  }

  private exportToPDF(data: EnhancedLocationPoint[], filename: string): void {
    // This would require a library like jsPDF
    // For now, export as CSV
    this.exportToCSV(data, filename);
  }

  private downloadFile(content: string, filename: string, mimeType: string): void {
    const blob = new Blob([content], { type: mimeType });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    window.URL.revokeObjectURL(url);
  }

  private getNestedProperty(obj: any, path: string): any {
    return path.split('.').reduce((current, prop) => current?.[prop], obj);
  }
}