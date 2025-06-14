import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { CardModule } from 'primeng/card';
import { MessageModule } from 'primeng/message';
import { AuthService, LoginRequest, LoginCredentials } from '../../../core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    InputTextModule,
    CardModule,
    MessageModule
  ],
  template: `
    <div class="login-container">
      <p-card header="Syscodeia Tracking Login" class="login-card">
        <form (ngSubmit)="onLogin()" #loginForm="ngForm">
          <div class="field">
            <label for="username">Username</label>
            <input 
              disabled  
              type="text" 
              id="username"
              pInputText 
              [(ngModel)]="credentials.username" 
              name="username"
              required
              class="w-full"
              placeholder="Enter username"
            />
          </div>
          
          <div class="field">
            <label for="password">Password</label>
            <input 
              disabled
              type="password" 
              id="password"
              pInputText 
              [(ngModel)]="credentials.password" 
              name="password"
              required
              class="w-full"
              placeholder="Enter password"
            />
          </div>

          <div class="field">
            <label for="clientId">Client ID</label>
            <input 
              disabled
              type="text" 
              id="clientId"
              pInputText 
              [(ngModel)]="credentials.clientId" 
              name="clientId"
              class="w-full"
              placeholder="Enter client ID"
            />
          </div>

          <p-message 
            *ngIf="errorMessage" 
            severity="error" 
            [text]="errorMessage"
            class="w-full mb-3">
          </p-message>

          <p-button 
            type="submit"
            label="Login"
            [loading]="isLoading"
            [disabled]="!loginForm.form.valid"
            class="w-full">
          </p-button>
        </form>
      </p-card>
    </div>
  `,
  styles: [`
    .login-container {
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      padding: 1rem;
    }

    .login-card {
      width: 100%;
      max-width: 400px;
    }

    .field {
      margin-bottom: 1rem;
    }

    .field label {
      display: block;
      margin-bottom: 0.5rem;
      font-weight: 600;
      color: #374151;
    }

    :host ::ng-deep .p-card-body {
      padding: 2rem;
    }

    :host ::ng-deep .p-card-header {
      text-align: center;
      font-size: 1.5rem;
      font-weight: 600;
      color: #1f2937;
    }
  `]
})
export class LoginComponent {
  credentials: LoginRequest = {
    username: 'Syscodeia',
    password: '123456',
    clientId: 'syscodeia-tracking'
  };

  isLoading = false;
  errorMessage = '';

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  onLogin(): void {
    if (!this.credentials.username || !this.credentials.password) {
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';

    // Use the new authenticate method for better error handling
    this.authService.authenticate(this.credentials as LoginCredentials).subscribe({
      next: (user) => {
        this.isLoading = false;
        this.router.navigate(['/dashboard']);
      },
      error: (error) => {
        this.isLoading = false;
        this.errorMessage = error.message || 'Login failed. Please check your credentials and try again.';
      }
    });
  }
} 