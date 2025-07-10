export const environment = {
  production: true,
  apiUrl: 'https://napi.5gcity.com',
  traxbeanApiUrl: 'https://napi.5gcity.com',
  
  // Google Maps Configuration
  googleMapsApiKey: 'YOUR_PRODUCTION_GOOGLE_MAPS_API_KEY_HERE',
  
  // Location History Configuration
  locationHistory: {
    cacheSize: 200,
    cacheTtlMinutes: 60,
    maxDataPoints: 50000,
    defaultPageSize: 50,
    prefetchDays: 14,
    enableAnalytics: true,
    enableExport: true,
    mapDefaults: {
      zoom: 15,
      center: { lat: 40.7128, lng: -74.0060 }, // New York City
      mapTypeId: 'roadmap'
    }
  },
  
  // Feature Flags
  features: {
    locationHistory: true,
    realTimeTracking: true,
    analytics: true,
    export: true
  }
};