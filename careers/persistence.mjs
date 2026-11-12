export function persistenceError(stage, cause) {
  if (cause?.code === 'COLLECTION_PERSISTENCE_FAILED') return cause;
  return Object.assign(new Error(`Persistence failed at ${stage}: ${cause?.code ?? 'UNKNOWN'}: ${cause?.message ?? cause}`, { cause }), {
    code: 'COLLECTION_PERSISTENCE_FAILED', failure_scope: 'persistence', persistence_stage: stage,
    cause_code: cause?.code ?? null,
  });
}

export function persistSync(stage, operation) {
  try { return operation(); } catch (error) { throw persistenceError(stage, error); }
}

export async function persist(stage, operation) {
  try { return await operation(); } catch (error) { throw persistenceError(stage, error); }
}
