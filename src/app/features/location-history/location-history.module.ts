import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { GoogleMapsModule } from '@angular/google-maps';

// PrimeNG Modules
import { ButtonModule } from 'primeng/button';
import { CalendarModule } from 'primeng/calendar';
import { CardModule } from 'primeng/card';
import { DropdownModule } from 'primeng/dropdown';
import { TableModule } from 'primeng/table';
import { ToastModule } from 'primeng/toast';
import { ProgressBarModule } from 'primeng/progressbar';
import { SkeletonModule } from 'primeng/skeleton';
import { TabViewModule } from 'primeng/tabview';
import { DividerModule } from 'primeng/divider';
import { TooltipModule } from 'primeng/tooltip';
import { InputTextModule } from 'primeng/inputtext';
import { MultiSelectModule } from 'primeng/multiselect';
import { SliderModule } from 'primeng/slider';
import { ToggleButtonModule } from 'primeng/togglebutton';
import { ChipModule } from 'primeng/chip';
import { BadgeModule } from 'primeng/badge';
import { MessageService } from 'primeng/api';

// Feature Components
import { LocationHistoryPageComponent } from './pages/location-history/location-history-page.component';
import { CalendarSelectorComponent } from './components/calendar-selector/calendar-selector.component';
import { LocationTableComponent } from './components/location-table/location-table.component';
import { HistoryMapComponent } from './components/location-map/history-map.component';

// Services
import { LocationHistoryService } from './services/location-history.service';
import { LocationCacheService } from './services/location-cache.service';

// Routing
import { LocationHistoryRoutingModule } from './location-history-routing.module';

/**
 * Location History Feature Module
 * 
 * This module encapsulates all location history functionality including:
 * - Calendar-based date selection
 * - Interactive map visualization
 * - Tabular data display with sorting/filtering
 * - Analytics and statistics
 * - Device management
 * - Caching and performance optimization
 * 
 * Built with Angular 19 features:
 * - Standalone components
 * - Signals for reactive state management
 * - Modern RxJS patterns
 * - Computed signals and effects
 * - Signal-based services
 */
@NgModule({
  declarations: [
    // Note: Components are standalone, so they're not declared here
    // This module serves as a feature boundary and dependency container
  ],
  imports: [
    // Angular Core
    CommonModule,
    ReactiveFormsModule,
    
    // Google Maps
    GoogleMapsModule,
    
    // PrimeNG UI Components
    ButtonModule,
    CalendarModule,
    CardModule,
    DropdownModule,
    TableModule,
    ToastModule,
    ProgressBarModule,
    SkeletonModule,
    TabViewModule,
    DividerModule,
    TooltipModule,
    InputTextModule,
    MultiSelectModule,
    SliderModule,
    ToggleButtonModule,
    ChipModule,
    BadgeModule,
    
    // Feature Routing
    LocationHistoryRoutingModule,
    
    // Standalone Components
    LocationHistoryPageComponent,
    CalendarSelectorComponent,
    LocationTableComponent,
    HistoryMapComponent
  ],
  providers: [
    // Feature Services
    LocationHistoryService,
    LocationCacheService,
    
    // PrimeNG Services
    MessageService
  ],
  exports: [
    // Export main components for potential use in other modules
    LocationHistoryPageComponent,
    CalendarSelectorComponent,
    LocationTableComponent,
    HistoryMapComponent
  ]
})
export class LocationHistoryModule {
  constructor() {
    // Module initialization
    console.log('LocationHistoryModule initialized with Angular 19 features');
  }
}