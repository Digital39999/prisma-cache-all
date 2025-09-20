import { LRUCache as DefaultLRUCache } from 'lru-cache';
import { Cache, CacheOptions } from '../modules/types';

export class LRUCache<ModelNames extends string = string> implements Cache {
	private cache: DefaultLRUCache<string, string>;
	private defaultTtl: number;

	constructor (options: CacheOptions<ModelNames> = {}) {
		this.defaultTtl = (options.ttlSeconds ?? 300) * 1000;

		this.cache = new DefaultLRUCache({
			max: options.maxSize ?? 1000,
			ttl: this.defaultTtl,
			ttlAutopurge: true,
			updateAgeOnGet: true,
			updateAgeOnHas: true,
		});
	}

	async read(key: string): Promise<string | null> {
		return this.cache.get(key) ?? null;
	}

	async write(key: string, value: string, ttl?: number): Promise<void> {
		this.cache.set(key, value, { ttl: ttl ? ttl * 1000 : undefined });
	}

	async flush(pattern?: string): Promise<void> {
		if (!pattern) {
			this.cache.clear();
			return;
		}

		const regex = pattern.endsWith(':')
			? new RegExp(`^${pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`)
			: new RegExp(pattern);

		for (const key of this.cache.keys()) {
			if (regex.test(key)) {
				this.cache.delete(key);
			}
		}
	}

	async delete(key: string): Promise<void> {
		this.cache.delete(key);
	}

	async size(): Promise<number> {
		return this.cache.size;
	}

	async close(): Promise<void> {
		this.cache.clear();
	}
}
