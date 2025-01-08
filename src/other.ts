import { createHash } from 'crypto';

export const PureActions = [
	'aggregate',
	'count',
	'findFirst',
	'findMany',
	'findUnique',
	'queryRaw',
];

export const ImpureActions = [
	'create',
	'createMany',
	'delete',
	'deleteMany',
	'executeRaw',
	'update',
	'updateMany',
	'upsert',
];

export function makeHash(str: string | null): string {
	if (!str) return '';
	return createHash('sha256').update(str).digest('hex');
}
