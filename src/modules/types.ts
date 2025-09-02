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
	metrics?: MetricsCallbacks;
}

export type MetricsCallbacks = {
	onCacheHit?: (key: string, model: string, action: string) => void;
	onCacheMiss?: (key: string, model: string, action: string) => void;

	onDbConnectionPoolChange?: (active: number, idle: number, total: number) => void;
	onDbRequest?: (model: string, action: string, durationMs: number) => void;
	onDbError?: (model: string, action: string, error: Error, durationMs: number) => void;
}

export type SingletonClient = {
	cache?: Cache;
	client?: PrismaClient;
}

export type ExpirableValue = {
	d: string;
	e: number;
}
