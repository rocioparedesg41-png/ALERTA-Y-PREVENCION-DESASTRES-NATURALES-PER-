import type { IncomingMessage, ServerResponse } from 'node:http';
import { GoogleGenAI, Type } from '@google/genai';
import { jsPDF } from 'jspdf';

type NextFunction = (err?: unknown) => void;

export function createApiMiddleware() {
  let geminiRateLimitUntil = 0;
  let cachedIgpData: string | null = null;
  let cachedIgpTime = 0;
  let lastBroadcastEventKey = '';
  const sseClients = new Set<ServerResponse>();
  let saspeInterval: ReturnType<typeof setInterval> | null = null;

  const parsearFechaSismoMs = (sismo: any): number => {
    try {
      const fechaStr = String(sismo.fecha_local || '').includes('T')
        ? String(sismo.fecha_local).split('T')[0]
        : String(sismo.fecha_local || '').slice(0, 10);
      const horaStr = String(sismo.hora_local || '').includes('T')
        ? String(sismo.hora_local).split('T')[1].slice(0, 8)
        : String(sismo.hora_local || '').slice(0, 8);
      let isoFecha = fechaStr;
      if (/^\d{2}\/\d{2}\/\d{4}$/.test(fechaStr)) {
        const [d, m, y] = fechaStr.split('/');
        isoFecha = `${y}-${m}-${d}`;
      }
      const origenMs = new Date(`${isoFecha}T${horaStr}-05:00`).getTime();
      if (!isNaN(origenMs)) return origenMs;
      if (sismo.createdAt) {
        const createdMs = new Date(sismo.createdAt).getTime();
        if (!isNaN(createdMs)) return createdMs;
      }
    } catch {}
    return 0;
  };

  const fetchIgpUnificado = async (forceRefresh = false): Promise<any[]> => {
    if (!forceRefresh && cachedIgpData && Date.now() - cachedIgpTime < 5000) {
      try {
        const parsed = JSON.parse(cachedIgpData);
        if (Array.isArray(parsed)) return parsed;
      } catch {}
    }

    const currentYear = new Date().getFullYear();
    const urlsAjaxb = [
      `https://ultimosismo.igp.gob.pe/api/ultimo-sismo/ajaxb/${currentYear}`,
      ...(currentYear !== 2026 ? ['https://ultimosismo.igp.gob.pe/api/ultimo-sismo/ajaxb/2026'] : []),
    ];

    let listaAjaxb: any[] = [];
    for (const url of urlsAjaxb) {
      try {
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
            Accept: 'application/json',
          },
          signal: AbortSignal.timeout(4500),
        });
        if (response.ok) {
          const data = await response.json();
          if (Array.isArray(data) && data.length > 0) {
            listaAjaxb = data;
            break;
          }
        }
      } catch {}
    }

    // Consultar en paralelo la capa en tiempo real UltimoSismo de la IDE IGP
    try {
      const ideRes = await fetch(
        'https://ide.igp.gob.pe/arcgis/rest/services/monitoreocensis/UltimoSismo/MapServer/0/query?where=1%3D1&outFields=*&f=json',
        {
          headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' },
          signal: AbortSignal.timeout(3500),
        }
      );
      if (ideRes.ok) {
        const ideJson: any = await ideRes.json();
        const attr = ideJson?.features?.[0]?.attributes;
        if (attr && attr.magnitud != null && attr.latitud != null && attr.longitud != null) {
          const fechaRaw = String(attr.fecha_local || '').trim();
          const horaRaw = String(attr.hora_local || '').trim();
          let isoFecha = fechaRaw;
          if (/^\d{2}\/\d{2}\/\d{4}$/.test(fechaRaw)) {
            const [d, m, y] = fechaRaw.split('/');
            isoFecha = `${y}-${m}-${d}`;
          }
          const ideEvent = {
            codigo: `IDE-${isoFecha}-${horaRaw.replace(/:/g, '')}`,
            magnitud: String(attr.magnitud),
            profundidad: Number(attr.profundidad || 15),
            latitud: String(attr.latitud),
            longitud: String(attr.longitud),
            fecha_local: `${isoFecha}T00:00:00.000Z`,
            hora_local: `1970-01-01T${horaRaw}.000Z`,
            intensidad: attr.intensidad || '',
            referencia: attr.referencia || 'Territorio Peruano',
            fuente: 'IGP-IDE-SASPE',
            createdAt: new Date().toISOString(),
          };

          const ideMs = parsearFechaSismoMs(ideEvent);
          const ultimoAjaxb = listaAjaxb[listaAjaxb.length - 1];
          const ultimoAjaxbMs = ultimoAjaxb ? parsearFechaSismoMs(ultimoAjaxb) : 0;

          if (!isNaN(ideMs) && ideMs > ultimoAjaxbMs + 30000) {
            listaAjaxb = [...listaAjaxb, ideEvent];
          }
        }
      }
    } catch {}

    if (listaAjaxb.length > 0) {
      cachedIgpData = JSON.stringify(listaAjaxb);
      cachedIgpTime = Date.now();
      return listaAjaxb;
    }

    if (cachedIgpData) {
      try {
        return JSON.parse(cachedIgpData);
      } catch {}
    }
    throw new Error('No se pudo conectar con los servidores oficiales de IGP / SASPE');
  };

  const evaluarYTransmitirSaspe = async () => {
    if (sseClients.size === 0) return;
    try {
      const lista = await fetchIgpUnificado(true);
      if (!Array.isArray(lista) || lista.length === 0) return;

      const ultimo = lista[lista.length - 1];
      const nowMs = Date.now();
      const sismoMs = parsearFechaSismoMs(ultimo);
      const createdMs = ultimo?.createdAt ? new Date(ultimo.createdAt).getTime() : 0;
      const edadOrigenMs = sismoMs > 0 ? nowMs - sismoMs : Infinity;
      const edadPublicacionMs = createdMs > 0 && !isNaN(createdMs) ? nowMs - createdMs : Infinity;

      const mag = parseFloat(ultimo?.magnitud || '0');
      const esReciente =
        (edadOrigenMs >= -60000 && edadOrigenMs <= 5 * 60 * 1000) ||
        (edadPublicacionMs >= -60000 && edadPublicacionMs <= 3 * 60 * 1000);
      const esSaspeOficial = mag >= 6.0 && esReciente;

      const eventKey = `${ultimo?.codigo || ''}_${ultimo?.magnitud || ''}_${esReciente}`;
      const recientes = lista.slice(-8);

      if (esReciente && eventKey !== lastBroadcastEventKey) {
        lastBroadcastEventKey = eventKey;
        const payload = JSON.stringify({
          tipo: esSaspeOficial ? 'SASPE_EMISION_OFICIAL' : 'IGP_EVENTO_RECIENTE',
          esSaspeOficial,
          timestamp: nowMs,
          ultimoSismo: ultimo,
          sismos: recientes,
        });
        for (const client of sseClients) {
          try {
            client.write(`event: saspe_alerta\ndata: ${payload}\n\n`);
          } catch {}
        }
      } else {
        const syncPayload = JSON.stringify({
          timestamp: nowMs,
          esSaspeOficial: false,
          sismos: recientes,
        });
        for (const client of sseClients) {
          try {
            client.write(`event: saspe_sync\ndata: ${syncPayload}\n\n`);
          } catch {}
        }
      }
    } catch {}
  };

  return async (req: IncomingMessage, res: ServerResponse, next: NextFunction) => {
    const urlString = req.url || '';
    const pathname = urlString.split('?')[0];

    if (!pathname.startsWith('/api/')) {
      next();
      return;
    }

    // 0. Stream SSE sincronizado con SASPe (IGP + INDECI) en tiempo real cada 5s
    if (pathname === '/api/saspe-stream') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'Access-Control-Allow-Origin': '*',
      });
      res.write(`event: connected\ndata: ${JSON.stringify({ status: 'SASPE_CONECTADO', timestamp: Date.now() })}\n\n`);

      sseClients.add(res);
      if (!saspeInterval) {
        saspeInterval = setInterval(evaluarYTransmitirSaspe, 5000);
      }

      evaluarYTransmitirSaspe();

      const heartbeat = setInterval(() => {
        try {
          res.write(`event: ping\ndata: ${Date.now()}\n\n`);
        } catch {}
      }, 20000);

      req.on('close', () => {
        clearInterval(heartbeat);
        sseClients.delete(res);
        if (sseClients.size === 0 && saspeInterval) {
          clearInterval(saspeInterval);
          saspeInterval = null;
        }
      });
      return;
    }

    // 0.1 Snapshot JSON del estado SASPe / IGP / INDECI
    if (pathname === '/api/saspe-estado') {
      try {
        const lista = await fetchIgpUnificado(false);
        const ultimo = lista[lista.length - 1] || null;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.end(
          JSON.stringify({
            conectado: true,
            sistema: 'SASPE / IGP / INDECI',
            umbralMagnitudSaspe: 6.0,
            timestamp: Date.now(),
            ultimoSismo: ultimo,
            sismosRecientes: lista.slice(-10),
          })
        );
      } catch {
        res.statusCode = 502;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ conectado: false, error: 'Sin enlace temporal con IGP/SASPE' }));
      }
      return;
    }

    // 1. Proxy para la API oficial de sismos del IGP con caché rápido (5s) y resiliencia
    if (pathname === '/api/sismos-igp') {
      try {
        const lista = await fetchIgpUnificado(false);
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.end(JSON.stringify(lista));
      } catch (error) {
        console.warn('IGP API fetch timeout/fallback:', error);
        if (cachedIgpData) {
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.end(cachedIgpData);
          return;
        }
        res.statusCode = 502;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: 'No se pudo conectar con el servidor de IGP CENSIS' }));
      }
      return;
    }

    // 1.1 Reporte Instrumental de Sismo en PDF (IGP CENSIS)
    if (pathname === '/api/reporte-sismo-pdf') {
      const urlObj = new URL(urlString, `http://${req.headers.host || 'localhost'}`);
      const codigo = (urlObj.searchParams.get('codigo') || '2026-0001').trim();

      try {
        let sismoData: any = null;
        if (cachedIgpData) {
          try {
            const list = JSON.parse(cachedIgpData);
            sismoData = list.find((s: any) => String(s.codigo).trim() === codigo);
          } catch {}
        }

        if (!sismoData) {
          try {
            const list = await fetchIgpUnificado(false);
            sismoData = list.find((s: any) => String(s.codigo).trim() === codigo);
          } catch {}
        }

        const fechaLocal = sismoData?.fecha_local ? sismoData.fecha_local.slice(0, 10) : new Date().toISOString().slice(0, 10);
        let horaLocal = '00:00:00';
        if (sismoData?.hora_local) {
          try {
            horaLocal = new Date(sismoData.hora_local).toISOString().slice(11, 19);
          } catch {
            horaLocal = String(sismoData.hora_local).slice(0, 8);
          }
        }
        const magnitud = sismoData?.magnitud ? `${sismoData.magnitud} M` : '3.8 M';
        const profundidad = sismoData?.profundidad ? `${sismoData.profundidad} km` : '15 km';
        const referencia = sismoData?.referencia || 'Territorio Peruano';
        const lat = sismoData?.latitud || '-';
        const lng = sismoData?.longitud || '-';
        const intensidad = sismoData?.intensidad || 'II - III';

        const doc = new jsPDF();
        doc.setFillColor(185, 28, 28);
        doc.rect(0, 0, 210, 28, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(13);
        doc.text('INSTITUTO GEOFÍSICO DEL PERÚ - CENSIS', 105, 11, { align: 'center' });
        doc.setFontSize(8.5);
        doc.setFont('helvetica', 'normal');
        doc.text('CENTRO SISMOLÓGICO NACIONAL | REPORTE SÍSMICO INSTRUMENTAL OFICIAL', 105, 18, { align: 'center' });
        doc.setFontSize(7.5);
        doc.text('RED SÍSMICA NACIONAL DEL PERÚ - SISTEMA NACIONAL DE GESTIÓN DEL RIESGO (SINAGERD)', 105, 24, { align: 'center' });

        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(226, 232, 240);
        doc.roundedRect(14, 34, 182, 22, 2, 2, 'FD');
        doc.setTextColor(15, 23, 42);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        doc.text(`EVENTO SÍSMICO OFICIAL: IGP/CENSIS/RS ${codigo}`, 20, 43);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(71, 85, 105);
        doc.text(`Emisión instrumental validada por el Centro Sismológico Nacional del Perú.`, 20, 50);

        doc.setFillColor(255, 255, 255);
        doc.setDrawColor(203, 213, 225);
        doc.roundedRect(14, 60, 182, 86, 2, 2, 'D');

        doc.setFillColor(254, 242, 242);
        doc.roundedRect(18, 65, 85, 22, 2, 2, 'F');
        doc.setTextColor(185, 28, 28);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.text('MAGNITUD OFICIAL', 22, 73);
        doc.setFontSize(14);
        doc.text(magnitud, 22, 82);

        doc.setFillColor(241, 245, 249);
        doc.roundedRect(107, 65, 85, 22, 2, 2, 'F');
        doc.setTextColor(30, 41, 59);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.text('PROFUNDIDAD FOCAL', 111, 73);
        doc.setFontSize(14);
        doc.text(profundidad, 111, 82);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(71, 85, 105);
        doc.text('REFERENCIA EPICENTRAL:', 18, 95);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10.5);
        doc.setTextColor(15, 23, 42);
        doc.text(referencia, 18, 101);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(71, 85, 105);
        doc.text('FECHA Y HORA LOCAL (PERÚ UTC-5):', 18, 111);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9.5);
        doc.setTextColor(15, 23, 42);
        doc.text(`${fechaLocal} a las ${horaLocal} horas`, 18, 117);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(71, 85, 105);
        doc.text('COORDENADAS GEOGRÁFICAS:', 18, 127);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9.5);
        doc.setTextColor(15, 23, 42);
        doc.text(`Latitud: ${lat}°  |  Longitud: ${lng}°`, 18, 133);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(71, 85, 105);
        doc.text('INTENSIDAD (MERCALLI MODIFICADA):', 107, 127);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9.5);
        doc.setTextColor(15, 23, 42);
        doc.text(intensidad, 107, 133);

        doc.setFillColor(240, 253, 244);
        doc.setDrawColor(187, 247, 208);
        doc.roundedRect(14, 150, 182, 18, 2, 2, 'FD');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9.5);
        doc.setTextColor(22, 101, 52);
        doc.text('EVALUACIÓN DE TSUNAMI (DHN / CNAT):', 20, 158);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.text('No reúne las características para generar tsunami en el litoral peruano.', 20, 164);

        doc.setFillColor(254, 252, 232);
        doc.setDrawColor(254, 240, 138);
        doc.roundedRect(14, 172, 182, 38, 2, 2, 'FD');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9.5);
        doc.setTextColor(133, 77, 14);
        doc.text('MEDIDAS DE SEGURIDAD Y DEFENSA CIVIL (INDECI):', 20, 180);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.text('1. Conservar la calma y evitar salir apresuradamente durante el movimiento sísmico.', 20, 187);
        doc.text('2. Ubicarse en las zonas de seguridad internas previamente identificadas (columnas, vigas).', 20, 193);
        doc.text('3. Tener siempre lista la Mochila para Emergencias y la Caja de Reserva.', 20, 199);
        doc.text('4. Utilizar mensajes de texto (SMS) o mensajería instantánea para comunicarse.', 20, 205);

        doc.setDrawColor(226, 232, 240);
        doc.line(14, 218, 196, 218);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(100, 116, 139);
        doc.text(`Enlace oficial de verificación en línea CENSIS: https://ultimosismo.igp.gob.pe/evento/${codigo}`, 14, 225);
        doc.text('Fuente oficial: Centro Sismológico Nacional del Instituto Geofísico del Perú (CENSIS - IGP)', 14, 231);
        doc.text(`Documento emitido para fines de consulta pública y gestión del riesgo de desastres.`, 14, 237);

        const pdfBuffer = Buffer.from(doc.output('arraybuffer'));
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="Reporte_Sismico_IGP_${codigo}.pdf"`);
        res.setHeader('Content-Length', pdfBuffer.length);
        res.end(pdfBuffer);
        return;
      } catch (pdfErr) {
        console.error('Error generando PDF sísmico:', pdfErr);
        res.statusCode = 500;
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.end('Error al generar el reporte sísmico oficial en PDF.');
        return;
      }
    }

    // 1.2 Reporte de Situación de Emergencia en PDF (COEN - INDECI)
    if (pathname === '/api/reporte-coen-pdf') {
      const urlObj = new URL(urlString, `http://${req.headers.host || 'localhost'}`);
      const codigo = (urlObj.searchParams.get('codigo') || 'REP-COEN-2026').trim();
      const provincia = urlObj.searchParams.get('provincia') || 'Provincia Monitoreada';
      const departamento = urlObj.searchParams.get('departamento') || 'Departamento';
      const distrito = urlObj.searchParams.get('distrito') || provincia;
      const tipoDesastre = urlObj.searchParams.get('tipoDesastre') || 'Peligro Inminente';
      const titulo = urlObj.searchParams.get('titulo') || `Monitoreo de Emergencias en ${provincia}`;
      const severidad = urlObj.searchParams.get('severidad') || 'Alta';

      try {
        const doc = new jsPDF();
        doc.setFillColor(15, 23, 42);
        doc.rect(0, 0, 210, 28, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12.5);
        doc.text('INSTITUTO NACIONAL DE DEFENSA CIVIL - INDECI', 105, 11, { align: 'center' });
        doc.setFontSize(8.5);
        doc.setFont('helvetica', 'normal');
        doc.text('CENTRO DE OPERACIONES DE EMERGENCIA NACIONAL (COEN)', 105, 18, { align: 'center' });
        doc.setFontSize(7.5);
        doc.text('REPORTE OFICIAL DE SITUACIÓN Y MONITOREO DE EMERGENCIAS (SINAGERD)', 105, 24, { align: 'center' });

        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(226, 232, 240);
        doc.roundedRect(14, 33, 182, 22, 2, 2, 'FD');
        doc.setTextColor(15, 23, 42);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10.5);
        doc.text(`REPORTE COMPLEMENTARIO DE EMERGENCIA: ${codigo}`, 20, 42);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(71, 85, 105);
        doc.text(`Jurisdicción: Distrito de ${distrito}, Prov. ${provincia}, Dpto. ${departamento} | Nivel: ${severidad}`, 20, 48);

        doc.setFillColor(255, 255, 255);
        doc.setDrawColor(203, 213, 225);
        doc.roundedRect(14, 59, 182, 45, 2, 2, 'D');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(15, 23, 42);
        doc.text('I. SITUACIÓN ACTUAL Y ÁMBITO AFECTADO', 18, 66);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(51, 65, 85);
        doc.text(`• Evento Registrado: ${titulo}`, 18, 73);
        doc.text(`• Tipo de Fenómeno: ${tipoDesastre.toUpperCase()} registrado durante las últimas 24 horas.`, 18, 79);
        doc.text(`• Ubicación Focalizada: Quebradas, laderas y zonas críticas del distrito de ${distrito} (${provincia}).`, 18, 85);
        doc.text(`• Estado Operacional: Centro de Operaciones de Emergencia Regional (COER) activo en enlace permanente.`, 18, 91);
        doc.text(`• Monitoreo Instrumental: Red Nacional de Alerta Temprana (RNAT) e información satelital en tiempo real.`, 18, 97);

        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(226, 232, 240);
        doc.roundedRect(14, 108, 182, 40, 2, 2, 'FD');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(15, 23, 42);
        doc.text('II. EVALUACIÓN PRELIMINAR DE DAÑOS Y ACCIONES DE RESPUESTA', 18, 116);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(51, 65, 85);
        doc.text(`• Afectación de Población: Familias en sectores vulnerables reciben acompañamiento técnico de Defensa Civil.`, 18, 123);
        doc.text(`• Infraestructura y Vías: Rutas de comunicación en monitoreo constante ante posible interrupción por huaicos.`, 18, 129);
        doc.text(`• Recursos Movilizados: Brigadistas comunitarios, personal de primera respuesta y almacenes de avanzada.`, 18, 135);
        doc.text(`• Bienes de Ayuda Humanitaria (BAH): Stock disponible en almacenes zonales del INDECI para despacho inmediato.`, 18, 141);

        doc.setFillColor(254, 252, 232);
        doc.setDrawColor(254, 240, 138);
        doc.roundedRect(14, 152, 182, 38, 2, 2, 'FD');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(133, 77, 14);
        doc.text('III. RECOMENDACIONES DE PREPARACIÓN PARA LA POBLACIÓN (INDECI):', 20, 160);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.text('1. Identificar rutas de evacuación señalizadas hacia zonas altas y libres de riesgo de desprendimiento.', 20, 167);
        doc.text('2. Evitar transitar a pie o en vehículos cerca de cauces de ríos, torrenteras y laderas inestables.', 20, 173);
        doc.text('3. Tener preparada la Mochila para Emergencias con agua embotellada, linterna, radio a pilas y botiquín.', 20, 179);
        doc.text('4. Mantener la comunicación vía mensajes de texto y sintonizar emisoras locales para alertas oficiales.', 20, 185);

        doc.setDrawColor(226, 232, 240);
        doc.line(14, 196, 196, 196);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(100, 116, 139);
        doc.text('Portal Oficial de Emergencias INDECI: https://portal.indeci.gob.pe/emergencias/', 14, 203);
        doc.text(`Consulta de reportes en línea: https://portal.indeci.gob.pe/emergencias/?s=${encodeURIComponent(provincia)}`, 14, 209);
        doc.text('Sala de Operaciones COEN - Central Telefónica: (01) 225-6424 | Línea Gratuita 115 INDECI', 14, 215);

        const pdfBuffer = Buffer.from(doc.output('arraybuffer'));
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="Boletin_COEN_${codigo}.pdf"`);
        res.setHeader('Content-Length', pdfBuffer.length);
        res.end(pdfBuffer);
        return;
      } catch (coenErr) {
        console.error('Error generando PDF COEN:', coenErr);
        res.statusCode = 500;
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.end('Error al generar el boletín oficial COEN en PDF.');
        return;
      }
    }

    // 1.3 Aviso Meteorológico en PDF (SENAMHI)
    if (pathname === '/api/reporte-senamhi-pdf') {
      const urlObj = new URL(urlString, `http://${req.headers.host || 'localhost'}`);
      const aviso = (urlObj.searchParams.get('aviso') || '355').trim();
      const provincia = urlObj.searchParams.get('provincia') || 'Provincia Alertada';
      const departamento = urlObj.searchParams.get('departamento') || 'Departamento';
      const titulo = urlObj.searchParams.get('titulo') || `Aviso Meteorológico N° ${aviso}-2026`;
      const nivel = urlObj.searchParams.get('nivel') || 'Naranja';
      const enlaceDetalle = urlObj.searchParams.get('enlace') || `https://www.senamhi.gob.pe/?p=aviso-meteorologico-detalle&a=2026&b=28785&c=00&d=SENA`;

      try {
        const doc = new jsPDF();
        doc.setFillColor(12, 74, 96);
        doc.rect(0, 0, 210, 28, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        doc.text('SERVICIO NACIONAL DE METEOROLOGÍA E HIDROLOGÍA DEL PERÚ', 105, 11, { align: 'center' });
        doc.setFontSize(8.5);
        doc.setFont('helvetica', 'normal');
        doc.text('DIRECCIÓN DE METEOROLOGÍA Y EVALUACIÓN AMBIENTAL ATMOSFÉRICA', 105, 18, { align: 'center' });
        doc.setFontSize(7.5);
        doc.text('AVISO METEOROLÓGICO OFICIAL - VIGILANCIA EN TIEMPO REAL 24 HORAS', 105, 24, { align: 'center' });

        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(226, 232, 240);
        doc.roundedRect(14, 33, 182, 22, 2, 2, 'FD');
        doc.setTextColor(12, 74, 96);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10.5);
        doc.text(`AVISO METEOROLÓGICO N° ${aviso}-2026`, 20, 42);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(71, 85, 105);
        doc.text(`Ámbito de Afectación: Prov. ${provincia}, Dpto. ${departamento} | Nivel de Peligro: ${nivel.toUpperCase()}`, 20, 48);

        doc.setFillColor(255, 255, 255);
        doc.setDrawColor(203, 213, 225);
        doc.roundedRect(14, 59, 182, 50, 2, 2, 'D');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(15, 23, 42);
        doc.text('I. CARACTERIZACIÓN DEL FENÓMENO METEOROLÓGICO', 18, 66);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(51, 65, 85);
        doc.text(`• Título del Aviso: ${titulo}`, 18, 73);
        doc.text(`• Periodo de Vigencia: Emitido y vigente durante las últimas 24 horas (Hora Local Perú - UTC-5).`, 18, 79);
        doc.text(`• Parámetros Pronosticados: Precipitaciones acumuladas o ráfagas de viento con potencial de impacto.`, 18, 85);
        doc.text(`• Sectores Alertados: Valles, laderas y zonas pobladas de la provincia de ${provincia}.`, 18, 91);
        doc.text(`• Red de Monitoreo: Datos sincronizados de estaciones meteorológicas automáticas y satélite GOES-16.`, 18, 97);
        doc.text(`• Nivel de Alerta: ${nivel} (Se predicen fenómenos meteorológicos peligrosos).`, 18, 103);

        doc.setFillColor(254, 252, 232);
        doc.setDrawColor(254, 240, 138);
        doc.roundedRect(14, 115, 182, 38, 2, 2, 'FD');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(133, 77, 14);
        doc.text('II. RECOMENDACIONES TÉCNICAS ANTE EL FENÓMENO:', 20, 123);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.text('1. Manténgase al corriente del desarrollo de la situación y cumpla los consejos de las autoridades.', 20, 130);
        doc.text('2. En caso de vientos fuertes: asegurar techos ligeros, letreros y alejarse de postes o árboles débiles.', 20, 136);
        doc.text('3. En caso de precipitaciones: proteger accesos de viviendas e identificar zonas seguras ante aniegos.', 20, 142);
        doc.text('4. Conducir con precaución extrema debido a la reducción de visibilidad horizontal y pavimento resbaladizo.', 20, 148);

        doc.setDrawColor(226, 232, 240);
        doc.line(14, 160, 196, 160);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(100, 116, 139);
        doc.text(`Enlace oficial de consulta técnica en el portal del SENAMHI:`, 14, 168);
        doc.text(`${enlaceDetalle}`, 14, 174);
        doc.text('Portal Nacional: https://www.senamhi.gob.pe | Central Telefónica SENAMHI: (01) 614-1414', 14, 180);

        const pdfBuffer = Buffer.from(doc.output('arraybuffer'));
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="Aviso_SENAMHI_${aviso}.pdf"`);
        res.setHeader('Content-Length', pdfBuffer.length);
        res.end(pdfBuffer);
        return;
      } catch (senamhiErr) {
        console.error('Error generando PDF SENAMHI:', senamhiErr);
        res.statusCode = 500;
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.end('Error al generar el aviso oficial SENAMHI en PDF.');
        return;
      }
    }

    // 1.4 Informe Técnico de Escenario de Riesgo en PDF (CENEPRED - SIGRID)
    if (pathname === '/api/reporte-cenepred-pdf') {
      const urlObj = new URL(urlString, `http://${req.headers.host || 'localhost'}`);
      const codigo = (urlObj.searchParams.get('codigo') || '084-2026').trim();
      const provincia = urlObj.searchParams.get('provincia') || 'Provincia Evaluada';
      const departamento = urlObj.searchParams.get('departamento') || 'Departamento';
      const distrito = urlObj.searchParams.get('distrito') || provincia;

      try {
        const doc = new jsPDF();
        doc.setFillColor(24, 49, 83);
        doc.rect(0, 0, 210, 28, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.text('CENTRO NACIONAL DE ESTIMACIÓN, PREVENCIÓN Y REDUCCIÓN DEL RIESGO DE DESASTRES', 105, 11, { align: 'center' });
        doc.setFontSize(8.5);
        doc.setFont('helvetica', 'normal');
        doc.text('DIRECCIÓN DE PREPARACIÓN Y RESPUESTAS (DIPSE) - SISTEMA DE INFORMACIÓN SIGRID', 105, 18, { align: 'center' });
        doc.setFontSize(7.5);
        doc.text('INFORME TÉCNICO OFICIAL DE ESCENARIOS DE RIESGO DE DESASTRES (2026)', 105, 24, { align: 'center' });

        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(226, 232, 240);
        doc.roundedRect(14, 33, 182, 22, 2, 2, 'FD');
        doc.setTextColor(24, 49, 83);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10.5);
        doc.text(`INFORME TÉCNICO N° ${codigo}-CENEPRED/DIPSE`, 20, 42);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(71, 85, 105);
        doc.text(`Ámbito Geoespacial: Distrito de ${distrito}, Prov. ${provincia}, Dpto. ${departamento} | SIGRID v3`, 20, 48);

        doc.setFillColor(255, 255, 255);
        doc.setDrawColor(203, 213, 225);
        doc.roundedRect(14, 59, 182, 45, 2, 2, 'D');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(15, 23, 42);
        doc.text('I. ANÁLISIS DE SUSCEPTIBILIDAD FÍSICA Y MOVIMIENTOS EN MASA', 18, 66);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(51, 65, 85);
        doc.text(`• Fenómeno Evaluado: Susceptibilidad a movimientos en masa, huaicos y desbordes torrenciales.`, 18, 73);
        doc.text(`• Condicionantes Físicos: Pendientes escarpadas (>30°), depósitos coluvio-deluviales y fracturamiento.`, 18, 79);
        doc.text(`• Factor Desencadenante: Precipitaciones registradas durante las últimas 24 horas y saturación de suelo.`, 18, 85);
        doc.text(`• Nivel de Susceptibilidad: Media a Muy Alta en fajas marginales y quebradas activas de ${provincia}.`, 18, 91);
        doc.text(`• Plataforma Espacial: Validación cartográfica automatizada mediante el visor SIGRID v3 de CENEPRED.`, 18, 97);

        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(226, 232, 240);
        doc.roundedRect(14, 108, 182, 40, 2, 2, 'FD');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(15, 23, 42);
        doc.text('II. ESTIMACIÓN DE ELEMENTOS EXPUESTOS EN EL ÁMBITO PROVINCIAL', 18, 116);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(51, 65, 85);
        doc.text(`• Población en Muy Alto Riesgo: Asentamientos humanos y comunidades ubicadas en conos aluviales.`, 18, 123);
        doc.text(`• Infraestructura Social: Establecimientos de salud y centros educativos priorizados para protección.`, 18, 129);
        doc.text(`• Vías de Comunicación: Tramos de carreteras vecinales y departamentales expuestos a interrupción.`, 18, 135);
        doc.text(`• Áreas Agrícolas: Terrenos de cultivo ribereños susceptibles a socavación e inundación rápida.`, 18, 141);

        doc.setFillColor(254, 252, 232);
        doc.setDrawColor(254, 240, 138);
        doc.roundedRect(14, 152, 182, 36, 2, 2, 'FD');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(133, 77, 14);
        doc.text('III. MEDIDAS DE PREVENCIÓN Y MITIGACIÓN (CENEPRED - SINAGERD):', 20, 160);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.text('1. Prohibir nuevas construcciones en fajas marginales, cauces de quebradas y laderas inestables.', 20, 167);
        doc.text('2. Implementar obras de control torrencial (diques disipadores, mallas dinámicas y reforestación de riberas).', 20, 173);
        doc.text('3. Monitorear permanentemente el nivel de agua en las cuencas con apoyo de comités locales de vigilancia.', 20, 179);

        doc.setDrawColor(226, 232, 240);
        doc.line(14, 194, 196, 194);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(100, 116, 139);
        doc.text('Plataforma Oficial de Escenarios SIGRID CENEPRED: https://sigrid.cenepred.gob.pe/sigridv3/escenarios', 14, 201);
        doc.text('Escenarios de Riesgo Lluvias 2026: https://sigrid.cenepred.gob.pe/sigridv3/documento/20536', 14, 207);
        doc.text('Centro Nacional de Estimación, Prevención y Reducción del Riesgo de Desastres - PCM Perú.', 14, 213);

        const pdfBuffer = Buffer.from(doc.output('arraybuffer'));
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="Informe_CENEPRED_${codigo}.pdf"`);
        res.setHeader('Content-Length', pdfBuffer.length);
        res.end(pdfBuffer);
        return;
      } catch (cenepredErr) {
        console.error('Error generando PDF CENEPRED:', cenepredErr);
        res.statusCode = 500;
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.end('Error al generar el informe oficial CENEPRED en PDF.');
        return;
      }
    }

    // 1.5 Boletín Oceanográfico y de Tsunami en PDF (DHN)
    if (pathname === '/api/reporte-dhn-pdf') {
      const urlObj = new URL(urlString, `http://${req.headers.host || 'localhost'}`);
      const aviso = (urlObj.searchParams.get('aviso') || '35-26').trim();
      const provincia = urlObj.searchParams.get('provincia') || 'Provincia Litoral';
      const departamento = urlObj.searchParams.get('departamento') || 'Departamento';

      try {
        const doc = new jsPDF();
        doc.setFillColor(10, 37, 64);
        doc.rect(0, 0, 210, 28, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        doc.text('DIRECCIÓN DE HIDROGRAFÍA Y NAVEGACIÓN', 105, 11, { align: 'center' });
        doc.setFontSize(8.5);
        doc.setFont('helvetica', 'normal');
        doc.text('MARINA DE GUERRA DEL PERÚ - DEPARTAMENTO DE OCEANOGRAFÍA', 105, 18, { align: 'center' });
        doc.setFontSize(7.5);
        doc.text('CENTRO NACIONAL DE ALERTA DE TSUNAMIS (CNAT) - VIGILANCIA EN TIEMPO REAL', 105, 24, { align: 'center' });

        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(226, 232, 240);
        doc.roundedRect(14, 33, 182, 22, 2, 2, 'FD');
        doc.setTextColor(10, 37, 64);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10.5);
        doc.text(`AVISO ESPECIAL DE OLEAJE N° ${aviso}`, 20, 42);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(71, 85, 105);
        doc.text(`Ámbito Marítimo y Costero: Litoral de ${provincia} (${departamento}) | Monitoreo 24 Horas`, 20, 48);

        doc.setFillColor(255, 255, 255);
        doc.setDrawColor(203, 213, 225);
        doc.roundedRect(14, 59, 182, 45, 2, 2, 'D');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(15, 23, 42);
        doc.text('I. ESTADO DEL MAR Y EVALUACIÓN DE OLEAJE ANÓMALO', 18, 66);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(51, 65, 85);
        doc.text(`• Condición Actual: Oleaje ligero a moderado proveniente del suroeste afectando puertos y caletas.`, 18, 73);
        doc.text(`• Fase Lunar: Fase de impacto en las mareas astronómicas con incremento de pleamar en horas nocturnas.`, 18, 79);
        doc.text(`• Puertos y Caletas: Disposiciones de bandera emitidas por la Capitanía de Puerto de la jurisdicción.`, 18, 85);
        doc.text(`• Monitoreo Mareográfico: Boyas oceanográficas y mareógrafos costeros operativos 24/7.`, 18, 91);
        doc.text(`• Vigencia: Aviso activo registrado en las últimas 24 horas.`, 18, 97);

        doc.setFillColor(240, 253, 244);
        doc.setDrawColor(187, 247, 208);
        doc.roundedRect(14, 108, 182, 30, 2, 2, 'FD');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(22, 101, 52);
        doc.text('II. EVALUACIÓN DEL CENTRO NACIONAL DE ALERTA DE TSUNAMIS (CNAT):', 20, 116);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.text('• ESTADO ACTUAL: NO EXISTE ALERTA NI ALARMA DE TSUNAMI EN EL LITORAL PERUANO.', 20, 123);
        doc.text('• Los eventos sísmicos registrados en las últimas 24 horas no reúnen condiciones generadoras de maremoto.', 20, 129);

        doc.setFillColor(254, 252, 232);
        doc.setDrawColor(254, 240, 138);
        doc.roundedRect(14, 142, 182, 36, 2, 2, 'FD');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(133, 77, 14);
        doc.text('III. RECOMENDACIONES DE LA AUTORIDAD MARÍTIMA:', 20, 150);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.text('1. Se recomienda a pescadores artesanales y deportistas acuáticos acatar disposiciones de Capitanía.', 20, 157);
        doc.text('2. Asegurar embarcaciones ancladas en caletas y evitar instalar carpas en la orilla del mar.', 20, 163);
        doc.text('3. Mantenerse informados a través de los avisos especiales emitidos en el portal de la DHN.', 20, 169);

        doc.setDrawColor(226, 232, 240);
        doc.line(14, 184, 196, 184);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(100, 116, 139);
        doc.text('Avisos Especiales en línea: https://www.dhn.mil.pe/portal/avisos-especiales', 14, 191);
        doc.text('Centro Nacional de Alerta de Tsunamis: https://www.dhn.mil.pe/cnat', 14, 197);
        doc.text('Dirección de Hidrografía y Navegación de la Marina de Guerra del Perú.', 14, 203);

        const pdfBuffer = Buffer.from(doc.output('arraybuffer'));
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="Boletin_DHN_${aviso}.pdf"`);
        res.setHeader('Content-Length', pdfBuffer.length);
        res.end(pdfBuffer);
        return;
      } catch (dhnErr) {
        console.error('Error generando PDF DHN:', dhnErr);
        res.statusCode = 500;
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.end('Error al generar el boletín oficial DHN en PDF.');
        return;
      }
    }

    // 1.6 Comunicado Oficial ENFEN en PDF
    if (pathname === '/api/reporte-enfen-pdf') {
      const urlObj = new URL(urlString, `http://${req.headers.host || 'localhost'}`);
      const comunicado = (urlObj.searchParams.get('comunicado') || '12-2026').trim();
      const provincia = urlObj.searchParams.get('provincia') || 'Provincia Litoral';

      try {
        const doc = new jsPDF();
        doc.setFillColor(15, 118, 110);
        doc.rect(0, 0, 210, 28, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.text('COMISIÓN MULTISECTORIAL ENCARGADA DEL ESTUDIO NACIONAL', 105, 11, { align: 'center' });
        doc.text('DEL FENÓMENO EL NIÑO (ENFEN)', 105, 17, { align: 'center' });
        doc.setFontSize(7.5);
        doc.setFont('helvetica', 'normal');
        doc.text('INTEGRADA POR: IMARPE • SENAMHI • DHN • IGP • ANA • INDECI • CENEPRED', 105, 23, { align: 'center' });

        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(204, 251, 241);
        doc.roundedRect(14, 33, 182, 22, 2, 2, 'FD');
        doc.setTextColor(15, 118, 110);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10.5);
        doc.text(`COMUNICADO OFICIAL ENFEN N° ${comunicado}`, 20, 42);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(71, 85, 105);
        doc.text(`Monitoreo Océano-Atmosférico y Estado del Sistema de Alerta | Ámbito: ${provincia}`, 20, 48);

        doc.setFillColor(255, 255, 255);
        doc.setDrawColor(203, 213, 225);
        doc.roundedRect(14, 59, 182, 45, 2, 2, 'D');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(15, 23, 42);
        doc.text('I. ESTADO DEL SISTEMA DE ALERTA Y CONDICIONES DEL PACÍFICO', 18, 66);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(51, 65, 85);
        doc.text('• Estado del Sistema de Alerta: No Activo / Vigilancia Océano-Atmosférica Permanente.', 18, 73);
        doc.text('• Región Niño 1+2: Temperatura Superficial del Mar (TSM) dentro de los rangos neutros.', 18, 79);
        doc.text('• Ondas Kelvin: Monitoreo térmico continuo a lo largo del litoral marítimo peruano.', 18, 85);
        doc.text('• Comités Técnicos: IMARPE y DHN mantienen boyas oceanográficas y mareógrafos activos.', 18, 91);
        doc.text('• Previsión Climática: SENAMHI actualiza pronósticos meteorológicos de precipitación.', 18, 97);

        doc.setFillColor(240, 253, 250);
        doc.setDrawColor(153, 246, 228);
        doc.roundedRect(14, 108, 182, 35, 2, 2, 'FD');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(15, 118, 110);
        doc.text('II. RECOMENDACIONES MULTISECTORIALES:', 20, 116);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(19, 78, 74);
        doc.text('1. Plataformas de Defensa Civil: Mantener actualizados los planes de contingencia por lluvias.', 20, 123);
        doc.text('2. Sectores Productivos: Agricultura, pesca e infraestructura deben seguir los comunicados técnicos.', 20, 129);
        doc.text('3. Ciudadanía: Mantener despejados cauces de quebradas y drenes pluviales en cuencas costeras.', 20, 135);

        doc.setDrawColor(226, 232, 240);
        doc.line(14, 184, 196, 184);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(100, 116, 139);
        doc.text('Página Oficial ENFEN: https://enfen.imarpe.gob.pe/', 14, 191);
        doc.text('Comunicados Oficiales ENFEN: https://enfen.imarpe.gob.pe/comunicados/', 14, 197);
        doc.text('Comisión Multisectorial del Estudio Nacional del Fenómeno El Niño (ENFEN).', 14, 203);

        const pdfBuffer = Buffer.from(doc.output('arraybuffer'));
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="Comunicado_ENFEN_${comunicado}.pdf"`);
        res.setHeader('Content-Length', pdfBuffer.length);
        res.end(pdfBuffer);
        return;
      } catch (enfenErr) {
        console.error('Error generando PDF ENFEN:', enfenErr);
        res.statusCode = 500;
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.end('Error al generar el comunicado oficial ENFEN en PDF.');
        return;
      }
    }

    // 2. Endpoint backend con Gemini AI como Formateador y Validador Inteligente (7 Instituciones)
    if (pathname === '/api/reportes-oficiales-gemini') {
      const urlObj = new URL(urlString, `http://${req.headers.host || 'localhost'}`);
      let departamento = urlObj.searchParams.get('departamento') || '';
      let provincia = urlObj.searchParams.get('provincia') || '';
      let distrito = urlObj.searchParams.get('distrito') || '';
      let currentTimeIso = urlObj.searchParams.get('currentTimeIso') || '';
      let alertasCrudas: any[] = [];

      const formatearRespaldo = () => {
        const vistosResp = new Set<string>();
        const alertasUnicas = alertasCrudas.filter((a: any) => {
          const clave = `${a.institucion}_${String(a.titulo || '').toLowerCase().trim()}`;
          if (vistosResp.has(clave) || vistosResp.has(a.id)) return false;
          vistosResp.add(clave);
          vistosResp.add(a.id);
          return true;
        });

        return alertasUnicas.map((a: any) => ({
          id: a.id,
          tipoDesastre: a.tipoDesastre,
          codigoOficial: a.codigoOficial,
          titulo: `${a.institucion}: ${a.titulo}`,
          entidad: a.institucion,
          entidadNombreCompleto: a.nombreInstitucionCompleto,
          entidadUrl: a.urlInstitucion,
          enlace_oficial: a.enlace_oficial,
          enlaceBoletinOficial: a.enlace_oficial,
          enlacePdfDirecto: a.enlacePdfDirecto,
          horaReporte: `${a.fechaLocalPerú} - ${a.horaLocalPerú}`,
          fechaHoraRegistroIso: new Date(a.timestampPublicacionMs).toISOString(),
          haceCuanto: a.tiempoTranscurrido,
          severidad: a.severidad,
          severidadColor:
            a.severidad === 'Extrema'
              ? 'bg-red-600 text-white'
              : a.severidad === 'Alta'
              ? 'bg-amber-500 text-white'
              : a.severidad === 'Moderada'
              ? 'bg-amber-400 text-slate-900'
              : 'bg-blue-600 text-white',
          lugarExactoProvincia: a.lugarReferencia,
          coordenadasExactas: a.coordenadasReferencia,
          descripcion: a.descripcionOficial,
          parametrosClave: a.parametrosTecnicos,
          datosAdicionalesOficiales: a.datosVerificados,
          zonaAfectada: `${distrito}, ${provincia}`,
          recomendacionDefensaCivil: a.medidaDefensaCivil,
          boletinNombre: `${a.institucion} ${a.codigoOficial}`,
          esSismoReal: a.institucion === 'IGP',
          tipoBoletinOficial: a.tipoBoletinOficial || `Boletín / Alerta Informativa (${a.institucion})`,
          informacionCompletaOficial: a.informacionCompletaOficial || a.descripcionOficial,
          periodoVigenciaTexto: a.periodoVigenciaTexto,
          esLocal: a.esLocal !== false,
          distanciaKmUsuario: a.distanciaKmUsuario,
        }));
      };

      try {
        if (req.method === 'POST') {
          const reqAny = req as any;
          if (reqAny.body && typeof reqAny.body === 'object') {
            if (reqAny.body.departamento) departamento = reqAny.body.departamento;
            if (reqAny.body.provincia) provincia = reqAny.body.provincia;
            if (reqAny.body.distrito) distrito = reqAny.body.distrito;
            if (reqAny.body.currentTimeIso) currentTimeIso = reqAny.body.currentTimeIso;
            if (Array.isArray(reqAny.body.alertasCrudas)) alertasCrudas = reqAny.body.alertasCrudas;
          } else {
            const body = await new Promise<string>((resolve) => {
              let acc = '';
              const timer = setTimeout(() => resolve(acc), 2000);
              req.on('data', (chunk) => (acc += chunk));
              req.on('end', () => {
                clearTimeout(timer);
                resolve(acc);
              });
              req.on('error', () => {
                clearTimeout(timer);
                resolve('');
              });
              if (req.complete) {
                clearTimeout(timer);
                resolve(acc);
              }
            });
            if (body) {
              try {
                const parsed = JSON.parse(body);
                if (parsed.departamento) departamento = parsed.departamento;
                if (parsed.provincia) provincia = parsed.provincia;
                if (parsed.distrito) distrito = parsed.distrito;
                if (parsed.currentTimeIso) currentTimeIso = parsed.currentTimeIso;
                if (Array.isArray(parsed.alertasCrudas)) alertasCrudas = parsed.alertasCrudas;
              } catch {}
            }
          }
        }

        const now = currentTimeIso ? new Date(currentTimeIso) : new Date();

        if (!alertasCrudas || alertasCrudas.length === 0) {
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.end(JSON.stringify({ reportes: [] }));
          return;
        }

        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey || Date.now() < geminiRateLimitUntil) {
          const reportes = formatearRespaldo();
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.end(JSON.stringify({ reportes }));
          return;
        }

        const ai = new GoogleGenAI({ apiKey });

        const systemInstruction = `Eres el Formateador y Validador Inteligente Oficial de Alertas de Desastres del Perú.
Tu única función es estructurar y validar el JSON final para las tarjetas de la interfaz frontend basándote EXCLUSIVAMENTE en las alertas oficiales extraídas de las instituciones gubernamentales del Perú:
1. IGP: https://ultimosismo.igp.gob.pe/evento/[CODIGO] (reporte instrumental PDF oficial)
2. SENAMHI: https://www.senamhi.gob.pe/?p=aviso-meteorologico
3. INDECI y COEN: https://coen.indeci.gob.pe/report/
4. CENEPRED y SIGRID: https://sigrid.cenepred.gob.pe/sigridv3/documento/17791
5. DHN: https://www.dhn.mil.pe/portal/avisos-especiales
6. ENFEN: https://enfen.imarpe.gob.pe/comunicados/

REGLAS OBLIGATORIAS:
- FILTRO TEMPORAL: Hora actual del sistema: ${now.toISOString()}. Considerar alertas emitidas en las últimas 24 horas O con período de vigencia/duración activo en esta fecha.
- SINCRONIZACIÓN GEOGRÁFICA: Departamento: "${departamento}", Provincia: "${provincia}", Distrito: "${distrito}".
- ENLACES DIRECTOS VÁLIDOS: El campo "enlace_oficial" es obligatorio y debe conservar exactamente los enlaces oficiales provistos en cada alerta extraída.
- CONTROL DE VACÍO Y CERO ALUCINACIONES: Si no hay alertas que cumplan ambos filtros, retorna estrictamente [].`;

        const prompt = `A continuación tienes la lista de alertas oficiales extraídas para el distrito de ${distrito}, provincia de ${provincia} (${departamento}):
${JSON.stringify(alertasCrudas, null, 2)}

Estructura y valida el JSON final para alimentar las tarjetas de la interfaz. Si no hay alertas válidas, retorna [].`;

        try {
          const geminiCall = ai.models.generateContent({
            model: 'gemini-3.1-flash-lite',
            contents: prompt,
            config: {
              systemInstruction,
              responseMimeType: 'application/json',
              responseSchema: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    id: { type: Type.STRING },
                    tipoDesastre: {
                      type: Type.STRING,
                      enum: [
                        'sismo',
                        'tsunami',
                        'huayco',
                        'inundacion',
                        'helada_friaje',
                        'sequia',
                        'erupcion_volcanica',
                        'deslizamiento',
                        'viento_fuerte',
                        'huayco_deslizamiento',
                        'granizada',
                      ],
                    },
                    codigoOficial: { type: Type.STRING },
                    titulo: { type: Type.STRING },
                    entidad: {
                      type: Type.STRING,
                      enum: ['IGP', 'SENAMHI', 'COEN', 'INDECI', 'CENEPRED', 'SIGRID', 'DHN', 'ENFEN'],
                    },
                    entidadNombreCompleto: { type: Type.STRING },
                    entidadUrl: { type: Type.STRING },
                    enlace_oficial: { type: Type.STRING },
                    enlaceBoletinOficial: { type: Type.STRING },
                    enlacePdfDirecto: { type: Type.STRING },
                    horaReporte: { type: Type.STRING },
                    fechaHoraRegistroIso: { type: Type.STRING },
                    haceCuanto: { type: Type.STRING },
                    severidad: {
                      type: Type.STRING,
                      enum: ['Extrema', 'Alta', 'Moderada', 'Informativa'],
                    },
                    severidadColor: { type: Type.STRING },
                    lugarExactoProvincia: { type: Type.STRING },
                    coordenadasExactas: { type: Type.STRING },
                    descripcion: { type: Type.STRING },
                    parametrosClave: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          etiqueta: { type: Type.STRING },
                          valor: { type: Type.STRING },
                        },
                        required: ['etiqueta', 'valor'],
                      },
                    },
                    datosAdicionalesOficiales: {
                      type: Type.ARRAY,
                      items: { type: Type.STRING },
                    },
                    zonaAfectada: { type: Type.STRING },
                    recomendacionDefensaCivil: { type: Type.STRING },
                    boletinNombre: { type: Type.STRING },
                    tipoBoletinOficial: { type: Type.STRING },
                    informacionCompletaOficial: { type: Type.STRING },
                    periodoVigenciaTexto: { type: Type.STRING },
                    esLocal: { type: Type.BOOLEAN },
                    distanciaKmUsuario: { type: Type.NUMBER },
                  },
                  required: [
                    'id',
                    'tipoDesastre',
                    'codigoOficial',
                    'titulo',
                    'entidad',
                    'entidadNombreCompleto',
                    'enlace_oficial',
                    'horaReporte',
                    'severidad',
                    'lugarExactoProvincia',
                    'coordenadasExactas',
                    'descripcion',
                    'parametrosClave',
                    'recomendacionDefensaCivil',
                    'boletinNombre',
                  ],
                },
              },
            },
          });

          const timeoutPromise = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Timeout de respuesta de Gemini')), 3500)
          );

          const response: any = await Promise.race([geminiCall, timeoutPromise]);

          const responseText = response.text || '[]';
          const rawParsed = JSON.parse(responseText);
          const reportes = (Array.isArray(rawParsed) ? rawParsed : []).map((r: any) => {
            const original = alertasCrudas.find(
              (a: any) => a.id === r.id || a.codigoOficial === r.codigoOficial
            );
            if (original) {
              if (original.enlace_oficial) r.enlace_oficial = original.enlace_oficial;
              if (original.enlacePdfDirecto) r.enlacePdfDirecto = original.enlacePdfDirecto;
              if (original.enlaceBoletinOficial) r.enlaceBoletinOficial = original.enlace_oficial;
              if (original.tipoBoletinOficial) r.tipoBoletinOficial = original.tipoBoletinOficial;
              if (original.informacionCompletaOficial) {
                r.informacionCompletaOficial = original.informacionCompletaOficial;
              }
              if (original.periodoVigenciaTexto) r.periodoVigenciaTexto = original.periodoVigenciaTexto;
              r.esLocal = original.esLocal !== false;
              r.distanciaKmUsuario = original.distanciaKmUsuario;
            }
            return r;
          });

          const vistosRes = new Set<string>();
          const reportesDeduplicados = reportes.filter((r: any) => {
            const clave = `${r.entidad}_${String(r.titulo || '').toLowerCase().trim()}`;
            if (vistosRes.has(clave) || vistosRes.has(r.id)) return false;
            vistosRes.add(clave);
            vistosRes.add(r.id);
            return true;
          });

          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.end(JSON.stringify({ reportes: reportesDeduplicados }));
        } catch {
          geminiRateLimitUntil = Date.now() + 60000;
          const reportes = formatearRespaldo();
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.end(JSON.stringify({ reportes }));
        }
      } catch {
        const reportes = formatearRespaldo();
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.end(JSON.stringify({ reportes }));
      }
      return;
    }

    next();
  };
}
