import { ImpureActions, makeHash, PureActions } from '../other';
import { SingletonClient, Cache } from '../types';
// @ts-ignore
import { PrismaClient } from '@prisma/client';
import { LRUCache } from './lru';

export class Prisma {
	private static singleton: SingletonClient = {};

	cache: Cache;
	client: PrismaClient;

	constructor (cacheFactory: Cache = new LRUCache({ max: 1000 })) {
		if (!Prisma.singleton.cache) Prisma.singleton.cache = cacheFactory;
		if (!Prisma.singleton.client) Prisma.singleton.client = Prisma.clientFactory();

		this.client = Prisma.singleton.client;
		this.cache = Prisma.singleton.cache;
	}

	private static clientFactory(): PrismaClient {
		const client = new PrismaClient();

		for (const field of Object.getOwnPropertyNames(client).filter((property: string) => !property.startsWith('$') && !property.startsWith('_'))) {
			for (const action of ImpureActions) {
				const pristine = client[field][action];

				client[field][action] = (...args: unknown[]) => {
					Prisma.singleton.cache?.flush();
					return pristine(...args);
				};
			}

			for (const action of PureActions) {
				const pristine = client[field][action];

				client[field][action] = async (...args: unknown[]) => {
					const key = makeHash(JSON.stringify({ field, action, args }));
					const cached = await Prisma.singleton.cache?.read(key);

					if (cached) return transformDates(JSON.parse(cached));
					const evaluated = await pristine(...args);

					await Prisma.singleton.cache?.write(key, JSON.stringify(evaluated));
					return evaluated;
				};
			}
		}

		return client;
	}
}

export function isDateStringRegex(value: unknown): value is string {
	const isoPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;
	return typeof value === 'string' && isoPattern.test(value);
}

export function transformDates<T>(data: T): T {
	if (data instanceof Date) return data as unknown as T;
	if (Array.isArray(data)) return data.map(transformDates) as unknown as T;
	if (typeof data === 'object' && data !== null) {
		for (const key in data) {
			data[key] = transformDates(data[key]);
		}
	}

	return isDateStringRegex(data) ? new Date(data) as unknown as T : data;
}
