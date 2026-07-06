import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getEstandares } from '../data';
import { getLinksByCodigo } from '../data/estandarLinks';
import { getEstandaresByCargo as getNuevoIngresoCargos } from '../data/nuevoIngresoMapping';
import type { Estandar } from '../types';

const MAX_INTENTOS = 2;
const LS_KEY_INTENTOS = 'bisa-nuevo-ingreso-intentos';

function getIntentos(dni: string, estandarCodigo: string): number {
  try {
    const raw = localStorage.getItem(LS_KEY_INTENTOS);
    if (!raw) return 0;
    const data = JSON.parse(raw) as { dni: string; estandar: string; count: number }[];
    return data.find(d => d.dni === dni && d.estandar === estandarCodigo)?.count ?? 0;
  } catch { return 0; }
}

export default function NuevoIngresoStandardsPage() {
  const navigate = useNavigate();
  const [usuario, setUsuario] = useState<any>(null);
  const [estandares, setEstandares] = useState<Estandar[]>([]);

  useEffect(() => {
    const raw = sessionStorage.getItem('bisa-nuevo-ingreso');
    if (!raw) { navigate('/nuevo-ingreso'); return; }
    const user = JSON.parse(raw);
    setUsuario(user);

    // Obtener códigos asignados al cargo desde la matriz de nuevo ingreso
    const codigos = getNuevoIngresoCargos(user.cargo);
    const todos = getEstandares();
    const filtrados = codigos.length > 0
      ? todos.filter(e => codigos.includes(e.estandar_codigo))
      : todos; // fallback: mostrar todos si no hay matriz cargada
    setEstandares(filtrados);
  }, [navigate]);

  if (!usuario) return null;

  return (
    <div className="layout">
      <header className="header">
        <div className="header__brand" onClick={() => navigate('/')}>
          BISA<span>.</span> Quiz
        </div>
        <div className="header__nav">
          <span className="header__user">{usuario.nombre}</span>
          <span style={{ fontSize: 12, background: '#E6007E', color: '#fff', padding: '2px 8px', borderRadius: 12, marginLeft: 8 }}>
            Nuevo Ingreso
          </span>
          <button className="header__link header__link--logout"
            onClick={() => { sessionStorage.removeItem('bisa-nuevo-ingreso'); navigate('/'); }}>
            Salir
          </button>
        </div>
      </header>

      <main className="main">
        <h1 className="page-title">Tus Estándares Asignados</h1>
        <p className="page-subtitle">
          {estandares.length} estándares asignados a tu cargo: <strong>{usuario.cargo}</strong>
        </p>

        {estandares.length === 0 ? (
          <div className="empty-state">
            <p className="empty-state__text">
              No hay estándares asignados a tu cargo aún. Contacta al administrador.
            </p>
          </div>
        ) : (
          <>
            {/* Tarjetas — solo para ver material, sin botón de quiz */}
            <div className="standards-grid">
              {estandares.map(est => (
                <div
                  key={est.estandar_codigo}
                  className="standard-card"
                  style={{ cursor: 'pointer' }}
                  onClick={() => navigate(`/nuevo-ingreso/estandar/${encodeURIComponent(est.estandar_codigo)}`)}
                >
                  <div className="standard-card__code">{est.estandar_codigo}</div>
                  <div className="standard-card__name">{est.estandar_nombre}</div>
                  <div className="standard-card__stats">
                    <span>📄 Ver material</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Botón unificado Iniciar Evaluación */}
            {(() => {
              const intentosGlobales = (() => {
                try {
                  const raw = localStorage.getItem('bisa-nuevo-ingreso-intentos-global');
                  if (!raw) return 0;
                  const data = JSON.parse(raw) as { dni: string; count: number }[];
                  return data.find(d => d.dni === usuario.dni)?.count ?? 0;
                } catch { return 0; }
              })();
              const aprobado = (() => {
                try {
                  const raw = localStorage.getItem('bisa-nuevo-ingreso-resultados');
                  if (!raw) return false;
                  const data = JSON.parse(raw) as { dni: string; puntaje: number }[];
                  return data.some(d => d.dni === usuario.dni && d.puntaje > 13);
                } catch { return false; }
              })();
              const bloqueado = intentosGlobales >= MAX_INTENTOS && !aprobado;

              return (
                <div style={{ marginTop: 40, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                  {aprobado && (
                    <div style={{ background: '#dcfce7', color: '#166534', padding: '10px 24px', borderRadius: 10, fontWeight: 700, fontSize: 15 }}>
                      🎉 ¡Evaluación aprobada!
                    </div>
                  )}
                  {!aprobado && intentosGlobales === 1 && (
                    <div style={{ background: '#FFF8E1', border: '1px solid #FFD54F', color: '#7B5800', padding: '10px 24px', borderRadius: 10, fontSize: 14, textAlign: 'center' }}>
                      ⚠️ Este es tu <strong>último intento</strong>. Revisa bien el material antes de continuar.
                    </div>
                  )}
                  <button
                    disabled={bloqueado}
                    onClick={() => navigate('/nuevo-ingreso/quiz-global')}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 14,
                      padding: '18px 40px', borderRadius: 14,
                      background: bloqueado ? '#e0e0e0' : '#E6007E',
                      color: bloqueado ? '#999' : '#fff',
                      border: 'none', cursor: bloqueado ? 'not-allowed' : 'pointer',
                      fontSize: 18, fontWeight: 700,
                      boxShadow: bloqueado ? 'none' : '0 6px 24px rgba(230,0,126,0.35)',
                      transition: 'all 0.2s',
                    }}
                  >
                    <span style={{ fontSize: 26 }}>📝</span>
                    {bloqueado ? 'Evaluación no disponible' : 'Iniciar Evaluación'}
                    {!bloqueado && (
                      <span style={{ fontSize: 13, fontWeight: 400, opacity: 0.85, marginLeft: 4 }}>
                        — 20 preguntas · Intento {intentosGlobales + 1} de {MAX_INTENTOS}
                      </span>
                    )}
                  </button>
                  {bloqueado && (
                    <p style={{ fontSize: 13, color: '#999', textAlign: 'center' }}>
                      Has agotado tus {MAX_INTENTOS} intentos para esta evaluación.
                    </p>
                  )}
                </div>
              );
            })()}
          </>
        )}
      </main>
    </div>
  );
}
