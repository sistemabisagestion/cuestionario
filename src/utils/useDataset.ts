import { useEffect, useState } from 'react';
import { loadDataset } from './datasets';
import type { DatasetModule, DatasetSnapshot } from './datasets';

// Reads the published version when the page is entered (no polling).
export function useDataset<M extends DatasetModule>(module: M) {
  const [snapshot, setSnapshot] = useState<DatasetSnapshot<M> | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    loadDataset(module).then(data => { if (active) { setSnapshot(data); setError(''); } })
      .catch(error => { if (active) setError(error instanceof Error ? error.message : 'No se pudo consultar la información publicada.'); });
    return () => { active = false; };
  }, [module]);
  return { snapshot, error, loading: !snapshot && !error };
}
