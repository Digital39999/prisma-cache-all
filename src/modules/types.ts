import type { PrismaClient } from '@prisma/client';

export type Cache = {
	read: (key: string) => Promise<string | null>;
	write: (key: string, value: string, ttl?: number) => Promise<void>;
	flush: (pattern?: string) => Promise<void>;
	delete: (key: string) => Promise<void>;
	close?: () => Promise<void> | void;
}

export type CacheOptions = {
	maxSize?: number;
	enabled?: boolean;
	keyPrefix?: string;
	ttlSeconds?: number;

	onDBRequest?: (model: string, action: string, args: unknown) => Promise<void>;

	onCacheHit?: (key: string) => Promise<void>;
	onCacheMiss?: (key: string) => Promise<void>;
}

export type SingletonClient = {
	cache?: Cache;
	client?: PrismaClient;
}

export type ExpirableValue = {
	d: string;
	e: number;
}
