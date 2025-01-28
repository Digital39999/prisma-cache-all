# Prisma with Caching

This package provides an extension of Prisma that includes caching mechanisms using LRU or Redis, enabling better performance by reducing database hits.

---

## Installation

1. **Install Dependencies**:
   ```bash
   npm install @prisma/client lru-cache ioredis prisma-cache-all
   ```

2. **Ensure Prisma Client is Generated**:
   Make sure the Prisma client is properly generated:
   ```bash
   npx prisma generate
   ```

---

## Features

- **Singleton Prisma Client**: Prevents multiple instances of the Prisma client.
- **Caching**:
  - Supports **LRU Cache** (in-memory).
  - Supports **Redis Cache** (distributed).
- **Automatic Cache Invalidation**: Writes, updates, and deletes clear related cache entries.
- **Automatic Caching of Reads**: Fetch operations are cached.

---

## Usage

### 1. Import and Instantiate Prisma with Caching

```typescript
import { Prisma } from './path-to-prisma-class';

// Use default LRU cache with a max size of 100 entries
const prisma = new Prisma(new LRUCache({ max: 100 }));

// OR use Redis for distributed caching
import { Redis } from './path-to-redis-class';
const prismaWithRedis = new Prisma(new Redis('redis://localhost:6379', { ttlSeconds: 60 }));
```

### 2. Querying with Prisma

You can use the Prisma instance as usual:

```typescript
const users = await prisma.client.user.findMany();

// The above query is automatically cached if using Redis or LRU cache.
```

### 3. Cache Management

- **Clear Cache**:
   ```typescript
   await prisma.cache.flush();
   ```

- **Close Cache**:
   ```typescript
   prisma.cache.close();
   ```

---

## Advanced Configuration

### LRU Cache

Customize the in-memory LRU cache by providing options:

```typescript
const prisma = new Prisma(new LRUCache({
  max: 200,
  ttlSeconds: 120, // Time-to-live for cached entries in seconds
}));
```

### Redis Cache

Use Redis for distributed caching with advanced options:

```typescript
const prisma = new Prisma(new Redis('redis://localhost:6379', {
  ttlSeconds: 300, // Cache lifetime
  keyPrefix: 'myapp-cache',
}));
```

---

## How Caching Works

1. **Read Operations**:
   - Reads (e.g., `findMany`, `findUnique`) are cached.
   - Cached results are returned when available.

2. **Write Operations**:
   - Writes (e.g., `create`, `update`, `delete`) automatically invalidate the cache.

3. **Cache Keys**:
   - Cache keys are generated based on the query parameters and action.

---

## Example Workflow

```typescript
// Import and initialize Prisma with Redis caching
import { Prisma } from './path-to-prisma-class';
import { Redis } from './path-to-redis-class';

const prisma = new Prisma(new Redis('redis://localhost:6379', { ttlSeconds: 120 }));

// Query users
const users = await prisma.client.user.findMany(); // Cached after first call

// Add a new user (cache is invalidated automatically)
await prisma.client.user.create({ data: { name: 'John Doe' } });

// Query users again (cache is refreshed)
const updatedUsers = await prisma.client.user.findMany();
```

---

## API Reference

### Prisma Class

#### Constructor
```typescript
constructor(cacheFactory: Cache)
```
- `cacheFactory`: A function returning a cache instance (e.g., `LRUCache` or `Redis`).

#### Properties
- `client`: The Prisma client instance.
- `cache`: The cache instance (either `LRUCache` or `Redis`).

#### Methods
- `flush()`: Clears all cache entries.
- `close()`: Closes the cache connection (if applicable).

### Cache Interfaces

#### LRUCache
```typescript
new LRUCache(options: { max: number, ttlSeconds?: number })
```
- `max`: Maximum number of entries.
- `ttlSeconds`: Time-to-live for each entry in seconds.

#### Redis
```typescript
new Redis(urlOrClient: string | RedisClient, options?: { ttlSeconds?: number, keyPrefix?: string })
```
- `urlOrClient`: Redis connection URL or Redis client instance.
- `ttlSeconds`: Time-to-live for cached entries in seconds.
- `keyPrefix`: Prefix for cache keys.

---

## License

This package is MIT licensed.
