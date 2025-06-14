import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonModule } from 'primeng/button';

export interface HeaderAction {
  label: string;
  icon: string;
  severity?: 'primary' | 'secondary' | 'success' | 'info' | 'warning' | 'help' | 'danger';
  loading?: boolean;
  action: () => void;
}

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, ButtonModule],
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss'
})
export class HeaderComponent {
  @Input() title: string = '';
  @Input() subtitle?: string;
  @Input() actions: HeaderAction[] = [];
  @Input() showShadow: boolean = true;
  @Input() backgroundColor: string = 'white';

  onActionClick(action: HeaderAction): void {
    action.action();
  }
}