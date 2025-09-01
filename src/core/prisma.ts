import { Cache, SingletonClient, CacheOptions } from '../modules/types';
import { makeHash, serialize, deserialize } from '../modules/utils';
import { PureActions, ImpureActions } from '../modules/constants';
import type { PrismaClient } from '@prisma/client';
import { LRUCache } from './lru';

export class PrismaWithCache {
	private static singleton: SingletonClient = {};
	private cacheEnabled: boolean;

	public readonly cache: Cache;
	public readonly client: PrismaClient;

	constructor (client: PrismaClient, cache?: Cache, private options: CacheOptions = {}) {
		this.cacheEnabled = options.enabled ?? true;

		if (!PrismaWithCache.singleton.cache) PrismaWithCache.singleton.cache = cache ?? new LRUCache(options);
		if (!PrismaWithCache.singleton.client) {
			PrismaWithCache.singleton.client = client;
			this.wrapClientMethods(PrismaWithCache.singleton.client);
		}

		this.client = PrismaWithCache.singleton.client;
		this.cache = PrismaWithCache.singleton.cache;
	}

	private wrapClientMethods(client: PrismaClient): void {
		const modelNames = Object.getOwnPropertyNames(client).filter((prop) => !prop.startsWith('$') && !prop.startsWith('_') && typeof client[prop] === 'object');

		for (const modelName of modelNames) {
			const model = client[modelName];

			for (const action of ImpureActions) {
				if (typeof model[action] === 'function') {
					const original = model[action].bind(model);

					model[action] = async (...args: unknown[]) => {
						const result = await original(...args);

						if (this.cacheEnabled) await this.cache.flush(modelName);
						await this.options.onDBRequest?.(modelName, action, args);

						return result;
					};
				}
			}

			for (const action of PureActions) {
				if (typeof model[action] === 'function') {
					const original = model[action].bind(model);

					model[action] = async (...args: unknown[]) => {
						if (!this.cacheEnabled) return original(...args);
						await this.options.onDBRequest?.(modelName, action, args);

						const cacheKey = this.generateCacheKey(modelName, action, args);

						const cached = await this.cache.read(cacheKey);
						if (cached) {
							await this.options.onCacheHit?.(cacheKey);
							return deserialize(cached);
						}

						await this.options.onCacheMiss?.(cacheKey);
						const result = await original(...args);
						await this.cache.write(cacheKey, serialize(result));

						return result;
					};
				}
			}
		}
	}

	private generateCacheKey(model: string, action: string, args: unknown[]): string {
		const keyData = { model, action, args };
		return `${model}:${action}:${makeHash(keyData)}`;
	}

	async clearCache(pattern?: string): Promise<void> {
		await this.cache.flush(pattern);
	}

	async clearModelCache(modelName: string): Promise<void> {
		await this.cache.flush(modelName);
	}

	enableCache(): void {
		this.cacheEnabled = true;
	}

	disableCache(): void {
		this.cacheEnabled = false;
	}

	async close(): Promise<void> {
		await this.client.$disconnect();
		if (this.cache.close) await this.cache.close();
	}
}
