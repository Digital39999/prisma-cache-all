# Prisma with Caching

This package provides an enhanced extension of Prisma that includes intelligent caching mechanisms using LRU (in-memory) or ValKey/Redis (distributed), enabling better performance by reducing database hits with smart cache invalidation.

---

## Installation

1. **Install Dependencies**:
   ```bash
   pnpm install prisma-cache-all
   ```

2. **Ensure Prisma Client is Generated**:
   Make sure the Prisma client is properly generated:
   ```bash
   pnpx prisma generate
   ```

---

## Features

- **Singleton Prisma Client**: Prevents multiple instances of the Prisma client
- **Dual Caching Support**:
  - **LRU Cache** (in-memory) with automatic purging
  - **ValKey/Redis Cache** (distributed) with TTL support
- **Smart Cache Invalidation**: Model-specific cache clearing instead of full flush
- **Automatic Caching**: Read operations are automatically cached
- **Runtime Control**: Enable/disable caching dynamically
- **Error Resilience**: Cache failures don't break database operations
- **Pattern-based Cache Management**: Clear cache entries by pattern matching

---

## Quick Start

### Basic Usage with LRU Cache

```typescript
import { PrismaClient } from '@prisma/client';
import { PrismaWithCache, LRUCache } from 'prisma-cache-all';

const prisma = new PrismaWithCache(
  new PrismaClient(),
  new LRUCache({ maxSize: 1000, ttlSeconds: 300 })
);

// Use exactly like regular Prisma
const users = await prisma.client.user.findMany();
```

### With ValKey/Redis for Distributed Caching

```typescript
import { PrismaClient } from '@prisma/client';
import { PrismaWithCache, ValKeyCache } from 'prisma-cache-all';

const cache = new ValKeyCache('redis://localhost:6379', {
  ttlSeconds: 300,
  keyPrefix: 'myapp:cache'
});

const prisma = new PrismaWithCache(
  new PrismaClient(),
  cache,
);

const users = await prisma.client.user.findMany(); // Cached automatically
```

---

## Advanced Configuration

### LRU Cache Options

```typescript
const lruCache = new LRUCache({
  maxSize: 2000,        // Maximum number of cached entries
  ttlSeconds: 600,      // Time-to-live in seconds (default: 300)
});
```

### ValKey/Redis Cache Options

```typescript
const redisCache = new ValKeyCache('redis://localhost:6379', {
  ttlSeconds: 300,           // Cache lifetime in seconds
  keyPrefix: 'myapp:cache',  // Prefix for all cache keys
  // Any IORedis options...
  retryDelayOnFailover: 100,
  maxRetriesPerRequest: 3,
});
```

### Prisma Wrapper Options

```typescript
const prisma = new PrismaWithCache(
  new PrismaClient(),
  cache,
  {
    enabled: true,        // Enable/disable caching (default: true)
    ttlSeconds: 300,      // Default TTL for cache entries
  }
);
```

---

## How Caching Works

### Automatic Caching Strategy

1. **Read Operations** (Cached):
   - `findFirst`, `findFirstOrThrow`
   - `findUnique`, `findUniqueOrThrow`
   - `findMany`, `count`
   - `aggregate`, `groupBy`
   - `queryRaw`

2. **Write Operations** (Trigger Cache Invalidation):
   - `create`, `createMany`
   - `update`, `updateMany`
   - `delete`, `deleteMany`
   - `upsert`, `executeRaw`

3. **Smart Invalidation**:
   - Write operations only clear cache for the affected model
   - No more expensive full cache flushes

### Cache Key Generation

Cache keys are generated using the format:
```
{model}:{action}:{hash-of-parameters}
```

Example: `user:findMany:a1b2c3d4e5f6g7h8`

---

## API Reference

### PrismaWithCache Class

#### Constructor
```typescript
new PrismaWithCache(client: PrismaClient, cache?: Cache, options?: CacheOptions)
```

#### Properties
- `client`: The wrapped Prisma client instance
- `cache`: The cache instance (LRUCache or ValKeyCache)

#### Methods

```typescript
// Cache management
await prisma.clearCache();                    // Clear all cache
await prisma.clearCache('user');             // Clear cache matching pattern
await prisma.clearModelCache('user');        // Clear specific model cache

// Runtime control
prisma.enableCache();                         // Enable caching
prisma.disableCache();                        // Disable caching

// Cleanup
await prisma.close();                         // Close connections
```

### LRUCache Class

```typescript
new LRUCache(options?: CacheOptions)
```

**Options:**
- `maxSize?: number` - Maximum cache entries (default: 1000)
- `ttlSeconds?: number` - TTL in seconds (default: 300)

### ValKeyCache Class

```typescript
new ValKeyCache(urlOrClient: string | Redis, options?: RedisOptions & CacheOptions)
```

**Options:**
- `ttlSeconds?: number` - TTL in seconds (default: 300)
- `keyPrefix?: string` - Cache key prefix (default: 'prisma:cache')
- Plus all IORedis options

---

## Usage Examples

### Basic CRUD with Caching

```typescript
import { PrismaClient } from '@prisma/client';
import { PrismaWithCache, LRUCache } from 'prisma-cache-all';

const prisma = new PrismaWithCache(
  new PrismaClient(),
  new LRUCache({ maxSize: 500, ttlSeconds: 300 })
);

// First call hits database and caches result
const users = await prisma.client.user.findMany();

// Second call returns cached result
const cachedUsers = await prisma.client.user.findMany();

// Write operation clears user model cache
await prisma.client.user.create({
  data: { name: 'John Doe', email: 'john@example.com' }
});

// Next read will hit database again (cache was cleared)
const refreshedUsers = await prisma.client.user.findMany();
```

### Distributed Caching with Redis

```typescript
import { PrismaClient } from '@prisma/client';
import { PrismaWithCache, ValKeyCache } from 'prisma-cache-all';

const cache = new ValKeyCache('redis://localhost:6379', {
  ttlSeconds: 600,
  keyPrefix: 'myapp:db:cache',
});

const prisma = new PrismaWithCache(new PrismaClient(), cache);

// This works across multiple application instances
const posts = await prisma.client.post.findMany({
  include: { author: true }
});
```

### Manual Cache Management

```typescript
// Clear specific model cache
await prisma.clearModelCache('user');

// Clear cache by pattern (all user-related)
await prisma.clearCache('user');

// Clear all cache
await prisma.clearCache();

// Temporarily disable caching
prisma.disableCache();
const uncachedData = await prisma.client.user.findMany();

// Re-enable caching
prisma.enableCache();
```

### Error Handling

```typescript
// Cache errors don't break database operations
try {
  const users = await prisma.client.user.findMany();
  // This will work even if cache is down
} catch (error) {
  // Only database errors are thrown
  console.error('Database error:', error);
}
```

---

## Performance Considerations

- **LRU Cache**: Best for single-instance applications, very fast
- **ValKey/Redis**: Best for multi-instance/distributed applications
- **Memory Usage**: LRU cache uses application memory, Redis uses separate memory
- **Network**: Redis adds network latency but enables sharing across instances
- **TTL**: Shorter TTL = fresher data but more database hits

---

## Migration from v1

The new version has breaking changes:

### Old API:
```typescript
import { Prisma } from 'prisma-cache-all';
const prisma = new Prisma(new LRUCache({ max: 100 }));
```

### New API:
```typescript
import { PrismaWithCache, LRUCache } from 'prisma-cache-all';
const prisma = new PrismaWithCache(
  new PrismaClient(),
  new LRUCache({ maxSize: 100 })
);
```

---

## License

This package is licensed under the GNU General Public License v3.0. See the [LICENSE](LICENSE) file for more details.
