export const PureActions = [
	'FindFirst',
	'FindFirstOrThrow',
	'FindUnique',
	'FindUniqueOrThrow',
	'FindMany',
	'Count',
	'Aggregate',
	'GroupBy',
	'QueryRaw',
] as const;

export const ImpureActions = [
	'Create',
	'CreateMany',
	'Delete',
	'DeleteMany',
	'ExecuteRaw',
	'Update',
	'UpdateMany',
	'Upsert',
] as const;

export type PureAction = typeof PureActions[number];
export type ImpureAction = typeof ImpureActions[number];
