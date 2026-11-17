import React, { useState } from 'react';
import {
  BookOpen,
  MapPin,
  Map,
  Volume2,
  Backpack,
  PhoneCall,
  Send,
  Radio,
  Download,
  ShieldAlert,
  ChevronRight,
  Smartphone,
  Sun,
  Moon,
  Search,
  Navigation,
  AlertCircle,
  RefreshCw,
  Maximize2,
  Crosshair,
  BellOff,
  ZoomIn,
} from 'lucide-react';
import { AppTab } from '../App';

interface ManualUsoProps {
  onNavigateTab: (tab: AppTab) => void;
  onOpenDownloadModal: () => void;
  onOpenSos: () => void;
  onOpenPhones: () => void;
  onOpenLiveNews: () => void;
}

export const ManualUso: React.FC<ManualUsoProps> = ({
  onNavigateTab,
  onOpenDownloadModal,
  onOpenSos,
  onOpenPhones,
  onOpenLiveNews,
}) => {
  const [activeSection, setActiveSection] = useState<string>('intro');

  const manualSections = [
    {
      id: 'intro',
      title: '1. Acceso, Portada y Navegación General',
      icon: ShieldAlert,
      tag: 'General',
    },
    {
      id: 'ubicacion',
      title: '2. Ubicación, GPS y Evaluación Multirriesgo',
      icon: MapPin,
      tag: '1893 Dist.',
    },
    {
      id: 'reportes',
      title: '3. Reportes 24h (8 Entidades) y Noticias en Vivo',
      icon: Radio,
      tag: 'Tiempo Real',
    },
    {
      id: 'mapa',
      title: '4. Cartografía y Rutas de Evacuación',
      icon: Map,
      tag: 'Leaflet',
    },
    {
      id: 'alarma',
      title: '5. Alarma Sísmica SASPe y Segundo Plano',
      icon: Volume2,
      tag: 'SASPe 24/7',
    },
    {
      id: 'infografias',
      title: '6. Infografías y Protocolos Oficiales INDECI',
      icon: BookOpen,
      tag: 'Prevención',
    },
    {
      id: 'mochila',
      title: '7. Mochila de Emergencia (72 Horas)',
      icon: Backpack,
      tag: 'Checklist',
    },
    {
      id: 'sos',
      title: '8. Central SOS Offline y Directorio Nacional',
      icon: PhoneCall,
      tag: 'Rescate',
    },
    {
      id: 'instalacion',
      title: '9. Instalación Offline (PWA) y Actualizaciones',
      icon: Download,
      tag: 'Web/App',
    },
  ];

  return (
    <div id="seccion-manual-de-uso" className="space-y-6">
      {/* Hero Header del Manual */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white rounded-2xl p-6 sm:p-8 border border-slate-700 shadow-md">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-red-600/30 border border-red-500/50 flex items-center justify-center text-red-400 shrink-0">
              <BookOpen className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-red-500/20 text-red-300 border border-red-500/30 text-[10px] font-bold uppercase tracking-wider">
                  Guía Oficial del Usuario
                </span>
                <span className="text-xs text-slate-400">Edición 2026</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black mt-1">
                Manual de Uso y Operaciones del Sistema
              </h2>
              <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-2xl leading-relaxed">
                Guía completa de todas las herramientas de SAPDENP: ingreso rápido, geolocalización de 1,893 distritos, reportes oficiales 24h, cartografía Leaflet, alarma sísmica SASPe, infografías INDECI, mochila 72h, mensajería SOS sin internet e instalación PWA.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onOpenDownloadModal}
              className="px-3.5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs flex items-center gap-2 transition-colors cursor-pointer shadow-xs"
            >
              <Download className="w-4 h-4" />
              <span>Instalar App Offline</span>
            </button>
          </div>
        </div>
      </div>

      {/* Grid: Navigation Sidebar & Content */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Sidebar Index */}
        <div className="lg:col-span-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm space-y-1.5 sticky top-20">
          <div className="px-2 py-1.5 mb-2 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Módulos del Manual
            </span>
            <span className="text-[10px] font-semibold text-red-600">9 Secciones</span>
          </div>

          {manualSections.map((sec) => {
            const Icon = sec.icon;
            const isActive = activeSection === sec.id;
            return (
              <button
                key={sec.id}
                type="button"
                onClick={() => setActiveSection(sec.id)}
                className={`w-full text-left px-3 py-2.5 rounded-lg text-xs font-semibold flex items-center justify-between transition-all cursor-pointer ${
                  isActive
                    ? 'bg-red-600 text-white shadow-xs font-bold'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-500'}`} />
                  <span className="truncate">{sec.title}</span>
                </div>
                <span
                  className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider shrink-0 ml-2 ${
                    isActive
                      ? 'bg-white/20 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                  }`}
                >
                  {sec.tag}
                </span>
              </button>
            );
          })}
        </div>

        {/* Content Panel */}
        <div className="lg:col-span-8 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm text-slate-800 dark:text-slate-200 space-y-6">
          {/* SECCIÓN 1: INTRO, PORTADA Y NAVEGACIÓN */}
          {activeSection === 'intro' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2.5 pb-3 border-b border-slate-200 dark:border-slate-800">
                <ShieldAlert className="w-5 h-5 text-red-600" />
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  1. Acceso, Portada y Navegación General
                </h3>
              </div>
              <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                El <strong>SAPDENP (Sistema de Alerta y Prevención de Desastres Naturales del Perú)</strong> brinda información geocientífica inmediata y herramientas operativas que funcionan incluso sin conexión a internet.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                  <h4 className="font-bold text-xs text-red-600 uppercase tracking-wider mb-1">
                    9 Amenazas Monitoreadas
                  </h4>
                  <p className="text-xs text-slate-600 dark:text-slate-300">
                    Sismo, Tsunami, Huaico / Deslizamiento, Inundación, Helada / Friaje, Sequía, Erupción Volcánica, Viento Fuerte y Granizada.
                  </p>
                </div>
                <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                  <h4 className="font-bold text-xs text-blue-600 uppercase tracking-wider mb-1">
                    Cobertura Nacional Total
                  </h4>
                  <p className="text-xs text-slate-600 dark:text-slate-300">
                    24 departamentos, Provincia Constitucional del Callao, 196 provincias y 1,893 distritos con altitud, microclima y zonas seguras.
                  </p>
                </div>
              </div>

              <div className="space-y-2.5 text-xs text-slate-700 dark:text-slate-300">
                <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                  <strong>Portada de Ingreso:</strong> Puedes entrar con <em>Iniciar Sesión</em>, <em>Registrarse</em> o mediante el botón <strong>"Ingreso Rápido de Emergencia (Sin Registro)"</strong>. Tu sesión se conserva al recargar la página y, al pulsar <strong>"Salir"</strong>, se mantiene guardada tu última ubicación fijada o geolocalizada.
                </div>
                <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 flex items-start gap-2.5">
                  <div className="flex items-center gap-1 shrink-0 pt-0.5 text-amber-500">
                    <Sun className="w-4 h-4" />
                    <Moon className="w-4 h-4 text-blue-400" />
                  </div>
                  <div>
                    <strong>Barra Superior y Modo Claro / Oscuro:</strong> Desde el encabezado accedes en un clic al <strong>Escudo Oficial SAPDENP</strong> (ampliable), <strong>Instalar App</strong>, <strong>Noticias</strong> en vivo, botón rápido <strong>SOS</strong>, directorio <strong>105 / 116 / 106</strong>, este <strong>Manual de Uso</strong>, <strong>Términos y Medalla</strong> (con insignia ampliable de autoría) y el selector de <strong>Modo Claro / Oscuro</strong> (detecta el tema del dispositivo o recuerda tu preferencia).
                  </div>
                </div>
                <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                  <strong>5 Pestañas y Botón Atrás Inteligente:</strong> Navega entre <em>Ubicación y Riesgos</em>, <em>Mapa y Evacuación</em>, <em>Infografías y Protocolos</em>, <em>Mochila de Emergencia</em> y <em>Central SOS y Teléfonos</em>. El botón "Atrás" del navegador o celular cierra ventanas abiertas o regresa a la pestaña anterior sin cerrar la aplicación.
                </div>
              </div>
            </div>
          )}

          {/* SECCIÓN 2: UBICACIÓN, GPS Y EVALUACIÓN MULTIRRIESGO */}
          {activeSection === 'ubicacion' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2.5 pb-3 border-b border-slate-200 dark:border-slate-800">
                <MapPin className="w-5 h-5 text-red-600" />
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  2. Ubicación, GPS y Evaluación Multirriesgo
                </h3>
              </div>
              <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                La pestaña <strong>"Ubicación y Riesgos"</strong> calibra todo el sistema (reportes, mapa, protocolos y mochila) a tu jurisdicción exacta:
              </p>

              <div className="space-y-2.5 text-xs text-slate-700 dark:text-slate-300">
                <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 flex items-start gap-2.5">
                  <Search className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <div>
                    <strong>Buscador Instantáneo:</strong> Escribe cualquier departamento, provincia o distrito (ej. <em>Chosica, Callao, Ubinas, Puno</em>) en la barra de búsqueda para elegirlo al instante desde la lista desplegable de coincidencias.
                  </div>
                </div>
                <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                  <strong>Selector Territorial en Cascada:</strong> Selecciona manualmente <strong>Departamento (24 + Callao)</strong>, <strong>Provincia</strong> y <strong>Distrito</strong>. El panel muestra de inmediato la región natural, desastres identificados, microclima, altitud (m s. n. m.) y coordenadas GPS.
                </div>
                <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 flex items-start gap-2.5">
                  <Navigation className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                  <div>
                    <strong>Botón "GEOLOCALIZAR AHORA":</strong> Usa el GPS de tu dispositivo para detectar automáticamente el distrito más cercano, fijar tus coordenadas exactas y recordar tu jurisdicción al volver a abrir la app.
                  </div>
                </div>
                <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                  <strong>Evaluación Multirriesgo Distrital y Accesos Rápidos:</strong> Selecciona cualquiera de los desastres prioritarios de tu zona para consultar su <em>Nivel de Riesgo</em>, <em>Aviso SAT</em>, <em>Causa Geofísica Principal</em>, <em>Acciones Clave Recomendadas por INDECI</em> y abrir su infografía con <strong>"Ver Infografía Oficial"</strong>. El panel lateral ofrece accesos directos al Mapa, Infografía, Mochila y estado de redes nacionales.
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => onNavigateTab('ubicacion')}
                  className="px-4 py-2 bg-slate-900 dark:bg-white dark:text-slate-900 text-white font-bold text-xs rounded-lg flex items-center gap-2 transition-colors cursor-pointer"
                >
                  <span>Ir a Ubicación y Riesgos</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* SECCIÓN 3: REPORTES 24H Y NOTICIAS EN VIVO */}
          {activeSection === 'reportes' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2.5 pb-3 border-b border-slate-200 dark:border-slate-800">
                <Radio className="w-5 h-5 text-red-600" />
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  3. Reportes 24h (8 Entidades) y Noticias en Vivo
                </h3>
              </div>
              <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                El módulo <strong>"Reportes - Boletines - Alerta - Comunicados de las últimas 24 horas"</strong> sincroniza información oficial de las <strong>8 entidades del SINAGERD</strong> en orden estricto: <strong>IGP, SENAMHI, INDECI, COEN, ENFEN, CENEPRED, DHN</strong> (en zonas con acceso marítimo) y <strong>SIGRID</strong>.
              </p>

              <div className="space-y-2.5 text-xs text-slate-700 dark:text-slate-300">
                <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                  <strong>Filtro Local vs. Reportes Regionales:</strong> Alterna entre las pestañas <strong>"Filtro Local 24h"</strong> (estricto para tu distrito y provincia) y <strong>"Reportes de las últimas 24 horas de la región"</strong> (eventos de todo tu departamento), además de filtrar por tipo de desastre.
                </div>
                <div className="p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-red-700 dark:text-red-300">Alerta Visual "¡Sismo 24h!" / "¡SISMO EN SU REGIÓN (24H)!":</strong> Si el CENSIS-IGP registró un sismo en tu departamento durante las últimas 24 horas, aparece un indicador pulsante en la pestaña principal, la barra de jurisdicción y Reportes 24h. Al hacer clic te lleva y filtra los eventos sísmicos regionales.
                  </div>
                </div>
                <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                  <strong>Acciones en Cada Tarjeta de Reporte:</strong> Cada ficha muestra entidad, severidad, referencia, fecha/hora local, coordenadas, profundidad, intensidad y medida preventiva INDECI. Puedes:
                  <ul className="list-disc list-inside mt-1.5 space-y-1">
                    <li>Pulsar <strong>"Protocolo de Emergencia ... → Ir a Evaluación Multirriesgo Distrital"</strong> para activar y revisar el protocolo correspondiente.</li>
                    <li>Desplegar <strong>"Ver detalles oficiales completos emitidos"</strong> con parámetros técnicos verificados.</li>
                    <li><strong>Descargar</strong> reportes oficiales en PDF (IGP, SENAMHI, COEN/INDECI, CENEPRED/SIGRID, DHN) o ficha técnica, <strong>Compartir</strong> el comunicado, abrir su <strong>Infografía</strong> o ir al portal directo con <strong>"Ver Evento en IGP" / "Reporte Oficial"</strong>.</li>
                  </ul>
                </div>
                <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                  <strong>Noticias en Vivo:</strong> Pulsa el botón <strong>"Noticias"</strong> (encabezado), <strong>"Monitoreo Oficial en Vivo"</strong> o la barra inferior fija <strong>"NOTICIAS EN VIVO"</strong> para ver comunicados filtrables por entidad y acceder directo a sus páginas web oficiales.
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={onOpenLiveNews}
                  className="px-4 py-2 bg-slate-900 dark:bg-white dark:text-slate-900 text-white font-bold text-xs rounded-lg flex items-center gap-2 transition-colors cursor-pointer"
                >
                  <Radio className="w-4 h-4 text-red-400" />
                  <span>Ver Noticias y Fuentes en Vivo</span>
                </button>
              </div>
            </div>
          )}

          {/* SECCIÓN 4: MAPA */}
          {activeSection === 'mapa' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2.5 pb-3 border-b border-slate-200 dark:border-slate-800">
                <Map className="w-5 h-5 text-red-600" />
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  4. Cartografía y Rutas de Evacuación (Leaflet)
                </h3>
              </div>
              <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                La pestaña <strong>"Mapa y Evacuación"</strong> integra un visor cartográfico interactivo basado en Leaflet (IGN Perú / OpenStreetMap / ESRI):
              </p>
              <ul className="space-y-2 text-xs text-slate-700 dark:text-slate-300 list-disc list-inside">
                <li><strong>3 Capas Cartográficas:</strong> Alterna entre vista de <strong>Calles</strong> (OpenStreetMap), <strong>Topográfico</strong> (Esri World Topo) y <strong>Satélite</strong> (Esri World Imagery).</li>
                <li><strong>Panorama Nacional vs. Distrito:</strong> Usa <strong>"Ver Todo el Perú (24 Dptos)"</strong> / <strong>"Enfocar Mi Distrito"</strong> para visualizar las capitales departamentales y Callao o centrar el mapa en tu jurisdicción.</li>
                <li><strong>Rutas Activas (3) y Zonas Seguras:</strong> Activa o desactiva las 3 rutas hacia las <em>Zonas Seguras Designadas</em> del distrito (calculando distancia en metros y tiempo estimado a pie desde tu GPS o sede municipal). Haz clic en cualquier tarjeta del panel lateral o marcador para resaltar su ruta.</li>
                <li><strong>Perímetros de Evacuación:</strong> Círculos de evacuación inmediata (500 m) y zona de influencia extendida (1,000 m) alrededor de la sede distrital.</li>
              </ul>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 flex items-start gap-2">
                  <Maximize2 className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <div>
                    <strong>Visión Completa:</strong> Expande el mapa a pantalla completa (sal con <strong>ESC</strong> o el botón <em>Regresar</em>).
                  </div>
                </div>
                <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 flex items-start gap-2">
                  <Crosshair className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                  <div>
                    <strong>Mira GPS y Controles:</strong> Fija tu ubicación GPS real en el mapa (<em>"Tú estás aquí"</em> con radio de precisión), usa Zoom +/- o recentra al distrito.
                  </div>
                </div>
              </div>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => onNavigateTab('mapa')}
                  className="px-4 py-2 bg-slate-900 dark:bg-white dark:text-slate-900 text-white font-bold text-xs rounded-lg flex items-center gap-2 transition-colors cursor-pointer"
                >
                  <span>Abrir Mapa Interactivo</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* SECCIÓN 5: ALARMA SÍSMICA SASPE */}
          {activeSection === 'alarma' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2.5 pb-3 border-b border-slate-200 dark:border-slate-800">
                <Volume2 className="w-5 h-5 text-red-600" />
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  5. Alarma Sísmica SASPe y Segundo Plano
                </h3>
              </div>
              <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                La barra superior <strong>"Red Sísmica SASPE / IGP"</strong> mantiene monitoreo continuo 24/7 en tiempo real (conexión directa SSE + sondeo cada 10s + caché local sin internet) sincronizado con tu distrito o ubicación GPS.
              </p>
              <div className="space-y-2.5 text-xs text-slate-700 dark:text-slate-300">
                <div className="p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg">
                  <strong className="text-red-700 dark:text-red-300">Disparo Automático SASPe:</strong> Se activa automáticamente ante alertas oficiales SASPe (M ≥ 6.0 hasta 650 km) o sismos recientes dentro del radio de impacto geográfico de tu jurisdicción, reproduciendo la sirena oficial en bucle, vibración continua y notificación del sistema con acceso directo al reporte del IGP.
                </div>
                <div className="p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg">
                  <strong>Segundo Plano y Pantalla Encendida:</strong> Utiliza audio precargado (y sirena sintetizada de respaldo), <em>MediaSession</em> y <em>Wake Lock</em> para seguir alertando aunque la pantalla se bloquee o cambies de pestaña.
                </div>
                <div className="p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg flex items-start gap-2.5">
                  <BellOff className="w-4 h-4 text-slate-600 dark:text-slate-300 shrink-0 mt-0.5" />
                  <div>
                    <strong>Prueba y Desactivación:</strong> Pulsa el botón <strong>"Alarma Sísmica (prueba)"</strong> para simular un sismo M 6.3 en tu ubicación y verificar sonido y vibración. Con la alarma roja activa (muestra magnitud, distancia y tiempo transcurrido), pulsa <strong>"DESACTIVAR ALARMA"</strong> para silenciarla y marcar el evento como atendido.
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* SECCIÓN 6: INFOGRAFÍAS */}
          {activeSection === 'infografias' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2.5 pb-3 border-b border-slate-200 dark:border-slate-800">
                <BookOpen className="w-5 h-5 text-red-600" />
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  6. Infografías y Protocolos Oficiales INDECI
                </h3>
              </div>
              <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                La pestaña <strong>"Infografías y Protocolos"</strong> presenta las láminas gráficas oficiales de Defensa Civil / INDECI sincronizadas con las amenazas predominantes de tu provincia:
              </p>
              <div className="space-y-2.5 text-xs text-slate-700 dark:text-slate-300">
                <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                  <strong>Selector Rápido por Amenaza:</strong> Cambia entre las láminas disponibles para tu zona (Sismo, Tsunami, Huaico / Deslizamiento, Inundación, Volcán, Helada / Friaje, Sequía, Viento Fuerte y Granizada).
                </div>
                <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 flex items-start gap-2">
                  <ZoomIn className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <div>
                    <strong>Pantalla Completa y Descarga:</strong> Haz clic en la imagen o en <strong>"Ver en Pantalla Completa"</strong> para ampliarla al 100% y utilizar el botón de descarga para guardarla en tu dispositivo.
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg">
                  <span className="font-bold text-amber-700 dark:text-amber-300 block mb-1">1. PREPÁRATE (Antes)</span>
                  Identifica zonas seguras internas, elabora tu plan familiar y ten lista tu mochila de emergencia.
                </div>
                <div className="p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg">
                  <span className="font-bold text-red-700 dark:text-red-300 block mb-1">2. UBÍCATE (Durante)</span>
                  Mantén la calma, aléjate de ventanas, postes o repisas, y protégete en columnas o muros portantes.
                </div>
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-lg">
                  <span className="font-bold text-emerald-700 dark:text-emerald-300 block mb-1">3. EVACÚA (Después)</span>
                  Desconecta gas y electricidad, camina con paso firme hacia el punto de reunión sin utilizar ascensores.
                </div>
              </div>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => onNavigateTab('infografias')}
                  className="px-4 py-2 bg-slate-900 dark:bg-white dark:text-slate-900 text-white font-bold text-xs rounded-lg flex items-center gap-2 transition-colors cursor-pointer"
                >
                  <span>Ver Infografías Oficiales</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* SECCIÓN 7: MOCHILA */}
          {activeSection === 'mochila' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2.5 pb-3 border-b border-slate-200 dark:border-slate-800">
                <Backpack className="w-5 h-5 text-red-600" />
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  7. Mochila de Emergencia (72 Horas)
                </h3>
              </div>
              <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                La pestaña <strong>"Mochila de Emergencia"</strong> adapta dinámicamente la lista de insumos bajo norma INDECI 72h según tu distrito y la amenaza seleccionada, guardando tu avance automáticamente en el dispositivo:
              </p>
              <ul className="space-y-2 text-xs text-slate-700 dark:text-slate-300 list-disc list-inside">
                <li><strong>Progreso y Prioridades:</strong> Visualiza la barra de porcentaje familiar y distingue entre artículos <em>Obligatorios</em> y <em>Recomendados</em> por categoría (agua, alimentos, botiquín, bioseguridad, herramientas y abrigo).</li>
                <li><strong>Filtros Interactivos:</strong> Alterna entre <strong>Todos</strong>, <strong>Pendientes</strong> y <strong>Completados</strong>; toca cada tarjeta para marcar o desmarcar artículos.</li>
                <li><strong>Botones "Reiniciar" y "Completar Todo":</strong> Permite restablecer la lista o completarla al 100%, activando la confirmación visual <strong>"¡CHECKLIST OK!"</strong>.</li>
              </ul>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => onNavigateTab('mochila')}
                  className="px-4 py-2 bg-slate-900 dark:bg-white dark:text-slate-900 text-white font-bold text-xs rounded-lg flex items-center gap-2 transition-colors cursor-pointer"
                >
                  <span>Abrir Checklist de Mochila</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* SECCIÓN 8: CENTRAL SOS Y DIRECTORIO */}
          {activeSection === 'sos' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2.5 pb-3 border-b border-slate-200 dark:border-slate-800">
                <PhoneCall className="w-5 h-5 text-red-600" />
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  8. Central SOS Offline y Directorio Nacional
                </h3>
              </div>
              <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                Disponible desde la pestaña <strong>"Central SOS y Teléfonos"</strong> o desde los botones <strong>SOS</strong> y <strong>105 / 116 / 106</strong> del encabezado, diseñada para operar incluso cuando falla internet:
              </p>

              <div className="space-y-2.5 text-xs text-slate-700 dark:text-slate-300">
                <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                  <strong>Mensajería SOS Offline (SMS):</strong> Configura y guarda localmente tus <strong>2 Contactos de Emergencia</strong>, elige entre <strong>"Necesito ayuda urgente"</strong> o <strong>"Estoy a salvo"</strong>, y selecciona formato <strong>"✓ 100% Offline"</strong> (SMS puro sin enlaces web para redes 2G/3G) o <strong>"Con Link Maps"</strong>. Incluye tus coordenadas GPS reales o distritales y permite:
                  <ul className="list-disc list-inside mt-1.5 space-y-1">
                    <li><strong>"Abrir Mensajes SMS (Elegir de mi Agenda de Contactos)"</strong> o <strong>"Enviar directo al número"</strong>.</li>
                    <li><strong>"Enviar por WhatsApp (requiere internet)"</strong> o <strong>"Copiar texto"</strong> del mensaje preformateado.</li>
                    <li>También puedes usar <strong>"Enviar SMS Directo"</strong> desde la pestaña Central SOS.</li>
                  </ul>
                </div>
                <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                  <strong>7 Centrales Nacionales 24/7 y 8 Portales Científicos:</strong> Marcación directa a <strong>105</strong> (PNP), <strong>116</strong> (Bomberos), <strong>106</strong> (SAMU), <strong>115</strong> (INDECI / COEN), <strong>110</strong> (POLCAR Carreteras), <strong>100</strong> (Línea 100) y <strong>111</strong> (Cruz Roja), junto a enlaces a IGP, SENAMHI, INDECI, COEN, CENEPRED, SIGRID, DHN y ENFEN.
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2.5 text-xs">
                <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 text-center">
                  <span className="text-2xl font-black text-red-600 block">105</span>
                  <span className="font-bold text-slate-900 dark:text-white mt-1 block">Policía Nacional</span>
                </div>
                <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 text-center">
                  <span className="text-2xl font-black text-red-600 block">116</span>
                  <span className="font-bold text-slate-900 dark:text-white mt-1 block">Bomberos Perú</span>
                </div>
                <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 text-center">
                  <span className="text-2xl font-black text-red-600 block">106</span>
                  <span className="font-bold text-slate-900 dark:text-white mt-1 block">SAMU</span>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 pt-2">
                <button
                  type="button"
                  onClick={onOpenSos}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-lg flex items-center gap-2 transition-colors cursor-pointer"
                >
                  <Send className="w-4 h-4" />
                  <span>Abrir Mensajería SOS</span>
                </button>
                <button
                  type="button"
                  onClick={onOpenPhones}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold text-xs rounded-lg flex items-center gap-2 border border-slate-200 dark:border-slate-700 hover:bg-slate-200 transition-colors cursor-pointer"
                >
                  <PhoneCall className="w-4 h-4 text-red-600" />
                  <span>Directorio Telefónico Nacional</span>
                </button>
                <button
                  type="button"
                  onClick={() => onNavigateTab('emergencia')}
                  className="px-4 py-2 bg-slate-900 dark:bg-white dark:text-slate-900 text-white font-bold text-xs rounded-lg flex items-center gap-2 transition-colors cursor-pointer"
                >
                  <span>Ir a Central SOS</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* SECCIÓN 9: INSTALACIÓN PWA Y ACTUALIZACIONES */}
          {activeSection === 'instalacion' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2.5 pb-3 border-b border-slate-200 dark:border-slate-800">
                <Download className="w-5 h-5 text-red-600" />
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  9. Instalación Offline (PWA) y Actualizaciones
                </h3>
              </div>
              <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                SAPDENP es una Progressive Web App (PWA) accesible desde el botón <strong>"Instalar App"</strong> del encabezado o desde la portada de ingreso, preparada para seguir funcionando sin internet:
              </p>

              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-3 text-xs">
                <h4 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Smartphone className="w-4 h-4 text-emerald-500" />
                  <span>Guía por Plataforma (Android • iPhone/iOS • Web/PC):</span>
                </h4>
                <div className="space-y-2">
                  <p>
                    <strong>Android (Chrome / Brave / Edge):</strong> Selecciona la pestaña <em>Android</em> y pulsa <strong>"Instalar Ahora en Android"</strong> (o en el menú ⋮ elige <em>"Instalar aplicación"</em> / <em>"Agregar a la pantalla principal"</em>).
                  </p>
                  <p>
                    <strong>iPhone / iPad (Safari):</strong> Selecciona la pestaña <em>iPhone / iOS</em>; en Safari toca <em>Compartir</em>, elige <em>"Agregar al inicio"</em> y confirma en <em>"Agregar"</em>.
                  </p>
                  <p>
                    <strong>Web / PC (Windows / Mac / Linux):</strong> Selecciona la pestaña <em>Web / PC</em> y pulsa <strong>"Instalar en PC / Mac"</strong> (o el ícono ⨁ en la barra de direcciones).
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-2 text-xs">
                <h4 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 text-blue-500" />
                  <span>Sincronización Continua y Búsqueda Manual de Actualizaciones:</span>
                </h4>
                <p className="text-slate-600 dark:text-slate-300">
                  La app comprueba nuevas versiones automáticamente al abrirse y cada 60 segundos en segundo plano. Desde la ventana de descarga puedes ver la versión instalada, la hora de última comprobación y pulsar <strong>"Buscar Actualización"</strong> para sincronizar al instante sin perder tu ubicación, contactos SOS ni checklist guardados.
                </p>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={onOpenDownloadModal}
                  className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl flex items-center gap-2 shadow-sm transition-colors cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Abrir Ventana de Descarga e Instalación</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

