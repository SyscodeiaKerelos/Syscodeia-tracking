import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { LocationHistoryPageComponent } from './pages/location-history/location-history-page.component';

/**
 * Location History Routing Configuration
 * 
 * Defines routes for the location history feature module.
 * Uses Angular 19 routing features and lazy loading patterns.
 */
const routes: Routes = [
  {
    path: '',
    component: LocationHistoryPageComponent,
    title: 'Location History',
    data: {
      breadcrumb: 'Location History',
      description: 'View and analyze location tracking data',
      requiresAuth: true,
      permissions: ['location:read'],
      preload: true
    }
  },
  {
    path: 'device/:deviceId',
    component: LocationHistoryPageComponent,
    title: 'Device Location History',
    data: {
      breadcrumb: 'Device History',
      description: 'Location history for specific device',
      requiresAuth: true,
      permissions: ['location:read']
    }
  },
  {
    path: 'device/:deviceId/date/:date',
    component: LocationHistoryPageComponent,
    title: 'Location History - Specific Date',
    data: {
      breadcrumb: 'Date History',
      description: 'Location history for specific device and date',
      requiresAuth: true,
      permissions: ['location:read']
    }
  },
  {
    path: '**',
    redirectTo: '',
    pathMatch: 'full'
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class LocationHistoryRoutingModule { }