import { apiRequest, loginAdmin, logoutSession } from '../utils/api';
import bisaLogoNegro from '../assets/bisa_fondo_negro.png';
import bisaLogoBlanco from '../assets/bisa_fondo_blanco.png';
import { useState, useMemo, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAllIntentosAsync } from '../utils/storage';
import { legacyCustomPreguntas } from '../data';
import { legacyCustomLinks } from '../data/estandarLinks';
import { loadDataset, publishDataset } from '../utils/datasets';
import { downloadResultsExcel } from '../utils/excelTables';
import { toRows } from '../../shared/datasets.mjs';
import DataControls from './DataControls';
import type { Intento } from '../types';

// Historical records may still carry the snake_case names of the old storage.
type IntentoRegistro = Intento & Partial<{ estandar_codigo: string; unidad_negocio: string; estandar_nombre: string; intento_num: number; total_preguntas: number }>;
type FiltroEstado = 'todos' | 'aprobado' | 'desaprobado';
type FiltroTipo = 'todos' | 'antiguo' | 'nuevo';

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
  const [authed, setAuthed] = useState(false);
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [activeTab, setActiveTab] = useState<'monitoreo' | 'gestion'>('monitoreo');
  const [filtroEstado, setFiltroEstado] = useState<FiltroEstado>('todos');
  const [filtroTipo, setFiltroTipo] = useState<FiltroTipo>('todos');
  const [mensaje, setMensaje] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [editandoLinks, setEditandoLinks] = useState(false);
  const [linksEditables, setLinksEditables] = useState<Record<string, { documento: string; video: string }>>({});
  const [linksBase, setLinksBase] = useState('');
  const [linksRefresh, setLinksRefresh] = useState(0);
  const [guardandoLinks, setGuardandoLinks] = useState(false);
  // Copias que solo existen en este navegador (anteriores a la centralización); nunca se borran.
  const legacyPreguntas = useMemo(() => { const data = legacyCustomPreguntas(); return data ? { description: 'una versión local del banco de preguntas', rows: toRows('preguntas', data) } : null; }, []);
  const legacyLinks = useMemo(() => { const data = legacyCustomLinks(); return data ? { description: 'una versión local de los links', rows: toRows('links', data) } : null; }, []);

  // Resultados remotos consultados mediante la API del servidor.
  const [intentosServidor, setIntentosServidor] = useState<Intento[]>([]);

  // Cargar intentos globales después de validar la sesión administrativa.
  const loadIntentos = useCallback(() => {
    getAllIntentosAsync().then(setIntentosServidor).catch(() => setMensaje({ tipo: 'error', texto: 'No se pudieron cargar los resultados del servidor.' }));
  }, []);

  useEffect(() => {
    if (authed) loadIntentos();
  }, [loadIntentos, refreshKey, authed]);

  useEffect(() => {
    apiRequest<{ admin: boolean }>('session').then(data => setAuthed(data.admin)).catch(() => setAuthed(false));
  }, []);

  // Compatibilidad con registros históricos.
  const todosIntentos = useMemo(() => {
    return intentosServidor.map((i: IntentoRegistro) => {
      const estCodigo = i.estandarCodigo || i.estandar_codigo || '';
      const rawTipo = String(i.tipo || '').toUpperCase();

      // Detección robusta de si el registro pertenece a Onboarding / Nuevo Ingreso
      const esNuevoIngreso = estCodigo === 'EVALUACION-GLOBAL' || rawTipo.includes('NUEVO');

      return {
        ...i,
        tipo: esNuevoIngreso ? 'NUEVO INGRESO' : 'USUARIO ANTIGUO',
        unidadNegocio: i.unidadNegocio || i.unidad_negocio || '',
        estandarCodigo: estCodigo,
        estandarNombre: i.estandarNombre || i.estandar_nombre || '',
        intentoNum: i.intento_num || i.intentoNum || 1,
        totalPreguntas: i.totalPreguntas || i.total_preguntas || 20
      };
    });
  }, [intentosServidor]);

  // ── Filtrado por Pestañas y Estados ──────────────────────────────────────────
  const filtered = useMemo(() => todosIntentos.filter(i => {
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
    [...filtered].sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime()),
    [filtered]);

  // ── KPIs Dinámicos basados en la Base de Datos Real ──────────────────────────
  const totalEvals = todosIntentos.length;
  const aprobadosTotal = todosIntentos.filter(i =>
    i.tipo === 'NUEVO INGRESO' ? i.puntaje > 13 : i.puntaje > 12
  ).length;
  const desaprobadosTotal = totalEvals - aprobadosTotal;
  const pctAprobacion = totalEvals > 0 ? Math.round((aprobadosTotal / totalEvals) * 100) : 0;

  // ── Handlers de archivos ───────────────────────────────────────────────────
  // Exporta los registros que muestran los filtros activos (todos, si no hay filtros).
  function handleDescargarResultados() {
    const rows = sorted.map(i => ({
      tipo: i.tipo || 'USUARIO ANTIGUO',
      id: i.id,
      fecha: new Date(i.fecha).toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
      nombre: i.nombre || '',
      dni: i.dni,
      unidadNegocio: i.unidadNegocio || '',
      disciplina: i.disciplina || '',
      cargo: i.cargo || '',
      estandar: i.tipo === 'NUEVO INGRESO' ? 'Evaluación Global (Onboarding)' : i.estandarCodigo,
      estandarNombre: i.estandarNombre || '',
      intento: i.intentoNum || 1,
      nota: i.puntaje,
      total: i.totalPreguntas,
      estado: (i.tipo === 'NUEVO INGRESO' ? i.puntaje > 13 : i.puntaje > 12) ? 'Aprobado' : 'Desaprobado',
    }));
    downloadResultsExcel(rows)
      .then(() => setMensaje({ tipo: 'ok', texto: `${rows.length} evaluaciones exportadas.` }))
      .catch(() => setMensaje({ tipo: 'error', texto: 'No se pudo generar el Excel de resultados.' }));
  }

  async function abrirEditorLinks() {
    if (editandoLinks) { setEditandoLinks(false); return; }
    try {
      const current = await loadDataset('links');
      setLinksEditables(JSON.parse(JSON.stringify(current.data)));
      setLinksBase(current.version);
      setEditandoLinks(true);
    } catch (error) { setMensaje({ tipo: 'error', texto: error instanceof Error ? error.message : 'No se pudieron cargar los links.' }); }
  }

  async function guardarLinks() {
    setGuardandoLinks(true);
    try {
      const result = await publishDataset('links', { rows: toRows('links', linksEditables) }, 'parcial', linksBase);
      setEditandoLinks(false);
      setLinksRefresh(k => k + 1);
      setMensaje({ tipo: 'ok', texto: result.unchanged ? 'No había cambios en los links.' : `Links publicados para todos los usuarios (${result.summary?.modified ?? 0} modificados).` });
    } catch (error) { setMensaje({ tipo: 'error', texto: error instanceof Error ? error.message : 'No se pudieron guardar los links.' }); }
    finally { setGuardandoLinks(false); }
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
          <form onSubmit={async e => {
            e.preventDefault();
            setAuthError('');
            try { await loginAdmin(password); setAuthed(true); }
            catch (error) { setAuthError(error instanceof Error ? error.message : 'Error interno del servidor de autenticación. Intenta nuevamente.'); }
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
          <button className="header__link header__link--logout" onClick={async () => { await logoutSession(); sessionStorage.removeItem('bisa-admin-auth'); setAuthed(false); navigate('/'); }}>
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
                <select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value as FiltroEstado)}>
                  <option value="todos">Todos</option>
                  <option value="aprobado">Aprobados</option>
                  <option value="desaprobado">Desaprobados</option>
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Tipo de usuario</label>
                <select value={filtroTipo} onChange={e => setFiltroTipo(e.target.value as FiltroTipo)}>
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
                    {sorted.map(intento => {
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
            <GestionSeccion title="Resultados de Evaluaciones" subtitle="Descarga el historial de evaluaciones según los filtros de Monitoreo y KPIs.">
              <button className="btn btn--primary" onClick={handleDescargarResultados}>⬇ Descargar (Excel)</button>
            </GestionSeccion>

            {/* Banco de Preguntas */}
            <GestionSeccion title="Banco de Preguntas" subtitle="Preguntas publicadas para todas las evaluaciones.">
              <DataControls module="preguntas" legacy={legacyPreguntas} />
            </GestionSeccion>

            {/* Links de Estándares */}
            <GestionSeccion title="Links de Estándares" subtitle="Videos y documentos de cada estándar.">
              <DataControls module="links" refreshKey={linksRefresh} legacy={legacyLinks}>
                <button className="btn btn--secondary" onClick={() => void abrirEditorLinks()}>
                  {editandoLinks ? '✕ Cerrar editor' : '✏ Editar links'}
                </button>
              </DataControls>

              {editandoLinks && (
                <div style={{ width: '100%', marginTop: 12, border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
                  <div style={{ background: '#f9fafb', padding: '10px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e5e7eb' }}>
                    <span style={{ fontWeight: 600, fontSize: 13 }}>Editor de links</span>
                    <button className="btn btn--primary" style={{ fontSize: 12, padding: '4px 14px' }} disabled={guardandoLinks} onClick={() => void guardarLinks()}>
                      Publicar cambios
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

            <GestionSeccion
              title="Matriz de Nuevo Ingreso"
              subtitle="Define qué estándares se asignan a cada cargo para el flujo de onboarding."
            >
              <DataControls module="nuevo-ingreso" />
            </GestionSeccion>
            <GestionSeccion
              title="Matriz de Personal Antiguo"
              subtitle="Define qué estándares corresponden a cada cargo para los trabajadores antiguos."
            >
              <DataControls module="personal-antiguo" />
            </GestionSeccion>
          </>
        )}
      </main>
    </div>
  );
}
