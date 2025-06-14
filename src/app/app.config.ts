import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideAnimations } from '@angular/platform-browser/animations';
import { ConfirmationService, MessageService } from 'primeng/api';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { providePrimeNG } from 'primeng/config';
import Lara from '@primeng/themes/lara';
import { authInterceptor } from './core/interceptors/auth.interceptor';

import { routes } from './app.routes';

// Google Maps API key
const GOOGLE_MAPS_API_KEY = 'AIzaSyAplJESykdg7gWO5ASlfEde7zKQ6tJMNnc';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }), 
    provideRouter(routes),
    provideAnimations(),
    provideHttpClient(withInterceptors([authInterceptor])),
    providePrimeNG({
      theme: {
        preset: Lara,
        options: {
          prefix: 'p',
          darkModeSelector: '.p-dark',
          cssLayer: false
        }
      }
    }),
    {
      provide: 'GOOGLE_MAPS_API_KEY',
      useValue: GOOGLE_MAPS_API_KEY
    },
    ConfirmationService,
    MessageService
  ]
};
