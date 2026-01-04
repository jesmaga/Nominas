const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const path = require('path');
// --- NUEVAS IMPORTACIONES AL INICIO DEL ARCHIVO ---
const multer = require('multer');
const pdfParse = require('pdf-parse');
const { PDFDocument } = require('pdf-lib');
const upload = multer({ storage: multer.memoryStorage() }); // Guardamos en memoria RAM temporalmente
require('dotenv').config();

// --- DIAGNÓSTICO AL ARRANCAR ---
console.log("---------------------------------------------------");
console.log("🛠️ DIAGNÓSTICO DE LIBRERÍAS:");
console.log("Tipo de pdf-parse:", typeof pdfParse);
console.log("Valor de pdf-parse:", pdfParse);
console.log("---------------------------------------------------");
// Si aquí sale 'undefined', la librería no está instalada correctamente.

const app = express();
const port = process.env.PORT || 3000;

// Configuración de la conexión a NEON
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// --- 1. INICIALIZAR BASE DE DATOS (Creación de Tablas) ---
const initDB = async () => {
    try {
        const client = await pool.connect();

        // 1. Tabla Nóminas (REFACTORIZADA)
        // Borramos tabla antigua para migración (Según requerimiento)
        // await client.query('DROP TABLE IF EXISTS nominas');

        await client.query(`
            CREATE TABLE IF NOT EXISTS nominas (
                id SERIAL PRIMARY KEY,
                empleado_id TEXT,
                anio INTEGER,
                mes INTEGER,
                dias_cotizados NUMERIC(10,2),
                base_cc NUMERIC(10,2),
                base_cp NUMERIC(10,2),
                base_irpf NUMERIC(10,2),
                cuota_irpf NUMERIC(10,2),
                total_devengado NUMERIC(10,2),
                liquido_percibir NUMERIC(10,2),
                datos_completo JSONB,
                fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // 2. Tabla Puestos (Guardamos objeto JSON)
        await client.query(`
            CREATE TABLE IF NOT EXISTS puestos (
                id TEXT PRIMARY KEY,
                datos JSONB
            )
        `);

        // 3. Tabla Empleados (Guardamos objeto JSON)
        await client.query(`
            CREATE TABLE IF NOT EXISTS empleados (
                id TEXT PRIMARY KEY,
                datos JSONB
            )
        `);

        // 4. Tabla Usuarios
        await client.query(`
            CREATE TABLE IF NOT EXISTS usuarios (
                username TEXT PRIMARY KEY,
                password_hash TEXT
            )
        `);

        // 5. Tabla Configuraciones (SS, Empresa, Conceptos, Contratos)
        await client.query(`
            CREATE TABLE IF NOT EXISTS configuraciones (
                id TEXT PRIMARY KEY,
                datos JSONB
            )
        `);

        // --- CREAR ADMIN POR DEFECTO SI NO EXISTE ---
        // Hash MD5 de 'password123': 482c811da5d5b4bc6d497ffa98491e38
        const userCheck = await client.query("SELECT * FROM usuarios WHERE username = 'admin'");
        if (userCheck.rows.length === 0) {
            await client.query("INSERT INTO usuarios (username, password_hash) VALUES ($1, $2)", ['admin', '482c811da5d5b4bc6d497ffa98491e38']);
            console.log("--> Usuario 'admin' creado por defecto.");
        }

        console.log("--> Base de datos Neon conectada y tablas verificadas.");
        client.release();
    } catch (err) {
        console.error("Error inicializando DB:", err);
    }
};

// Ejecutamos la inicialización al arrancar
initDB();

// --- FUNCIÓN AYUDANTE: PARSEAR NÚMEROS ESPAÑOLES ---
// --- FUNCIÓN MEJORADA PARA PARSEAR NÚMEROS ---
const parseSpanishNumber = (str) => {
    if (!str) return 0;
    // Quita símbolo € y espacios
    let clean = str.replace(/[€\s]/g, '');
    // Caso 1.200,50 -> quita punto, cambia coma
    if (clean.includes('.') && clean.includes(',')) {
        clean = clean.replace(/\./g, '').replace(',', '.');
    }
    // Caso 1200,50 -> cambia coma
    else if (clean.includes(',')) {
        clean = clean.replace(',', '.');
    }
    const num = parseFloat(clean);
    return isNaN(num) ? 0 : num;
};

// --- EXTRACTOR DE DATOS BLINDADO (Ignora fórmulas como 1+2) ---
const extractDataFromPDF = (text) => {
    const data = {};

    // 1. Limpieza inicial
    // Reemplazamos saltos de línea por espacios y unificamos puntos
    const cleanText = text.replace(/\s+/g, ' ').replace(/\u2026/g, '...');

    // Helper para buscar importes monetarios (Busca: Cifras, coma, dos decimales)
    // El patrón .*? salta cualquier cosa (incluido "(1 + 2)") hasta llegar al importe
    const extractCurrency = (labelRegex) => {
        // Construimos una regex dinámica: Etiqueta + cualquier cosa + (NUMERO,DECIMALES)
        // Ejemplo generado: /TOTAL\s+DEVENGADO.*?(\d+(?:\.\d+)*,\d{2})/i
        const fullRegex = new RegExp(labelRegex.source + ".*?(\\d+(?:\\.\\d+)*,\\d{2})", "i");
        const match = cleanText.match(fullRegex);
        return match ? parseSpanishNumber(match[1]) : 0;
    };

    // 2. EXTRACCIONES CLAVE

    // DNI (Prioridad absoluta)
    const dniMatch = cleanText.match(/(\d{8})[-\s]*([A-Z])/i);
    if (dniMatch) data.dni = (dniMatch[1] + dniMatch[2]).toUpperCase();

    // FECHAS (Año y Mes)
    const anioMatch = cleanText.match(/\b(20\d{2})\b/);
    if (anioMatch) data.anio = parseInt(anioMatch[1]);

    const mesesRegex = /enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre/i;
    const mesMatch = cleanText.match(mesRegex);
    if (mesMatch) {
        const meses = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
        data.mes = meses.indexOf(mesMatch[0].toLowerCase()) + 1;
    } else {
        const fechaNum = cleanText.match(/\d{2}\/(\d{2})\/(20\d{2})/);
        if (fechaNum) {
            data.mes = parseInt(fechaNum[1]);
            data.anio = parseInt(fechaNum[2]);
        }
    }

    // 3. CONCEPTOS ECONÓMICOS (Usando el nuevo buscador de moneda)

    // Total Devengado
    // Ignorará el "(1 + 2)" y buscará el "250,22"
    data.total_devengado = extractCurrency(/TOTAL\s+DEVENGADO/);

    // Líquido a Percibir
    // Ignorará el "(A - B)" y buscará el "234,00"
    data.liquido_percibir = extractCurrency(/L[IÍ]QUIDO\s+TOTAL/);

    // Bases de Cotización
    // Priorizamos "Remuneración mensual" que aparece justo antes de la tabla de bases
    data.base_cc = extractCurrency(/Remuneraci[oó]n\s+mensual/);

    // Si falla, intentamos buscar por "Base Contingencias Comunes"
    if (!data.base_cc) {
        data.base_cc = extractCurrency(/Base\s+Contingencias\s+Comunes/);
    }

    // Base CP (Suele ser igual a la CC en nóminas sencillas si no se detecta otra)
    data.base_cp = extractCurrency(/Base\s+Contingencias\s+Profesionales/) || data.base_cc;

    // Base IRPF
    data.base_irpf = extractCurrency(/Base\s+sujeta\s+a\s+retenci[oó]n/) || data.total_devengado;

    // Cuota IRPF
    // Buscamos algo como "12,50" cerca de "Impuesto sobre la renta" o "IRPF"
    const posibleCuotaIRPF = extractCurrency(/Impuesto\s+sobre\s+la\s+renta/);

    // Validación de seguridad: La cuota no puede ser mayor que la base.
    // Si captura un número gigante, es que ha pillado la base por error.
    if (posibleCuotaIRPF > 0 && posibleCuotaIRPF < (data.total_devengado * 0.5)) {
        data.cuota_irpf = posibleCuotaIRPF;
    } else {
        data.cuota_irpf = 0;
    }

    return data;
};

// --- ENDPOINT: IMPORTACIÓN MASIVA (ESTRUCTURA IDÉNTICA A LA APP) ---
app.post('/api/importar-pdf', upload.single('nominaPdf'), async (req, res) => {

    if (!req.file) return res.status(400).json({ error: "No se subió ningún archivo." });

    const password = (req.body.password || "").trim();

    try {
        let bufferParaProcesar = req.file.buffer;

        // 1. DESBLOQUEO DEL PDF
        try {
            const pdfDoc = await PDFDocument.load(req.file.buffer, {
                password: password,
                ignoreEncryption: false
            });
            bufferParaProcesar = await pdfDoc.save();
        } catch (err) {
            const msg = err.message || "";
            if (msg.includes('Encrypted') || msg.includes('Password') || msg.includes('Input document')) {
                return res.status(400).json({ error: "PDF protegido o contraseña incorrecta.", requirePassword: true });
            }
            throw err;
        }

        // 2. EXTRACCIÓN DE TEXTO
        const pageTexts = [];
        const render_page = (pageData) => {
            return pageData.getTextContent({ normalizeWhitespace: false })
                .then(function (textContent) {
                    let lastY, text = '';
                    for (let item of textContent.items) {
                        if (lastY == item.transform[5] || !lastY) {
                            text += item.str;
                        } else {
                            text += '\n' + item.str;
                        }
                        lastY = item.transform[5];
                    }
                    pageTexts.push(text);
                    return text;
                });
        }

        await pdfParse(bufferParaProcesar, { pagerender: render_page });

        const results = {
            total: pageTexts.length,
            processed: 0,
            failed: 0,
            skipped: 0,
            details: []
        };

        // 3. PROCESAMIENTO
        for (let i = 0; i < pageTexts.length; i++) {
            const text = pageTexts[i];
            const pageNum = i + 1;
            const extracted = extractDataFromPDF(text);
            const lowerText = text.toLowerCase();

            // A. Filtro Horarios
            if (lowerText.includes('horario') || lowerText.includes('turno') || lowerText.includes('calendario laboral')) {
                if (!lowerText.includes('líquido') && !lowerText.includes('percibir')) {
                    results.skipped++;
                    continue;
                }
            }

            // B. Validación DNI
            if (!extracted.dni) {
                results.failed++;
                if (text.trim().length > 50) {
                    results.details.push({ page: pageNum, status: 'error', reason: 'No se encontró DNI' });
                }
                continue;
            }

            // C. BUSCAR EMPLEADO COMPLETO (Corrección Clave)
            // Usamos regexp_replace para limpiar el DNI de la BD y compararlo con el limpio del PDF
            const dniLimpio = extracted.dni.replace(/[^0-9A-Z]/gi, '');

            // ¡IMPORTANTE! Ahora pedimos 'datos' entero, no solo el nombre
            const empRes = await pool.query(
                `SELECT id, datos 
                 FROM empleados 
                 WHERE regexp_replace(datos->>'dni', '[^0-9A-Za-z]', '', 'g') = $1`,
                [dniLimpio]
            );

            if (empRes.rows.length === 0) {
                results.failed++;
                results.details.push({ page: pageNum, status: 'error', reason: `DNI ${extracted.dni} no registrado` });
                continue;
            }

            const empRow = empRes.rows[0];
            // Construimos el objeto empleado mezclando el ID de la tabla y el JSON de datos
            // Esto asegura que tenga campos como 'puestoId', 'antiguedad', etc.
            const empleadoCompleto = {
                id: empRow.id,
                ...empRow.datos
            };

            const anio = extracted.anio || new Date().getFullYear();
            const mes = extracted.mes || (new Date().getMonth() + 1);

            // Valores numéricos seguros extraídos del PDF
            const totalDevengado = extracted.total_devengado || 0;
            const liquido = extracted.liquido_percibir || 0;
            const baseCC = extracted.base_cc || 0;
            const baseCP = extracted.base_cp || 0;
            const cuotaIRPF = extracted.cuota_irpf || 0;
            const baseIRPF = extracted.base_irpf || 0;

            // Cálculos inversos simples para rellenar huecos
            const totalDeducciones = parseFloat((totalDevengado - liquido).toFixed(2));

            // Estimación de cuotas SS (si no se extrajeron explícitamente, usamos porcentajes estándar para rellenar visualmente)
            // Si el PDF no las da, al menos que no salga "undefined"
            const dedCC = parseFloat((baseCC * 0.047).toFixed(2));
            const dedDesempleo = parseFloat((baseCP * 0.0155).toFixed(2)); // Asumiendo general
            const dedFP = parseFloat((baseCP * 0.001).toFixed(2));
            const dedMEI = parseFloat((baseCP * 0.0013).toFixed(2));

            // D. CONSTRUIR EL JSON "datos_completo" EXACTO
            const datosCompleto = {
                mes: mes,
                anio: anio,
                nomina: {
                    // Totales Principales
                    salarioNeto: liquido.toFixed(2),
                    totalDevengos: totalDevengado.toFixed(2),
                    totalDeducciones: totalDeducciones.toFixed(2),
                    totalCoste: "0.00", // No suele venir en la nómina del trabajador

                    // Bases
                    baseCotizacion: baseCC.toFixed(2), // Usamos base CC como genérica
                    salarioBasePeriodo: baseCC.toFixed(2), // Aproximación para visualización
                    prorrataExtraPeriodo: "0.00",

                    // Deducciones Trabajador
                    deduccionCC: dedCC.toFixed(2),
                    deduccionDesempleo: dedDesempleo.toFixed(2),
                    deduccionFP: dedFP.toFixed(2),
                    deduccionMEI: dedMEI.toFixed(2),
                    deduccionIRPF: cuotaIRPF.toFixed(2),
                    totalDeduccionesSS: (dedCC + dedDesempleo + dedFP + dedMEI).toFixed(2),

                    // Porcentajes (Strings para que coincida con tu formato)
                    porcCC: "4.70",
                    porcDesempleo: "1.55",
                    porcFP: "0.10",
                    porcMEI: "0.13",
                    porcentajeIRPF: baseIRPF > 0 ? ((cuotaIRPF / baseIRPF) * 100).toFixed(2) : "0.00",

                    // Arrays vacíos requeridos por la app
                    otrosDevengos: [],
                    otrasDeducciones: [],
                    conceptosCalculados: [], // Aquí iría el detalle si lo parseáramos línea a línea

                    // Datos informativos (Rellenamos con 0 para evitar fallos)
                    diasCotizados: 30,
                    diasTrabajados: 30,
                    diasBajaEnPeriodo: 0,

                    // Aportaciones Empresa (Normalmente no están en el PDF del trabajador, ponemos 0)
                    totalAportacionesEmpresa: "0.00",
                    porcCCEmpresa: "23.60",
                    aportacionEmpresaCC: "0.00"
                },
                periodo: {
                    inicio: `${anio}-${String(mes).padStart(2, '0')}-01`,
                    fin: `${anio}-${String(mes).padStart(2, '0')}-${new Date(anio, mes, 0).getDate()}`
                },
                empleado: empleadoCompleto, // ¡Esto ahora tiene TODOS los campos!
                overwrite: false
            };

            // E. GUARDAR EN BASE DE DATOS
            await pool.query("DELETE FROM nominas WHERE empleado_id = $1 AND anio = $2 AND mes = $3", [empRow.id, anio, mes]);

            const values = [
                empRow.id,
                anio,
                mes,
                30,
                baseCC,
                baseCP,
                baseIRPF,
                cuotaIRPF,
                totalDevengado,
                liquido,
                JSON.stringify(datosCompleto) // Guardamos la estructura perfecta
            ];

            await pool.query(`
                INSERT INTO nominas (
                    empleado_id, anio, mes, dias_cotizados, 
                    base_cc, base_cp, base_irpf, cuota_irpf, 
                    total_devengado, liquido_percibir, datos_completo
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            `, values);

            results.processed++;
            results.details.push({ page: pageNum, status: 'success', empleado: empleadoCompleto.nombre, periodo: `${mes}/${anio}` });
        }

        res.json({ success: true, summary: results });

    } catch (e) {
        console.error("Error procesando PDF:", e);
        res.status(500).json({ error: e.message });
    }
});

// --- 2. API ENDPOINTS (RUTAS) ---

// --- LOGIN ---
app.post('/api/login', async (req, res) => {
    const { username, passwordHash } = req.body;
    try {
        const result = await pool.query("SELECT * FROM usuarios WHERE username = $1", [username]);
        const user = result.rows[0];

        if (user && user.password_hash === passwordHash) {
            res.json({ success: true, user: user.username });
        } else {
            res.status(401).json({ success: false, error: "Credenciales incorrectas" });
        }
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// --- GESTIÓN DE USUARIOS ---
app.get('/api/usuarios', async (req, res) => {
    try {
        const result = await pool.query("SELECT username FROM usuarios");
        res.json(result.rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/usuarios', async (req, res) => {
    const { username, passwordHash } = req.body;
    try {
        await pool.query("INSERT INTO usuarios (username, password_hash) VALUES ($1, $2)", [username, passwordHash]);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/usuarios/:username', async (req, res) => {
    try {
        if (req.params.username === 'admin') {
            return res.status(403).json({ error: "No se puede borrar al usuario admin" });
        }
        await pool.query("DELETE FROM usuarios WHERE username = $1", [req.params.username]);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- PUESTOS ---
app.get('/api/puestos', async (req, res) => {
    try {
        const result = await pool.query("SELECT datos FROM puestos");
        const puestos = result.rows.map(row => row.datos);
        res.json(puestos);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/puestos', async (req, res) => {
    const puesto = req.body;
    try {
        await pool.query(`
            INSERT INTO puestos (id, datos) VALUES ($1, $2)
            ON CONFLICT (id) DO UPDATE SET datos = $2
        `, [puesto.id, JSON.stringify(puesto)]);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/puestos/:id', async (req, res) => {
    try {
        await pool.query("DELETE FROM puestos WHERE id = $1", [req.params.id]);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- EMPLEADOS ---
app.get('/api/empleados', async (req, res) => {
    try {
        const result = await pool.query("SELECT datos FROM empleados");
        const empleados = result.rows.map(row => row.datos);
        res.json(empleados);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/empleados', async (req, res) => {
    const empleado = req.body;
    try {
        await pool.query(`
            INSERT INTO empleados (id, datos) VALUES ($1, $2)
            ON CONFLICT (id) DO UPDATE SET datos = $2
        `, [empleado.id, JSON.stringify(empleado)]);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/empleados/:id', async (req, res) => {
    try {
        await pool.query("DELETE FROM empleados WHERE id = $1", [req.params.id]);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- CONFIGURACIONES (SS, Empresa, Conceptos, Contratos) ---
app.get('/api/config/:id', async (req, res) => {
    try {
        const result = await pool.query("SELECT datos FROM configuraciones WHERE id = $1", [req.params.id]);
        if (result.rows.length > 0) {
            res.json(result.rows[0].datos);
        } else {
            res.json(null);
        }
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/config/:id', async (req, res) => {
    try {
        await pool.query(`
            INSERT INTO configuraciones (id, datos) VALUES ($1, $2)
            ON CONFLICT (id) DO UPDATE SET datos = $2
        `, [req.params.id, JSON.stringify(req.body)]);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- NÓMINAS ---

// Obtener historial de nóminas
app.get('/api/nominas', async (req, res) => {
    try {
        const query = `
            SELECT 
                n.id, 
                n.anio, 
                n.mes, 
                n.total_devengado, 
                n.liquido_percibir, 
                n.fecha_creacion,
                n.datos_completo,  -- <--- ¡ESTA ES LA LÍNEA QUE FALTABA!
                e.nombre as empleado_nombre, 
                e.puesto,
                e.dni,
                e.nss,
                e.antiguedad
            FROM nominas n
            JOIN empleados e ON n.empleado_id = e.id
            ORDER BY n.anio DESC, n.mes DESC, n.id DESC
        `;

        const { rows } = await pool.query(query);
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Error al obtener historial" });
    }
});

app.get('/api/nominas/base-anterior', async (req, res) => {
    try {
        const { empleadoId, fechaBaja } = req.query;

        if (!empleadoId || !fechaBaja) {
            return res.status(400).json({ error: 'Faltan parámetros: empleadoId, fechaBaja' });
        }

        // Parsear fecha baja (YYYY-MM-DD)
        const dateBaja = new Date(fechaBaja);
        // Queremos el mes anterior
        // Restamos un mes a la fecha dada
        dateBaja.setMonth(dateBaja.getMonth() - 1);

        const targetAnio = dateBaja.getFullYear();
        // getMonth() devuelve 0-11, sumamos 1 para guardar como 1-12
        const targetMes = dateBaja.getMonth() + 1;

        // Buscar en BD
        const query = `
            SELECT base_cc 
            FROM nominas 
            WHERE empleado_id = $1 AND anio = $2 AND mes = $3
            LIMIT 1
        `;

        const result = await pool.query(query, [empleadoId, targetAnio, targetMes]);

        if (result.rows.length > 0) {
            res.json({ base: parseFloat(result.rows[0].base_cc) });
        } else {
            res.json({ base: null });
        }

    } catch (e) {
        console.error("Error buscando base anterior:", e);
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/nominas/acumulado', async (req, res) => {
    try {
        const { empleadoId, anio, mes } = req.query;

        if (!empleadoId || !anio) {
            return res.status(400).json({ error: 'Faltan parámetros: empleadoId, anio' });
        }

        // Si se paso mes, exlcuimos ese mes en adelante (para no sumar el mes que estamos calculando actualmente si ya existiera borrador)
        // O simplemente sumamos todo lo ANTERIOR a ese mes.
        // La consulta sumara todo lo del año dado para ese empleado
        // Opcional: AND mes < $3

        let query = `
            SELECT 
                COALESCE(SUM(total_devengado), 0) as total_ingresos,
                COALESCE(SUM(cuota_irpf), 0) as total_retenido
            FROM nominas
            WHERE empleado_id = $1 AND anio = $2
        `;

        const params = [empleadoId, parseInt(anio)];

        if (mes) {
            query += ` AND mes < $3`;
            params.push(parseInt(mes));
        }

        const result = await pool.query(query, params);

        const acumulado = result.rows[0] || { total_ingresos: 0, total_retenido: 0 };

        // Convert to numbers just in case
        res.json({
            totalIngresos: parseFloat(acumulado.total_ingresos),
            totalRetenido: parseFloat(acumulado.total_retenido)
        });

    } catch (e) {
        console.error("Error obteniendo acumulados:", e);
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/guardar', async (req, res) => {
    // 1. Extraemos también 'mes' y 'anio' y el nuevo flag 'overwrite'
    const { empleado, periodo, nomina, mes, anio, overwrite } = req.body;

    try {
        // 2. Lógica de Fallback de seguridad:
        let anioFinal = parseInt(anio);
        let mesFinal = parseInt(mes);

        if (isNaN(anioFinal) && periodo && periodo.anio) anioFinal = parseInt(periodo.anio);
        if (isNaN(mesFinal) && periodo && periodo.mes) mesFinal = parseInt(periodo.mes);

        if ((isNaN(anioFinal) || isNaN(mesFinal)) && periodo && periodo.inicio) {
            const fechaObj = new Date(periodo.inicio);
            if (!isNaN(fechaObj.getTime())) {
                anioFinal = fechaObj.getFullYear();
                mesFinal = fechaObj.getMonth() + 1;
            }
        }

        if (isNaN(anioFinal) || isNaN(mesFinal)) {
            console.error("Error backend: Mes o Año son NaN", req.body);
            return res.status(400).json({ error: "No se pudo determinar el Mes o Año de la nómina. Verifique las fechas." });
        }

        // --- PREVENCIÓN DE DUPLICADOS ---
        const checkQuery = `SELECT id FROM nominas WHERE empleado_id = $1 AND anio = $2 AND mes = $3`;
        const checkResult = await pool.query(checkQuery, [empleado.id, anioFinal, mesFinal]);

        if (checkResult.rows.length > 0) {
            if (!overwrite) {
                return res.json({
                    success: false,
                    exists: true,
                    message: `Ya existe una nómina para ${empleado.nombre} en ${mesFinal}/${anioFinal}. ¿Deseas sobreescribirla?`
                });
            } else {
                // Si overwrite es true, borramos el registro anterior antes de insertar el nuevo
                await pool.query(`DELETE FROM nominas WHERE empleado_id = $1 AND anio = $2 AND mes = $3`, [empleado.id, anioFinal, mesFinal]);
            }
        }

        const values = [
            empleado.id,
            anioFinal,
            mesFinal,
            parseFloat(nomina.diasCotizados || 0),
            parseFloat(nomina.baseContingenciasComunes || 0),
            parseFloat(nomina.baseContingenciasProfesionales || 0),
            parseFloat(nomina.baseIRPF || 0),
            parseFloat(nomina.cuotaIRPF || nomina.deduccionIRPF || 0),
            parseFloat(nomina.totalDevengado || nomina.totalDevengos || 0),
            parseFloat(nomina.salarioNeto || 0),
            JSON.stringify(req.body)
        ];

        await pool.query(`
            INSERT INTO nominas (
                empleado_id, anio, mes, dias_cotizados, 
                base_cc, base_cp, base_irpf, cuota_irpf, 
                total_devengado, liquido_percibir, datos_completo
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        `, values);

        res.json({ success: true });
    } catch (e) {
        console.error("Error SQL:", e);
        res.status(500).json({ error: e.message });
    }
});

// --- ENDPOINT: Borrar nómina por ID ---
app.delete('/api/nominas/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query('DELETE FROM nominas WHERE id = $1', [id]);
        res.json({ success: true });
    } catch (err) {
        console.error("Error al borrar nómina:", err);
        res.status(500).json({ error: "Error al borrar la nómina del servidor" });
    }
});


app.get('/api/historial', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM nominas ORDER BY fecha_creacion DESC LIMIT 50');
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});


// --- RUTA COMODÍN (Catch-all) ---
// Usamos RegExp para compatibilidad con Express 5.
// Redirige cualquier ruta no conocida al login.
app.get(/.*/, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// --- ENDPOINT: Obtener las últimas 6 cotizaciones para Certificado de Empresa ---
app.get('/api/nominas/ultimas-cotizaciones/:empleadoId', async (req, res) => {
    const { empleadoId } = req.params;
    try {
        const query = `
            SELECT anio, mes, dias_cotizados, base_cp
            FROM nominas
            WHERE empleado_id = $1
            ORDER BY anio DESC, mes DESC
            LIMIT 6
        `;
        const result = await pool.query(query, [empleadoId]);
        res.json(result.rows);
    } catch (err) {
        console.error("Error al obtener últimas cotizaciones:", err);
        res.status(500).json({ error: "Error al obtener cotizaciones del servidor" });
    }
});

// Arrancar servidor
app.listen(port, () => {
    console.log(`Servidor escuchando en puerto ${port}`);
});