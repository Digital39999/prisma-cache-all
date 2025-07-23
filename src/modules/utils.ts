import { createHash } from 'crypto';

export function makeHash(data: unknown): string {
	const str = typeof data === 'string' ? data : JSON.stringify(data);
	return createHash('sha256').update(str).digest('hex').slice(0, 16); // Shorter hash
}

export function isDateString(value: unknown): value is string {
	return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value);
}

export function serialize(value: unknown): string {
	return JSON.stringify(value, (_, val) => {
		if (val instanceof Date) return { __d: val.toISOString() };
		if (Buffer.isBuffer(val)) return { __b: val.toString('base64') };
		if (val instanceof ArrayBuffer) return { __ab: Buffer.from(val).toString('base64') };
		return val;
	});
}

export function deserialize<T = unknown>(value: string): T {
	return JSON.parse(value, (_, val) => {
		if (val?.__d) return new Date(val.__d);
		if (val?.__b) return Buffer.from(val.__b, 'base64');
		if (val?.__ab) return Buffer.from(val.__ab, 'base64').buffer;
		return val;
	});
}
