# Syscodia Tracking - Project Development Rules

## Project Overview
Syscodia Tracking is an Angular 19.2.10 application for real-time device tracking and location management, integrating with the Traxbean Location API and Google Maps.

## Technical Stack

### Core Technologies
- **Framework**: Angular 19.2.10
- **Language**: TypeScript (ES2022 target)
- **Styling**: SCSS
- **UI Library**: PrimeNG with PrimeIcons
- **Maps**: @angular/google-maps
- **HTTP Client**: Angular HttpClient with interceptors

### Dependencies
- **Runtime**: Node.js with npm
- **Build Tool**: Angular CLI
- **Authentication**: JWT tokens
- **API Integration**: RESTful services

## Project Architecture

### Directory Structure
```
src/
├── app/
│   ├── components/          # Reusable UI components
│   ├── core/               # Core services (auth, device, error handling)
│   ├── features/           # Feature modules (auth, dashboard, devices, tracking)
│   ├── layout/             # Layout components
│   ├── shared/             # Shared components and interfaces
│   ├── app.config.ts       # Application configuration
│   └── app.routes.ts       # Route definitions
├── environments/           # Environment configurations
└── styles.scss            # Global styles
```

### Architectural Patterns
1. **Feature-based organization**: Group related functionality in feature modules
2. **Shared components**: Reusable components in `shared/` directory
3. **Core services**: Centralized business logic in `core/` services
4. **Lazy loading**: Feature modules loaded on demand
5. **Guard protection**: Route protection with `AuthGuard`
6. **HTTP interceptors**: Centralized request/response handling

## API Integration Standards

### Base Configuration
- **API Base URL**: `https://napi.5gcity.com`
- **Authentication**: JWT token in Authorization header
- **Content-Type**: `application/json`
- **Error Handling**: Centralized via `ErrorHandlerService`

### Traxbean API Integration

#### Primary Endpoints
1. **Real-time/Date Range Tracking**: `/app/traxbean/tracking`
   - Use for: Date ranges, specific times, sub-day queries
   - Supports: Precise temporal control with `fromDate` and `toDate`

2. **Historical Data**: `/app/traxbean/playback`
   - Use for: Full-day historical data
   - Supports: Single day data retrieval

3. **Data Availability**: `/app/traxbean/playbackExist`
   - Use for: Checking data availability before queries
   - Supports: Multi-day availability checks

4. **Indoor Location**: `/app/traxbean/getGeoLocationLK`
   - Use for: Indoor positioning data
   - Supports: Building-specific location tracking

#### Request/Response Interfaces
```typescript
// Tracking Request
interface TrackingRequest {
  deviceId: string;
  fromDate: string; // ISO 8601 format
  toDate: string;   // ISO 8601 format
}

// Location Response
interface LocationResponse {
  deviceId: string;
  timestamp: string;
  latitude: number;
  longitude: number;
  accuracy?: number;
  speed?: number;
  heading?: number;
}
```

#### Implementation Strategy
```typescript
// Use /tracking for date ranges and specific times
getDeviceLocations(deviceId: string, fromDate: Date, toDate: Date) {
  return this.http.post<LocationResponse[]>('/app/traxbean/tracking', {
    deviceId,
    fromDate: fromDate.toISOString(),
    toDate: toDate.toISOString()
  });
}

// Use /playback for full-day historical data
getDailyHistory(deviceId: string, date: Date) {
  return this.http.post<LocationResponse[]>('/app/traxbean/playback', {
    deviceId,
    date: date.toISOString().split('T')[0]
  });
}
```

## Security Guidelines

### Authentication
1. **JWT Storage**: Store tokens securely
2. **Token Validation**: Check token expiry before requests
3. **Auto-logout**: Redirect to login on 401 responses
4. **Route Protection**: Use `AuthGuard` for protected routes

### HTTP Security
1. **HTTPS Only**: All API calls must use HTTPS
2. **Header Injection**: Use `AuthInterceptor` for consistent headers
3. **Error Handling**: Never expose sensitive data in error messages

## UI/UX Standards

### Component Guidelines
1. **PrimeNG Integration**: Use PrimeNG components consistently
2. **Responsive Design**: Ensure mobile compatibility
3. **Loading States**: Show loading indicators for async operations
4. **Error Display**: User-friendly error messages

### Map Integration
1. **Google Maps**: Use `@angular/google-maps` wrapper
2. **Markers**: Display device locations with custom markers
3. **Polylines**: Show movement paths when applicable
4. **Controls**: Provide zoom, pan, and layer controls

### Styling
1. **SCSS**: Use SCSS for all styling
2. **Global Styles**: Define common styles in `styles.scss`
3. **Component Styles**: Keep component-specific styles in component files
4. **PrimeNG Theming**: Use PrimeNG theme configuration

## State Management

### Service-based State
1. **Singleton Services**: Use services for shared state
2. **BehaviorSubjects**: For reactive state management
3. **Local State**: Component state for UI-specific data

### Data Flow
1. **Services**: Handle API calls and data transformation
2. **Components**: Display data and handle user interactions
3. **Guards**: Control navigation and access
4. **Interceptors**: Handle cross-cutting concerns

## Testing Guidelines

### Unit Testing
1. **Jasmine/Karma**: Use Angular's default testing setup
2. **Service Testing**: Mock HTTP calls and dependencies
3. **Component Testing**: Test component logic and templates
4. **Coverage**: Maintain reasonable test coverage

### Integration Testing
1. **E2E Testing**: Test critical user flows
2. **API Testing**: Test API integration points
3. **Authentication Flow**: Test login/logout scenarios

## Code Quality

### TypeScript Standards
1. **Strict Mode**: Enable strict TypeScript checking
2. **Interfaces**: Define interfaces for all data structures
3. **Type Safety**: Avoid `any` type usage
4. **Null Safety**: Handle null/undefined values properly

### Code Organization
1. **Single Responsibility**: One responsibility per class/function
2. **DRY Principle**: Avoid code duplication
3. **Naming Conventions**: Use descriptive, consistent names
4. **Comments**: Document complex business logic

### Linting and Formatting
1. **ESLint**: Use Angular ESLint configuration
2. **Prettier**: Consistent code formatting
3. **EditorConfig**: Consistent editor settings

## Build and Deployment

### Development
```bash
npm start                 # Development server
npm run build            # Production build
npm test                 # Run unit tests
npm run lint             # Run linting
```

### Environment Configuration
1. **Development**: `environment.ts`
2. **Production**: `environment.prod.ts`
3. **API URLs**: Configure per environment
4. **Feature Flags**: Use environment variables

### Build Optimization
1. **Lazy Loading**: Implement for feature modules
2. **Tree Shaking**: Remove unused code
3. **Minification**: Enable for production builds
4. **Source Maps**: Generate for debugging

## Environment Rules

### Development Environment
- **API URL**: `https://napi.5gcity.com`
- **Debug Mode**: Enabled
- **Source Maps**: Enabled
- **Hot Reload**: Enabled

### Production Environment
- **API URL**: `https://napi.5gcity.com`
- **Debug Mode**: Disabled
- **Minification**: Enabled
- **Optimization**: Enabled

## Documentation Standards

### Code Documentation
1. **JSDoc**: Document public APIs
2. **README**: Keep project README updated
3. **Inline Comments**: Explain complex logic
4. **Type Definitions**: Document interface purposes

### API Documentation
1. **Endpoint Documentation**: Document all API endpoints
2. **Request/Response Examples**: Provide clear examples
3. **Error Codes**: Document possible error responses
4. **Authentication**: Document auth requirements

## Performance Guidelines

### Angular Optimization
1. **OnPush Strategy**: Use for performance-critical components
2. **TrackBy Functions**: Use for large lists
3. **Lazy Loading**: Implement for routes and modules
4. **Bundle Analysis**: Monitor bundle sizes

### API Optimization
1. **Caching**: Implement appropriate caching strategies
2. **Pagination**: Use for large datasets
3. **Debouncing**: Implement for search/filter operations
4. **Error Retry**: Implement retry logic for failed requests

## Maintenance Guidelines

### Dependency Management
1. **Regular Updates**: Keep dependencies updated
2. **Security Audits**: Run `npm audit` regularly
3. **Version Pinning**: Pin critical dependency versions
4. **Compatibility**: Test updates in development first

### Monitoring
1. **Error Tracking**: Implement error monitoring
2. **Performance Monitoring**: Track application performance
3. **User Analytics**: Monitor user behavior
4. **API Monitoring**: Track API response times and errors

## Git Workflow

### Branch Strategy
1. **Main Branch**: Production-ready code
2. **Development Branch**: Integration branch
3. **Feature Branches**: Individual features
4. **Hotfix Branches**: Critical fixes

### Commit Guidelines
1. **Conventional Commits**: Use conventional commit format
2. **Descriptive Messages**: Clear, concise commit messages
3. **Small Commits**: Atomic, focused commits
4. **Code Review**: Require reviews for main branch

---

*This document should be updated as the project evolves and new patterns emerge.*