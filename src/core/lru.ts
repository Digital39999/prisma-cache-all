import { LRUCache as DefaultLRUCache } from 'lru-cache';
import { Cache } from '../types';

export class LRUCache implements Cache {
	readonly lifetime: number;

	private cache: DefaultLRUCache<string, string>;

	constructor (
		options: (Partial<Omit<DefaultLRUCache.Options<string, string, unknown>, 'ttl'>> & { ttlSeconds?: number; }) = { ttlSeconds: 60 },
	) {
		this.cache = new DefaultLRUCache({ ...options, ttl: (options.ttlSeconds || 60) * 1000, ttlAutopurge: options.ttlAutopurge ?? false });
		this.lifetime = options.ttlSeconds || 60;
	}

	async read(key: string): Promise<string | null> {
		const value = this.cache.get(key);
		return value ?? null;
	}

	async write(key: string, value: string): Promise<void> {
		this.cache.set(key, value);
	}

	async flush(): Promise<void> {
		this.cache.clear();
	}

	close(): void {
		// No specific cleanup needed for LRUCache
	}
}
