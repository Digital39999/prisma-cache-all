import { Cache, SingletonClient, CacheOptions, MetricsCallbacks } from '../modules/types';
import { makeHash, serialize, deserialize } from '../modules/utils';
import { PureActions, ImpureActions } from '../modules/constants';
import type { PrismaClient } from '@prisma/client';
import { LRUCache } from './lru';

export class PrismaWithCache<ModelNames extends string = string> {
	private static singleton: SingletonClient = {};
	private metricsCallbacks: MetricsCallbacks<ModelNames>;

	public cacheEnabled: boolean;

	public readonly cache: Cache;
	public readonly client: PrismaClient;

	constructor (client: PrismaClient, cache?: Cache, options: CacheOptions<ModelNames> = {}) {
		this.cacheEnabled = options.enabled ?? true;
		this.metricsCallbacks = options.metrics ?? {};

		if (!PrismaWithCache.singleton.cache) PrismaWithCache.singleton.cache = cache ?? new LRUCache(options);
		if (!PrismaWithCache.singleton.client) {
			PrismaWithCache.singleton.client = client;
			this.wrapClientMethods(PrismaWithCache.singleton.client);
		}

		this.client = PrismaWithCache.singleton.client;
		this.cache = PrismaWithCache.singleton.cache;
	}

	private wrapClientMethods(client: PrismaClient): void {
		const modelNames = Object.getOwnPropertyNames(client).filter(
			(prop) => !prop.startsWith('$') && !prop.startsWith('_') && typeof client[prop] === 'object',
		) as ModelNames[];

		for (const modelName of modelNames) {
			const model = client[modelName];

			for (const action of ImpureActions) {
				if (typeof model[action] === 'function') {
					const original = model[action].bind(model);

					model[action] = async (...args: unknown[]) => {
						const timeNow = Date.now();

						try {
							const result = await original(...args);
							const duration = Date.now() - timeNow;

							this.metricsCallbacks.onDbRequest?.(modelName, action, duration);

							if (this.cacheEnabled) await this.cache.flush(modelName);

							return result;
						} catch (error) {
							const duration = Date.now() - timeNow;
							this.metricsCallbacks.onDbError?.(modelName, action, error as Error, duration);
							throw error;
						}
					};
				}
			}

			for (const action of PureActions) {
				if (typeof model[action] === 'function') {
					const original = model[action].bind(model);

					model[action] = async (...args: unknown[]) => {
						const cacheKey = this.generateCacheKey(modelName, action, args);

						if (this.cacheEnabled) {
							const cached = await this.cache.read(cacheKey);
							if (cached) {
								this.metricsCallbacks.onCacheHit?.(modelName, action, cacheKey);
								return deserialize(cached);
							}

							this.metricsCallbacks.onCacheMiss?.(modelName, action, cacheKey);
						}

						const timeNow = Date.now();
						try {
							const result = await original(...args);
							const duration = Date.now() - timeNow;

							this.metricsCallbacks.onDbRequest?.(modelName, action, duration);

							if (this.cacheEnabled) {
								this.cache.write(cacheKey, serialize(result));
							}

							return result;
						} catch (error) {
							const duration = Date.now() - timeNow;
							this.metricsCallbacks.onDbError?.(modelName, action, error as Error, duration);
							throw error;
						}
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

	async close(): Promise<void> {
		await this.client.$disconnect();
		if (this.cache.close) await this.cache.close();
	}

	// Metrics callbacks.
	setMetricsCallbacks(callbacks: MetricsCallbacks<ModelNames>): void {
		this.metricsCallbacks = { ...this.metricsCallbacks, ...callbacks };
	}

	// Toggle methods.
	enableCache(): void {
		this.cacheEnabled = true;
	}

	disableCache(): void {
		this.cacheEnabled = false;
	}
}
