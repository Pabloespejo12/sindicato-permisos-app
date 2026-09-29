import { useState, useEffect } from 'react';
import type { SolicitudPermiso, EstadoPermiso, TrabajadorNomina, Usuario, RolUsuario } from './types';
import { db } from './firebase';
import { collection, doc, setDoc, addDoc, deleteDoc, updateDoc, onSnapshot } from 'firebase/firestore';

import { FormularioPermiso } from './components/FormularioPermiso';
import { HistorialPermisos } from './components/HistorialPermisos';
import { ComprobantePermiso } from './components/ComprobantePermiso';
import { ResumenMensual } from './components/ResumenMensual';
import { GestionNomina } from './components/GestionNomina';
import { GestionUsuarios } from './components/GestionUsuarios';
import { GestionAutorizados } from './components/GestionAutorizados'; // <-- Nuevo componente de gestión
import { Login } from './components/Login';

// Interfaz local si no está en types.ts
export interface Autorizado {
  id: string;
  nombre: string;
}

export function App() {
  const [usuarioLogueado, setUsuarioLogueado] = useState<Usuario | null>(() => {
    const saved = localStorage.getItem('sindicato_sesion_activa');
    return saved ? JSON.parse(saved) : null;
  });

  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [solicitudes, setSolicitudes] = useState<SolicitudPermiso[]>([]);
  const [nomina, setNomina] = useState<TrabajadorNomina[]>([]);
  const [autorizados, setAutorizados] = useState<Autorizado[]>([]); // <-- Estado para autorizados
  
  const [solicitudSeleccionada, setSolicitudSeleccionada] = useState<SolicitudPermiso | null>(null);
  const [vistaActiva, setVistaActiva] = useState<'gestion' | 'resumen' | 'nomina' | 'usuarios' | 'autorizados'>('gestion');
  const [mostrarAlertaConciliacion, setMostrarAlertaConciliacion] = useState(true);

  useEffect(() => {
    const unsubUsuarios = onSnapshot(collection(db, 'usuarios'), (snapshot) => {
      const listaUsuarios: Usuario[] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Usuario));
      if (listaUsuarios.length === 0) {
        const iniciales: Omit<Usuario, 'id'>[] = [
          { nombre: 'Super Administrador', email: 'super@sindicato.cl', password: '1234', rol: 'superadmin' },
          { nombre: 'Administrador General', email: 'admin@sindicato.cl', password: '1234', rol: 'admin' },
          { nombre: 'Digitador Turno', email: 'digitador@sindicato.cl', password: '1234', rol: 'digitador' },
          { nombre: 'Visualizador Consulta', email: 'visor@sindicato.cl', password: '1234', rol: 'visualizador' },
        ];
        iniciales.forEach(async (u) => {
          await setDoc(doc(collection(db, 'usuarios')), u);
        });
      } else {
        setUsuarios(listaUsuarios);
      }
    });

    const unsubSolicitudes = onSnapshot(collection(db, 'solicitudes'), (snapshot) => {
      const listaSolicitudes: SolicitudPermiso[] = snapshot.docs.map(doc => {
        const data = doc.data() as any;
        return {
          ...data,
          id: data.folioVisual || data.id || doc.id,
          firebaseId: doc.id
        } as SolicitudPermiso;
      });
      setSolicitudes(listaSolicitudes);
    });

    const unsubNomina = onSnapshot(collection(db, 'nomina'), (snapshot) => {
      const listaNomina: TrabajadorNomina[] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TrabajadorNomina));
      if (listaNomina.length === 0) {
        const nominaInicial: Omit<TrabajadorNomina, 'id'>[] = [
          { nombre: 'IVAN SOTO', rut: '1245789-9', cargo: '' },
          { nombre: 'PAMELA DIAZ', rut: '44545412-2', cargo: '' },
          { nombre: 'PABLO ESPEJO C', rut: '12575300-0', cargo: '' },
        ];
        nominaInicial.forEach(async (t) => {
          await setDoc(doc(collection(db, 'nomina')), t);
        });
      } else {
        setNomina(listaNomina);
      }
    });

    // --- SINCRONIZACIÓN DE AUTORIZADOS EN FIREBASE ---
    const unsubAutorizados = onSnapshot(collection(db, 'autorizados'), (snapshot) => {
      const listaAutorizados: Autorizado[] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Autorizado));
      if (listaAutorizados.length === 0) {
        const autorizadosIniciales: Omit<Autorizado, 'id'>[] = [
          { nombre: 'Dr. Javier Pérez' },
          { nombre: 'María Silva (Administración)' }
        ];
        autorizadosIniciales.forEach(async (a) => {
          await setDoc(doc(collection(db, 'autorizados')), a);
        });
      } else {
        setAutorizados(listaAutorizados);
      }
    });

    return () => {
      unsubUsuarios();
      unsubSolicitudes();
      unsubNomina();
      unsubAutorizados();
    };
  }, []);

  useEffect(() => {
    if (usuarioLogueado) {
      localStorage.setItem('sindicato_sesion_activa', JSON.stringify(usuarioLogueado));
    } else {
      localStorage.removeItem('sindicato_sesion_activa');
    }
  }, [usuarioLogueado]);

  if (!usuarioLogueado) {
    return <Login usuarios={usuarios} onIniciarSesion={setUsuarioLogueado} />;
  }

  const rolUsuario = usuarioLogueado.rol;

  const cerrarSesion = () => {
    setUsuarioLogueado(null);
  };

  const anioActual = new Date().getFullYear();
  const horasConciliacionUsadas = solicitudes.filter(sol => {
    const nombreSol = String(sol.nombreTrabajador || '').trim().toLowerCase();
    const nombreLogueado = String(usuarioLogueado.nombre || '').trim().toLowerCase();
    const esDelTrabajador = nombreSol === nombreLogueado;
    const esAnioActual = new Date(sol.fechaInicio).getFullYear() === anioActual;
    const motivoStr = String(sol.motivo || '').toLowerCase().trim();
    return esDelTrabajador && esAnioActual && motivoStr.includes('conciliaci');
  }).reduce((acc, sol) => {
    const cantidadStr = String((sol as any).cantidadHoras || '');
    if (cantidadStr.includes('día')) {
      const dias = parseFloat(cantidadStr) || 1;
      return acc + (dias * 8.5);
    } else {
      const hrs = parseFloat(cantidadStr) || 8.5;
      return acc + hrs;
    }
  }, 0);

  const horasConciliacionRestantes = Math.max(0, 17 - horasConciliacionUsadas);

  const agregarSolicitud = async (nueva: Omit<SolicitudPermiso, 'id'>) => {
    if (rolUsuario === 'visualizador') {
      alert('⚠️ Los visualizadores no tienen permisos para crear solicitudes.');
      return;
    }

    const anioSolicitud = new Date(nueva.fechaInicio).getFullYear();
    const motivoStr = String(nueva.motivo || '').toLowerCase().trim();
    const esConciliacion = motivoStr.includes('conciliaci');

    if (esConciliacion) {
      const trabajadorNuevo = String(nueva.nombreTrabajador || '').trim().toLowerCase();
      const solicitudesAnioColaborador = solicitudes.filter(sol => {
        const mismoTrabajador = String(sol.nombreTrabajador || '').trim().toLowerCase() === trabajadorNuevo;
        const esDelAnio = new Date(sol.fechaInicio).getFullYear() === anioSolicitud;
        const motivoSol = String(sol.motivo || '').toLowerCase().trim();
        return mismoTrabajador && esDelAnio && motivoSol.includes('conciliaci');
      });

      // Calcular horas ya usadas sumando registros anteriores de forma dinámica
      const horasYaUsadas = solicitudesAnioColaborador.reduce((acc, sol) => {
        const cantidadStr = String((sol as any).cantidadHoras || '');
        if (cantidadStr.includes('día')) {
          const dias = parseFloat(cantidadStr) || 1;
          return acc + (dias * 8.5);
        } else {
          const hrs = parseFloat(cantidadStr) || 8.5;
          return acc + hrs;
        }
      }, 0);

      // Calcular horas del nuevo permiso que se quiere agregar
      const cantidadStrNueva = String((nueva as any).cantidadHoras || '');
      let horasNuevas = 8.5;
      if (cantidadStrNueva.includes('día')) {
        const diasNuevos = parseFloat(cantidadStrNueva) || 1;
        // RESTRICCIÓN CORREGIDA: Permite hasta 2 días (17 horas) en una sola solicitud
        if (diasNuevos > 2) {
          alert('❌ Error: Las solicitudes bajo el motivo "Conciliación" no pueden exceder de 2 días en total por solicitud.');
          return;
        }
        horasNuevas = diasNuevos * 8.5;
      } else {
        horasNuevas = parseFloat(cantidadStrNueva) || 8.5;
      }

      if (horasYaUsadas + horasNuevas > 17) {
        alert(`❌ Límite excedido: El colaborador ${nueva.nombreTrabajador} ya cuenta con ${horasYaUsadas} hora(s) de conciliación usadas este año (${anioSolicitud}). El máximo permitido son 17 horas (2 días). Le quedan ${Math.max(0, 17 - horasYaUsadas)} horas disponibles.`);
        return;
      }
    }

    try {
      let maxFolio = 0;
      solicitudes.forEach(sol => {
        const num = parseInt(sol.id, 10);
        if (!isNaN(num) && num > maxFolio) {
          maxFolio = num;
        }
      });
      const nuevoFolio = String(maxFolio + 1).padStart(3, '0');

      await addDoc(collection(db, 'solicitudes'), {
        ...nueva,
        id: nuevoFolio,
        folioVisual: nuevoFolio
      });
      
      alert(`¡Solicitud creada con éxito! Folio asignado: #${nuevoFolio}`);
    } catch (error) {
      console.error("Error al agregar solicitud:", error);
      alert('Hubo un error al guardar en Firebase.');
    }
  };

  const cambiarEstado = async (solicitudItem: any, nuevoEstado: EstadoPermiso) => {
    if (rolUsuario === 'visualizador' || rolUsuario === 'digitador') {
      alert('⚠️ Tu rol actual no tiene permisos para cambiar el estado de las solicitudes.');
      return;
    }
    try {
      const targetId = solicitudItem.firebaseId || solicitudItem.id;
      const docRef = doc(db, 'solicitudes', targetId);
      await updateDoc(docRef, { estado: nuevoEstado });
    } catch (error) {
      console.error("Error al cambiar estado:", error);
      alert('Error al actualizar el estado en Firebase.');
    }
  };

  const eliminarSolicitud = async (solicitudItem: any) => {
    if (rolUsuario !== 'admin' && rolUsuario !== 'superadmin') {
      alert('⚠️ Solo los administradores pueden eliminar registros.');
      return;
    }
    if (window.confirm('¿Estás seguro de eliminar este registro?')) {
      try {
        const targetId = solicitudItem.firebaseId || solicitudItem.id;
        const docRef = doc(db, 'solicitudes', targetId);
        await deleteDoc(docRef);
      } catch (error) {
        console.error("Error al eliminar:", error);
        alert('Error al eliminar de Firebase.');
      }
    }
  };

  const agregarTrabajadorNomina = async (nuevo: Omit<TrabajadorNomina, 'id'>) => {
    if (rolUsuario === 'visualizador') {
      alert('⚠️ Los visualizadores no pueden modificar la nómina.');
      return;
    }
    const rutLimpio = nuevo.rut.trim().toUpperCase();
    if (nomina.some(t => t.rut.trim().toUpperCase() === rutLimpio)) {
      alert(`⚠️ El trabajador con RUT ${nuevo.rut} ya se encuentra registrado.`);
      return;
    }
    try {
      const idUnico = Date.now().toString();
      await setDoc(doc(db, 'nomina', idUnico), { ...nuevo, id: idUnico });
      alert('¡Trabajador agregado a Firebase con éxito!');
    } catch (error) {
      console.error("Error al agregar trabajador:", error);
    }
  };

  const eliminarTrabajadorNomina = async (id: string) => {
    if (rolUsuario !== 'admin' && rolUsuario !== 'superadmin') {
      alert('⚠️ Solo los administradores pueden eliminar trabajadores.');
      return;
    }
    try {
      await deleteDoc(doc(db, 'nomina', id));
    } catch (error) {
      console.error("Error al eliminar trabajador:", error);
    }
  };

  const agregarNominaMasiva = async (nuevosTrabajadores: Omit<TrabajadorNomina, 'id'>[]) => {
    if (rolUsuario === 'visualizador') return;
    let duplicadosCount = 0;

    for (const [index, nuevo] of nuevosTrabajadores.entries()) {
      const rutLimpio = nuevo.rut.trim().toUpperCase();
      if (!nomina.some(t => t.rut.trim().toUpperCase() === rutLimpio)) {
        const idUnico = `${Date.now()}-${index}`;
        await setDoc(doc(db, 'nomina', idUnico), { ...nuevo, id: idUnico });
      } else {
        duplicadosCount++;
      }
    }
    alert(`Carga masiva completada en la nube. Se omitieron ${duplicadosCount} duplicados.`);
  };

  // --- FUNCIONES PARA GESTIÓN DE AUTORIZADOS ---
  const agregarAutorizado = async (nombre: string) => {
    if (rolUsuario === 'visualizador') {
      alert('⚠️ Los visualizadores no pueden modificar los autorizados.');
      return;
    }
    try {
      const idUnico = Date.now().toString();
      await setDoc(doc(db, 'autorizados', idUnico), { id: idUnico, nombre });
      alert('¡Funcionario autorizado agregado con éxito!');
    } catch (error) {
      console.error("Error al agregar autorizado:", error);
    }
  };

  const eliminarAutorizado = async (id: string) => {
    if (rolUsuario !== 'admin' && rolUsuario !== 'superadmin') {
      alert('⚠️ Solo los administradores pueden eliminar autorizados.');
      return;
    }
    try {
      await deleteDoc(doc(db, 'autorizados', id));
    } catch (error) {
      console.error("Error al eliminar autorizado:", error);
    }
  };

  const agregarUsuario = async (nuevo: Omit<Usuario, 'id'>) => {
    if (rolUsuario !== 'superadmin') {
      alert('⚠️ Solo el SuperAdministrador tiene permisos para crear nuevos usuarios.');
      return;
    }
    if (usuarios.some(u => u.email.trim().toLowerCase() === nuevo.email.trim().toLowerCase())) {
      alert('⚠️ Ya existe un usuario registrado con ese correo electrónico.');
      return;
    }
    try {
      const idUnico = Date.now().toString();
      await setDoc(doc(db, 'usuarios', idUnico), { ...nuevo, id: idUnico });
      alert('¡Usuario creado en Firebase con éxito!');
    } catch (error) {
      console.error("Error al crear usuario:", error);
    }
  };

  const cambiarRolUsuario = async (id: string, nuevoRol: RolUsuario) => {
    if (rolUsuario !== 'superadmin') {
      alert('⚠️ Solo el SuperAdmin puede modificar los roles.');
      return;
    }
    try {
      await updateDoc(doc(db, 'usuarios', id), { rol: nuevoRol });
    } catch (error) {
      console.error("Error al cambiar rol:", error);
    }
  };

  const cambiarPasswordUsuario = async (id: string, nuevaPassword: string) => {
    if (rolUsuario !== 'superadmin') {
      alert('⚠️ Solo el SuperAdmin tiene permisos para cambiar contraseñas de usuarios.');
      return;
    }
    try {
      await updateDoc(doc(db, 'usuarios', id), { password: nuevaPassword });
      alert('¡Contraseña actualizada en Firebase con éxito!');
    } catch (error) {
      console.error("Error al cambiar contraseña:", error);
    }
  };

  const eliminarUsuario = async (id: string) => {
    if (rolUsuario !== 'superadmin') {
      alert('⚠️ Solo el SuperAdmin puede eliminar usuarios.');
      return;
    }
    try {
      await deleteDoc(doc(db, 'usuarios', id));
    } catch (error) {
      console.error("Error al eliminar usuario:", error);
    }
  };

  return (
    <div className="min-h-screen bg-[#FDFBF7] text-[#2C241D] relative">
      
      {mostrarAlertaConciliacion && rolUsuario !== 'superadmin' && (
        <div className="fixed bottom-5 right-5 z-50 bg-white border-l-4 border-[#8B5A2B] p-4 rounded-xl shadow-2xl flex items-center gap-4 max-w-sm transition-all duration-300">
          <div>
            <p className="text-xs font-bold text-[#5C4033] uppercase">📅 Conciliación ({anioActual})</p>
            <p className="text-sm text-[#2C241D]">
              Te quedan <span className="font-bold text-[#8B5A2B]">{horasConciliacionRestantes} de 17 horas</span> (2 días) disponibles este año.
            </p>
          </div>
          <button 
            onClick={() => setMostrarAlertaConciliacion(false)}
            className="text-gray-400 hover:text-gray-600 font-bold text-lg cursor-pointer"
          >
            &times;
          </button>
        </div>
      )}

      <div className="sticky top-0 z-40 bg-[#FDFBF7] pt-6 pb-4 px-4 sm:px-6 lg:px-8 shadow-sm">
        <div className="max-w-5xl mx-auto space-y-4">
          
          <div className="bg-white p-3 rounded-xl shadow-md border border-[#E6E0D5] flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm">
              <span className="font-semibold text-[#5C4033]">Sesión Iniciada (Cloud):</span>
              <span className="text-[#8B5A2B] font-bold">{usuarioLogueado.nombre}</span>
              <span className="bg-[#EBE5D8] text-[#5C4033] text-xs px-2 py-0.5 rounded-full uppercase font-semibold">
                {usuarioLogueado.rol}
              </span>
            </div>
            <button
              onClick={cerrarSesion}
              className="bg-red-50 hover:bg-red-100 text-red-700 text-xs font-semibold px-3 py-1.5 rounded-lg border border-red-200 transition cursor-pointer"
            >
              Cerrar Sesión
            </button>
          </div>
          
          <header className="bg-[#5C4033] text-[#FDFBF7] p-6 rounded-xl shadow-md border-b-4 border-[#A0522D]">
            <h1 className="text-2xl font-extrabold tracking-wide">
              Centro Odontológico Sindicato N° 1 Codelco Chile
            </h1>
            <p className="text-sm text-[#D7CCC8] mt-1">
              Sistema de Gestión y Registro Formal de Permisos de Trabajadores
            </p>
          </header>

          <nav className="flex flex-wrap justify-center gap-2 sm:gap-4 bg-[#F5F2EB] p-3 rounded-xl shadow-sm border border-[#E6E0D5]">
            <button
              onClick={() => setVistaActiva('gestion')}
              className={`px-4 sm:px-6 py-2 rounded-lg font-semibold text-sm transition ${
                vistaActiva === 'gestion' ? 'bg-[#8B5A2B] text-white shadow' : 'text-[#5C4033] hover:bg-[#EBE5D8]'
              }`}
            >
              📝 Gestión y Permisos
            </button>
            <button
              onClick={() => setVistaActiva('resumen')}
              className={`px-4 sm:px-6 py-2 rounded-lg font-semibold text-sm transition ${
                vistaActiva === 'resumen' ? 'bg-[#8B5A2B] text-white shadow' : 'text-[#5C4033] hover:bg-[#EBE5D8]'
              }`}
            >
              📊 Resumen Mensual por Horas
            </button>
            {rolUsuario !== 'visualizador' && (
              <>
                <button
                  onClick={() => setVistaActiva('nomina')}
                  className={`px-4 sm:px-6 py-2 rounded-lg font-semibold text-sm transition ${
                    vistaActiva === 'nomina' ? 'bg-[#8B5A2B] text-white shadow' : 'text-[#5C4033] hover:bg-[#EBE5D8]'
                  }`}
                >
                  👥 Gestión de Nómina
                </button>
                <button
                  onClick={() => setVistaActiva('autorizados')}
                  className={`px-4 sm:px-6 py-2 rounded-lg font-semibold text-sm transition ${
                    vistaActiva === 'autorizados' ? 'bg-[#8B5A2B] text-white shadow' : 'text-[#5C4033] hover:bg-[#EBE5D8]'
                  }`}
                >
                  ✍️ Funcionarios Autorizados
                </button>
              </>
            )}
            {rolUsuario === 'superadmin' && (
              <button
                onClick={() => setVistaActiva('usuarios')}
                className={`px-4 sm:px-6 py-2 rounded-lg font-semibold text-sm transition ${
                  vistaActiva === 'usuarios' ? 'bg-[#8B5A2B] text-white shadow' : 'text-[#5C4033] hover:bg-[#EBE5D8]'
                }`}
              >
                🔑 Control de Usuarios
              </button>
            )}
          </nav>

        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <main>
          {vistaActiva === 'gestion' ? (
            <div className="space-y-8">
              {rolUsuario !== 'visualizador' && (
                <FormularioPermiso 
                  onAgregarSolicitud={agregarSolicitud} 
                  nominaPersonal={nomina} 
                  listaAutorizados={autorizados}
                />
              )}
              <HistorialPermisos
                solicitudes={solicitudes}
                onCambiarEstado={(id, estado) => {
                  const encontrada = solicitudes.find(s => s.id === id || (s as any).firebaseId === id);
                  cambiarEstado(encontrada || id, estado);
                }}
                onEliminar={(id) => {
                  const encontrada = solicitudes.find(s => s.id === id || (s as any).firebaseId === id);
                  eliminarSolicitud(encontrada || id);
                }}
                onVerComprobante={(sol) => setSolicitudSeleccionada(sol)}
              />
            </div>
          ) : vistaActiva === 'resumen' ? (
            <ResumenMensual permisos={solicitudes} />
          ) : vistaActiva === 'nomina' ? (
            <GestionNomina
              nomina={nomina}
              onAgregarTrabajador={agregarTrabajadorNomina}
              onEliminarTrabajador={eliminarTrabajadorNomina}
              onCargaMasiva={agregarNominaMasiva}
            />
          ) : vistaActiva === 'autorizados' && rolUsuario !== 'visualizador' ? (
            <GestionAutorizados
              autorizados={autorizados}
              onAgregarAutorizado={agregarAutorizado}
              onEliminarAutorizado={eliminarAutorizado}
            />
          ) : rolUsuario === 'superadmin' && vistaActiva === 'usuarios' ? (
            <GestionUsuarios
              usuarios={usuarios}
              onAgregarUsuario={agregarUsuario}
              onCambiarRolUsuario={cambiarRolUsuario}
              onCambiarPasswordUsuario={cambiarPasswordUsuario}
              onEliminarUsuario={eliminarUsuario}
            />
          ) : null}
        </main>

        {solicitudSeleccionada && (
          <ComprobantePermiso solicitud={solicitudSeleccionada} onCerrar={() => setSolicitudSeleccionada(null)} />
        )}
      </div>
    </div>
  );
}

export default App;