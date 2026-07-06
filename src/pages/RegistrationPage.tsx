import { useState, useRef, useEffect } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import { getIntentosByDni } from '../utils/storage';
import bisaLogo from '../assets/bisa_fondo_blanco.png';

const CARGOS = [
  'Admin. Contratos',
  'Arquitecto supervisor',
  'Asist. Control Doc.',
  'Asist. Topografía',
  'Ayudante',
  'Coordinador proyecto',
  'Estimador Costos',
  'Gerente de proyecto',
  'Ing. Control Proyectos',
  'Ing. Control Proyectos Jr.',
  'Ing. Control Proyectos Sr',
  'Ing. Producción',
  'Ing. Proyectos Campo Sr.',
  'Ing. Proyectos Sr.',
  'Ing. Proyectos campo',
  'Ing. SSTMA',
  'Ing. Superv. CQA Jr.',
  'Ing. Superv. Jr.',
  'Ing. Superv. SSOMA Jr.',
  'Ing. Supervisor',
  'Ing. Supervisor CQA',
  'Ing. Supervisor CQA Sr.',
  'Ing. Supervisor SSOMA',
  'Ing. Supervisor SSOMA Sr.',
  'Ing. Supervisor Sr.',
  'Jefe CQA',
  'Jefe Proyecto',
  'Jefe SSOMA',
  'Superv. Cadista (Téc.)',
  'Supervisor Campo (Téc.)',
  'Topógrafo Supervisor',
];

const UNIDADES_NEGOCIO = ['EPCM', 'INGENIERÍA', 'ESTUDIOS MINEROS'];
const DISCIPLINAS = ['Supervisión CM', 'Gestión de proyecto CM'];

export default function RegistrationPage() {
  const navigate = useNavigate();
  const { login } = useUser();
  const [form, setForm] = useState({
    nombre: '',
    unidadNegocio: '',
    disciplina: '',
    cargo: '',
    correo: '',
    dni: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [returning, setReturning] = useState(false);

  // Estados para el buscador de cargos
  const [cargoSearch, setCargoSearch] = useState('');
  const [showCargoList, setShowCargoList] = useState(false);
  const cargoWrapperRef = useRef<HTMLDivElement>(null);

  // Cerrar la lista de cargos si se hace clic afuera
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (cargoWrapperRef.current && !cargoWrapperRef.current.contains(event.target as Node)) {
        setShowCargoList(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function validate() {
    const errs: Record<string, string> = {};
    if (!form.nombre.trim()) errs.nombre = 'Nombre es requerido';
    if (!form.unidadNegocio.trim()) errs.unidadNegocio = 'Unidad de negocio es requerida';
    if (!form.disciplina.trim()) errs.disciplina = 'Disciplina es requerida';
    if (!form.cargo.trim()) errs.cargo = 'Cargo es requerido';
    if (form.cargo && !CARGOS.includes(form.cargo)) errs.cargo = 'Seleccione un cargo válido de la lista';
    if (!form.correo.includes('@')) errs.correo = 'Correo inválido';
    if (!/^\d{8}$/.test(form.dni)) errs.dni = 'DNI debe tener 8 dígitos';
    return errs;
  }

  function handleDniBlur() {
    if (/^\d{8}$/.test(form.dni)) {
      const intentos = getIntentosByDni(form.dni);
      if (intentos.length > 0) setReturning(true);
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    login({
      nombre: form.nombre.trim(),
      unidadNegocio: form.unidadNegocio.trim(),
      disciplina: form.disciplina.trim(),
      cargo: form.cargo.trim(),
      correo: form.correo.trim(),
      dni: form.dni.trim(),
    });
    navigate('/standards');
  }

  const filteredCargos = CARGOS.filter(c => 
    c.toLowerCase().includes(cargoSearch.toLowerCase())
  );

  return (
    <div className="registration">
      <div className="registration__card">
        <div className="registration__logo" style={{ marginBottom: 8 }}>
          <img
            src={bisaLogo}
            alt="BISA"
            style={{ height: 96, objectFit: 'contain' }}
          />
        </div>
        <p className="registration__title">Evaluación de Estándares de Gestión</p>

        {returning && (
          <div style={{
            background: '#e8f5e9',
            border: '1px solid #a5d6a7',
            borderRadius: 'var(--radius)',
            padding: '12px 16px',
            marginBottom: '20px',
            fontSize: '14px',
            color: '#2e7d32',
          }}>
            Bienvenido de regreso. Se encontraron evaluaciones previas con este DNI.
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Nombre */}
          <div className="form-group">
            <label>Nombre completo</label>
            <input
              type="text"
              placeholder="Juan Pérez García"
              value={form.nombre}
              onChange={e => setForm({ ...form, nombre: e.target.value })}
            />
            {errors.nombre && <div className="error">{errors.nombre}</div>}
          </div>

          {/* Unidad de negocio */}
          <div className="form-group">
            <label>Unidad de negocio</label>
            <select
              value={form.unidadNegocio}
              onChange={e => setForm({ ...form, unidadNegocio: e.target.value })}
            >
              <option value="">Seleccionar unidad de negocio...</option>
              {UNIDADES_NEGOCIO.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
            {errors.unidadNegocio && <div className="error">{errors.unidadNegocio}</div>}
          </div>

          {/* Disciplina */}
          <div className="form-group">
            <label>Disciplina</label>
            <select
              value={form.disciplina}
              onChange={e => setForm({ ...form, disciplina: e.target.value })}
            >
              <option value="">Seleccionar disciplina...</option>
              {DISCIPLINAS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
            {errors.disciplina && <div className="error">{errors.disciplina}</div>}
          </div>

          {/* Cargo con Búsqueda */}
          <div className="form-group" ref={cargoWrapperRef}>
            <label>Cargo</label>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                placeholder="Buscar o seleccionar cargo..."
                value={showCargoList ? cargoSearch : form.cargo}
                onFocus={() => {
                  setShowCargoList(true);
                  setCargoSearch('');
                }}
                onChange={e => {
                  setCargoSearch(e.target.value);
                  setShowCargoList(true);
                }}
                autoComplete="off"
              />
              {/* Dropdown flotante */}
              {showCargoList && (
                <ul style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  maxHeight: '200px',
                  overflowY: 'auto',
                  background: '#fff',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  listStyle: 'none',
                  padding: 0,
                  margin: '4px 0 0 0',
                  zIndex: 10,
                  boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                }}>
                  {filteredCargos.length > 0 ? (
                    filteredCargos.map(c => (
                      <li
                        key={c}
                        style={{
                          padding: '10px 12px',
                          cursor: 'pointer',
                          borderBottom: '1px solid #f0f0f0',
                          color: '#333',
                          fontSize: '14px'
                        }}
                        onMouseDown={() => {
                          setForm({ ...form, cargo: c });
                          setCargoSearch('');
                          setShowCargoList(false);
                        }}
                        onMouseEnter={e => (e.currentTarget.style.background = '#f5f6f7')}
                        onMouseLeave={e => (e.currentTarget.style.background = '#fff')}
                      >
                        {c}
                      </li>
                    ))
                  ) : (
                    <li style={{ padding: '10px 12px', color: '#999', fontSize: '14px' }}>
                      No se encontraron resultados
                    </li>
                  )}
                </ul>
              )}
            </div>
            {errors.cargo && <div className="error">{errors.cargo}</div>}
          </div>

          {/* Correo */}
          <div className="form-group">
            <label>Correo electrónico</label>
            <input
              type="email"
              placeholder="jperez@bisa.com.pe"
              value={form.correo}
              onChange={e => setForm({ ...form, correo: e.target.value })}
            />
            {errors.correo && <div className="error">{errors.correo}</div>}
          </div>

          {/* DNI */}
          <div className="form-group">
            <label>DNI</label>
            <input
              type="text"
              placeholder="12345678"
              maxLength={8}
              value={form.dni}
              onChange={e => setForm({ ...form, dni: e.target.value.replace(/\D/g, '') })}
              onBlur={handleDniBlur}
            />
            {errors.dni && <div className="error">{errors.dni}</div>}
          </div>

          <button type="submit" className="btn btn--primary btn--full">
            Ingresar
          </button>
        </form>
      </div>
    </div>
  );
}