/**
 * @fileoverview High-Performance Caching & Memory Profiling Module
 * Provides zero-dependency LRU & TTL memoization, memory leak prevention,
 * event listener registry with deterministic lifecycle teardown, and cache telemetry.
 * @module cache
 */

/**
 * High-performance Least-Recently-Used (LRU) Cache with Time-To-Live (TTL) expiration.
 */
export class LRUCache {
  /**
   * @param {number} [maxSize=100] - Maximum entries before eviction.
   * @param {number} [defaultTtlMs=300000] - Default TTL in ms (default 5 minutes).
   */
  constructor(maxSize = 100, defaultTtlMs = 300000) {
    this.maxSize = Math.max(1, maxSize);
    this.defaultTtlMs = defaultTtlMs;
    /** @type {Map<string, { value: any, expiresAt: number }>} */
    this.cache = new Map();
    this.hits = 0;
    this.misses = 0;
  }

  /**
   * Retrieves an item from the cache.
   * @param {string} key - Cache key.
   * @returns {any|null} The cached value or null if expired/missing.
   */
  get(key) {
    const entry = this.cache.get(key);
    if (!entry) {
      this.misses++;
      return null;
    }

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.misses++;
      return null;
    }

    // Refresh LRU order (delete and re-insert)
    this.cache.delete(key);
    this.cache.set(key, entry);
    this.hits++;
    return entry.value;
  }

  /**
   * Stores an item in the cache.
   * @param {string} key - Cache key.
   * @param {any} value - Value to cache.
   * @param {number} [ttlMs] - Custom TTL in ms.
   */
  set(key, value, ttlMs = this.defaultTtlMs) {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxSize) {
      // Evict oldest entry (first item in Map iterator)
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey !== undefined) {
        this.cache.delete(oldestKey);
      }
    }

    this.cache.set(key, {
      value,
      expiresAt: Date.now() + ttlMs
    });
  }

  /**
   * Clears all cache entries.
   */
  clear() {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
  }

  /**
   * Returns cache metrics and hit ratio.
   * @returns {{ size: number, maxSize: number, hits: number, misses: number, hitRatio: string }}
   */
  getStats() {
    const total = this.hits + this.misses;
    const ratio = total > 0 ? `${((this.hits / total) * 100).toFixed(1)}%` : '0.0%';
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hits: this.hits,
      misses: this.misses,
      hitRatio: ratio
    };
  }
}

/**
 * Centralized Event Listener Registry for deterministic memory cleanup
 * and detached DOM node memory leak prevention.
 */
export class EventListenerRegistry {
  constructor() {
    /** @type {Array<{ target: EventTarget, type: string, listener: Function, options: any }>} */
    this.listeners = [];
  }

  /**
   * Registers and attaches an event listener with automatic lifecycle tracking.
   * @param {EventTarget} target - Target element or window.
   * @param {string} type - Event type.
   * @param {Function} listener - Handler function.
   * @param {any} [options] - Event listener options.
   * @returns {Function} Disposal function.
   */
  add(target, type, listener, options = false) {
    if (!target || typeof target.addEventListener !== 'function') {
      return () => {};
    }

    target.addEventListener(type, listener, options);
    const record = { target, type, listener, options };
    this.listeners.push(record);

    return () => {
      this.remove(record);
    };
  }

  /**
   * Removes a single tracked listener.
   * @param {{ target: EventTarget, type: string, listener: Function, options: any }} record
   */
  remove(record) {
    const idx = this.listeners.indexOf(record);
    if (idx !== -1) {
      record.target.removeEventListener(record.type, record.listener, record.options);
      this.listeners.splice(idx, 1);
    }
  }

  /**
   * Detaches all tracked event listeners to prevent memory leaks during view transitions.
   */
  disposeAll() {
    for (const record of this.listeners) {
      record.target.removeEventListener(record.type, record.listener, record.options);
    }
    this.listeners = [];
  }

  /**
   * Active listeners count.
   * @returns {number}
   */
  get activeCount() {
    return this.listeners.length;
  }
}

/**
 * Global singleton LRU caches for calculations & GenAI briefings.
 */
export const aqiCalcCache = new LRUCache(200, 600000); // 10 minutes TTL
export const advisoryCache = new LRUCache(50, 300000);  // 5 minutes TTL
export const appEventRegistry = new EventListenerRegistry();
