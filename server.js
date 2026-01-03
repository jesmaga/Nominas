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

// --- EXTRACTOR DE DATOS ROBUSTO ---
const extractDataFromPDF = (text) => {
    const data = {};
    const rawText = text;
    const lowerText = text.toLowerCase();

    // 1. DNI (Busca 8 dígitos + letra, con o sin guión ignorando espacios extra)
    // Limpiamos el texto de espacios excesivos para facilitar la búsqueda
    const cleanText = rawText.replace(/\s+/g, ' ');
    const dniMatch = cleanText.match(/\b(\d{8})[- ]?([A-Z])\b/i);

    if (dniMatch) {
        // Formateamos el DNI sin guiones y en mayúsculas para que coincida con lo guardado en BD
        data.dni = (dniMatch[1] + dniMatch[2]).toUpperCase();
    }

    // 2. FECHA (Texto o Numérica)
    const meses = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

    // Año
    const anioMatch = rawText.match(/\b(20\d{2})\b/);
    if (anioMatch) data.anio = parseInt(anioMatch[1]);

    // Mes (Texto)
    const mesTextoIndex = meses.findIndex(m => lowerText.includes(m));
    if (mesTextoIndex !== -1) {
        data.mes = mesTextoIndex + 1;
    } else {
        // Mes (Numérico dd/mm/yyyy)
        const fechaNumMatch = rawText.match(/(\d{2})[\/\-](\d{2})[\/\-](20\d{2})/);
        if (fechaNumMatch) {
            data.mes = parseInt(fechaNumMatch[2]);
            // Si no habíamos encontrado año antes, usamos este
            if (!data.anio) data.anio = parseInt(fechaNumMatch[3]);
        }
    }

    // 3. VALORES MONETARIOS
    // Liquido
    const liquidoMatch = rawText.match(/(?:Líquido|Neto|Percibir|Liquido)[^0-9]*([\d\.,]+)\s*€?/i);
    if (liquidoMatch) data.liquido_percibir = parseSpanishNumber(liquidoMatch[1]);

    // Devengado
    const devengadoMatch = rawText.match(/Total\s+Devengado[^0-9]*([\d\.,]+)/i);
    if (devengadoMatch) data.total_devengado = parseSpanishNumber(devengadoMatch[1]);

    // Bases
    const baseCCMatch = rawText.match(/Base.*?Comunes[^0-9]*([\d\.,]+)/i);
    if (baseCCMatch) data.base_cc = parseSpanishNumber(baseCCMatch[1]);

    const baseCPMatch = rawText.match(/Base.*?(?:Profesionales|Accidentes)[^0-9]*([\d\.,]+)/i);
    if (baseCPMatch) data.base_cp = parseSpanishNumber(baseCPMatch[1]);

    const baseIRPFMatch = rawText.match(/Base.*?(?:IRPF|Retención)[^0-9]*([\d\.,]+)/i);
    if (baseIRPFMatch) data.base_irpf = parseSpanishNumber(baseIRPFMatch[1]);

    const cuotaIRPFMatch = rawText.match(/(?:Cuota|Retención).*?IRPF[^0-9]*([\d\.,]+)/i);
    if (cuotaIRPFMatch) data.cuota_irpf = parseSpanishNumber(cuotaIRPFMatch[1]);

    return data;
};

// --- ENDPOINT: IMPORTACIÓN MASIVA (CON SOPORTE PASSWORD Y FILTRO HORARIOS) ---
app.post('/api/importar-pdf', upload.single('nominaPdf'), async (req, res) => {

    console.log("--> Body recibido:", req.body);
    console.log("--> Contraseña recibida:", req.body.password);
    console.log("--> Archivo recibido:", req.file);

    if (!req.file) return res.status(400).json({ error: "No se subió ningún archivo." });

    const password = req.body.password || ""; // Recibimos la contraseña del frontend

    try {
        let pdfBuffer = req.file.buffer;

        // 1. GESTIÓN DE CONTRASEÑA (Desbloquear PDF si es necesario)
        try {
            // Intentamos cargar. Si el PDF tiene pass y no lo enviamos (o es incorrecto), falla.
            const pdfDoc = await PDFDocument.load(req.file.buffer, {
                password: password,
                ignoreEncryption: false
            });

            // Si carga bien, guardamos una versión "limpia" (sin encriptar)
            pdfBuffer = await pdfDoc.save();

        } catch (err) {
            console.error("Error PDF Load:", err.message); // Ver el error real en consola

            // Detectar si está encriptado (mensaje típico: "EncryptedPDFError")
            if (err.message.includes('Encrypted') || err.message.includes('Password')) {
                // Si el usuario no envió pass, pedirla
                if (!password) {
                    return res.status(400).json({ error: "El PDF está protegido. Por favor, introduce la contraseña." });
                } else {
                    // Si envió pass pero falló, es incorrecta
                    return res.status(400).json({ error: "Contraseña incorrecta." });
                }
            }
            // Si es otro error (ej. archivo corrupto), dejamos que continue o lanzamos error
            throw err;
        }

        // 2. LEER TEXTO (Usando el buffer desbloqueado)
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

        await pdfParse(pdfBuffer, { pagerender: render_page });

        const results = {
            total: pageTexts.length,
            processed: 0,
            failed: 0,
            skipped: 0, // Nuevo contador para horarios
            details: []
        };

        // 3. PROCESAR PÁGINAS
        for (let i = 0; i < pageTexts.length; i++) {
            const text = pageTexts[i];
            const pageNum = i + 1;
            const extracted = extractDataFromPDF(text);
            const lowerText = text.toLowerCase();

            // A. DETECTAR SI ES UN HORARIO (Para saltarlo limpiamente)
            // Ajusta "horario" o "calendario" según lo que aparezca realmente en el PDF
            if (lowerText.includes('horario') || lowerText.includes('turno') || lowerText.includes('calendario laboral')) {
                // Verificamos que NO parezca una nómina (por si acaso)
                if (!lowerText.includes('líquido') && !lowerText.includes('percibir')) {
                    results.skipped++;
                    // Opcional: No añadir detalle para no ensuciar el log, o añadir como 'info'
                    // results.details.push({ page: pageNum, status: 'skipped', reason: 'Página de Horario detectada' });
                    continue;
                }
            }

            // B. VALIDACIÓN DE DNI
            if (!extracted.dni) {
                results.failed++;
                // Solo reportamos error si hay bastante texto (evitar hojas en blanco)
                if (text.trim().length > 50) {
                    results.details.push({ page: pageNum, status: 'error', reason: 'No se encontró DNI (¿Formato ilegible?)' });
                }
                continue;
            }

            // C. BUSCAR EMPLEADO (CORRECCIÓN SQL JSON)
            // IMPORTANTE: Buscamos dentro del objeto JSON 'datos'
            const empRes = await pool.query(
                "SELECT id, datos->>'nombre' as nombre FROM empleados WHERE datos->>'dni' = $1",
                [extracted.dni]
            );

            if (empRes.rows.length === 0) {
                results.failed++;
                console.log(`Fallo Pág ${pageNum}: DNI '${extracted.dni}' no existe en BD.`);
                results.details.push({ page: pageNum, status: 'error', reason: `DNI ${extracted.dni} no registrado` });
                continue;
            }

            const empleado = empRes.rows[0];
            const anio = extracted.anio || new Date().getFullYear();
            const mes = extracted.mes || (new Date().getMonth() + 1);

            // D. GUARDAR EN BD
            const values = [
                empleado.id,
                anio,
                mes,
                30,
                extracted.base_cc || 0,
                extracted.base_cp || 0,
                extracted.base_irpf || 0,
                extracted.cuota_irpf || 0,
                extracted.total_devengado || 0,
                extracted.liquido_percibir || 0,
                JSON.stringify({ origen: "importacion_pdf_lote", pagina: pageNum })
            ];

            // Sobrescribir si ya existe ese mes
            await pool.query("DELETE FROM nominas WHERE empleado_id = $1 AND anio = $2 AND mes = $3", [empleado.id, anio, mes]);

            await pool.query(`
                INSERT INTO nominas (
                    empleado_id, anio, mes, dias_cotizados, 
                    base_cc, base_cp, base_irpf, cuota_irpf, 
                    total_devengado, liquido_percibir, datos_completo
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            `, values);

            results.processed++;
            results.details.push({ page: pageNum, status: 'success', empleado: empleado.nombre, periodo: `${mes}/${anio}` });
        }

        res.json({ success: true, summary: results });

    } catch (e) {
        console.error("Error procesando PDF:", e);
        // Devolvemos el error limpio al frontend
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