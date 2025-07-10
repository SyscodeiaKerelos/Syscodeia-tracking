export const environment = {
  production: false,
  apiUrl: 'https://napi.5gcity.com',
  traxbeanApiUrl: 'https://napi.5gcity.com',
  
  // Google Maps Configuration
  googleMapsApiKey: 'YOUR_GOOGLE_MAPS_API_KEY_HERE',
  
  // Location History Configuration
  locationHistory: {
    cacheSize: 100,
    cacheTtlMinutes: 30,
    maxDataPoints: 10000,
    defaultPageSize: 25,
    prefetchDays: 7,
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