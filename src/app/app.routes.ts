import { Routes } from '@angular/router';
import { AuthGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  {
    path: '',
    redirectTo: '/dashboard',
    pathMatch: 'full'
  },
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login/login.component').then(m => m.LoginComponent)
  },
  {
    path: 'dashboard',
    loadComponent: () => import('./features/tracking/tracking.component').then(m => m.TrackingComponent),
    canActivate: [AuthGuard]
  },
  {
    path: 'location-history',
    loadChildren: () => import('./features/location-history/location-history.module').then(m => m.LocationHistoryModule),
    canActivate: [AuthGuard],
    data: {
      preload: true,
      title: 'Location History',
      description: 'View and analyze location tracking data'
    }
  },
  {
    path: '**',
    redirectTo: '/dashboard'
  }
];
