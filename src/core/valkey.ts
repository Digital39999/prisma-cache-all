import ValKeyClient, { RedisOptions } from 'iovalkey';
import { Cache } from '../types';

type ExpirableValue = {
	d: string;
	e: number;
};

export class ValKey implements Cache {
	readonly lifetime: number;
	private client: ValKeyClient;
	private hashIdentifier: string;

	constructor (
		urlOrClient: string | ValKeyClient,
		options: RedisOptions & { ttlSeconds?: number; } = { ttlSeconds: 60, keyPrefix: 'cache' },
	) {
		if (typeof urlOrClient === 'string') this.client = new ValKeyClient(urlOrClient, options);
		else this.client = urlOrClient;

		this.lifetime = options.ttlSeconds || 60;
		this.hashIdentifier = options.keyPrefix ? `${options.keyPrefix}:hash` : 'cache:hash';

		this.startCleanupInterval();
	}

	async read(key: string): Promise<string | null> {
		const value = await this.client.hget(this.hashIdentifier, key);
		if (!value) return null;

		const expirableValue = JSON.parse(value) as ExpirableValue;
		if (expirableValue.e > 0 && Date.now() > expirableValue.e) {
			await this.client.hdel(this.hashIdentifier, key); // Auto-delete expired key
			return null;
		}

		return expirableValue.d;
	}

	async write(key: string, value: string): Promise<void> {
		const expirableValue: ExpirableValue = {
			d: value,
			e: this.lifetime ? Date.now() + this.lifetime * 1000 : 0, // Convert seconds to milliseconds
		};

		await this.client.hset(this.hashIdentifier, key, JSON.stringify(expirableValue));
	}

	async flush(): Promise<void> {
		await this.client.del(this.hashIdentifier);
	}

	close(): void {
		this.client.disconnect();
	}

	private startCleanupInterval(intervalMs: number = 600000): void { // Default: 10 minutes
		setInterval(async () => {
			const keys = await this.client.hkeys(this.hashIdentifier);
			for (const key of keys) {
				const value = await this.client.hget(this.hashIdentifier, key);
				if (!value) continue;

				const expirableValue = JSON.parse(value) as ExpirableValue;
				if (expirableValue.e > 0 && Date.now() > expirableValue.e) {
					await this.client.hdel(this.hashIdentifier, key);
				}
			}
		}, intervalMs);
	}
}
