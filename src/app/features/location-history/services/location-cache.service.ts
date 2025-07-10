import { Injectable, signal, computed, effect } from '@angular/core';
import { 
  LocationPoint, 
  CacheEntry, 
  CacheConfig, 
  CacheMetrics 
} from '../models/location-history.interface';

/**
 * Location Cache Service with Angular 19 Signals
 * Implements intelligent caching with TTL, LRU eviction, and metrics
 */
@Injectable({
  providedIn: 'root'
})
export class LocationCacheService {
  private readonly config: CacheConfig = {
    maxSize: 100,
    defaultTtl: 600000, // 10 minutes
    cleanupInterval: 300000, // 5 minutes
    enableMetrics: true
  };

  // Cache storage using Map for better performance
  private readonly availableDatesCache = new Map<string, CacheEntry<number[]>>();
  private readonly locationDataCache = new Map<string, CacheEntry<LocationPoint[]>>();
  
  // Angular 19 Signals for reactive cache metrics
  private readonly _metrics = signal<CacheMetrics>({
    hits: 0,
    misses: 0,
    evictions: 0,
    size: 0,
    hitRate: 0
  });

  // Computed signal for cache statistics
  public readonly metrics = computed(() => {
    const current = this._metrics();
    const totalRequests = current.hits + current.misses;
    return {
      ...current,
      hitRate: totalRequests > 0 ? (current.hits / totalRequests) * 100 : 0,
      size: this.availableDatesCache.size + this.locationDataCache.size
    };
  });

  // Cleanup interval reference
  private cleanupInterval?: number;

  constructor() {
    this.startCleanupInterval();
    
    // Angular 19 effect to log cache metrics in development
    if (!this.isProduction()) {
      effect(() => {
        const metrics = this.metrics();
        console.debug('Cache Metrics:', metrics);
      });
    }
  }

  /**
   * Get available dates from cache
   */
  getAvailableDates(key: string): number[] | null {
    const result = this.getCachedData(this.availableDatesCache, key);
    this.updateMetrics(result !== null);
    return result;
  }

  /**
   * Set available dates in cache
   */
  setAvailableDates(key: string, data: number[], ttl?: number): void {
    this.setCachedData(
      this.availableDatesCache, 
      key, 
      data, 
      ttl ?? this.config.defaultTtl
    );
  }

  /**
   * Get location data from cache
   */
  getLocationData(key: string): LocationPoint[] | null {
    const result = this.getCachedData(this.locationDataCache, key);
    this.updateMetrics(result !== null);
    return result;
  }

  /**
   * Set location data in cache
   */
  setLocationData(key: string, data: LocationPoint[], ttl?: number): void {
    this.setCachedData(
      this.locationDataCache, 
      key, 
      data, 
      ttl ?? this.config.defaultTtl * 2 // Location data cached longer
    );
  }

  /**
   * Check if data exists in cache (without retrieving)
   */
  hasAvailableDates(key: string): boolean {
    return this.hasValidCacheEntry(this.availableDatesCache, key);
  }

  /**
   * Check if location data exists in cache
   */
  hasLocationData(key: string): boolean {
    return this.hasValidCacheEntry(this.locationDataCache, key);
  }

  /**
   * Prefetch data keys for better performance
   */
  prefetchKeys(keys: string[], type: 'dates' | 'locations'): string[] {
    const cache = type === 'dates' ? this.availableDatesCache : this.locationDataCache;
    return keys.filter(key => !this.hasValidCacheEntry<number[] | LocationPoint[]>(cache, key));
  }

  /**
   * Clear all cache data
   */
  clearAll(): void {
    this.availableDatesCache.clear();
    this.locationDataCache.clear();
    this.resetMetrics();
  }

  /**
   * Clear expired entries manually
   */
  clearExpired(): number {
    const expiredCount = this.removeExpiredEntries();
    this.updateEvictionMetrics(expiredCount);
    return expiredCount;
  }

  /**
   * Get cache size information
   */
  getCacheInfo(): {
    availableDatesSize: number;
    locationDataSize: number;
    totalSize: number;
    maxSize: number;
  } {
    return {
      availableDatesSize: this.availableDatesCache.size,
      locationDataSize: this.locationDataCache.size,
      totalSize: this.availableDatesCache.size + this.locationDataCache.size,
      maxSize: this.config.maxSize
    };
  }

  /**
   * Update cache configuration
   */
  updateConfig(newConfig: Partial<CacheConfig>): void {
    Object.assign(this.config, newConfig);
    
    // Restart cleanup interval if changed
    if (newConfig.cleanupInterval) {
      this.stopCleanupInterval();
      this.startCleanupInterval();
    }
  }

  /**
   * Destroy service and cleanup resources
   */
  ngOnDestroy(): void {
    this.stopCleanupInterval();
    this.clearAll();
  }

  // Private helper methods

  private getCachedData<T>(
    cache: Map<string, CacheEntry<T>>, 
    key: string
  ): T | null {
    const entry = cache.get(key);
    if (!entry) {
      return null;
    }

    const now = Date.now();
    if (this.isExpired(entry, now)) {
      cache.delete(key);
      this.updateEvictionMetrics(1);
      return null;
    }

    // Update access statistics
    entry.accessCount++;
    entry.lastAccessed = now;
    
    return entry.data;
  }

  private setCachedData<T>(
    cache: Map<string, CacheEntry<T>>, 
    key: string, 
    data: T, 
    ttl: number
  ): void {
    // Check if we need to evict entries
    if (cache.size >= this.config.maxSize && !cache.has(key)) {
      this.evictLeastRecentlyUsed(cache);
    }

    const now = Date.now();
    cache.set(key, {
      data,
      timestamp: now,
      ttl,
      accessCount: 1,
      lastAccessed: now
    });
  }

  private hasValidCacheEntry<T>(
    cache: Map<string, CacheEntry<T>>, 
    key: string
  ): boolean {
    const entry = cache.get(key);
    if (!entry) {
      return false;
    }

    return !this.isExpired(entry, Date.now());
  }

  private isExpired<T>(entry: CacheEntry<T>, now: number): boolean {
    return (now - entry.timestamp) > entry.ttl;
  }

  private evictLeastRecentlyUsed<T>(cache: Map<string, CacheEntry<T>>): void {
    let oldestKey: string | null = null;
    let oldestTime = Date.now();

    for (const [key, entry] of cache.entries()) {
      if (entry.lastAccessed < oldestTime) {
        oldestTime = entry.lastAccessed;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      cache.delete(oldestKey);
      this.updateEvictionMetrics(1);
    }
  }

  private removeExpiredEntries(): number {
    const now = Date.now();
    let expiredCount = 0;

    // Clean available dates cache
    for (const [key, entry] of this.availableDatesCache.entries()) {
      if (this.isExpired(entry, now)) {
        this.availableDatesCache.delete(key);
        expiredCount++;
      }
    }

    // Clean location data cache
    for (const [key, entry] of this.locationDataCache.entries()) {
      if (this.isExpired(entry, now)) {
        this.locationDataCache.delete(key);
        expiredCount++;
      }
    }

    return expiredCount;
  }

  private updateMetrics(isHit: boolean): void {
    if (!this.config.enableMetrics) return;

    const current = this._metrics();
    this._metrics.set({
      ...current,
      hits: isHit ? current.hits + 1 : current.hits,
      misses: isHit ? current.misses : current.misses + 1
    });
  }

  private updateEvictionMetrics(count: number): void {
    if (!this.config.enableMetrics) return;

    const current = this._metrics();
    this._metrics.set({
      ...current,
      evictions: current.evictions + count
    });
  }

  private resetMetrics(): void {
    this._metrics.set({
      hits: 0,
      misses: 0,
      evictions: 0,
      size: 0,
      hitRate: 0
    });
  }

  private startCleanupInterval(): void {
    this.cleanupInterval = window.setInterval(() => {
      this.clearExpired();
    }, this.config.cleanupInterval);
  }

  private stopCleanupInterval(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
    }
  }

  private isProduction(): boolean {
    return typeof window !== 'undefined' && 
           (window as any)['ng'] && 
           (window as any)['ng'].getContext && 
           (window as any)['ng'].getContext(document.body)?.injector?.get('ENVIRONMENT')?.production;
  }
}