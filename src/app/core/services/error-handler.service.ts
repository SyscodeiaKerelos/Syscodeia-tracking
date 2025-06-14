import { Injectable } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';

export interface ApiError {
  code: number;
  message: string;
  userMessage: string;
}

@Injectable({
  providedIn: 'root'
})
export class ErrorHandlerService {

  constructor() { }

  handleApiError(error: any): ApiError {
    let code = 500;
    let message = 'Unknown error';
    let userMessage = 'An unexpected error occurred. Please try again.';

    if (error instanceof HttpErrorResponse) {
      code = error.status;
      message = error.message;

      switch (code) {
        case 0:
          userMessage = 'Network error. Please check your internet connection.';
          break;
        case 400:
          userMessage = 'Invalid request. Please check your input.';
          break;
        case 401:
          userMessage = 'Authentication failed. Please login again.';
          break;
        case 403:
          userMessage = 'Access denied. You don\'t have permission for this action.';
          break;
        case 404:
          userMessage = 'Resource not found.';
          break;
        case 429:
          userMessage = 'Too many requests. Please wait a moment and try again.';
          break;
        case 500:
          userMessage = 'Server error. Please try again later.';
          break;
        case 503:
          userMessage = 'Service temporarily unavailable. Please try again later.';
          break;
        default:
          userMessage = `Error ${code}: ${error.error?.message || error.message || 'Unknown error'}`;
      }
    } else if (error?.error?.message) {
      // API returned an error message
      message = error.error.message;
      userMessage = error.error.message;
    } else if (typeof error === 'string') {
      message = error;
      userMessage = error;
    } else if (error?.message) {
      message = error.message;
      userMessage = error.message;
    }

    return {
      code,
      message,
      userMessage
    };
  }

  getNetworkErrorMessage(): string {
    return 'Unable to connect to the server. Please check your internet connection and try again.';
  }

  getAuthenticationErrorMessage(): string {
    return 'Your session has expired. Please login again.';
  }

  getGenericErrorMessage(): string {
    return 'Something went wrong. Please try again later.';
  }
} 