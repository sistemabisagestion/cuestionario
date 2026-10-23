import { MATRIX_TYPES, validateMapping } from '../shared/matrices.mjs';
import codes from '../shared/standard-codes.json' with { type: 'json' };

export function validateInitialDocuments(documents) {
  for (const type of MATRIX_TYPES) {
    const doc = documents[type];
    if (!doc || doc.schema !== 1 || !doc.current || typeof doc.current.revision !== 'string' || !doc.current.revision || !doc.current.updatedAt || doc.previous !== null) throw new Error(`Documento inicial inválido: ${type}`);
    const result = validateMapping(doc.current.mapping, codes);
    if (result.errors.length || !doc.current.mapping.length || JSON.stringify(result.mapping) !== JSON.stringify(doc.current.mapping)) throw new Error(`Asignaciones iniciales inválidas o alteradas: ${type}`);
  }
}

// Explicit migration only. Never called from GET, app startup or React.
// There is no overwrite path, even if the script is run more than once.
export async function seedMissingMatrices(store, documents, backupExisting) {
  validateInitialDocuments(documents);
  const outcomes = [];
  for (const type of MATRIX_TYPES) {
    let existing = await store.read(type);
    if (!existing) {
      try {
        await store.write(type, documents[type], null);
        outcomes.push({ type, status: 'created' });
        continue;
      } catch (error) {
        if (error.status !== 409) throw error;
        existing = await store.read(type);
        if (!existing) throw error;
      }
    }
    await backupExisting(type, existing.document);
    outcomes.push({ type, status: 'preserved-existing' });
  }
  return outcomes;
}
