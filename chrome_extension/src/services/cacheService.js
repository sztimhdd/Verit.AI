class CacheService {
  constructor() {
    this.cache = new Map();
    this.maxSize = 100; // 最大缓存条目数
  }

  async get(key) {
    const item = this.cache.get(key);
    if (!item) return null;

    // 检查是否过期
    if (Date.now() > item.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return item.data;
  }

  async set(key, data, ttl = 3600000) { // 默认1小时过期
    // 如果缓存已满，删除最旧的条目
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this._getOldestKey();
      this.cache.delete(oldestKey);
    }

    this.cache.set(key, {
      data,
      expiresAt: Date.now() + ttl
    });
  }

  async clear() {
    this.cache.clear();
  }

  _getOldestKey() {
    let oldestKey = null;
    let oldestTime = Infinity;

    for (const [key, value] of this.cache.entries()) {
      if (value.expiresAt < oldestTime) {
        oldestTime = value.expiresAt;
        oldestKey = key;
      }
    }

    return oldestKey;
  }
}

export const cacheService = new CacheService(); 