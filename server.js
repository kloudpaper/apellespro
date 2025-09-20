// server.js — Apelles Taller
require('dotenv').config();

const { randomUUID } = require('crypto');
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');

console.log('[CFG] TICKET_PATH =', TICKET_PATH);
try {
  const exists = require('fs').existsSync(TICKET_PATH);
  console.log('[CFG] TICKET exists? ->', exists);
  if (!exists) {
    console.error('[ERROR] ticket no encontrado en', TICKET_PATH);
  }
} catch (e) {
  console.error('[ERROR] comprobando ticket:', e);
}

const app = express();

// Almacenamiento en memoria cuando no haya Mongo conectado
const memStore = [];


// Ruta del ticket; puedes moverlo, o controlar por env:
const TICKET_PATH = process.env.TICKET_PATH || path.join(__dirname, 'public', 'ticket.html');

// helper simple de plantilla: {{clave}}
function renderTemplate(tpl, vars){
  return Object.entries(vars).reduce((html,[k,v]) =>
    html.replace(new RegExp(`{{\\s*${k}\\s*}}`, 'g'), String(v ?? '')), tpl);
}


/* =========================
   Configuración general
========================= */
const PORT = process.env.PORT || 4000;
const ALLOWED_ORIGINS = (process.env.CORS_ORIGINS || 'https://kloudpaper.github.io')
  .split(',').map(s => s.trim());

app.use(express.json());
app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    const ok = ALLOWED_ORIGINS.includes(origin);
    cb(ok ? null : new Error('CORS not allowed'), ok);
  },
  methods: ['GET','POST','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization'],
}));
app.options('/register', cors());

/* =========================
   Datos del taller (WAD House)
========================= */
const WORKSHOP = {
  title: 'Taller de Preparación de Óleo Tradicional (Apelles Pro)',
  dateText: 'Sábado 27 de septiembre · 11:30 a.m. (America/Mexico_City)',
  timezone: 'America/Mexico_City',
  startISO: '2025-09-27T11:30:00-06:00', // ajusta el offset si aplica horario de verano
  endISO:   '2025-09-27T14:00:00-06:00',
  placeName: 'WAD House — Galería y tienda de Arte',
  placeAddr: 'Calle 10 Ote 212, San Juan Aquiahuac, 72810 San Andrés Cholula, Puebla',
  price: '$1,000 MXN',
  igApelles: 'https://www.instagram.com/apellespro/',
  igWad: 'https://www.instagram.com/wad_house/'
};

/* =========================
   MongoDB
========================= */
(async () => {
  try {
    const uri = process.env.MONGO_URL;
    const dbName = process.env.MONGO_DB || 'apelles_taller';
    if (!uri) {
      console.warn('[WARN] MONGO_URL no definido — JSON/CSV dependerán de DB.');
    } else {
      await mongoose.connect(uri, { dbName });
      console.log('[OK] Mongo conectado:', dbName);
    }
  } catch (err) {
    console.error('[ERROR] Mongo:', err.message);
  }
})();

const RegistrationSchema = new mongoose.Schema({
  firstName: String,
  lastName: String,
  email: String,
  phone: String,
  createdAt: { type: Date, default: Date.now }
}, { versionKey: false });

const Registration = mongoose.models.ApellesRegistration
  || mongoose.model('ApellesRegistration', RegistrationSchema);

/* =========================
   Email HTML (boleto)
   — arte adaptado de tu plantilla Apelles
========================= */
function ticketHtml({ firstName, lastName, qid }) {
  // inspirado en tu HTML de Apelles Pro — Presentación  (colores, tipografía, layout)  :contentReference[oaicite:4]{index=4}
  const fullName = [firstName, lastName].filter(Boolean).join(' ');
  return `
  <body style="background:#1b1b1b;font-family:Arial,Helvetica,sans-serif;color:#e6e6e6;margin:0;padding:0">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr><td align="center" style="padding:30px 16px">
        <table role="presentation" width="680" style="width:680px;max-width:680px;background:linear-gradient(180deg,#2b2b2b,#1b1b1b);border-radius:8px;overflow:hidden;box-shadow:0 6px 18px rgba(0,0,0,.6)">
          <tr>
            <td style="padding:20px;text-align:left">
              <img src="https://raw.githubusercontent.com/kloudpaper/apelles-pro/main/APELLES_LOGO_BLANCO.png" width="180" alt="Apelles Pro">
            </td>
          </tr>
          <tr>
            <td style="padding:0 24px 10px 24px">
              <h1 style="margin:0;font-size:22px;line-height:28px;color:#f5f5f5;font-weight:600">${WORKSHOP.title}</h1>
              <p style="margin:8px 0 0;color:#cfcfcf;font-size:14px;line-height:20px">
                ¡Gracias por inscribirte, <strong>${fullName}</strong>! Este correo es tu <strong>boleto</strong> de acceso.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 24px">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#262626;border-radius:6px;padding:12px">
                <tr>
                  <td style="color:#dcdcdc;font-size:14px">
                    <div><strong>Cuándo:</strong> ${WORKSHOP.dateText}</div>
                    <div><strong>Dónde:</strong> ${WORKSHOP.placeName} — ${WORKSHOP.placeAddr}</div>
                    <div><strong>Costo:</strong> ${WORKSHOP.price}</div>
                    <div><strong>Folio:</strong> ${qid}</div>
                    <div style="margin-top:8px">Instagram:
                      <a href="${WORKSHOP.igWad}" style="color:#d9d9d9">WAD House</a> ·
                      <a href="${WORKSHOP.igApelles}" style="color:#d9d9d9">Apelles Pro</a>
                    </div>
                  </td>
                </tr>
              </table>
              <p style="margin:12px 0 0;color:#bdbdbd;font-size:13px">
                Se adjunta un archivo <code>.ics</code> para agregar al calendario.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:14px 24px;background:#141414;text-align:center;color:#8f8f8f;font-size:12px">
              Hecho en Puebla • Apelles Pro © 2025
            </td>
          </tr>
        </table>
      </td></tr>
    </table>
  </body>
  `;
}

/* =========================
   Utilidades ICS
========================= */
function escapeIcs(text) {
  return String(text || '')
    .replace(/\\/g, '\\\\').replace(/;/g, '\\;')
    .replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

function buildIcsWorkshop() {
  const nowUTC = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  const fmtUTC = (iso) => new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  const description =
    `Taller en WAD House\\n` +
    `${WORKSHOP.placeAddr}\\n` +
    `Instagram: ${WORKSHOP.igApelles}`;
  const lines = [
    'BEGIN:VCALENDAR',
    'PRODID:-//Apelles Taller//EN',
    'VERSION:2.0',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    //`UID:${uuidv4()}@apelles-taller`,
    `UID:${randomUUID()}@apelles-taller`,
    `DTSTAMP:${nowUTC}`,
    `DTSTART:${fmtUTC(WORKSHOP.startISO)}`,
    `DTEND:${fmtUTC(WORKSHOP.endISO)}`,
    `SUMMARY:${escapeIcs(WORKSHOP.title)}`,
    `LOCATION:${escapeIcs(WORKSHOP.placeName + ' — ' + WORKSHOP.placeAddr)}`,
    `DESCRIPTION:${escapeIcs(description)}`,
    'END:VEVENT',
    'END:VCALENDAR'
  ];
  return lines.join('\r\n');
}

/* =========================
   Mailer
========================= */
// Reemplaza la firma y uso de sendMail para aceptar bcc:
async function sendMail({ to, bcc, subject, html, icsBuffer }) {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 465);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.MAIL_FROM || user;

  if (!host || !user || !pass) throw new Error('SMTP faltante');

  const transporter = nodemailer.createTransport({
    host, port, secure: port === 465, auth: { user, pass }
  });

  const attachments = icsBuffer ? [{
    filename: 'apelles-taller.ics',
    content: icsBuffer,
    contentType: 'text/calendar; charset=utf-8; method=PUBLISH'
  }] : [];

  return transporter.sendMail({ from, to, bcc, subject, html, attachments });
}

/* =========================
   Endpoints
========================= */
app.get('/', (_req, res) => {
  res.type('text/plain').send('Apelles Taller API\nGET /health, /registrations.json, /registrations.csv, POST /register');
});

app.get('/health', (_req, res) => {
  res.json({ ok:true, service:'apelles-taller', time:new Date().toISOString(), uptime_s:process.uptime() });
});

app.post('/register', async (req, res) => {
  try {
    const { firstName, lastName, email, phone } = req.body || {};
    if (!firstName || !lastName || !email) {
      return res.status(400).json({ ok:false, error:'firstName, lastName y email son obligatorios.' });
    }

    // Folio e ICS
   // const qid = uuidv4().slice(0,8).toUpperCase();
   // antes:
   // const qid = uuidv4().slice(0,8).toUpperCase();

   // ahora:
    const qid = randomUUID().slice(0,8).toUpperCase(); // folio corto
    const ics = buildIcsWorkshop();

    // QR
    const qrPayload = JSON.stringify({
      e: 'Apelles Taller Óleo',
      folio: qid,
      name: `${firstName} ${lastName}`,
      date: WORKSHOP.startISO,
      venue: WORKSHOP.placeName
    });
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(qrPayload)}`;

    // Render ticket desde archivo (con QR)
    const tpl = fs.readFileSync(TICKET_PATH, 'utf8');
    const html = renderTemplate(tpl, { firstName, lastName, folio: qid, qrUrl });

    // Guardar: Mongo si está conectado; si no, memoria
    let saved = null;
    if (mongoose.connection.readyState === 1) {
      saved = await Registration.create({ firstName, lastName, email, phone });
    } else {
      memStore.unshift({ firstName, lastName, email, phone, createdAt: new Date() });
    }

    // Enviar correo (con BCC a WAD)
  
  await sendMail({
    to: email,
    bcc: ['julio@wearewad.com', 'perla@wearewad.com'],
    subject: process.env.MAIL_SUBJECT || 'Tu boleto — Taller de Óleo (Apelles Pro)',
    html,
    icsBuffer: Buffer.from(ics, 'utf8')
  });
 

    res.json({ ok:true, saved:!!saved, message:'Registro exitoso. Te enviamos tu boleto y .ics por correo.' });
  } catch (err) {
    console.error('[ERROR] /register:', err);
    res.status(500).json({ ok:false, error:'Error en el servidor.' });
  }
});



app.get('/registrations.json', async (_req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.json(memStore);
    }
    const items = await Registration.find({}).sort({ createdAt:-1 }).lean();
    res.setHeader('Content-Type','application/json; charset=utf-8');
    res.send(JSON.stringify(items, null, 2));
  } catch (err) {
    console.error('[ERROR] /registrations.json:', err);
    res.status(500).json({ ok:false, error:'Error generando JSON.' });
  }
});

app.get('/registrations.csv', async (_req, res) => {
  try {
    let items;
    if (mongoose.connection.readyState !== 1) {
      items = memStore;
    } else {
      items = await Registration.find({}).sort({ createdAt:-1 }).lean();
    }
    const headers = ['firstName','lastName','email','phone','createdAt'];
    const esc = v => {
      if (v==null) return '';
      const s = String(v).replace(/"/g,'""');
      return /[",\n]/.test(s) ? `"${s}"` : s;
    };
    const csv = [headers.join(',')].concat(items.map(r => headers.map(h => esc(r[h])).join(','))).join('\n');
    res.setHeader('Content-Type','text/csv; charset=utf-8');
    res.setHeader('Content-Disposition','attachment; filename="apelles-registrations.csv"');
    res.send(csv);
  } catch (err) {
    console.error('[ERROR] /registrations.csv:', err);
    res.status(500).json({ ok:false, error:'Error generando CSV.' });
  }
});

app.use((req,res)=>res.status(404).json({ ok:false, error:`Ruta no encontrada: ${req.method} ${req.path}` }));
app.listen(PORT, ()=> console.log(`[OK] Apelles Taller API en puerto ${PORT}`));
