import { PrismaClient } from '@prisma/client';

export interface Cache {
	read: (key: string) => Promise<string | null>;
	write: (key: string, value: string) => Promise<void>;
	flush: () => Promise<void>;
}

export interface SingletonClient {
	cache?: Cache;
	client?: PrismaClient;
}
