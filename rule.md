# Syscodia Tracking - Development Rules

## Project Overview
Angular 19.2.10 application for real-time device tracking and location management, integrating with Traxbean Location API and Google Maps.

## Technical Stack
- **Framework**: Angular 19.2.10 + TypeScript (ES2022)
- **UI**: PrimeNG + PrimeIcons + SCSS
- **Maps**: @angular/google-maps
- **Authentication**: JWT tokens
- **API**: RESTful services via HttpClient

## Architecture Rules

### Directory Structure
```
src/app/
├── core/               # Core services (auth, device, error handling)
├── features/           # Feature modules (auth, dashboard, devices, tracking)
├── shared/             # Shared components and interfaces
├── layout/             # Layout components
└── components/         # Reusable UI components
```

### Key Patterns
1. **Feature-based organization** - Group related functionality
2. **Lazy loading** - Feature modules loaded on demand
3. **Route guards** - Protect routes with `AuthGuard`
4. **HTTP interceptors** - Centralized request/response handling
5. **Service-based state** - Use BehaviorSubjects for reactive state

## API Integration Rules

### Base Configuration
- **API Base URL**: `https://napi.5gcity.com`
- **Authentication**: JWT token in Authorization header
- **Content-Type**: `application/json`

### Traxbean API Endpoints
1. **Real-time/Date Range**: `/app/traxbean/tracking`
2. **Historical Data**: `/app/traxbean/playback`
3. **Data Availability**: `/app/traxbean/playbackExist`
4. **Indoor Location**: `/app/traxbean/getGeoLocationLK`

### Implementation Pattern
```typescript
// Use /tracking for date ranges and specific times
getDeviceLocations(deviceId: string, fromDate: Date, toDate: Date) {
  return this.http.post<LocationResponse[]>('/app/traxbean/tracking', {
    deviceId,
    fromDate: fromDate.toISOString(),
    toDate: toDate.toISOString()
  });
}
```

## Security Rules
1. **HTTPS Only** - All API calls must use HTTPS
2. **JWT Storage** - Store tokens securely
3. **Token Validation** - Check expiry before requests
4. **Auto-logout** - Redirect to login on 401 responses
5. **Error Handling** - Never expose sensitive data

## UI/UX Rules
1. **PrimeNG Components** - Use consistently throughout app
2. **Responsive Design** - Ensure mobile compatibility
3. **Loading States** - Show indicators for async operations
4. **Error Display** - User-friendly error messages
5. **Google Maps** - Use `@angular/google-maps` wrapper

## Code Quality Rules

### TypeScript Standards
1. **Strict Mode** - Enable strict TypeScript checking
2. **Interfaces** - Define for all data structures
3. **Type Safety** - Avoid `any` type usage
4. **Null Safety** - Handle null/undefined properly

### Code Organization
1. **Single Responsibility** - One responsibility per class/function
2. **DRY Principle** - Avoid code duplication
3. **Naming Conventions** - Use descriptive, consistent names
4. **Comments** - Document complex business logic

### Styling
1. **SCSS** - Use for all styling
2. **Global Styles** - Define common styles in `styles.scss`
3. **Component Styles** - Keep component-specific styles local
4. **PrimeNG Theming** - Use theme configuration

## Testing Rules
1. **Jasmine/Karma** - Use Angular's default testing setup
2. **Service Testing** - Mock HTTP calls and dependencies
3. **Component Testing** - Test logic and templates
4. **E2E Testing** - Test critical user flows

## Build Rules

### Development Commands
```bash
npm start                 # Development server
npm run build            # Production build
npm test                 # Run unit tests
npm run lint             # Run linting
```

### Environment Configuration
- **Development**: `environment.ts`
- **Production**: `environment.prod.ts`
- **API URLs**: Configure per environment

### Optimization
1. **Lazy Loading** - Implement for feature modules
2. **Tree Shaking** - Remove unused code
3. **OnPush Strategy** - Use for performance-critical components
4. **TrackBy Functions** - Use for large lists

## Git Workflow Rules

### Branch Strategy
1. **main** - Production-ready code
2. **develop** - Integration branch
3. **feature/** - Individual features
4. **hotfix/** - Critical fixes

### Commit Guidelines
1. **Conventional Commits** - Use standard format
2. **Descriptive Messages** - Clear, concise descriptions
3. **Small Commits** - Atomic, focused changes
4. **Code Review** - Required for main branch

## Performance Rules
1. **Caching** - Implement appropriate strategies
2. **Pagination** - Use for large datasets
3. **Debouncing** - Implement for search/filter
4. **Error Retry** - Implement retry logic
5. **Bundle Analysis** - Monitor bundle sizes

## Maintenance Rules
1. **Regular Updates** - Keep dependencies updated
2. **Security Audits** - Run `npm audit` regularly
3. **Error Monitoring** - Implement error tracking
4. **Performance Monitoring** - Track app performance

---

*Follow these rules to maintain code quality, consistency, and project standards.*