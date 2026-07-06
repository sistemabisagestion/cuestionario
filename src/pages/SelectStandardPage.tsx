import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import { getEstandaresByCargo } from '../data';
import { getIntentosByDniAsync } from '../utils/storage';
import type { Intento } from '../types';

const MAX_INTENTOS = 2;

export default function SelectStandardPage() {
  const navigate = useNavigate();
  const { user } = useUser();
  const [intentos, setIntentos] = useState<Intento[]>([]);

  useEffect(() => {
    if (!user) return;
    getIntentosByDniAsync(user.dni).then(setIntentos);
  }, [user]);

  function getEstadoEstandar(estandarCodigo: string) {
    const estIntentos = intentos.filter(i => i.estandarCodigo === estandarCodigo);
    const numIntentos = estIntentos.length;
    const mejor = numIntentos > 0 ? Math.max(...estIntentos.map(i => i.puntaje)) : null;
    const aprobado = mejor !== null && mejor > 12;
    const bloqueado = numIntentos >= MAX_INTENTOS && !aprobado;
    return { bloqueado, numIntentos, mejor, aprobado };
  }

  const estandaresFiltrados = user ? getEstandaresByCargo(user.cargo) : [];

  return (
    <>
      <h1 className="page-title">Selecciona un Estándar</h1>
      <p className="page-subtitle">
        {user ? `${estandaresFiltrados.length} estándares asignados a: ${user.cargo}` : 'Cargando...'}
      </p>

      <div className="standards-grid">
        {estandaresFiltrados.map(est => {
          const { bloqueado, numIntentos, mejor, aprobado } = getEstadoEstandar(est.estandar_codigo);

          return (
            <div
              key={est.estandar_codigo}
              className="standard-card"
              onClick={() => navigate(`/estandar/${encodeURIComponent(est.estandar_codigo)}`)}
              style={{ cursor: 'pointer', opacity: bloqueado ? 0.6 : 1 }}
            >
              <div className="standard-card__code">{est.estandar_codigo}</div>
              <div className="standard-card__name">{est.estandar_nombre}</div>
              <div className="standard-card__stats">
                <span>
                  {numIntentos === 0 ? 'Sin intentos' : `Intento ${numIntentos} de ${MAX_INTENTOS}`}
                </span>
                {mejor !== null && (
                  <span className="standard-card__best">Mejor: {mejor}/20</span>
                )}
              </div>

              {aprobado && (
                <div style={{ marginTop: 8, padding: '4px 8px', background: '#dcfce7', color: '#166534', borderRadius: 4, fontSize: 12, fontWeight: 600, textAlign: 'center' }}>
                  ✓ Aprobado
                </div>
              )}
              {bloqueado && (
                <div style={{ marginTop: 8, padding: '4px 8px', background: '#fee2e2', color: '#991b1b', borderRadius: 4, fontSize: 12, fontWeight: 600, textAlign: 'center' }}>
                  🔒 Sin intentos disponibles
                </div>
              )}
              {!bloqueado && !aprobado && numIntentos === 1 && (
                <div style={{ marginTop: 8, padding: '4px 8px', background: '#FFF8E1', color: '#7B5800', borderRadius: 4, fontSize: 12, fontWeight: 600, textAlign: 'center' }}>
                  ⚠️ Último intento disponible
                </div>
              )}
              {!bloqueado && !aprobado && numIntentos === 0 && (
                <div style={{ marginTop: 8, padding: '4px 8px', background: '#f0f4ff', color: '#1e3a8a', borderRadius: 4, fontSize: 12, textAlign: 'center' }}>
                  2 intentos disponibles
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
