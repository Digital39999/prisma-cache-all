import type { PrismaClient } from '@prisma/client';

export type Cache = {
	read: (key: string) => Promise<string | null>;
	write: (key: string, value: string, ttl?: number) => Promise<void>;
	flush: (pattern?: string) => Promise<void>;
	delete: (key: string) => Promise<void>;
	close?: () => Promise<void> | void;
}

export type CacheOptions = {
	ttlSeconds?: number;
	maxSize?: number;
	keyPrefix?: string;
	enabled?: boolean;
}

export type SingletonClient = {
	cache?: Cache;
	client?: PrismaClient;
}

export type ExpirableValue = {
	d: string;
	e: number;
}
