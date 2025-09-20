import { Cache, SingletonClient, CacheOptions, MetricsCallbacks } from '../modules/types';
import { makeHash, serialize, deserialize, firstToLowerCase } from '../modules/utils';
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

	private callMetric<K extends keyof MetricsCallbacks<ModelNames>>(key: K, ...args: Parameters<NonNullable<MetricsCallbacks<ModelNames>[K]>>): void {
		const fn = this.metricsCallbacks[key] as (...args: any[]) => void; // eslint-disable-line
		if (fn) fn(...args);
	}

	private wrapClientMethods(client: PrismaClient): void {
		const modelNames = Object.getOwnPropertyNames(client).filter(
			(prop) => !prop.startsWith('$') && !prop.startsWith('_') && typeof client[prop] === 'object',
		) as ModelNames[];

		for (const modelName of modelNames) {
			const model = client[modelName];

			// Impure Actions (create, update, delete)
			for (const rawAction of ImpureActions) {
				const action = firstToLowerCase(rawAction);

				if (typeof model[action] === 'function') {
					const original = model[action].bind(model);
					model[action] = async (...args: unknown[]) => {
						const timeNow = Date.now();
						try {
							const result = await original(...args);
							const duration = Date.now() - timeNow;

							this.callMetric('onDbRequest', modelName, rawAction, duration);

							if (this.cacheEnabled) {
								await this.cache.flush(`${modelName}:`);
								const size = await this.cache.size?.();
								this.callMetric('onCacheSizeUpdate', size);
							}

							return result;
						} catch (error) {
							const duration = Date.now() - timeNow;
							this.callMetric('onDbError', modelName, rawAction, error as Error, duration);
							throw error;
						}
					};
				}
			}

			// Pure Actions (findMany, findUnique)
			for (const rawAction of PureActions) {
				const action = firstToLowerCase(rawAction);

				if (typeof model[action] === 'function') {
					const original = model[action].bind(model);
					model[action] = async (...args: unknown[]) => {
						const cacheKey = this.generateCacheKey(modelName, action, args);

						if (this.cacheEnabled) {
							const cached = await this.cache.read(cacheKey);
							if (cached) {
								this.callMetric('onCacheHit', modelName, rawAction, cacheKey);
								return deserialize(cached);
							} else {
								this.callMetric('onCacheMiss', modelName, rawAction, cacheKey);
							}
						}

						const timeNow = Date.now();
						try {
							const result = await original(...args);
							const duration = Date.now() - timeNow;

							this.callMetric('onDbRequest', modelName, rawAction, duration);

							if (this.cacheEnabled) {
								await this.cache.write(cacheKey, serialize(result));
								const size = await this.cache.size?.();
								this.callMetric('onCacheSizeUpdate', size);
							}

							return result;
						} catch (error) {
							const duration = Date.now() - timeNow;
							this.callMetric('onDbError', modelName, rawAction, error as Error, duration);
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
		await this.cache.flush(`${modelName}:`);
	}

	async close(): Promise<void> {
		await this.client.$disconnect();
		if (this.cache.close) await this.cache.close();
	}

	// Metrics callbacks.
	setMetricsCallbacks(callbacks: MetricsCallbacks<ModelNames>): void {
		Object.assign(this.metricsCallbacks, callbacks);
	}

	// Toggle methods.
	enableCache(): void {
		this.cacheEnabled = true;
	}

	disableCache(): void {
		this.cacheEnabled = false;
	}
}
