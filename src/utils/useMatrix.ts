import { useEffect, useState } from 'react';
import { loadMatrix } from './matrices';
import type { MatrixSnapshot, MatrixType } from './matrices';

export function useMatrix(type: MatrixType) {
  const [snapshot, setSnapshot] = useState<MatrixSnapshot | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    loadMatrix(type).then(data => { if (active) { setSnapshot(data); setError(''); } })
      .catch(error => { if (active) setError(error instanceof Error ? error.message : 'No se pudo consultar la matriz vigente.'); });
    return () => { active = false; };
  }, [type]);
  return { snapshot, error, loading: !snapshot && !error };
}
