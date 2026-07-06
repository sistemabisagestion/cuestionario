import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import { getIntentosByDni, getIntentosByDniAsync } from '../utils/storage';
import type { Intento } from '../types';

function scoreClass(puntaje: number): string {
  if (puntaje >= 16) return 'history-table__score--high';
  if (puntaje > 12) return 'history-table__score--mid';
  return 'history-table__score--low';
}

export default function HistoryPage() {
  const { user } = useUser();
  const navigate = useNavigate();

  // Start with localStorage data (instant), then refresh from Supabase
  const [intentos, setIntentos] = useState<Intento[]>(() =>
    user ? getIntentosByDni(user.dni) : []
  );

  useEffect(() => {
    if (!user) return;
    getIntentosByDniAsync(user.dni).then(setIntentos);
  }, [user]);

  const sorted = [...intentos].sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());

  return (
    <>
      <h1 className="page-title">Historial de Evaluaciones</h1>
      <p className="page-subtitle">
        Registro de todas tus evaluaciones anteriores.
      </p>

      {sorted.length === 0 ? (
        <div className="empty-state">
          <p className="empty-state__text">Aún no has realizado evaluaciones.</p>
          <button
            className="btn btn--primary"
            onClick={() => navigate('/standards')}
            style={{ marginTop: 16 }}
          >
            Iniciar evaluación
          </button>
        </div>
      ) : (
        <div className="table-wrapper">
          <table className="history-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Estándar</th>
                <th>Nota</th>
                <th>Estado</th>
                <th>Detalle</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map(intento => {
                const codigoCorto = intento.estandarCodigo.replace('CL-ES-GOP-', '');
                const fecha = new Date(intento.fecha).toLocaleDateString('es-PE', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                });
                return (
                  <tr key={intento.id}>
                    <td>{fecha}</td>
                    <td>
                      <strong>{codigoCorto}</strong>
                      <br />
                      <span style={{ fontSize: 12, color: 'var(--color-gray)' }}>
                        {intento.estandarNombre}
                      </span>
                    </td>
                    <td>
                      <span className={`history-table__score ${scoreClass(intento.puntaje)}`}>
                        {intento.puntaje}/20
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${intento.puntaje > 12 ? 'badge--aprobado' : 'badge--desaprobado'}`}>
                        {intento.puntaje > 12 ? 'Aprobado' : 'Desaprobado'}
                      </span>
                    </td>
                    <td>
                      <span
                        className="history-table__link"
                        onClick={() => navigate(`/results/${intento.id}`)}
                      >
                        Ver detalle
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
  );
}
