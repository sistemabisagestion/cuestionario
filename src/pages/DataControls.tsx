import { useCallback, useEffect, useRef, useState } from 'react';
import { loadDataset, previewDataset, publishDataset, restoreDataset, clearMatrix, listVersions } from '../utils/datasets';
import type { DatasetModule, DatasetPreview, DatasetSnapshot, DatasetVersion, UpdateMode } from '../utils/datasets';
import { downloadDatasetExcel, saveInBrowser, tableExcel } from '../utils/excelTables';
import { DATASETS, isMatrixModule } from '../../shared/datasets.mjs';

const ACTIONS: Record<string, string> = {
  'version-incluida': 'Versión original incluida', 'version-existente': 'Versión existente al centralizar', 'matriz-vacia': 'Matriz vacía',
  'actualizacion-parcial': 'Actualización parcial', 'sincronizacion-completa': 'Sincronización completa', restauracion: 'Restauración', limpieza: 'Limpieza de matriz',
  incluida: 'Versión original incluida', legado: 'Versión existente al centralizar', vacia: 'Matriz vacía',
};
const MODES: Record<UpdateMode, string> = {
  parcial: 'Actualización parcial: agrega y modifica; no elimina registros ausentes del archivo.',
  completa: 'Sincronización completa: el archivo será la nueva versión completa; elimina lo que no aparezca.',
};
const date = (value: string | null) => value ? new Date(value).toLocaleString('es-PE') : 'incluida con la aplicación';
function describe(snapshot: DatasetSnapshot) {
  if (snapshot.module === 'preguntas') return `${(snapshot as DatasetSnapshot<'preguntas'>).data.length} estándares — ${snapshot.count} preguntas`;
  if (snapshot.module === 'links') return `${snapshot.count} estándares con video y documento en SharePoint`;
  return `${(snapshot as DatasetSnapshot<'nuevo-ingreso'>).data.length} cargos · ${snapshot.count} asignaciones`;
}
const box = { width: '100%', padding: 12, background: '#f7fafc', borderRadius: 6, fontSize: 13 } as const;
// Secondary actions inside white cards (header__link is styled for the dark header).
const linkButton = { background: 'none', border: 'none', padding: 0, color: '#1D262B', fontSize: 13, fontWeight: 600, textDecoration: 'underline', cursor: 'pointer' } as const;

export interface LegacyCopy { description: string; rows: Record<string, unknown>[] }

// Download, upload with server-side preview, confirmed publication and version restore.
export default function DataControls({ module, refreshKey = 0, legacy, onPublished, children }: {
  module: DatasetModule; refreshKey?: number; legacy?: LegacyCopy | null; onPublished?: () => void; children?: React.ReactNode;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [snapshot, setSnapshot] = useState<DatasetSnapshot | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [mode, setMode] = useState<UpdateMode>('parcial');
  const [preview, setPreview] = useState<DatasetPreview | null>(null);
  const [deletionsConfirmed, setDeletionsConfirmed] = useState(false);
  const [versions, setVersions] = useState<DatasetVersion[] | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const spec = DATASETS[module];

  const reload = useCallback(() => loadDataset(module).then(setSnapshot), [module]);
  useEffect(() => { reload().catch(error => setMessage({ ok: false, text: error.message })); }, [reload, refreshKey]);

  async function run(action: () => Promise<void>) {
    setBusy(true); setMessage(null);
    try { await action(); }
    catch (error) { setMessage({ ok: false, text: error instanceof Error ? error.message : 'No se pudo completar la operación.' }); }
    finally { setBusy(false); }
  }
  function analyze(selected: File, selectedMode: UpdateMode) {
    setPreview(null); setDeletionsConfirmed(false);
    void run(async () => setPreview(await previewDataset(module, { file: selected }, selectedMode)));
  }
  async function finish(text: string) {
    setFile(null); setPreview(null); setVersions(null);
    await reload();
    setMessage({ ok: true, text });
    onPublished?.();
  }
  const publish = () => preview && file && void run(async () => {
    const result = await publishDataset(module, { file }, preview.mode, preview.base, preview.counts.removed || undefined);
    await finish(result.unchanged ? 'El archivo no contiene cambios; la versión vigente se mantiene.'
      : `Publicado para todos los usuarios: ${result.summary?.added ?? 0} agregados, ${result.summary?.modified ?? 0} modificados, ${result.summary?.removed ?? 0} eliminados.`);
  });
  const restore = (version: DatasetVersion) => snapshot && window.confirm(`¿Restaurar la versión del ${date(version.createdAt)}? Se publicará como una nueva versión y la actual quedará en el historial.`)
    && void run(async () => { await restoreDataset(module, version.versionId, snapshot.version); await finish('Versión restaurada y publicada para todos los usuarios.'); });
  const clear = () => snapshot && isMatrixModule(module) && window.confirm('¿Limpiar esta matriz? Los trabajadores dejarán de tener asignaciones. La versión actual quedará en el historial.')
    && void run(async () => { await clearMatrix(module, snapshot.version); await finish('Matriz limpiada. La versión anterior se puede restaurar.'); });
  const pendingDeletions = !!preview && preview.mode === 'completa' && preview.counts.removed > 0;
  const hasChanges = !!preview && (preview.counts.added + preview.counts.modified + preview.counts.removed) > 0;

  return <>
    <button className="btn btn--primary" disabled={busy} onClick={() => void run(async () => { setSnapshot(await downloadDatasetExcel(module)); })}>⬇ Descargar (Excel)</button>
    <button className="btn btn--secondary" disabled={busy} onClick={() => input.current?.click()}>⬆ Subir (Excel)</button>
    {isMatrixModule(module) && <button className="btn btn--dark" disabled={busy || !snapshot || !snapshot.count || !!preview} onClick={clear}>🗑 Limpiar matriz</button>}
    {children}
    <input ref={input} type="file" accept=".xlsx" style={{ display: 'none' }} onChange={event => {
      const selected = event.target.files?.[0]; event.target.value = '';
      if (!selected) return;
      if (!/\.xlsx$/i.test(selected.name) || selected.size > spec.maxFileBytes) { setMessage({ ok: false, text: `Usa un archivo .xlsx de máximo ${Math.round(spec.maxFileBytes / 1048576)} MB.` }); return; }
      setFile(selected); analyze(selected, mode);
    }} />

    {snapshot && <div style={{ width: '100%', fontSize: 12, color: '#6b7280' }}>
      {describe(snapshot)} · Versión vigente: {date(snapshot.updatedAt)}
    </div>}

    {file && (preview || busy) && <div role="status" style={box}>
      <div style={{ fontWeight: 600, marginBottom: 8 }}>Vista previa: {file.name}</div>
      {(['parcial', 'completa'] as UpdateMode[]).map(option => <label key={option} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 4, cursor: 'pointer' }}>
        <input type="radio" name={`modo-${module}`} checked={mode === option} disabled={busy} onChange={() => { setMode(option); analyze(file, option); }} />
        <span>{MODES[option]}</span>
      </label>)}
      {!preview && <p style={{ margin: '8px 0 0' }}>Validando archivo en el servidor…</p>}
      {preview && <>
        <p style={{ margin: '10px 0 6px' }}>
          <strong>{preview.counts.received} registros leídos:</strong> {preview.counts.added} nuevos · {preview.counts.modified} modificados · {preview.counts.removed} eliminados · {preview.counts.unchanged} sin cambios. Resultado: {preview.counts.total} registros.
        </p>
        {([['Nuevos', preview.changes.added, preview.counts.added], ['Eliminados', preview.changes.removed, preview.counts.removed]] as const).map(([label, items, total]) => items.length > 0 &&
          <details key={label}><summary>{label} ({total})</summary><ul style={{ margin: '4px 0' }}>{items.map(item => <li key={item}>{item}</li>)}{total > items.length && <li>… y {total - items.length} más</li>}</ul></details>)}
        {preview.changes.modified.length > 0 && <details><summary>Modificados ({preview.counts.modified})</summary><ul style={{ margin: '4px 0' }}>
          {preview.changes.modified.map(item => <li key={item.label}>{item.label}: {item.fields.join(', ')}</li>)}
          {preview.counts.modified > preview.changes.modified.length && <li>… y {preview.counts.modified - preview.changes.modified.length} más</li>}
        </ul></details>}
        {preview.errors.length > 0 && <div style={{ color: '#991b1b', marginTop: 8 }}>
          <strong>{preview.totalErrors} errores bloqueantes. Corrige el archivo y vuelve a subirlo; no se publicará nada.</strong>
          <ul style={{ margin: '4px 0' }}>{preview.errors.map((error, i) => <li key={i}>{error}</li>)}</ul>
          {preview.totalErrors > preview.errors.length && <p style={{ margin: 0 }}>Se muestran los primeros {preview.errors.length}.</p>}
        </div>}
        {preview.warnings.length > 0 && <details style={{ marginTop: 8 }}><summary>{preview.totalWarnings} advertencias (no bloquean)</summary>
          <ul style={{ margin: '4px 0' }}>{preview.warnings.map((warning, i) => <li key={i}>{warning}</li>)}</ul></details>}
        {pendingDeletions && preview.valid && <label style={{ display: 'flex', gap: 8, marginTop: 10, color: '#991b1b', fontWeight: 600 }}>
          <input type="checkbox" checked={deletionsConfirmed} onChange={event => setDeletionsConfirmed(event.target.checked)} />
          Confirmo que se eliminarán {preview.counts.removed} registros de la versión publicada.
        </label>}
        {preview.valid && !hasChanges && <p style={{ margin: '8px 0 0' }}>El archivo coincide con la versión vigente; no hay nada que publicar.</p>}
      </>}
      <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
        <button className="btn btn--primary" disabled={busy || !preview?.valid || !hasChanges || (pendingDeletions && !deletionsConfirmed)} onClick={publish}>Confirmar publicación</button>
        <button className="btn btn--secondary" disabled={busy} onClick={() => { setFile(null); setPreview(null); }}>Cancelar</button>
      </div>
    </div>}

    {message && <p role="status" style={{ width: '100%', margin: 0, color: message.ok ? '#166534' : '#991b1b' }}>{message.text}</p>}

    {legacy && <div style={{ ...box, background: '#fffbeb' }}>
      Este navegador conserva {legacy.description} guardada antes de la centralización. Ya no se usa en las evaluaciones.{' '}
      <button style={linkButton} disabled={busy} onClick={() => void run(async () => saveInBrowser(await tableExcel(spec, legacy.rows, `${spec.filename}-copia-local`)))}>Descargar copia local</button>
    </div>}

    <button style={linkButton} disabled={busy || !!preview} onClick={() => versions ? setVersions(null) : void run(async () => setVersions((await listVersions(module)).versions))}>
      {versions ? 'Ocultar versiones' : 'Versiones anteriores'}
    </button>
    {versions && <div style={{ ...box, maxHeight: 260, overflowY: 'auto' }}>
      {versions.map(version => <div key={version.versionId} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '6px 0', borderBottom: '1px solid #e5e7eb' }}>
        <span>
          <strong>{date(version.createdAt)}</strong> · {ACTIONS[version.action] ?? version.action} · {version.count} registros
          {version.summary && ` (+${version.summary.added} / ~${version.summary.modified} / −${version.summary.removed})`}
          {version.versionId === snapshot?.version && <strong style={{ color: '#166534' }}> · vigente</strong>}
        </span>
        {version.versionId !== snapshot?.version && <button style={linkButton} disabled={busy} onClick={() => restore(version)}>Restaurar</button>}
      </div>)}
    </div>}
  </>;
}
