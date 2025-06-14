import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpErrorResponse } from '@angular/common/http';
import { Observable, BehaviorSubject, throwError } from 'rxjs';
import { map, catchError, tap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { UserService } from './user.service';

export interface LoginCredentials {
  username: string;
  password: string;
  clientId?: string;
}

export interface AuthenticationResponse {
  data: {
    token: string;
    user: UserContext;
  };
  code: number;
  message: string;
}

export interface UserContext {
  id: number;
  departmentId: number;
  userType: number;
  name: string;
  username: string;
  nickName: string;
  headImg: string;
  email: string;
  phone: string;
  status: number;
  createdAt?: string;
  updatedAt?: string;
}

// Legacy interface for backward compatibility
export interface LoginRequest {
  username: string;
  password: string;
  clientId?: string;
}

export interface LoginResponse {
  token: string;
  user?: any;
}

// API Response interfaces based on specification
export interface ApiResponse<T> {
  data: T;
  code: number;
  message: string;
}

export interface UserData {
  id: number;
  departmentId: number;
  userType: number;
  name: string;
  username: string;
  nickName: string;
  headImg: string;
  email: string;
  phone: string;
  status: number;
}

export interface LoginApiResponse {
  token: string;
  user: UserData;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly baseUrl = environment.traxbeanApiUrl;
  private readonly tokenKey = 'traxbean_jwt_token';
  private readonly userContextKey = 'traxbean_user_context';
  
  // Reactive authentication state management
  private currentUserSubject = new BehaviorSubject<UserContext | null>(null);
  private isAuthenticatedSubject = new BehaviorSubject<boolean>(false);
  private tokenSubject = new BehaviorSubject<string | null>(this.getStoredToken());
  
  public currentUser$ = this.currentUserSubject.asObservable();
  public isAuthenticated$ = this.isAuthenticatedSubject.asObservable();
  public token$ = this.tokenSubject.asObservable();

  private readonly httpOptions = {
    headers: new HttpHeaders({
      'Content-Type': 'application/json'
    })
  };

  private tempToken: string = '';

  constructor(
    private http: HttpClient,
    private userService: UserService,
  ) {
    this.initializeAuthenticationState();
  }

  /**
   * Primary authentication method with comprehensive error handling
   * Implements enterprise-grade token management and state synchronization
   */
  authenticate(credentials: LoginCredentials): Observable<UserContext> {
    const loginPayload = {
      username: credentials.username.trim(),
      password: credentials.password,
      clientId: 'syscodeia-tracking'
    };

    const url = `${this.baseUrl}/app/traxbean/login`;

    return this.http.post<AuthenticationResponse>(
      url,
      loginPayload,
      this.httpOptions
    ).pipe(
      map(response => this.validateAuthenticationResponse(response)),
      tap(userContext => this.establishAuthenticatedSession(userContext)),
      catchError(error => {
        return this.handleAuthenticationError(error);
      })
    );
  }

  /**
   * Legacy login method for backward compatibility
   */
  login(credentials: LoginRequest): Observable<LoginResponse> {
    return this.authenticate(credentials).pipe(
      map(user => ({
        token: this.tempToken,
        user: user
      }))
    );
  }

  /**
   * Secure token storage with encryption consideration
   * Implements JWT lifecycle management
   */
  private establishAuthenticatedSession(user: UserContext): void {
    const token = this.tempToken;
    
    // Store token and user context
    localStorage.setItem(this.tokenKey, token);
    localStorage.setItem(this.userContextKey, JSON.stringify(user));
    
         // Update reactive state
     this.currentUserSubject.next(user);
     this.isAuthenticatedSubject.next(true);
     this.tokenSubject.next(token);

     // Store user information with the complete user data
     this.userService.setUser(user);
  }

  /**
   * Retrieve stored JWT token for API authorization
   */
  getAuthToken(): string | null {
    return localStorage.getItem(this.tokenKey);
  }

  /**
   * Legacy getToken method for backward compatibility
   */
  getToken(): string | null {
    return this.getAuthToken();
  }

  /**
   * Generate authorization headers for subsequent API calls
   */
  getAuthHeaders(): HttpHeaders {
    const token = this.getAuthToken();
    if (!token) {
      throw new Error('No authentication token available. Please login first.');
    }

    return new HttpHeaders({
      'Authorization': `${token}`,
      'Content-Type': 'application/json'
    });
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    const token = this.getAuthToken();
    const user = this.getCurrentUser();
    return !!(token && user);
  }

  /**
   * Get current user context
   */
  getCurrentUser(): UserContext | null {
    return this.currentUserSubject.value;
  }

  /**
   * Get current user ID for API calls
   */
  getCurrentUserId(): number | null {
    const user = this.getCurrentUser();
    return user ? user.id : null;
  }

  /**
   * Comprehensive logout with state cleanup
   */
  logout(): void {
    localStorage.removeItem(this.tokenKey);
    localStorage.removeItem(this.userContextKey);
    
    this.currentUserSubject.next(null);
    this.isAuthenticatedSubject.next(false);
    this.tokenSubject.next(null);
    this.userService.clearUser();
  }

  /**
   * Initialize authentication state on application bootstrap
   */
  private initializeAuthenticationState(): void {
    const storedUser = localStorage.getItem(this.userContextKey);
    const storedToken = this.getAuthToken();

    if (storedUser && storedToken) {
      try {
        const user: UserContext = JSON.parse(storedUser);
        this.currentUserSubject.next(user);
        this.isAuthenticatedSubject.next(true);
        this.tokenSubject.next(storedToken);
      } catch (error) {
        console.error('Failed to parse stored user context:', error);
        this.logout();
      }
    }
  }

  /**
   * Validate API response structure and business logic
   */
  private validateAuthenticationResponse(response: AuthenticationResponse): UserContext {
    if (response.code !== 200) {
      throw new Error(`Authentication failed: ${response.message}`);
    }

    if (!response.data?.token || !response.data?.user) {
      throw new Error('Invalid authentication response structure');
    }

    // Store token temporarily for session establishment
    this.tempToken = response.data.token;

    return response.data.user;
  }

  /**
   * Centralized error handling with detailed logging
   */
  private handleAuthenticationError(error: HttpErrorResponse): Observable<never> {
    let errorMessage = 'Authentication failed';

    if (error.error instanceof ErrorEvent) {
      // Client-side network error
      errorMessage = `Network error: ${error.error.message}`;
    } else {
      // Server-side error
      switch (error.status) {
        case 0:
          errorMessage = 'Network error. Please check your internet connection and CORS configuration.';
          break;
        case 400:
          errorMessage = 'Invalid request. Please check your credentials.';
          break;
        case 401:
          errorMessage = 'Invalid credentials provided';
          break;
        case 403:
          errorMessage = 'Access denied. Please contact your administrator.';
          break;
        case 404:
          errorMessage = 'API endpoint not found. The Traxbean API may not be publicly accessible or the endpoint path may be incorrect.';
          break;
        case 429:
          errorMessage = 'Too many login attempts. Please try again later.';
          break;
        case 500:
          errorMessage = 'Server error. Please contact system administrator.';
          break;
        case 503:
          errorMessage = 'Service temporarily unavailable. Please try again later.';
          break;
        default:
          errorMessage = error.error?.message || `Unexpected error: ${error.message}`;
      }
    }

    console.error('Authentication Error:', {
      status: error.status,
      message: errorMessage,
      timestamp: new Date().toISOString(),
      url: error.url,
      fullError: error
    });

    return throwError(() => new Error(errorMessage));
  }

  /**
   * Get stored token for internal use
   */
  private getStoredToken(): string | null {
    return localStorage.getItem(this.tokenKey);
  }
} 