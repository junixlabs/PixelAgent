/**
 * Shared Fastify JSON Schema fragments. Routes import these so the contract
 * for `dsl` and other recurring fields stays consistent.
 */

export const dslField = { type: 'string', minLength: 1 } as const;

export const instructionField = {
  type: 'string',
  minLength: 1,
  maxLength: 2000,
} as const;
