import React, { useState } from 'react';
import type { SolicitudPermiso } from '../types';

interface Props {
  permisos: SolicitudPermiso[];
}

export const ResumenMensual: React.FC<Props> = ({ permisos }) => {
  const [mesSeleccionado, setMesSeleccionado] = useState<string>(
    new Date().toISOString().slice(0, 7) // Formato "YYYY-MM"
  );
  const [busquedaFuncionario, setBusquedaFuncionario] = useState<string>('');

  // Función matemática inteligente mejorada para leer cantidadHoras y calcular 8.5h por día
  const calcularHorasPermiso = (p: any): number => {
    const textoCantidad = (p.cantidadHoras || p.totalHoras || p.horas || '').toString().toLowerCase();

    if (textoCantidad) {
      if (textoCantidad.includes('días') || textoCantidad.includes('dia') || textoCantidad.includes('día')) {
        const diasNum = parseFloat(textoCantidad.replace(/[^0-9,.]/g, '').replace(',', '.')) || 0;
        return diasNum * 8.5;
      } else if (textoCantidad.includes('hrs') || textoCantidad.includes('hr')) {
        const horasNum = parseFloat(textoCantidad.replace(/[^0-9,.]/g, '').replace(',', '.')) || 0;
        return horasNum;
      } else {
        const numPlano = parseFloat(textoCantidad.replace(',', '.')) || 0;
        if (numPlano > 0) return numPlano;
      }
    }

    if (p.tipoTiempo === 'Dias' && p.dias) {
      return Number(p.dias) * 8.5;
    }

    if (p.horaSalida && p.horaLlegada) {
      try {
        const [hSalida, mSalida] = p.horaSalida.split(':').map(Number);
        const [hLlegada, mLlegada] = p.horaLlegada.split(':').map(Number);
        
        const minutosSalida = hSalida * 60 + mSalida;
        const minutosLlegada = hLlegada * 60 + mLlegada;
        
        const diferenciaMinutos = minutosLlegada - minutosSalida;
        if (diferenciaMinutos > 0) {
          return Number((diferenciaMinutos / 60).toFixed(1));
        }
      } catch (e) {
        // Ignorar error de formato
      }
    }

    if (p.dias) {
      return Number(p.dias) * 8.5;
    }

    return 0;
  };

  // 1. Filtrar solicitudes según el mes
  const permisosDelMes = permisos.filter((p: any) => {
    const fecha = p.fechaSolicitud || p.fechaInicio || p.fecha || '';
    return fecha.toString().includes(mesSeleccionado);
  });

  // 2. Filtrar por texto de búsqueda en el nombre
  const permisosFiltrados = permisosDelMes.filter((p: any) => {
    const nombre = p.nombreTrabajador || p.nombreFuncionario || p.nombre || '';
    return nombre.toLowerCase().includes(busquedaFuncionario.toLowerCase());
  });

  // 3. Agrupar y sumar horas por funcionario con desglose y cálculo de horas a descontar
  const resumenPorPersona = permisosFiltrados.reduce((acc, permiso: any) => {
    const nombre = permiso.nombreTrabajador || permiso.nombreFuncionario || permiso.nombre || 'Sin nombre';
    const rut = permiso.rut || 'N/A';
    const horas = calcularHorasPermiso(permiso);
    const motivoLower = (permiso.motivo || '').toLowerCase();

    if (!acc[nombre]) {
      acc[nombre] = {
        nombre,
        rut,
        cantidadPermisos: 0,
        particulares: 0,
        medico: 0,
        administrativo: 0,
        conciliacion: 0,
        asuntosFamiliares: 0,
        gremial: 0,
        otros: 0,
        totalHoras: 0,
        horasADescuentar: 0,
      };
    }

    acc[nombre].cantidadPermisos += 1;

    // Clasificación estricta de motivos
    if (motivoLower.includes('particular')) {
      acc[nombre].particulares += horas;
    } else if (motivoLower.includes('médico') || motivoLower.includes('medico')) {
      acc[nombre].medico += horas;
    } else if (motivoLower.includes('administrativo')) {
      acc[nombre].administrativo += horas;
    } else if (motivoLower.includes('conciliación') || motivoLower.includes('conciliacion')) {
      acc[nombre].conciliacion += horas;
    } else if (motivoLower.includes('familiar') || motivoLower.includes('asuntos familiares')) {
      acc[nombre].asuntosFamiliares += horas;
    } else if (motivoLower.includes('gremial')) {
      acc[nombre].gremial += horas;
    } else {
      acc[nombre].otros += horas;
    }

    acc[nombre].totalHoras += horas;

    // Cálculo de horas a descontar: Particulares + Administrativo + Asuntos Familiares + Otros
    acc[nombre].horasADescuentar = 
      acc[nombre].particulares + 
      acc[nombre].administrativo + 
      acc[nombre].asuntosFamiliares + 
      acc[nombre].otros;

    return acc;
  }, {} as Record<string, { 
    nombre: string; 
    rut: string; 
    cantidadPermisos: number; 
    particulares: number;
    medico: number;
    administrativo: number;
    conciliacion: number;
    asuntosFamiliares: number;
    gremial: number;
    otros: number;
    totalHoras: number;
    horasADescuentar: number;
  }>);

  const datosResumen = Object.values(resumenPorPersona);

  // 4. KPIs del mes
  const totalPermisosMes = permisosDelMes.length;
  const sumaGlobalHoras = permisosDelMes.reduce((sum, p: any) => sum + calcularHorasPermiso(p), 0);
  const funcionarioConMasHoras = datosResumen.reduce((max, curr) => 
    curr.totalHoras > (max?.totalHoras || 0) ? curr : max, datosResumen[0]
  );

  // 5. Exportar a Excel (CSV)
  const exportarAExcel = () => {
    if (datosResumen.length === 0) {
      alert('No hay datos para exportar en este mes.');
      return;
    }

    const headers = [
      'Funcionario', 'RUT', 'Total Permisos', 'Particulares (hrs)', 'Médico (hrs)', 
      'Administrativo (hrs)', 'Conciliación (hrs)', 'Asuntos Familiares (hrs)', 
      'Gremial (hrs)', 'Otros (hrs)', 'Suma Total (hrs)', 'Horas a Descontar (hrs)'
    ];
    
    const rows = datosResumen.map(d => [
      `"${d.nombre}"`,
      `"${d.rut}"`,
      d.cantidadPermisos,
      d.particulares.toFixed(1),
      d.medico.toFixed(1),
      d.administrativo.toFixed(1),
      d.conciliacion.toFixed(1),
      d.asuntosFamiliares.toFixed(1),
      d.gremial.toFixed(1),
      d.otros.toFixed(1),
      d.totalHoras.toFixed(1),
      d.horasADescuentar.toFixed(1)
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + 
      [headers.join(';'), ...rows.map(e => e.join(';'))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `resumen_permisos_${mesSeleccionado}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Tarjetas de Estadísticas / KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl shadow-sm border border-[#E6E0D5]">
          <p className="text-sm font-medium text-[#795548]">Total Permisos del Mes</p>
          <p className="text-2xl font-bold text-[#8B5A2B] mt-1">{totalPermisosMes}</p>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-[#E6E0D5]">
          <p className="text-sm font-medium text-[#795548]">Suma Global de Horas</p>
          <p className="text-2xl font-bold text-[#2C241D] mt-1">{sumaGlobalHoras.toFixed(1)} hrs</p>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-[#E6E0D5]">
          <p className="text-sm font-medium text-[#795548]">Funcionario con más horas</p>
          <p className="text-sm font-bold text-[#2C241D] mt-1 break-words leading-tight" title={funcionarioConMasHoras ? funcionarioConMasHoras.nombre : 'Ninguno'}>
            {funcionarioConMasHoras ? `${funcionarioConMasHoras.nombre} (${funcionarioConMasHoras.totalHoras.toFixed(1)}h)` : 'N/A'}
          </p>
        </div>
      </div>

      {/* Controles de Filtro y Exportación */}
      <div className="bg-white p-6 rounded-xl shadow-md border border-[#E6E0D5] flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex flex-col sm:flex-row items-center gap-4 w-full md:w-auto">
          <div>
            <label className="block text-xs font-semibold text-[#795548] uppercase mb-1">Seleccionar Mes</label>
            <input 
              type="month" 
              value={mesSeleccionado} 
              onChange={(e) => setMesSeleccionado(e.target.value)}
              className="border border-[#D7CCC8] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#8B5A2B] bg-[#FDFBF7]"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#795548] uppercase mb-1">Filtrar Funcionario</label>
            <input 
              type="text"
              placeholder="Buscar por nombre..."
              value={busquedaFuncionario}
              onChange={(e) => setBusquedaFuncionario(e.target.value)}
              className="border border-[#D7CCC8] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#8B5A2B] w-full sm:w-60 bg-[#FDFBF7]"
            />
          </div>
        </div>

        <button
          onClick={exportarAExcel}
          className="w-full md:w-auto bg-[#6B8E23] hover:bg-[#556B2F] text-white font-semibold px-4 py-2.5 rounded-lg text-sm shadow transition flex items-center justify-center gap-2 cursor-pointer"
        >
          📊 Exportar a Excel (CSV)
        </button>
      </div>

      {/* Tabla Dinámica Agrupada con Desglose por Motivo */}
      <div className="bg-white rounded-xl shadow-md border border-[#E6E0D5] overflow-hidden">
        <div className="p-4 bg-[#F5F2EB] border-b border-[#E6E0D5]">
          <h3 className="font-bold text-sm text-[#5C4033]">Acumulado por Trabajador - Periodo {mesSeleccionado} (1 día = 8.5 hrs)</h3>
        </div>
        <div className="max-h-[450px] overflow-y-auto">
          <table className="min-w-full divide-y divide-[#E6E0D5]">
            <thead className="bg-[#EBE5D8] sticky top-0 z-10 shadow-sm">
              <tr>
                <th className="py-1.5 px-1.5 text-left text-[9px] font-semibold text-[#5C4033] uppercase">Funcionario</th>
                <th className="py-1.5 px-1.5 text-left text-[9px] font-semibold text-[#5C4033] uppercase">RUT</th>
                <th className="py-1.5 px-1.5 text-center text-[9px] font-semibold text-[#5C4033] uppercase">Total Permisos</th>
                <th className="py-1.5 px-1.5 text-center text-[9px] font-semibold text-[#5C4033] uppercase">Particulares</th>
                <th className="py-1.5 px-1.5 text-center text-[9px] font-semibold text-[#5C4033] uppercase">Médico</th>
                <th className="py-1.5 px-1.5 text-center text-[9px] font-semibold text-[#5C4033] uppercase">Administrativo</th>
                <th className="py-1.5 px-1.5 text-center text-[9px] font-semibold text-[#5C4033] uppercase">Conciliación</th>
                <th className="py-1.5 px-1.5 text-center text-[9px] font-semibold text-[#5C4033] uppercase">Asuntos Familiares</th>
                <th className="py-1.5 px-1.5 text-center text-[9px] font-semibold text-[#5C4033] uppercase">Gremial</th>
                <th className="py-1.5 px-1.5 text-center text-[9px] font-semibold text-[#5C4033] uppercase">Otros</th>
                <th className="py-1.5 px-1.5 text-right text-[9px] font-semibold text-[#5C4033] uppercase">Suma Total</th>
                <th className="py-1.5 px-1.5 text-right text-[9px] font-semibold text-red-700 uppercase bg-[#F5E6E0]">Horas a Descontar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E6E0D5] text-[9px] text-[#2C241D]">
              {datosResumen.length > 0 ? (
                datosResumen.map((item, index) => (
                  <tr key={index} className="hover:bg-[#FDFBF7]">
                    <td className="py-1.5 px-1.5 font-medium">{item.nombre}</td>
                    <td className="py-1.5 px-1.5 text-[#795548]">{item.rut}</td>
                    <td className="py-1.5 px-1.5 text-center">
                      <span className="bg-[#EBE5D8] text-[#5C4033] text-[9px] font-semibold px-1.5 py-0.5 rounded-full">
                        {item.cantidadPermisos}
                      </span>
                    </td>
                    <td className="py-1.5 px-1.5 text-center text-[#795548]">{item.particulares > 0 ? `${item.particulares.toFixed(1)} hrs` : '-'}</td>
                    <td className="py-1.5 px-1.5 text-center text-[#795548]">{item.medico > 0 ? `${item.medico.toFixed(1)} hrs` : '-'}</td>
                    <td className="py-1.5 px-1.5 text-center text-[#795548]">{item.administrativo > 0 ? `${item.administrativo.toFixed(1)} hrs` : '-'}</td>
                    <td className="py-1.5 px-1.5 text-center text-[#795548]">{item.conciliacion > 0 ? `${item.conciliacion.toFixed(1)} hrs` : '-'}</td>
                    <td className="py-1.5 px-1.5 text-center text-[#795548]">{item.asuntosFamiliares > 0 ? `${item.asuntosFamiliares.toFixed(1)} hrs` : '-'}</td>
                    <td className="py-1.5 px-1.5 text-center text-[#795548]">{item.gremial > 0 ? `${item.gremial.toFixed(1)} hrs` : '-'}</td>
                    <td className="py-1.5 px-1.5 text-center text-[#795548]">{item.otros > 0 ? `${item.otros.toFixed(1)} hrs` : '-'}</td>
                    <td className="py-1.5 px-1.5 text-right font-bold text-[#8B5A2B]">{item.totalHoras.toFixed(1)} hrs</td>
                    <td className="py-1.5 px-1.5 text-right font-bold text-red-700 bg-[#FDF5F2]">{item.horasADescuentar.toFixed(1)} hrs</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={12} className="py-8 text-center text-[#795548]">
                    No se encontraron registros para este mes ({mesSeleccionado}).
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};