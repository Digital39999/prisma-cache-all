import ValKeyClient, { RedisOptions } from 'iovalkey';
import { Cache } from '../types';

export class ValKey implements Cache {
	readonly lifetime: number;

	private client: ValKeyClient;

	constructor (
		urlOrClient: string | ValKeyClient,
		options: RedisOptions & { ttlSeconds?: number; } = { ttlSeconds: 60, keyPrefix: 'cache' },
	) {
		if (typeof urlOrClient === 'string') this.client = new ValKeyClient(urlOrClient, options);
		else this.client = urlOrClient;

		this.lifetime = options.ttlSeconds || 60;
	}

	async read(key: string): Promise<string | null> {
		return await this.client.get(this.client.options.keyPrefix ? `${this.client.options.keyPrefix}:${key}` : key);
	}

	async write(key: string, value: string): Promise<void> {
		const ValKeyKey = this.client.options.keyPrefix ? `${this.client.options.keyPrefix}:${key}` : key;
		await this.client.set(ValKeyKey, value, 'EX', this.lifetime);
	}

	async flush(): Promise<void> {
		await this.client.flushdb();
	}

	close(): void {
		this.client.disconnect();
	}
}
