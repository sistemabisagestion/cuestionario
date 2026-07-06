import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import bisaLogo from '../assets/bisa_fondo_blanco.png';

const CARGOS = [
  'Admin. Contratos','Arquitecto supervisor','Asist. Control Doc.','Asist. Topografía',
  'Ayudante','Coordinador proyecto','Estimador Costos','Gerente de proyecto',
  'Ing. Control Proyectos','Ing. Control Proyectos Jr.','Ing. Control Proyectos Sr',
  'Ing. Producción','Ing. Proyectos Campo Sr.','Ing. Proyectos Sr.','Ing. Proyectos campo',
  'Ing. SSTMA','Ing. Superv. CQA Jr.','Ing. Superv. Jr.','Ing. Superv. SSOMA Jr.',
  'Ing. Supervisor','Ing. Supervisor CQA','Ing. Supervisor CQA Sr.',
  'Ing. Supervisor SSOMA','Ing. Supervisor SSOMA Sr.','Ing. Supervisor Sr.',
  'Jefe CQA','Jefe Proyecto','Jefe SSOMA','Superv. Cadista (Téc.)','Supervisor Campo (Téc.)','Topógrafo Supervisor',
];

const UNIDADES_NEGOCIO = ['EPCM', 'INGENIERÍA', 'ESTUDIOS MINEROS'];
const DISCIPLINAS = ['Supervisión CM', 'Gestión de proyecto CM'];

export default function NuevoIngresoPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ nombre: '', unidadNegocio: '', disciplina: '', cargo: '', correo: '', dni: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busquedaCargo, setBusquedaCargo] = useState('');

  const cargosFiltrados = CARGOS.filter(c => c.toLowerCase().includes(busquedaCargo.toLowerCase()));

  function validate() {
    const errs: Record<string, string> = {};
    if (!form.nombre.trim()) errs.nombre = 'Nombre es requerido';
    if (!form.unidadNegocio) errs.unidadNegocio = 'Unidad de negocio es requerida';
    if (!form.disciplina) errs.disciplina = 'Disciplina es requerida';
    if (!form.cargo) errs.cargo = 'Cargo es requerido';
    if (!form.correo.includes('@')) errs.correo = 'Correo inválido';
    if (!/^\d{8}$/.test(form.dni)) errs.dni = 'DNI debe tener 8 dígitos';
    return errs;
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    // Guardar en sessionStorage para el flujo de nuevo ingreso
    sessionStorage.setItem('bisa-nuevo-ingreso', JSON.stringify({
      nombre: form.nombre.trim(),
      unidadNegocio: form.unidadNegocio,
      disciplina: form.disciplina,
      cargo: form.cargo,
      correo: form.correo.trim(),
      dni: form.dni.trim(),
      tipo: 'NUEVO INGRESO',
    }));
    navigate('/nuevo-ingreso/standards');
  }

  return (
    <div className="registration">
      <div className="registration__card">
        <div className="registration__logo" style={{ marginBottom: 8 }}>
          <img src={bisaLogo} alt="BISA" style={{ height: 96, objectFit: 'contain' }} />
        </div>
        <p className="registration__title">Registro — Nuevo Ingreso</p>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Nombre completo</label>
            <input type="text" placeholder="Juan Pérez García" value={form.nombre}
              onChange={e => setForm({ ...form, nombre: e.target.value })} />
            {errors.nombre && <div className="error">{errors.nombre}</div>}
          </div>

          <div className="form-group">
            <label>Unidad de negocio</label>
            <select value={form.unidadNegocio} onChange={e => setForm({ ...form, unidadNegocio: e.target.value })}>
              <option value="">Seleccionar...</option>
              {UNIDADES_NEGOCIO.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
            {errors.unidadNegocio && <div className="error">{errors.unidadNegocio}</div>}
          </div>

          <div className="form-group">
            <label>Disciplina</label>
            <select value={form.disciplina} onChange={e => setForm({ ...form, disciplina: e.target.value })}>
              <option value="">Seleccionar...</option>
              {DISCIPLINAS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
            {errors.disciplina && <div className="error">{errors.disciplina}</div>}
          </div>

          <div className="form-group">
            <label>Cargo</label>
            <input
              type="text"
              placeholder="Buscar o seleccionar cargo..."
              value={busquedaCargo}
              onChange={e => {
                setBusquedaCargo(e.target.value);
                // Si el texto no coincide exactamente con un cargo, limpiar selección
                if (!CARGOS.includes(e.target.value)) {
                  setForm({ ...form, cargo: '' });
                }
              }}
              style={{ borderRadius: cargosFiltrados.length > 0 && busquedaCargo && !form.cargo ? '6px 6px 0 0' : undefined }}
            />
            {/* Dropdown de sugerencias solo cuando hay búsqueda activa y no hay cargo seleccionado */}
            {busquedaCargo && !form.cargo && cargosFiltrados.length > 0 && (
              <div style={{
                border: '1px solid #d1d5db', borderTop: 'none', borderRadius: '0 0 6px 6px',
                maxHeight: 180, overflowY: 'auto', background: '#fff',
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)', zIndex: 10, position: 'relative',
              }}>
                {cargosFiltrados.map(c => (
                  <div
                    key={c}
                    onClick={() => { setForm({ ...form, cargo: c }); setBusquedaCargo(c); }}
                    style={{
                      padding: '10px 14px', cursor: 'pointer', fontSize: 14,
                      borderBottom: '1px solid #f0f0f0',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#f5f5f5')}
                    onMouseLeave={e => (e.currentTarget.style.background = '#fff')}
                  >
                    {c}
                  </div>
                ))}
              </div>
            )}
            {form.cargo && (
              <div style={{ fontSize: 12, color: '#16a34a', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                ✓ Cargo seleccionado: <strong>{form.cargo}</strong>
                <button
                  type="button"
                  onClick={() => { setForm({ ...form, cargo: '' }); setBusquedaCargo(''); }}
                  style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: 13, marginLeft: 4 }}
                >
                  ✕
                </button>
              </div>
            )}
            {errors.cargo && <div className="error">{errors.cargo}</div>}
          </div>

          <div className="form-group">
            <label>Correo electrónico</label>
            <input type="email" placeholder="jperez@bisa.com.pe" value={form.correo}
              onChange={e => setForm({ ...form, correo: e.target.value })} />
            {errors.correo && <div className="error">{errors.correo}</div>}
          </div>

          <div className="form-group">
            <label>DNI</label>
            <input type="text" placeholder="12345678" maxLength={8} value={form.dni}
              onChange={e => setForm({ ...form, dni: e.target.value.replace(/\D/g, '') })} />
            {errors.dni && <div className="error">{errors.dni}</div>}
          </div>

          <button type="submit" className="btn btn--primary btn--full">Continuar</button>
          <button type="button" className="btn btn--secondary btn--full" style={{ marginTop: 10 }}
            onClick={() => navigate('/')}>Volver</button>
        </form>
      </div>
    </div>
  );
}
