import React, { useState } from 'react';
import type { SolicitudPermiso, EstadoPermiso } from '../types';

interface Props {
  solicitudes: SolicitudPermiso[];
  onCambiarEstado: (id: string, nuevoEstado: EstadoPermiso) => void;
  onEliminar: (id: string) => void;
  onVerComprobante: (solicitud: SolicitudPermiso) => void;
}

export const HistorialPermisos: React.FC<Props> = ({
  solicitudes,
  onCambiarEstado,
  onEliminar,
  onVerComprobante,
}) => {
  const [busqueda, setBusqueda] = useState('');
  const [filtroEstado, setFiltroEstado] = useState<string>('TODOS');
  const [filtroMotivo, setFiltroMotivo] = useState<string>('TODOS');

  // Obtener una lista única de motivos existentes en las solicitudes para el filtro
  const motivosDisponibles = Array.from(
    new Set(solicitudes.map((sol) => sol.motivo.split(' - ')[0]))
  ).filter(Boolean);

  // Filtrar solicitudes combinando la búsqueda general y los filtros por columna
  const solicitudesFiltradas = solicitudes.filter((sol) => {
    const coincideTexto =
      sol.id.toLowerCase().includes(busqueda.toLowerCase()) ||
      sol.nombreTrabajador.toLowerCase().includes(busqueda.toLowerCase()) ||
      sol.rut.toLowerCase().includes(busqueda.toLowerCase());

    const coincideEstado = filtroEstado === 'TODOS' || sol.estado === filtroEstado;
    const coincideMotivo = filtroMotivo === 'TODOS' || sol.motivo.toLowerCase().includes(filtroMotivo.toLowerCase());

    return coincideTexto && coincideEstado && coincideMotivo;
  });

  // Calcular total de horas acumuladas (Horas y Días convertidos a 8.5 hrs)
  const totalHorasAprobadas = solicitudes
    .filter((sol) => sol.estado === 'Aprobado')
    .reduce((acc, sol) => {
      const texto = sol.cantidadHoras.toLowerCase();
      
      if (texto.includes('días') || texto.includes('dia') || texto.includes('día')) {
        const diasNum = parseFloat(texto.replace(/[^0-9,.]/g, '').replace(',', '.')) || 0;
        return acc + (diasNum * 8.5);
      } else if (texto.includes('hrs')) {
        const horasNum = parseFloat(texto.replace(/[^0-9,.]/g, '').replace(',', '.')) || 0;
        return acc + horasNum;
      }
      
      return acc;
    }, 0);

  // Agrupar y desglosar horas por trabajador y por tipo de motivo (solo solicitudes aprobadas)
  const resumenPorTrabajador = solicitudes
    .filter((sol) => sol.estado === 'Aprobado')
    .reduce((acc: { [rut: string]: any }, curr) => {
      const rut = curr.rut || 'Sin RUT';
      if (!acc[rut]) {
        acc[rut] = {
          nombre: curr.nombreTrabajador,
          rut: rut,
          totalPermisos: 0,
          particulares: 0,
          medico: 0,
          administrativo: 0,
          otros: 0,
          sumaTotal: 0
        };
      }

      acc[rut].totalPermisos += 1;

      // Calcular valor numérico real en horas (1 día = 8.5 hrs)
      const texto = curr.cantidadHoras.toLowerCase();
      let horasReales = 0;
      if (texto.includes('días') || texto.includes('dia') || texto.includes('día')) {
        const diasNum = parseFloat(texto.replace(/[^0-9,.]/g, '').replace(',', '.')) || 0;
        horasReales = diasNum * 8.5;
      } else {
        horasReales = parseFloat(texto.replace(/[^0-9,.]/g, '').replace(',', '.')) || 0;
      }

      const motivoLower = curr.motivo.toLowerCase();
      if (motivoLower.includes('particular')) {
        acc[rut].particulares += horasReales;
      } else if (motivoLower.includes('médico') || motivoLower.includes('medico')) {
        acc[rut].medico += horasReales;
      } else if (motivoLower.includes('administrativo')) {
        acc[rut].administrativo += horasReales;
      } else {
        acc[rut].otros += horasReales;
      }

      acc[rut].sumaTotal += horasReales;
      return acc;
    }, {});

  const listaResumenTrabajadores = Object.values(resumenPorTrabajador);

  const handleEliminarClick = (sol: SolicitudPermiso) => {
    const targetId = (sol as any).firebaseId || sol.id;
    if (window.confirm(`¿Estás seguro de que deseas eliminar la solicitud #${sol.id}?`)) {
      onEliminar(targetId);
    }
  };

  const handleCambiarEstadoClick = (sol: SolicitudPermiso, nuevoEstado: EstadoPermiso) => {
    const targetId = (sol as any).firebaseId || sol.id;
    onCambiarEstado(targetId, nuevoEstado);
  };

  return (
    <div className="bg-white p-6 rounded-xl shadow-md space-y-6 border border-slate-200">
      
      {/* Encabezado y Buscador General */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b pb-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Historial e Informes de Permisos</h2>
          <p className="text-sm text-slate-500 mt-0.5">Revisa, aprueba o gestiona los permisos solicitados.</p>
        </div>

        <div className="w-full md:w-72">
          <input
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por Folio, Nombre o RUT..."
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Barra de Filtros por Columna */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
        <div>
          <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">Filtrar por Estado</label>
          <select
            value={filtroEstado}
            onChange={(e) => setFiltroEstado(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="TODOS">Todos los estados</option>
            <option value="Pendiente">Pendiente</option>
            <option value="Aprobado">Aprobado</option>
            <option value="Rechazado">Rechazado</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">Filtrar por Motivo</label>
          <select
            value={filtroMotivo}
            onChange={(e) => setFiltroMotivo(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="TODOS">Todos los motivos</option>
            {motivosDisponibles.map((motivo, index) => (
              <option key={index} value={motivo}>
                {motivo}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Tarjetas de Resumen */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-1">
          <span className="text-xs font-semibold text-blue-900 uppercase tracking-wider">Total Solicitudes Registradas</span>
          <div className="text-3xl font-extrabold text-slate-800">{solicitudes.length}</div>
        </div>
        <div className="bg-emerald-50/50 p-4 rounded-xl border border-emerald-200 space-y-1">
          <span className="text-xs font-semibold text-emerald-800 uppercase tracking-wider">Total Horas Acumuladas (Incluye Días a 8.5h)</span>
          <div className="text-3xl font-extrabold text-emerald-700">{totalHorasAprobadas.toFixed(1)} hrs</div>
        </div>
      </div>

      {/* Tabla del Historial Principal */}
      <div className="overflow-x-auto border border-slate-200 rounded-xl">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Folio</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Período</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Trabajador / Aprobador</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Motivo</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Duración</th>
              <th className="px-6 py-3 text-center text-xs font-medium text-slate-500 uppercase tracking-wider">Estado / Acciones</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-slate-200">
            {solicitudesFiltradas.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-sm text-slate-500">
                  {solicitudes.length === 0 ? 'No hay solicitudes registradas todavía.' : 'No se encontraron coincidencias con los filtros aplicados.'}
                </td>
              </tr>
            ) : (
              solicitudesFiltradas.map((sol) => (
                <tr key={sol.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-blue-600">
                    #{sol.id}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                    <div className="font-medium text-slate-900">{sol.fechaInicio || 'N/A'}</div>
                    <div className="text-xs text-slate-500">al {sol.fechaFin || sol.fechaInicio || 'N/A'}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-semibold text-slate-900">{sol.nombreTrabajador}</div>
                    <div className="text-xs text-slate-500">RUT: {sol.rut}</div>
                    <div className="text-xs text-blue-700 font-medium mt-0.5">Jefe Sección: {sol.cargo || 'No asignado'}</div>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-700 max-w-xs truncate">
                    {sol.motivo}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-slate-800">
                    {sol.cantidadHoras}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center space-y-2">
                    <div className="flex justify-center">
                      <span
                        className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          sol.estado === 'Aprobado'
                            ? 'bg-emerald-100 text-emerald-800'
                            : sol.estado === 'Rechazado'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {sol.estado}
                      </span>
                    </div>
                    <div className="flex justify-center items-center gap-1.5 flex-wrap">
                      <button
                        type="button"
                        onClick={() => onVerComprobante(sol)}
                        className="px-2.5 py-1 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded text-xs font-medium transition cursor-pointer"
                        title="Ver Comprobante PDF"
                      >
                        📄 PDF
                      </button>
                      {sol.estado !== 'Aprobado' && (
                        <button
                          type="button"
                          onClick={() => handleCambiarEstadoClick(sol, 'Aprobado')}
                          className="px-2.5 py-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded text-xs font-medium transition cursor-pointer"
                        >
                          Aprobar
                        </button>
                      )}
                      {sol.estado !== 'Rechazado' && (
                        <button
                          type="button"
                          onClick={() => handleCambiarEstadoClick(sol, 'Rechazado')}
                          className="px-2.5 py-1 bg-amber-50 text-amber-700 hover:bg-amber-100 rounded text-xs font-medium transition cursor-pointer"
                        >
                          Rechazar
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleEliminarClick(sol)}
                        className="px-2.5 py-1 bg-red-50 text-red-600 hover:bg-red-100 rounded text-xs font-medium transition cursor-pointer"
                        title="Eliminar solicitud"
                      >
                        🗑️
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Tabla: Acumulado por Trabajador - Desglose por Tipo de Solicitud */}
      <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
        <div className="bg-amber-50/70 px-6 py-3.5 border-b border-slate-200">
          <h3 className="text-sm font-bold text-slate-800">Acumulado por Trabajador - Desglose por Tipo de Solicitud (1 día = 8.5 hrs)</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-left">
            <thead className="bg-slate-50 text-xs font-semibold text-slate-600 uppercase">
              <tr>
                <th className="px-6 py-3">Funcionario</th>
                <th className="px-6 py-3">RUT</th>
                <th className="px-6 py-3 text-center">Total Permisos</th>
                <th className="px-6 py-3 text-center">Particulares</th>
                <th className="px-6 py-3 text-center">Médico</th>
                <th className="px-6 py-3 text-center">Administrativo</th>
                <th className="px-6 py-3 text-center">Otros</th>
                <th className="px-6 py-3 text-right">Suma Total</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200 text-sm">
              {listaResumenTrabajadores.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-6 text-center text-slate-500">
                    No hay registros aprobados para generar el desglose por trabajador.
                  </td>
                </tr>
              ) : (
                listaResumenTrabajadores.map((item: any, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-3.5 font-semibold text-slate-900">{item.nombre}</td>
                    <td className="px-6 py-3.5 text-slate-500">{item.rut}</td>
                    <td className="px-6 py-3.5 text-center">
                      <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded-full text-xs font-medium">
                        {item.totalPermisos}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 text-center text-slate-700">{item.particulares > 0 ? `${item.particulares.toFixed(1)} hrs` : '-'}</td>
                    <td className="px-6 py-3.5 text-center text-slate-700">{item.medico > 0 ? `${item.medico.toFixed(1)} hrs` : '-'}</td>
                    <td className="px-6 py-3.5 text-center text-slate-700">{item.administrativo > 0 ? `${item.administrativo.toFixed(1)} hrs` : '-'}</td>
                    <td className="px-6 py-3.5 text-center text-slate-700">{item.otros > 0 ? `${item.otros.toFixed(1)} hrs` : '-'}</td>
                    <td className="px-6 py-3.5 text-right font-bold text-slate-900">{item.sumaTotal.toFixed(1)} hrs</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};