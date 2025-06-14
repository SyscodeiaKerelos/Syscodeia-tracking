import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { Router } from '@angular/router';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const token = authService.getToken();

  // Clone request with proper headers for Traxbean API requests
  if (req.url.includes('napi.5gcity.com')) {
    let headers = req.headers.set('Content-Type', 'application/json');
    
    // Add authorization header if token exists and not login request
    if (token && !req.url.includes('/login')) {
      headers = headers.set('Authorization', `${token}`);
    }

    const authReq = req.clone({
      headers: headers
    });

    return next(authReq).pipe(
      catchError((error: HttpErrorResponse) => {
        console.error('Interceptor: Request failed', error);
        
        // Handle authentication errors
        if (error.status === 401 && !req.url.includes('/login')) {
          // Token expired or invalid, logout and redirect
          authService.logout();
          router.navigate(['/login']);
        }
        return throwError(() => error);
      })
    );
  }

  return next(req);
}; 