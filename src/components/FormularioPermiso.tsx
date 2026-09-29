import React, { useState, useEffect } from 'react';
import type { SolicitudPermiso, TrabajadorNomina } from '../types';

interface Autorizado {
  id: string;
  nombre: string;
}

interface Props {
  onAgregarSolicitud: (solicitud: Omit<SolicitudPermiso, 'id'>) => void;
  nominaPersonal: TrabajadorNomina[];
  listaAutorizados: Autorizado[];
}

export const FormularioPermiso: React.FC<Props> = ({ onAgregarSolicitud, nominaPersonal, listaAutorizados }) => {
  const [nombreTrabajador, setNombreTrabajador] = useState('');
  const [rut, setRut] = useState('');
  const [motivo, setMotivo] = useState('Particulares');
  const [tipoPermiso, setTipoPermiso] = useState<'Por Horas' | 'Por Dias'>('Por Horas');
  
  const [cantidadHoras, setCantidadHoras] = useState('2');
  const [cantidadDias, setCantidadDias] = useState('1');

  const [horaSalida, setHoraSalida] = useState('');
  const [horaRegreso, setHoraRegreso] = useState('');
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [autorizadoPor, setAutorizadoPor] = useState('');
  const [observaciones, setObservaciones] = useState('');

  // Efecto "BUSCARV" para autocompletar el RUT
  useEffect(() => {
    if (!nombreTrabajador) {
      setRut('');
      return;
    }
    const encontrado = nominaPersonal.find(t => t.nombre.toUpperCase() === nombreTrabajador.toUpperCase());
    if (encontrado) {
      setRut(encontrado.rut);
    } else {
      setRut('');
    }
  }, [nombreTrabajador, nominaPersonal]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombreTrabajador || !rut) {
      alert('Por favor seleccione un trabajador válido.');
      return;
    }

    if (!autorizadoPor) {
      alert('Por favor seleccione quién autoriza el permiso.');
      return;
    }

    const fInicio = fechaInicio || new Date().toISOString().split('T')[0];
    const fFin = fechaFin || fInicio;
    const esPorDias = tipoPermiso === 'Por Dias';

    if (esPorDias) {
      // VALIDACIÓN CORREGIDA: Conciliación puede ser de hasta 2 días completos
      if (motivo === 'Conciliación' && Number(cantidadDias) > 2) {
        alert('Error: Las solicitudes bajo el motivo "Conciliación" no pueden exceder de 2 días.');
        return;
      }

      // VALIDACIÓN PARA DÍAS
      const inicioMs = new Date(fInicio).getTime();
      const finMs = new Date(fFin).getTime();

      if (finMs < inicioMs) {
        alert('Error: La fecha "Hasta" no puede ser anterior a la fecha "Desde".');
        return;
      }

      const diferenciaDias = Math.round((finMs - inicioMs) / (1000 * 60 * 60 * 24)) + 1;
      
      if (Number(cantidadDias) !== diferenciaDias) {
        const confirmar = window.confirm(
          `La cantidad de días ingresada (${cantidadDias}) no coincide con el rango de fechas seleccionado (${diferenciaDias} días).\n¿Desea ajustar la solicitud a ${diferenciaDias} día(s)?`
        );
        if (confirmar) {
          setCantidadDias(diferenciaDias.toString());
        } else {
          return;
        }
      }
    } else {
      // VALIDACIÓN ESTRICTA PARA HORAS
      if (!horaSalida || !horaRegreso) {
        alert('Por favor ingrese tanto la hora de salida como la hora de regreso.');
        return;
      }

      // Convertir horas a minutos para calcular la diferencia exacta
      const [hSalida, mSalida] = horaSalida.split(':').map(Number);
      const [hRegreso, mRegreso] = horaRegreso.split(':').map(Number);
      
      const totalMinutosSalida = hSalida * 60 + mSalida;
      const totalMinutosRegreso = hRegreso * 60 + mRegreso;
      const diferenciaMinutos = totalMinutosRegreso - totalMinutosSalida;

      if (diferenciaMinutos <= 0) {
        alert('Error: La hora de regreso debe ser estrictamente posterior a la hora de salida.');
        return;
      }

      const horasCalculadas = Number((diferenciaMinutos / 60).toFixed(1));
      const horasIngresadas = Number(cantidadHoras.replace(',', '.'));

      // Verificar si hay discrepancia entre el horario ingresado y las horas declaradas
      if (Math.abs(horasIngresadas - horasCalculadas) > 0.1) {
        const confirmar = window.confirm(
          `La cantidad de horas ingresada (${horasIngresadas} hrs) no coincide con el intervalo de tiempo entre las ${horaSalida} y las ${horaRegreso} (${horasCalculadas} hrs).\n¿Desea ajustar la duración a ${horasCalculadas} hrs?`
        );
        if (confirmar) {
          setCantidadHoras(horasCalculadas.toString().replace('.', ','));
        } else {
          return;
        }
      }
    }

    const totalCalculado = esPorDias 
      ? `${cantidadDias} día(s)` 
      : `${cantidadHoras.replace(',', '.')} hrs`;

    onAgregarSolicitud({
      nombreTrabajador: nombreTrabajador.toUpperCase(),
      rut,
      cargo: autorizadoPor,
      tipoPermiso: esPorDias ? 'Administrativo (Días)' : 'Administrativo (Horas)',
      fechaInicio: fInicio,
      fechaFin: fFin,
      cantidadHoras: totalCalculado,
      horaSalida: esPorDias ? '' : horaSalida,
      horaRegreso: esPorDias ? '' : horaRegreso,
      motivo: `${motivo} - ${observaciones}`.trim(),
      estado: 'Pendiente'
    });

    // Limpiar formulario
    setNombreTrabajador('');
    setRut('');
    setHoraSalida('');
    setHoraRegreso('');
    setObservaciones('');
    setAutorizadoPor('');
    alert('¡Solicitud enviada con éxito!');
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white p-6 rounded-xl shadow-md space-y-6 border border-slate-200">
      <h2 className="text-xl font-bold text-slate-800 border-b pb-3">Formulario de Solicitud de Permiso</h2>

      {/* SECCIÓN 1: DATOS DEL TRABAJADOR */}
      <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-4">
        <h3 className="text-sm font-semibold text-blue-900 uppercase tracking-wider">1. Datos del Trabajador</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Nombre del Trabajador (Nómina)</label>
            <select
              value={nombreTrabajador}
              onChange={(e) => setNombreTrabajador(e.target.value)}
              required
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">-- Seleccione un trabajador --</option>
              {nominaPersonal.map((t) => (
                <option key={t.id} value={t.nombre}>
                  {t.nombre}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">RUT</label>
            <input
              type="text"
              value={rut}
              readOnly
              placeholder="Se autocompleta con la nómina"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-100 text-slate-500 focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* SECCIÓN 2: MOTIVO Y TIPO */}
      <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-4">
        <h3 className="text-sm font-semibold text-blue-900 uppercase tracking-wider">2. Motivo y Tipo de Solicitud</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Motivo</label>
            <select
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="Particulares">Particulares</option>
              <option value="Administrativo">Administrativo</option>
              <option value="Médico">Médico</option>
              <option value="Gremial">Gremial</option>
              <option value="Asuntos Familiares">Asuntos Familiares</option>
              <option value="Conciliación">Conciliación</option>
              <option value="Otro">Otro</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Tipo de Solicitud</label>
            <select
              value={tipoPermiso}
              onChange={(e) => setTipoPermiso(e.target.value as any)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="Por Horas">Por Horas</option>
              <option value="Por Dias">Por Días</option>
            </select>
          </div>
        </div>
      </div>

      {/* SECCIÓN 3: DURACIÓN Y HORARIOS */}
      <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-4">
        <h3 className="text-sm font-semibold text-blue-900 uppercase tracking-wider">3. Duración y Horarios</h3>
        
        {tipoPermiso === 'Por Horas' ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Cantidad (Horas)</label>
              <input
                type="text"
                value={cantidadHoras}
                onChange={(e) => setCantidadHoras(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Hora de Salida</label>
              <input
                type="time"
                value={horaSalida}
                onChange={(e) => setHoraSalida(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Hora de Regreso</label>
              <input
                type="time"
                value={horaRegreso}
                onChange={(e) => setHoraRegreso(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Cantidad de Días</label>
              <input
                type="number"
                min="1"
                max="2"
                value={cantidadDias}
                onChange={(e) => setCantidadDias(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex items-center text-sm text-slate-500 italic pt-6">
              * El sistema validará la correspondencia con las fechas seleccionadas.
            </div>
          </div>
        )}
      </div>

      {/* SECCIÓN 4: FECHAS Y OBSERVACIONES */}
      <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-4">
        <h3 className="text-sm font-semibold text-blue-900 uppercase tracking-wider">4. Fechas y Autorización</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Desde (Fecha)</label>
            <input
              type="date"
              value={fechaInicio}
              onChange={(e) => setFechaInicio(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Hasta (Fecha)</label>
            <input
              type="date"
              value={fechaFin}
              onChange={(e) => setFechaFin(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Autorizado por</label>
            <select
              value={autorizadoPor}
              onChange={(e) => setAutorizadoPor(e.target.value)}
              required
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">-- Seleccione un autorizador --</option>
              {listaAutorizados.map((auth) => (
                <option key={auth.id} value={auth.nombre}>
                  {auth.nombre}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="pt-2">
          <label className="block text-sm font-medium text-slate-700 mb-1">Observaciones</label>
          <textarea
            rows={2}
            value={observaciones}
            onChange={(e) => setObservaciones(e.target.value)}
            placeholder="Detalles adicionales del permiso..."
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </div>
      </div>

      <div className="flex justify-end pt-4">
        <button
          type="submit"
          className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-8 py-3.5 rounded-xl text-base transition shadow-md cursor-pointer"
        >
          Enviar Solicitud
        </button>
      </div>
    </form>
  );
};