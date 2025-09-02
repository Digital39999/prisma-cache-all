import { PureAction, ImpureAction } from './constants';
import type { PrismaClient } from '@prisma/client';

export type AllActions = PureAction | ImpureAction;

export type Cache = {
	read: (key: string) => Promise<string | null>;
	write: (key: string, value: string, ttl?: number) => Promise<void>;
	flush: (pattern?: string) => Promise<void>;
	delete: (key: string) => Promise<void>;
	close?: () => Promise<void> | void;
}

export type CacheOptions<ModelNames extends string = string> = {
	maxSize?: number;
	enabled?: boolean;
	keyPrefix?: string;
	ttlSeconds?: number;
	metrics?: MetricsCallbacks<ModelNames>;
}

export type MetricsCallbacks<ModelNames extends string = string> = {
	onCacheHit?: (model: ModelNames, action: AllActions, key: string) => void;
	onCacheMiss?: (model: ModelNames, action: AllActions, key: string) => void;

	onDbRequest?: (model: ModelNames, action: AllActions, durationMs: number) => void;
	onDbError?: (model: ModelNames, action: AllActions, error: Error, durationMs: number) => void;
}

export type SingletonClient = {
	cache?: Cache;
	client?: PrismaClient;
}

export type ExpirableValue = {
	d: string;
	e: number;
}
