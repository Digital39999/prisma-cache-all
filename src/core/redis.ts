import { Redis as RedisClient, RedisOptions } from 'ioredis';
import { Cache } from '../types';

export class Redis implements Cache {
	readonly lifetime: number;

	private client: RedisClient;

	constructor(
		urlOrClient: string | RedisClient,
		options: RedisOptions & { ttlSeconds?: number; } = { ttlSeconds: 60, keyPrefix: 'cache' },
	) {
		if (typeof urlOrClient === 'string') {
			this.client = new RedisClient(urlOrClient, options);
		} else {
			this.client = urlOrClient;
		}

		this.lifetime = options.ttlSeconds || 60;
	}

	read(key: string): Promise<string | null> {
		return this.client.get(key);
	}

	async write(key: string, value: string): Promise<void> {
		await this.client.set(key, value, 'EX', this.lifetime);
	}

	async flush(): Promise<void> {
		await this.client.flushdb();
	}

	close(): void {
		this.client.disconnect();
	}
}
