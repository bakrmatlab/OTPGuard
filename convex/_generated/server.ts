// Offline schema-derived bindings. No deployment/codegen credentials are required.
import {
  queryGeneric,
  mutationGeneric,
  internalMutationGeneric,
  type QueryBuilder,
  type MutationBuilder,
  type DataModelFromSchemaDefinition,
  type GenericQueryCtx,
  type GenericMutationCtx,
} from 'convex/server';
import type schema from '../schema';
export type DataModel = DataModelFromSchemaDefinition<typeof schema>;
export type QueryCtx = GenericQueryCtx<DataModel>;
export type MutationCtx = GenericMutationCtx<DataModel>;
export const query: QueryBuilder<DataModel, 'public'> = queryGeneric;
export const mutation: MutationBuilder<DataModel, 'public'> = mutationGeneric;
export const internalMutation: MutationBuilder<DataModel, 'internal'> =
  internalMutationGeneric;
