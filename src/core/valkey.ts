import { Cache, CacheOptions, ExpirableValue } from '../modules/types';
import IORedis, { Redis, RedisOptions } from 'iovalkey';

export class ValKeyCache implements Cache {
	private client: Redis;
	private keyPrefix: string;
	private defaultTtl: number;
	private cleanupInterval?: NodeJS.Timeout;

	constructor (urlOrClient: string | Redis, options: RedisOptions & CacheOptions = {}) {
		this.client = typeof urlOrClient === 'string'
			? new IORedis(urlOrClient, options)
			: urlOrClient;

		this.keyPrefix = options.keyPrefix ?? 'prisma:cache';
		this.defaultTtl = options.ttlSeconds ?? 300;

		this.startCleanup();
	}

	async read(key: string): Promise<string | null> {
		const fullKey = `${this.keyPrefix}:${key}`;
		const value = await this.client.get(fullKey);

		if (!value) return null;

		const parsed = JSON.parse(value) as ExpirableValue;
		if (parsed.e > 0 && Date.now() > parsed.e) {
			await this.client.del(fullKey);
			return null;
		}

		return parsed.d;
	}

	async write(key: string, value: string, ttl?: number): Promise<void> {
		const fullKey = `${this.keyPrefix}:${key}`;
		const expiry = ttl ?? this.defaultTtl;

		const expirableValue: ExpirableValue = {
			d: value,
			e: expiry > 0 ? Date.now() + expiry * 1000 : 0,
		};

		if (expiry > 0) await this.client.setex(fullKey, expiry, JSON.stringify(expirableValue));
		else await this.client.set(fullKey, JSON.stringify(expirableValue));
	}

	async flush(pattern?: string): Promise<void> {
		const searchPattern = pattern
			? `${this.keyPrefix}:${pattern}*`
			: `${this.keyPrefix}:*`;

		const keys = await this.client.keys(searchPattern);
		if (keys.length > 0) await this.client.del(...keys);
	}

	async delete(key: string): Promise<void> {
		await this.client.del(`${this.keyPrefix}:${key}`);
	}

	async close(): Promise<void> {
		if (this.cleanupInterval) clearInterval(this.cleanupInterval);
		await this.client.quit();
	}

	async size(): Promise<number> {
		return this.client.dbsize();
	}

	private startCleanup(intervalMs: number = 600000): void {
		this.cleanupInterval = setInterval(async () => {
			const keys = await this.client.keys(`${this.keyPrefix}:*`);
			const pipeline = this.client.pipeline();

			for (const key of keys) {
				const value = await this.client.get(key);
				if (!value) continue;

				const parsed = JSON.parse(value) as ExpirableValue;
				if (parsed.e > 0 && Date.now() > parsed.e) pipeline.del(key);
			}

			await pipeline.exec();
		}, intervalMs);
	}
}
