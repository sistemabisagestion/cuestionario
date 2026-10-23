import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { loadEstandares } from '../data';
import { getIntentosByDniAsync, readNuevoIngresoUser } from '../utils/storage';
import { assignedCodes } from '../utils/matrices';
import type { Estandar, Intento } from '../types';

const MAX_INTENTOS = 2;

export default function NuevoIngresoStandardsPage() {
  const navigate = useNavigate();
  const [matrixError, setMatrixError] = useState('');
  const [loading, setLoading] = useState(true);
  const [usuario] = useState(readNuevoIngresoUser);
  const [estandares, setEstandares] = useState<Estandar[]>([]);
  // Attempts of the global evaluation, from the stored records (server; local copy when offline).
  const [registros, setRegistros] = useState<Intento[]>([]);

  useEffect(() => {
    if (!usuario) { navigate('/nuevo-ingreso'); return; }

    let active = true;
    Promise.all([assignedCodes('nuevo-ingreso', usuario.cargo), loadEstandares(), getIntentosByDniAsync(usuario.dni)]).then(([codes, todos, intentos]) => {
      if (!active) return;
      setEstandares(todos.filter(est => codes.includes(est.estandar_codigo)));
      setRegistros(intentos.filter(i => i.estandarCodigo === 'EVALUACION-GLOBAL'));
    }).catch(() => { if (active) setMatrixError('No se pudo consultar la Matriz de Nuevo Ingreso o el Banco de Preguntas. Intenta ingresar nuevamente.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [usuario, navigate]);

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

      <main className="main" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px 20px', minHeight: '80vh' }}>
        
        {/* Contenedor Principal Estructurado */}
        <div style={{
          width: '100%',
          maxWidth: '650px',
          background: '#ffffff',
          borderRadius: '8px',
          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.05)',
          border: '1px solid #e2e8f0',
          padding: '40px',
          boxSizing: 'border-box'
        }}>
          
          {/* Sección de Encabezado */}
          <h1 className="page-title" style={{ textAlign: 'left', margin: '0 0 8px 0', fontSize: '24px', color: '#1a202c' }}>
            Evaluación de Nuevo Ingreso
          </h1>
          <p className="page-subtitle" style={{ textAlign: 'left', margin: '0 0 24px 0', fontSize: '15px', color: '#4a5568', borderBottom: '1px solid #edf2f7', paddingBottom: '16px' }}>
            Cargo asignado: <strong style={{ color: '#1a202c' }}>{usuario.cargo}</strong>
          </p>

          {/* Información del Perfil de Estándares */}
          <div style={{ background: '#f7fafc', padding: '12px 16px', borderRadius: '6px', marginBottom: '24px', borderLeft: '4px solid #E6007E' }}>
            <p style={{ margin: 0, fontSize: '14px', color: '#4a5568' }}>
              Se han identificado <strong>{estandares.length}</strong> estándares técnicos correspondientes a su perfil profesional en la organización.
            </p>
            {!loading && !matrixError && estandares.length > 0 && <ul style={{ margin: '12px 0 0', paddingLeft: 20, fontSize: 13, color: '#4a5568' }}>
              {estandares.map(est => <li key={est.estandar_codigo}>
                <a href={`/nuevo-ingreso/estandar/${encodeURIComponent(est.estandar_codigo)}`}>{est.estandar_codigo} · {est.estandar_nombre}</a>
              </li>)}
            </ul>}
          </div>

          {/* Instrucciones Oficiales del Cuestionario */}
          <div style={{ marginBottom: '32px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#2d3748', margin: '0 0 12px 0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Instrucciones del Cuestionario
            </h2>
            
            <p style={{ fontSize: '14px', color: '#4a5568', lineHeight: '1.6', margin: '0 0 16px 0' }}>
              Esta evaluación ha sido diseñada exclusivamente para el personal de nuevo ingreso que se incorpora a la empresa, con el objetivo de testear y registrar el estado de los conocimientos técnicos previos al inicio de sus funciones operativas.
            </p>

            <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#2d3748', margin: '0 0 8px 0' }}>
              Reglas de Evaluación:
            </h3>
            <ul style={{ margin: '0', paddingLeft: '20px', fontSize: '14px', color: '#4a5568', lineHeight: '1.8' }}>
              <li><strong>Primer intento:</strong> Consta de 20 preguntas (1 punto por respuesta correcta).</li>
              <li><strong>Segundo intento (Recuperación):</strong> Consta de 20 preguntas (1 punto por respuesta correcta).</li>
              <li><strong>Criterio de aprobación:</strong> Se requiere una calificación final estrictamente mayor a 12 puntos.</li>
              <li><strong>Restricción de tiempo:</strong> Dispone de un máximo de 45 segundos para responder cada pregunta.</li>
            </ul>
          </div>

          {/* Bloque de Acción y Estado de Intentos */}
          {loading || matrixError || estandares.length === 0 ? (
            <div className="empty-state" style={{ textAlign: 'center', padding: '20px 0' }}>
              <p className="empty-state__text" style={{ color: '#e53e3e', fontWeight: 500 }}>
                {matrixError || (loading ? 'Consultando matriz vigente…' : 'No se encuentran estándares asignados a su cargo actual. Por favor, tome contacto con el administrador del sistema.')}
              </p>
            </div>
          ) : (
            (() => {
              const intentosGlobales = registros.length;
              const aprobado = registros.some(i => i.puntaje > 12);
              const bloqueado = intentosGlobales >= MAX_INTENTOS && !aprobado;

              return (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', borderTop: '1px solid #edf2f7', paddingTop: '24px' }}>
                  {aprobado && (
                    <div style={{ width: '100%', textAlign: 'center', background: '#f0fdf4', color: '#166534', padding: '12px', borderRadius: '6px', fontWeight: 600, fontSize: '14px', border: '1px solid #bbf7d0' }}>
                      Evaluación aprobada satisfactoriamente.
                    </div>
                  )}
                  {!aprobado && intentosGlobales === 1 && (
                    <div style={{ width: '100%', textAlign: 'center', background: '#fffbeb', border: '1px solid #fef3c7', color: '#b45309', padding: '12px', borderRadius: '6px', fontSize: '14px' }}>
                      Atención: Este es su último intento disponible para esta evaluación de diagnóstico.
                    </div>
                  )}
                  
                  <button
                    disabled={bloqueado}
                    onClick={() => navigate('/nuevo-ingreso/quiz-global')}
                    style={{
                      width: '100%',
                      padding: '16px 32px',
                      borderRadius: '6px',
                      background: bloqueado ? '#cbd5e1' : '#E6007E',
                      color: '#ffffff',
                      border: 'none',
                      cursor: bloqueado ? 'not-allowed' : 'pointer',
                      fontSize: '16px',
                      fontWeight: 700,
                      boxShadow: bloqueado ? 'none' : '0 4px 12px rgba(230, 0, 126, 0.2)',
                      transition: 'background-color 0.2s',
                    }}
                  >
                    {bloqueado ? 'Evaluación no disponible' : 'Iniciar Evaluación'}
                  </button>
                  
                  {!bloqueado && (
                    <span style={{ fontSize: '13px', color: '#718096', fontWeight: 500 }}>
                      Evaluación general unificada (20 preguntas) · Intento {intentosGlobales + 1} de {MAX_INTENTOS}
                    </span>
                  )}
                  
                  {bloqueado && (
                    <p style={{ fontSize: '13px', color: '#e53e3e', textAlign: 'center', margin: 0, fontWeight: 500 }}>
                      Ha agotado los {MAX_INTENTOS} intentos permitidos establecidos para esta evaluación de ingreso.
                    </p>
                  )}
                </div>
              );
            })()
          )}

        </div>
      </main>
    </div>
  );
}
