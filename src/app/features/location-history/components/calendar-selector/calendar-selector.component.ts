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
import { CalendarModule } from 'primeng/calendar';
import { ButtonModule } from 'primeng/button';
import { DropdownModule } from 'primeng/dropdown';
import { SkeletonModule } from 'primeng/skeleton';
import { TooltipModule } from 'primeng/tooltip';
import { Subject, takeUntil, debounceTime, distinctUntilChanged } from 'rxjs';
import { LocationHistoryService } from '../../services/location-history.service';
import { DeviceInfo, CalendarDay } from '../../models/location-history.interface';

/**
 * Calendar Selector Component with Angular 19 Signals
 * Provides device selection and date navigation with available dates highlighting
 */
@Component({
  selector: 'app-calendar-selector',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    CalendarModule,
    ButtonModule,
    DropdownModule,
    SkeletonModule,
    TooltipModule
  ],
  templateUrl: './calendar-selector.component.html',
  styles: [`
    .calendar-selector-container {
      background: white;
      border-radius: 8px;
      padding: 1.5rem;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }

    .calendar-grid {
      border: 1px solid #e5e7eb;
      border-radius: 6px;
      overflow: hidden;
    }

    .calendar-header {
      display: grid;
      grid-template-columns: repeat(7, 1fr);
      background: #f9fafb;
      border-bottom: 1px solid #e5e7eb;
    }

    .calendar-day-header {
      padding: 0.75rem 0.5rem;
      text-align: center;
      font-weight: 600;
      font-size: 0.875rem;
      color: #6b7280;
      border-right: 1px solid #e5e7eb;
    }

    .calendar-day-header:last-child {
      border-right: none;
    }

    .calendar-body {
      display: grid;
      grid-template-columns: repeat(7, 1fr);
    }

    .calendar-day {
      position: relative;
      padding: 0.75rem 0.5rem;
      text-align: center;
      border-right: 1px solid #e5e7eb;
      border-bottom: 1px solid #e5e7eb;
      min-height: 3rem;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      transition: all 0.2s ease;
    }

    .calendar-day:nth-child(7n) {
      border-right: none;
    }

    .calendar-day.other-month {
      color: #d1d5db;
      background: #f9fafb;
    }

    .calendar-day.clickable {
      cursor: pointer;
    }

    .calendar-day.clickable:hover {
      background: #f3f4f6;
    }

    .calendar-day.available {
      background: #ecfdf5;
      color: #065f46;
    }

    .calendar-day.available.clickable:hover {
      background: #d1fae5;
    }

    .calendar-day.selected {
      background: #3b82f6;
      color: white;
    }

    .calendar-day.today {
      font-weight: 700;
    }

    .calendar-day.today:not(.selected) {
      background: #fef3c7;
      color: #92400e;
    }

    .day-number {
      font-size: 0.875rem;
      line-height: 1;
    }

    .day-indicator {
      margin-top: 0.25rem;
      color: #10b981;
    }

    .calendar-day.selected .day-indicator {
      color: rgba(255, 255, 255, 0.8);
    }

    .calendar-day-skeleton {
      margin: 0.5rem;
    }

    .device-selection :deep(.p-dropdown) {
      width: 100%;
    }

    .no-device-state {
      border: 2px dashed #e5e7eb;
      border-radius: 8px;
    }

    @media (max-width: 640px) {
      .calendar-selector-container {
        padding: 1rem;
      }
      
      .calendar-day {
        padding: 0.5rem 0.25rem;
        min-height: 2.5rem;
      }
      
      .day-number {
        font-size: 0.75rem;
      }
    }
  `]
})
export class CalendarSelectorComponent implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();
  private readonly locationService = inject(LocationHistoryService);

  // Input/Output signals (Angular 19)
  readonly initialDevice = input<number | null>(null);
  readonly initialDate = input<Date | null>(null);
  readonly deviceSelected = output<number>();
  readonly dateSelected = output<Date>();

  // Component state signals
  private readonly _currentMonth = signal(new Date());
  private readonly _selectedDeviceId = signal<number | null>(null);
  private readonly _availableDates = signal<Set<number>>(new Set());
  private readonly _calendarLoading = signal(false);
  private readonly _devicesLoading = signal(false);
  private readonly _navigationLoading = signal(false);

  // Service state signals
  readonly devices = this.locationService.devices;
  readonly selectedDate = this.locationService.selectedDate;
  readonly loading = this.locationService.loading;

  // Computed signals
  readonly currentMonth = computed(() => this._currentMonth());
  readonly selectedDeviceId = computed(() => this._selectedDeviceId());
  readonly availableDates = computed(() => this._availableDates());
  readonly calendarLoading = computed(() => this._calendarLoading());
  readonly devicesLoading = computed(() => this._devicesLoading());
  readonly navigationLoading = computed(() => this._navigationLoading());

  readonly currentMonthDisplay = computed(() => {
    const month = this.currentMonth();
    return month.toLocaleDateString('en-US', { 
      month: 'long', 
      year: 'numeric' 
    });
  });

  readonly deviceOptions = computed(() => {
    return this.devices().map(device => ({
      label: device.name,
      value: device.id
    }));
  });

  readonly selectedDeviceName = computed(() => {
    const deviceId = this.selectedDeviceId();
    if (!deviceId) return null;
    const device = this.devices().find(d => d.id === deviceId);
    return device?.name || null;
  });

  readonly calendarDays = computed(() => {
    const month = this.currentMonth();
    const availableDates = this.availableDates();
    const selectedDate = this.selectedDate();
    
    return this.generateCalendarDays(month, availableDates, selectedDate ?? null);
  });

  readonly isCurrentMonth = computed(() => {
    const current = this.currentMonth();
    const now = new Date();
    return current.getFullYear() === now.getFullYear() && 
           current.getMonth() === now.getMonth();
  });

  // Constants
  readonly weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  readonly skeletonArray = Array(42).fill(0); // 6 weeks × 7 days

  // Reactive effects
  constructor() {
    // Effect to load available dates when device or month changes
    effect(() => {
      const deviceId = this.selectedDeviceId();
      const month = this.currentMonth();
      
      if (deviceId) {
        this.loadAvailableDates(deviceId, month);
      } else {
        this._availableDates.set(new Set());
      }
    });

    // Effect to handle initial values
    effect(() => {
      const initialDevice = this.initialDevice();
      const initialDate = this.initialDate();
      
      if (initialDevice && this.selectedDeviceId() !== initialDevice) {
        this._selectedDeviceId.set(initialDevice);
      }
      
      if (initialDate && this.currentMonth().getMonth() !== initialDate.getMonth()) {
        this._currentMonth.set(new Date(initialDate.getFullYear(), initialDate.getMonth(), 1));
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

  onDeviceChange(event: any): void {
    const deviceId = event.value;
    this._selectedDeviceId.set(deviceId);
    this.locationService.setSelectedDevice(deviceId);
    this.deviceSelected.emit(deviceId);
    
    // Reset selected date when device changes
    this.locationService.setSelectedDate(null);
  }

  onDateSelect(day: CalendarDay): void {
    if (!day.hasData || !day.isCurrentMonth) {
      return;
    }

    const selectedDate = new Date(
      this.currentMonth().getFullYear(),
      this.currentMonth().getMonth(),
      day.day
    );
    
    this.locationService.setSelectedDate(selectedDate);
    this.dateSelected.emit(selectedDate);
  }

  navigateMonth(direction: number): void {
    if (this.navigationLoading()) return;
    
    this._navigationLoading.set(true);
    
    const current = this.currentMonth();
    const newMonth = new Date(current.getFullYear(), current.getMonth() + direction, 1);
    
    // Don't allow navigation to future months
    const now = new Date();
    if (newMonth > now) {
      this._navigationLoading.set(false);
      return;
    }
    
    this._currentMonth.set(newMonth);
    
    // Small delay to show loading state
    setTimeout(() => {
      this._navigationLoading.set(false);
    }, 300);
  }

  getDeviceById(deviceId: number): DeviceInfo | undefined {
    return this.devices().find(device => device.id === deviceId);
  }

  getDateTooltip(day: CalendarDay): string {
    if (!day.isCurrentMonth) {
      return '';
    }
    
    if (day.hasData) {
      return `Location data available for ${day.day}`;
    }
    
    return `No location data for ${day.day}`;
  }

  formatSelectedDate(): string {
    const date = this.selectedDate();
    if (!date) return '';
    
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  trackByDay(index: number, day: CalendarDay): string {
    return `${day.day}-${day.isCurrentMonth}`;
  }

  // Private methods

  private initializeComponent(): void {
    // Set initial month to current month
    const now = new Date();
    this._currentMonth.set(new Date(now.getFullYear(), now.getMonth(), 1));
  }

  private loadAvailableDates(deviceId: number, month: Date): void {
    this._calendarLoading.set(true);
    
    this.locationService.getAvailableDates(
      deviceId,
      month.getFullYear(),
      month.getMonth() + 1
    ).pipe(
      takeUntil(this.destroy$),
      debounceTime(100),
      distinctUntilChanged()
    ).subscribe({
      next: (dates) => {
        this._availableDates.set(new Set(dates));
        this._calendarLoading.set(false);
      },
      error: (error) => {
        console.error('Failed to load available dates:', error);
        this._availableDates.set(new Set());
        this._calendarLoading.set(false);
      }
    });
  }

  private generateCalendarDays(
    month: Date, 
    availableDates: Set<number>, 
    selectedDate: Date | null
  ): CalendarDay[] {
    const days: CalendarDay[] = [];
    const now = new Date();
    const firstDay = new Date(month.getFullYear(), month.getMonth(), 1);
    const lastDay = new Date(month.getFullYear(), month.getMonth() + 1, 0);
    const startDate = new Date(firstDay);
    
    // Start from the beginning of the week
    startDate.setDate(startDate.getDate() - startDate.getDay());
    
    // Generate 42 days (6 weeks)
    for (let i = 0; i < 42; i++) {
      const currentDate = new Date(startDate);
      currentDate.setDate(startDate.getDate() + i);
      
      const isCurrentMonth = currentDate.getMonth() === month.getMonth();
      const isToday = this.isSameDay(currentDate, now);
      const isSelected = selectedDate ? this.isSameDay(currentDate, selectedDate) : false;
      const hasData = isCurrentMonth && availableDates.has(currentDate.getDate());
      
      days.push({
        day: currentDate.getDate(),
        date: new Date(currentDate),
        isCurrentMonth,
        isToday,
        isSelected,
        hasData
      });
    }
    
    return days;
  }

  private isSameDay(date1: Date, date2: Date): boolean {
    return date1.getFullYear() === date2.getFullYear() &&
           date1.getMonth() === date2.getMonth() &&
           date1.getDate() === date2.getDate();
  }
}