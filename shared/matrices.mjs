export const MATRIX_TYPES = ['nuevo-ingreso', 'personal-antiguo'];
export const MAX_ASSIGNMENTS = 4000;
export const normalizeCargo = value => value.trim().toLocaleLowerCase('es').replace(/\s+/g, ' ');

export function codesForCargo(mapping, cargo) {
  return mapping.find(row => normalizeCargo(row.cargo) === normalizeCargo(cargo))?.estandares ?? [];
}

// Used by Excel preview and again by the server before any write.
export function validateRows(rows, validCodes) {
  const errors = [];
  const grouped = new Map();
  const seen = new Set();
  if (!Array.isArray(rows) || rows.length > MAX_ASSIGNMENTS) {
    return { mapping: [], errors: [`Máximo ${MAX_ASSIGNMENTS} asignaciones.`], count: 0 };
  }
  const bank = new Set(validCodes);
  rows.forEach((row, index) => {
    const line = `Fila ${index + 2}`;
    if (!row || typeof row.cargo !== 'string' || typeof row.estandar !== 'string') {
      errors.push(`${line}: Cargo y Estándar deben ser texto.`); return;
    }
    const cargo = row.cargo.trim().replace(/\s+/g, ' ');
    const code = row.estandar.trim();
    if (!cargo || cargo.length > 120 || /[\u0000-\u001f=<>@]/.test(cargo) || /^[+\-]/.test(cargo)) errors.push(`${line}: cargo vacío o inválido (máximo 120 caracteres).`);
    if (!code) errors.push(`${line}: código de estándar vacío.`);
    else if (!bank.has(code)) errors.push(`${line}: código inexistente: ${code.slice(0, 60)}.`);
    const key = `${normalizeCargo(cargo)}\u0000${code}`;
    if (seen.has(key)) errors.push(`${line}: asignación duplicada.`);
    seen.add(key);
    const normalized = normalizeCargo(cargo);
    if (!grouped.has(normalized)) grouped.set(normalized, { cargo, estandares: [] });
    grouped.get(normalized).estandares.push(code);
  });
  return { mapping: [...grouped.values()], errors, count: rows.length };
}

export function validateMapping(mapping, validCodes) {
  if (!Array.isArray(mapping) || mapping.length > MAX_ASSIGNMENTS) return { errors: ['Matriz inválida.'], mapping: [], count: 0 };
  const rows = [];
  for (const entry of mapping) {
    if (!entry || typeof entry.cargo !== 'string' || !Array.isArray(entry.estandares) || !entry.estandares.length || entry.estandares.length > MAX_ASSIGNMENTS) {
      return { errors: ['Cada cargo debe tener al menos un estándar.'], mapping: [], count: 0 };
    }
    for (const estandar of entry.estandares) {
      rows.push({ cargo: entry.cargo, estandar });
      if (rows.length > MAX_ASSIGNMENTS) return { errors: ['Demasiadas asignaciones.'], mapping: [], count: 0 };
    }
  }
  return validateRows(rows, validCodes);
}
