import { useMatrix } from '../utils/useMatrix';
import { codesForCargo } from '../../shared/matrices.mjs';
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDataset } from '../utils/useDataset';
import { readNuevoIngresoUser } from '../utils/storage';



export default function NuevoIngresoDetailPage() {
  const { codigo } = useParams<{ codigo: string }>();
  const navigate = useNavigate();
  const { snapshot, error: matrixError, loading: matrixLoading } = useMatrix('nuevo-ingreso');
  const [usuario] = useState(readNuevoIngresoUser);
  const bank = useDataset('preguntas');
  const linkData = useDataset('links');

  useEffect(() => { if (!usuario) navigate('/nuevo-ingreso'); }, [usuario, navigate]);

  if (matrixLoading || matrixError) return <p role="status">{matrixError || 'Consultando matriz vigente…'}</p>;
  if (!snapshot || !codesForCargo(snapshot.mapping, usuario?.cargo || '').includes(decodeURIComponent(codigo || ''))) return <p role="alert">Este estándar no está asignado a tu cargo en la matriz correspondiente. Contacta al administrador.</p>;
  if (bank.loading || linkData.loading || bank.error || linkData.error) return <p role="status">{bank.error || linkData.error || 'Consultando información publicada…'}</p>;
  if (!usuario || !codigo) return null;

  const codigoDecoded = decodeURIComponent(codigo);
  const estandar = bank.snapshot?.data.find(e => e.estandar_codigo === codigoDecoded);
  const links = linkData.snapshot?.data[codigoDecoded] ?? null;

  if (!estandar) { navigate('/nuevo-ingreso/standards'); return null; }

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: '32px 16px' }}>
      <div style={{ marginBottom: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#E6007E', letterSpacing: 1 }}>
          {estandar.estandar_codigo}
        </span>
      </div>
      <h1 style={{ fontSize: 24, fontWeight: 700, color: '#1D262B', marginBottom: 8, lineHeight: 1.3 }}>
        {estandar.estandar_nombre}
      </h1>
      <p style={{ fontSize: 14, color: '#8C9093', marginBottom: 32 }}>
        Revisa el material antes de iniciar tu evaluación desde el panel principal.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 40 }}>
        {/* Video */}
        <a href={links?.video || '#'} target="_blank" rel="noopener noreferrer"
          style={{
            display: 'flex', alignItems: 'center', gap: 16, padding: '18px 20px', borderRadius: 12,
            background: links?.video ? '#1D262B' : '#f0f0f0', color: links?.video ? '#fff' : '#999',
            textDecoration: 'none', opacity: links?.video ? 1 : 0.5,
            pointerEvents: links?.video ? 'auto' : 'none', boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
          }}>
          <span style={{ fontSize: 28 }}>▶️</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15 }}>Ver video del estándar</div>
            <div style={{ fontSize: 12, opacity: 0.7, marginTop: 2 }}>Se abrirá en SharePoint</div>
          </div>
          <span style={{ marginLeft: 'auto', fontSize: 18, opacity: 0.6 }}>↗</span>
        </a>

        {/* Documento */}
        <a href={links?.documento || '#'} target="_blank" rel="noopener noreferrer"
          style={{
            display: 'flex', alignItems: 'center', gap: 16, padding: '18px 20px', borderRadius: 12,
            background: '#fff', color: '#1D262B', textDecoration: 'none',
            border: '1.5px solid #E0E0E0', opacity: links?.documento ? 1 : 0.5,
            pointerEvents: links?.documento ? 'auto' : 'none', boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
          }}>
          <span style={{ fontSize: 28 }}>📄</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15 }}>Leer documento del estándar</div>
            <div style={{ fontSize: 12, opacity: 0.6, marginTop: 2 }}>Se abrirá en SharePoint</div>
          </div>
          <span style={{ marginLeft: 'auto', fontSize: 18, opacity: 0.4 }}>↗</span>
        </a>

      </div>

      <button onClick={() => navigate('/nuevo-ingreso/standards')}
        style={{ background: 'none', border: 'none', color: '#8C9093', fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
        ← Volver a estándares
      </button>
    </div>
  );
}
