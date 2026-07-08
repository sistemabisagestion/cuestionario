import bisaLogoNegro from '../assets/bisa_fondo_negro.png';
import bisaLogoBlanco from '../assets/bisa_fondo_blanco.png';
import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getIntentos, importFromExcel, addTableFormat, getAllIntentosAsync } from '../utils/storage';
import { getEstandares, saveCustomPreguntas, hasCustomPreguntas, resetPreguntas } from '../data';
import { getLinks, saveLinks, resetLinks, DEFAULT_LINKS } from '../data/estandarLinks';
import { getNuevoIngresoMapping, saveNuevoIngresoMapping, resetNuevoIngresoMapping, parseMappingExcel } from '../data/nuevoIngresoMapping';
import type { Estandar, Pregunta, Intento } from '../types';

// ── Colores corporativos ──────────────────────────────────────────────────────
const MAGENTA = '#E6007E';
const NAVY = '#1D262B';

// ── Tab styles ────────────────────────────────────────────────────────────────
function TabButton({ label, active, onClick, badge }: { label: string; active: boolean; onClick: () => void; badge?: number }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '12px 24px',
        fontWeight: 600,
        fontSize: 14,
        border: 'none',
        borderBottom: active ? `3px solid ${MAGENTA}` : '3px solid transparent',
        color: active ? MAGENTA : '#6b7280',
        background: 'none',
        cursor: 'pointer',
        transition: 'all 0.15s',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        whiteSpace: 'nowrap',
      }}
    >
      {label}
      {badge !== undefined && badge > 0 && (
        <span style={{ background: MAGENTA, color: '#fff', borderRadius: 99, fontSize: 11, fontWeight: 700, padding: '1px 7px' }}>
          {badge}
        </span>
      )}
    </button>
  );
}

// ── Sección de gestión (título + botones) ─────────────────────────────────────
function GestionSeccion({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: '20px 24px', marginBottom: 16 }}>
      <div style={{ marginBottom: 14 }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, color: NAVY, margin: 0 }}>{title}</h3>
        {subtitle && <p style={{ fontSize: 13, color: '#6b7280', margin: '4px 0 0' }}>{subtitle}</p>}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
        {children}
      </div>
    </div>
  );
}

export default function AdminPage() {
  const navigate = useNavigate();
  const [authed, setAuthed] = useState(() => sessionStorage.getItem('bisa-admin-auth') === 'true');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [activeTab, setActiveTab] = useState<'monitoreo' | 'gestion'>('monitoreo');
  const [filtroEstado, setFiltroEstado] = useState<'todos' | 'aprobado' | 'desaprobado'>('todos');
  const [filtroTipo, setFiltroTipo] = useState<'todos' | 'antiguo' | 'nuevo'>('todos');
  const [mensaje, setMensaje] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [editandoLinks, setEditandoLinks] = useState(false);
  const [linksEditables, setLinksEditables] = useState<Record<string, { documento: string; video: string }>>({});

  const fileInputRef = useRef<HTMLInputElement>(null);
  const preguntasInputRef = useRef<HTMLInputElement>(null);
  const linksInputRef = useRef<HTMLInputElement>(null);
  const matrizInputRef = useRef<HTMLInputElement>(null);

  const [intentosAntiguos, setIntentosAntiguos] = useState<Intento[]>(() => getIntentos());
  const [intentosNuevoIngreso, setIntentosNuevoIngreso] = useState<any[]>([]);
  const allEstandares = useMemo(() => getEstandares(), [refreshKey]);

  // Cargar intentos globales desde la base de datos (Supabase)
  const loadIntentos = useCallback(() => {
    getAllIntentosAsync().then(setIntentosAntiguos);
  }, []);

  // Cargar intentos redundantes de nuevo ingreso local
  const loadNuevoIngreso = useCallback(() => {
    try {
      const raw = localStorage.getItem('bisa-nuevo-ingreso-resultados');
      if (raw) setIntentosNuevoIngreso(JSON.parse(raw));
    } catch { }
  }, []);

  useEffect(() => {
    loadIntentos();
    loadNuevoIngreso();
  }, [loadIntentos, loadNuevoIngreso, refreshKey]);

  // ── Combinar todos los intentos (FILTRADO AVANZADO ANTI-DUPLICADOS) ───────────
  const todosIntentos = useMemo(() => {
    // 1. Mapeamos lo que viene de Supabase tal cual está en la Base de Datos
    const deBaseDatos = intentosAntiguos.map(i => {
      const estCodigo = i.estandarCodigo || (i as any).estandar_codigo || '';
      const rawTipo = String((i as any).tipo || '').toUpperCase();
      
      // DETECCIÓN ROBUSTA: Si el código es EVALUACION-GLOBAL o contiene 'NUEVO', es un onboarding.
      const esNuevoIngreso = estCodigo === 'EVALUACION-GLOBAL' || rawTipo.includes('NUEVO');

      return {
        ...i,
        tipo: esNuevoIngreso ? 'NUEVO INGRESO' : 'USUARIO ANTIGUO',
        unidadNegocio: i.unidadNegocio || (i as any).unidad_negocio || '',
        estandarCodigo: estCodigo,
        estandarNombre: i.estandarNombre || (i as any).estandar_nombre || '',
        intentoNum: (i as any).intento_num || (i as any).intentoNum || 1,
        totalPreguntas: i.totalPreguntas || (i as any).total_preguntas || 20
      };
    });

    // Creamos sets de control combinados (por ID y por la combinación DNI + Código de examen)
    const idsExistentes = new Set(deBaseDatos.map(i => i.id));
    const clavesExistentes = new Set(deBaseDatos.map(i => `${i.dni}-${i.estandarCodigo}`));

    // 2. Mapeamos lo local solo si NO existe ya guardado formalmente en Supabase
    const deLocalstorage = intentosNuevoIngreso
      .map((ni: any) => ({
        id: ni.id || String(Math.random()),
        dni: ni.dni,
        nombre: ni.nombre,
        cargo: ni.cargo,
        unidadNegocio: ni.unidadNegocio || '',
        disciplina: ni.disciplina || '',
        estandarCodigo: ni.estandar || 'EVALUACION-GLOBAL',
        estandarNombre: ni.estandarNombre || 'Evaluación de Diagnóstico General',
        fecha: ni.fecha,
        textFecha: ni.fecha,
        puntaje: ni.puntaje,
        totalPreguntas: ni.totalPreguntas || 20,
        respuestas: ni.respuestas || [],
        tipo: 'NUEVO INGRESO',
        intentoNum: ni.intentoNum || 1,
      }))
      .filter(ni => !idsExistentes.has(ni.id) && !clavesExistentes.has(`${ni.dni}-${ni.estandarCodigo}`));

    return [...deBaseDatos, ...deLocalstorage];
  }, [intentosAntiguos, intentosNuevoIngreso]);

  // ── Filtrado por Pestañas y Estados ──────────────────────────────────────────
  const filtered = useMemo(() => todosIntentos.filter((i: any) => {
    const esNuevo = i.tipo === 'NUEVO INGRESO';
    
    // Regla de negocio para aprobación: Nuevo Ingreso aprueba con >13 (Nota 14), Antiguo con >12 (Nota 13)
    const aprobado = esNuevo ? i.puntaje > 13 : i.puntaje > 12;

    if (filtroEstado === 'aprobado' && !aprobado) return false;
    if (filtroEstado === 'desaprobado' && aprobado) return false;
    if (filtroTipo === 'antiguo' && esNuevo) return false;
    if (filtroTipo === 'nuevo' && !esNuevo) return false;
    return true;
  }), [todosIntentos, filtroEstado, filtroTipo]);

  const sorted = useMemo(() =>
    [...filtered].sort((a: any, b: any) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime()),
    [filtered]);

  // ── KPIs Dinámicos basados en la Base de Datos Real ──────────────────────────
  const totalEvals = todosIntentos.length;
  const aprobadosTotal = todosIntentos.filter((i: any) =>
    i.tipo === 'NUEVO INGRESO' ? i.puntaje > 13 : i.puntaje > 12
  ).length;
  const desaprobadosTotal = totalEvals - aprobadosTotal;
  const pctAprobacion = totalEvals > 0 ? Math.round((aprobadosTotal / totalEvals) * 100) : 0;
  const totalPreguntas = allEstandares.reduce((sum, e) => sum + e.preguntas.length, 0);

  // ── Handlers de archivos ───────────────────────────────────────────────────
  function handleDescargarResultados() {
    import('xlsx-js-style').then(XLSX => {
      const rows = todosIntentos.map((i: any) => ({
        'Tipo': i.tipo || 'USUARIO ANTIGUO',
        'ID': i.id,
        'Fecha': new Date(i.fecha).toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
        'Nombre': i.nombre || '',
        'DNI': i.dni,
        'Unidad Negocio': i.unidadNegocio || '',
        'Disciplina': i.disciplina || '',
        'Cargo': i.cargo || '',
        'Estándar': i.tipo === 'NUEVO INGRESO' ? 'Evaluación Global (Onboarding)' : i.estandarCodigo,
        'Nombre Estándar': i.estandarNombre || '',
        'Intento': i.intentoNum || 1,
        'Nota': i.puntaje,
        'Total Preguntas': i.totalPreguntas,
        'Estado': (i.tipo === 'NUEVO INGRESO' ? i.puntaje > 13 : i.puntaje > 12) ? 'Aprobado' : 'Desaprobado',
      }));
      const ws = XLSX.utils.json_to_sheet(rows);
      ws['!cols'] = [
        { wch: 16 }, { wch: 14 }, { wch: 18 }, { wch: 25 }, { wch: 10 },
        { wch: 18 }, { wch: 22 }, { wch: 25 }, { wch: 20 }, { wch: 40 },
        { wch: 8 }, { wch: 8 }, { wch: 14 }, { wch: 12 },
      ];
      addTableFormat(ws, rows.length, 14);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Evaluaciones');
      XLSX.writeFile(wb, `bisa-evaluaciones-${new Date().toISOString().slice(0, 10)}.xlsx`);
      setMensaje({ tipo: 'ok', texto: `${rows.length} evaluaciones exportadas (usuarios antiguos + nuevo ingreso).` });
    });
  }

  function handleSubirResultados(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    importFromExcel(file).then(result => {
      setMensaje(result.success
        ? { tipo: 'ok', texto: `Se importaron ${result.count} evaluaciones.` }
        : { tipo: 'error', texto: 'Formato inválido.' });
      if (result.success) setRefreshKey(k => k + 1);
    });
    e.target.value = '';
  }

  function handleDescargarPreguntas() {
    import('xlsx-js-style').then(XLSX => {
      const rows: Record<string, unknown>[] = [];
      for (const est of getEstandares()) {
        for (const p of est.preguntas) {
          rows.push({
            'Código Estándar': est.estandar_codigo, 'Nombre Estándar': est.estandar_nombre,
            'ID Pregunta': p.id, 'Categoría': p.categoria, 'Pregunta': p.pregunta,
            'Opción A': p.opcion_a, 'Opción B': p.opcion_b, 'Opción C': p.opcion_c,
            'Opción D': p.opcion_d, 'Opción E': p.opcion_e, 'Respuesta Correcta': p.respuesta_correcta,
          });
        }
      }
      const ws = XLSX.utils.json_to_sheet(rows);
      ws['!cols'] = [{ wch: 18 }, { wch: 40 }, { wch: 12 }, { wch: 20 }, { wch: 60 }, { wch: 40 }, { wch: 40 }, { wch: 40 }, { wch: 40 }, { wch: 40 }, { wch: 18 }];
      addTableFormat(ws, rows.length, 11);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Preguntas');
      XLSX.writeFile(wb, `bisa-preguntas-${new Date().toISOString().slice(0, 10)}.xlsx`);
    });
    setMensaje({ tipo: 'ok', texto: 'Banco de preguntas descargado.' });
  }

  function handleSubirPreguntas(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    import('xlsx-js-style').then(XLSX => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const data = new Uint8Array(ev.target?.result as ArrayBuffer);
          const wb = XLSX.read(data, { type: 'array' });
          const ws = wb.Sheets[wb.SheetNames[0]];
          const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws);
          const map = new Map<string, { nombre: string; preguntas: Pregunta[] }>();
          let idCounter = 1;
          for (const row of rows) {
            const codigo = String(row['Código Estándar'] || row['Codigo Estandar'] || '').trim();
            const nombre = String(row['Nombre Estándar'] || row['Nombre Estandar'] || '').trim();
            if (!codigo) continue;
            if (!map.has(codigo)) map.set(codigo, { nombre, preguntas: [] });
            map.get(codigo)!.preguntas.push({
              id: Number(row['ID Pregunta']) || idCounter++,
              categoria: String(row['Categoría'] || row['Categoria'] || ''),
              pregunta: String(row['Pregunta'] || ''),
              opcion_a: String(row['Opción A'] || row['Opcion A'] || ''),
              opcion_b: String(row['Opción B'] || row['Opcion B'] || ''),
              opcion_c: String(row['Opción C'] || row['Opcion C'] || ''),
              opcion_d: String(row['Opción D'] || row['Opcion D'] || ''),
              opcion_e: String(row['Opción E'] || row['Opcion E'] || ''),
              respuesta_correcta: String(row['Respuesta Correcta'] || '').trim().toUpperCase(),
            });
          }
          const estandares: Estandar[] = [];
          map.forEach((val, codigo) => estandares.push({ estandar_codigo: codigo, estandar_nombre: val.nombre, preguntas: val.preguntas }));
          if (estandares.length === 0) { setMensaje({ tipo: 'error', texto: 'No se encontraron preguntas.' }); return; }
          saveCustomPreguntas(estandares);
          const total = estandares.reduce((s, e) => s + e.preguntas.length, 0);
          setMensaje({ tipo: 'ok', texto: `Cargadas ${total} preguntas en ${estandares.length} estándares.` });
          setRefreshKey(k => k + 1);
        } catch { setMensaje({ tipo: 'error', texto: 'Error al leer el archivo.' }); }
      };
      reader.readAsArrayBuffer(file);
    });
    e.target.value = '';
  }

  function handleDescargarLinks() {
    import('xlsx-js-style').then(XLSX => {
      const links = getLinks();
      const rows = Object.entries(links).map(([codigo, l]) => ({ 'Estandar': codigo, 'Link del documento': l.documento, 'Link del video': l.video }));
      const ws = XLSX.utils.json_to_sheet(rows);
      ws['!cols'] = [{ wch: 20 }, { wch: 80 }, { wch: 80 }];
      addTableFormat(ws, rows.length, 3);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Links');
      XLSX.writeFile(wb, `bisa-links-${new Date().toISOString().slice(0, 10)}.xlsx`);
    });
    setMensaje({ tipo: 'ok', texto: 'Links descargados.' });
  }

  function handleSubirLinks(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    import('xlsx-js-style').then(XLSX => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const data = new Uint8Array(ev.target?.result as ArrayBuffer);
          const wb = XLSX.read(data, { type: 'array' });
          const ws = wb.Sheets[wb.SheetNames[0]];
          const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws);
          const newLinks: Record<string, { documento: string; video: string }> = {};
          for (const row of rows) {
            const codigo = String(row['Estandar'] || '').trim();
            if (!codigo) continue;
            newLinks[codigo] = { documento: String(row['Link del documento'] || '').trim(), video: String(row['Link del video'] || '').trim() };
          }
          if (Object.keys(newLinks).length === 0) { setMensaje({ tipo: 'error', texto: 'No se encontraron links.' }); return; }
          saveLinks(newLinks);
          setMensaje({ tipo: 'ok', texto: `Links de ${Object.keys(newLinks).length} estándares actualizados.` });
          setRefreshKey(k => k + 1);
        } catch { setMensaje({ tipo: 'error', texto: 'Error al leer el archivo de links.' }); }
      };
      reader.readAsArrayBuffer(file);
    });
    e.target.value = '';
  }

  // ── Login ──────────────────────────────────────────────────────────────────
  if (!authed) {
    return (
      <div className="registration">
        <div className="registration__card">
          <div className="registration__logo">
            <img src={bisaLogoBlanco} alt="BISA" style={{ height: 80, objectFit: 'contain' }} />
          </div>
          <p className="registration__title">Panel Administrador</p>
          <form onSubmit={e => {
            e.preventDefault();
            if (password === 'admin123') { sessionStorage.setItem('bisa-admin-auth', 'true'); setAuthed(true); }
            else setAuthError('Contraseña incorrecta');
          }}>
            <div className="form-group">
              <label>Contraseña</label>
              <input type="password" value={password} onChange={e => { setPassword(e.target.value); setAuthError(''); }} placeholder="Ingrese contraseña" autoFocus />
              {authError && <div className="error">{authError}</div>}
            </div>
            <button type="submit" className="btn btn--primary btn--full">Ingresar</button>
            <button type="button" className="btn btn--secondary btn--full" style={{ marginTop: 10 }} onClick={() => navigate('/')}>Volver</button>
          </form>
        </div>
      </div>
    );
  }

  // ── Panel principal ────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: '#f9fafb' }}>
      <header className="header">
        <div className="header__brand" onClick={() => navigate('/')}>
          <img src={bisaLogoNegro} alt="BISA" style={{ height: 56, objectFit: 'contain' }} />
        </div>
        <div className="header__nav">
          <button className="header__link header__link--logout" onClick={() => { sessionStorage.removeItem('bisa-admin-auth'); navigate('/'); }}>
            Cerrar sesión
          </button>
        </div>
      </header>

      <main style={{ width: '100%', padding: '32px 24px' }}>
        <h1 className="page-title">Panel de Administración</h1>

        {/* Mensaje de feedback */}
        {mensaje && (
          <div style={{ padding: '12px 16px', borderRadius: 8, marginBottom: 20, background: mensaje.tipo === 'ok' ? '#dcfce7' : '#fee2e2', color: mensaje.tipo === 'ok' ? '#166534' : '#991b1b', border: `1px solid ${mensaje.tipo === 'ok' ? '#a5d6a7' : '#fca5a5'}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>{mensaje.texto}</span>
            <button onClick={() => setMensaje(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'inherit' }}>×</button>
          </div>
        )}

        {/* ── TABS ──────────────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', borderBottom: '1px solid #e5e7eb', marginBottom: 28, overflowX: 'auto' }}>
          <TabButton label="Monitoreo y KPIs" active={activeTab === 'monitoreo'} onClick={() => setActiveTab('monitoreo')} badge={totalEvals} />
          <TabButton label="Gestión de Datos" active={activeTab === 'gestion'} onClick={() => setActiveTab('gestion')} />
        </div>

        {/* ══════════════════════════════════════════════════════════════════
            PESTAÑA 1: MONITOREO Y KPIs
        ══════════════════════════════════════════════════════════════════ */}
        {activeTab === 'monitoreo' && (
          <>
            {/* KPIs */}
            <div className="admin-stats" style={{ marginBottom: 28 }}>
              <div className="admin-stat">
                <div className="admin-stat__value">{totalEvals}</div>
                <div className="admin-stat__label">Total evaluaciones</div>
              </div>
              <div className="admin-stat admin-stat--success">
                <div className="admin-stat__value">{aprobadosTotal}</div>
                <div className="admin-stat__label">Aprobados</div>
              </div>
              <div className="admin-stat admin-stat--error">
                <div className="admin-stat__value">{desaprobadosTotal}</div>
                <div className="admin-stat__label">Desaprobados</div>
              </div>
              <div className="admin-stat">
                <div className="admin-stat__value">{pctAprobacion}%</div>
                <div className="admin-stat__label">Tasa de aprobación</div>
              </div>
            </div>

            {/* Filtros */}
            <div className="admin-filters" style={{ marginBottom: 20 }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Estado</label>
                <select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value as any)}>
                  <option value="todos">Todos</option>
                  <option value="aprobado">Aprobados</option>
                  <option value="desaprobado">Desaprobados</option>
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Tipo de usuario</label>
                <select value={filtroTipo} onChange={e => setFiltroTipo(e.target.value as any)}>
                  <option value="todos">Todos</option>
                  <option value="antiguo">Usuario Antiguo</option>
                  <option value="nuevo">Nuevo Ingreso</option>
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: 0, alignSelf: 'flex-end' }}>
                <button
                  className="btn btn--secondary"
                  onClick={() => setRefreshKey(k => k + 1)}
                  title="Actualizar datos"
                >
                  ↻ Actualizar
                </button>
              </div>
            </div>

            {/* Tabla de resultados */}
            {sorted.length === 0 ? (
              <div className="empty-state"><p className="empty-state__text">No se encontraron evaluaciones.</p></div>
            ) : (
              <div style={{ width: '100%', borderRadius: 8, border: '1px solid #e5e7eb' }}>
                <table className="history-table" style={{ width: '100%', tableLayout: 'auto', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={{ padding: '10px 14px', fontSize: 12, whiteSpace: 'nowrap' }}>Tipo</th>
                      <th style={{ padding: '10px 14px', fontSize: 12, whiteSpace: 'nowrap' }}>Fecha</th>
                      <th style={{ padding: '10px 14px', fontSize: 12 }}>Nombre</th>
                      <th style={{ padding: '10px 14px', fontSize: 12, whiteSpace: 'nowrap' }}>DNI</th>
                      <th style={{ padding: '10px 14px', fontSize: 12 }}>Unidad Negocio</th>
                      <th style={{ padding: '10px 14px', fontSize: 12 }}>Disciplina</th>
                      <th style={{ padding: '10px 14px', fontSize: 12 }}>Cargo</th>
                      <th style={{ padding: '10px 14px', fontSize: 12 }}>Estándar</th>
                      <th style={{ padding: '10px 14px', fontSize: 12, textAlign: 'center', whiteSpace: 'nowrap' }}>Intento</th>
                      <th style={{ padding: '10px 14px', fontSize: 12, textAlign: 'center', whiteSpace: 'nowrap' }}>Nota</th>
                      <th style={{ padding: '10px 14px', fontSize: 12, textAlign: 'center', whiteSpace: 'nowrap' }}>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.map((intento: any) => {
                      const esNuevo = intento.tipo === 'NUEVO INGRESO';
                      const aprobado = esNuevo ? intento.puntaje > 13 : intento.puntaje > 12;
                      const fecha = new Date(intento.fecha).toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
                      const intentoNum = intento.intentoNum || 1;

                      const td = { padding: '10px 14px', fontSize: 13, verticalAlign: 'top' as const };

                      return (
                        <tr key={intento.id}>
                          <td style={td}>
                            <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 10, background: esNuevo ? MAGENTA : NAVY, color: '#fff', whiteSpace: 'nowrap' as const }}>
                              {esNuevo ? 'NUEVO INGRESO' : 'USUARIO ANTIGUO'}
                            </span>
                          </td>
                          <td style={{ ...td, whiteSpace: 'nowrap' as const, fontSize: 12 }}>{fecha}</td>
                          <td style={td}>{intento.nombre || '—'}</td>
                          <td style={{ ...td, whiteSpace: 'nowrap' as const }}>{intento.dni}</td>
                          <td style={td}>{intento.unidadNegocio || '—'}</td>
                          <td style={td}>{intento.disciplina || '—'}</td>
                          <td style={td}>{intento.cargo || '—'}</td>
                          <td style={td}>
                            {esNuevo ? (
                              <span style={{ display: 'inline-block', background: '#f0f4ff', color: '#1e3a8a', borderRadius: 6, padding: '3px 8px', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' as const }}>
                                {intento.estandarNombre || 'Evaluación de Diagnóstico General'}
                              </span>
                            ) : (
                              <>
                                <strong style={{ fontSize: 12 }}>{intento.estandarCodigo}</strong>
                                <br />
                                <span style={{ fontSize: 11, color: 'var(--color-gray)' }}>{intento.estandarNombre}</span>
                              </>
                            )}
                          </td>
                          <td style={{ ...td, textAlign: 'center', fontWeight: 700 }}>{intentoNum}</td>
                          <td style={{ ...td, textAlign: 'center' }}>
                            <span className={`history-table__score ${aprobado ? 'history-table__score--high' : 'history-table__score--low'}`}>
                              {intento.puntaje}/{intento.totalPreguntas}
                            </span>
                          </td>
                          <td style={{ ...td, textAlign: 'center' }}>
                            <span className={`badge ${aprobado ? 'badge--aprobado' : 'badge--desaprobado'}`}>
                              {aprobado ? 'Aprobado' : 'Desaprobado'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            PESTAÑA 2: GESTIÓN DE DATOS
        ══════════════════════════════════════════════════════════════════ */}
        {activeTab === 'gestion' && (
          <>
            {/* Resultados */}
            <GestionSeccion title="Resultados de Evaluaciones" subtitle="Exporta o importa el historial completo de evaluaciones.">
              <button className="btn btn--primary" onClick={handleDescargarResultados}>⬇ Descargar (Excel)</button>
              <button className="btn btn--secondary" onClick={() => fileInputRef.current?.click()}>⬆ Subir (Excel)</button>
              <input ref={fileInputRef} type="file" accept=".xlsx,.xls" style={{ display: 'none' }} onChange={handleSubirResultados} />
            </GestionSeccion>

            {/* Banco de Preguntas */}
            <GestionSeccion
              title="Banco de Preguntas"
              subtitle={`${allEstandares.length} estándares — ${totalPreguntas} preguntas${hasCustomPreguntas() ? ' (personalizado)' : ''}`}
            >
              <button className="btn btn--primary" onClick={handleDescargarPreguntas}>⬇ Descargar (Excel)</button>
              <button className="btn btn--secondary" onClick={() => preguntasInputRef.current?.click()}>⬆ Subir (Excel)</button>
              {hasCustomPreguntas() && (
                <button className="btn btn--dark" onClick={() => { resetPreguntas(); setMensaje({ tipo: 'ok', texto: 'Preguntas restauradas.' }); setRefreshKey(k => k + 1); }}>↺ Restaurar originales</button>
              )}
              <input ref={preguntasInputRef} type="file" accept=".xlsx,.xls" style={{ display: 'none' }} onChange={handleSubirPreguntas} />
            </GestionSeccion>

            {/* Links de Estándares */}
            <GestionSeccion
              title="Links de Estándares"
              subtitle={`${Object.keys(DEFAULT_LINKS).length} estándares con video y documento en SharePoint.`}
            >
              <button className="btn btn--primary" onClick={handleDescargarLinks}>⬇ Descargar (Excel)</button>
              <button className="btn btn--secondary" onClick={() => linksInputRef.current?.click()}>⬆ Subir (Excel)</button>
              <button className="btn btn--secondary" onClick={() => { setLinksEditables(JSON.parse(JSON.stringify(getLinks()))); setEditandoLinks(v => !v); }}>
                {editandoLinks ? '✕ Cerrar editor' : '✏ Editar links'}
              </button>
              <button className="btn btn--dark" onClick={() => { resetLinks(); setMensaje({ tipo: 'ok', texto: 'Links restaurados.' }); setRefreshKey(k => k + 1); }}>↺ Restaurar</button>
              <input ref={linksInputRef} type="file" accept=".xlsx,.xls" style={{ display: 'none' }} onChange={handleSubirLinks} />

              {editandoLinks && (
                <div style={{ width: '100%', marginTop: 12, border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
                  <div style={{ background: '#f9fafb', padding: '10px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e5e7eb' }}>
                    <span style={{ fontWeight: 600, fontSize: 13 }}>Editor de links</span>
                    <button className="btn btn--primary" style={{ fontSize: 12, padding: '4px 14px' }} onClick={() => { saveLinks(linksEditables); setEditandoLinks(false); setMensaje({ tipo: 'ok', texto: 'Links guardados.' }); }}>
                      Guardar cambios
                    </button>
                  </div>
                  <div style={{ maxHeight: 360, overflowY: 'auto' }}>
                    {Object.keys(linksEditables).sort().map(codigo => (
                      <div key={codigo} style={{ padding: '12px 16px', borderBottom: '1px solid #f0f0f0' }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: MAGENTA, marginBottom: 6 }}>{codigo}</div>
                        <input type="text" placeholder="Link documento" value={linksEditables[codigo]?.documento || ''} onChange={e => setLinksEditables(p => ({ ...p, [codigo]: { ...p[codigo], documento: e.target.value } }))} style={{ fontSize: 12, padding: '6px 10px', border: '1px solid #ddd', borderRadius: 6, width: '100%', marginBottom: 6 }} />
                        <input type="text" placeholder="Link video" value={linksEditables[codigo]?.video || ''} onChange={e => setLinksEditables(p => ({ ...p, [codigo]: { ...p[codigo], video: e.target.value } }))} style={{ fontSize: 12, padding: '6px 10px', border: '1px solid #ddd', borderRadius: 6, width: '100%' }} />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </GestionSeccion>

            {/* Matriz Nuevo Ingreso */}
            <GestionSeccion
              title="Matriz de Nuevo Ingreso"
              subtitle="Define qué estándares se asignan a cada cargo para el flujo de onboarding."
            >
              <button className="btn btn--primary" onClick={() => {
                import('xlsx-js-style').then(XLSX => {
                  const mapping = getNuevoIngresoMapping();
                  if (mapping.length === 0) { setMensaje({ tipo: 'error', texto: 'No hay matriz cargada.' }); return; }
                  const rows: Record<string, unknown>[] = [];
                  mapping.forEach(m => m.estandares.forEach(e => rows.push({ 'Cargo': m.cargo, 'Estándar': e })));
                  const ws = XLSX.utils.json_to_sheet(rows);
                  ws['!cols'] = [{ wch: 30 }, { wch: 25 }];
                  addTableFormat(ws, rows.length, 2);
                  const wb = XLSX.utils.book_new();
                  XLSX.utils.book_append_sheet(wb, ws, 'Matriz');
                  XLSX.writeFile(wb, `bisa-matriz-nuevo-ingreso-${new Date().toISOString().slice(0, 10)}.xlsx`);
                });
              }}>
                ⬇ Descargar (Excel)
              </button>
              <button className="btn btn--secondary" onClick={() => matrizInputRef.current?.click()}>⬆ Subir (Excel)</button>
              <button className="btn btn--dark" onClick={() => { resetNuevoIngresoMapping(); setMensaje({ tipo: 'ok', texto: 'Matriz limpiada.' }); setRefreshKey(k => k + 1); }}>🗑 Limpiar matriz</button>
              <input ref={matrizInputRef} type="file" accept=".xlsx,.xls" style={{ display: 'none' }} onChange={async e => {
                const file = e.target.files?.[0];
                if (!file) return;
                try {
                  const mapping = await parseMappingExcel(file);
                  saveNuevoIngresoMapping(mapping);
                  setMensaje({ tipo: 'ok', texto: `Matriz cargada: ${mapping.length} cargos.` });
                  setRefreshKey(k => k + 1);
                } catch { setMensaje({ tipo: 'error', texto: 'Error al leer la matriz.' }); }
                e.target.value = '';
              }} />
            </GestionSeccion>
          </>
        )}
      </main>
    </div>
  );
}
