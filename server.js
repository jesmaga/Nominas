const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

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
    // 1. Extraemos también 'mes' y 'anio' del cuerpo de la petición
    const { empleado, periodo, nomina, mes, anio } = req.body;

    try {
        // 2. Lógica de Fallback de seguridad:
        // Intentamos leer el año/mes enviados explícitamente.
        // Si no existen, intentamos leerlos del objeto periodo.
        // Si no existen, intentamos extraerlos de la fecha de inicio del periodo.
        let anioFinal = parseInt(anio);
        let mesFinal = parseInt(mes);

        // Si falló lo anterior (es NaN), intentamos sacarlo del objeto periodo antiguo
        if (isNaN(anioFinal) && periodo && periodo.anio) anioFinal = parseInt(periodo.anio);
        if (isNaN(mesFinal) && periodo && periodo.mes) mesFinal = parseInt(periodo.mes);

        // Si SIGUE siendo NaN, intentamos parsear la fecha string "YYYY-MM-DD"
        if ((isNaN(anioFinal) || isNaN(mesFinal)) && periodo && periodo.inicio) {
            const fechaObj = new Date(periodo.inicio);
            if (!isNaN(fechaObj.getTime())) {
                anioFinal = fechaObj.getFullYear();
                mesFinal = fechaObj.getMonth() + 1;
            }
        }

        // 3. ULTIMA DEFENSA: Si sigue siendo NaN, detenemos todo para no romper la BD
        if (isNaN(anioFinal) || isNaN(mesFinal)) {
            console.error("Error backend: Mes o Año son NaN", req.body);
            return res.status(400).json({ error: "No se pudo determinar el Mes o Año de la nómina. Verifique las fechas." });
        }

        const values = [
            empleado.id,
            anioFinal, // Usamos la variable calculada y limpia
            mesFinal,  // Usamos la variable calculada y limpia
            parseFloat(nomina.diasCotizados || 0),
            parseFloat(nomina.baseContingenciasComunes || 0), // OJO: Asegúrate que el frontend manda este nombre exacto o usa nomina.baseCotizacion
            parseFloat(nomina.baseContingenciasProfesionales || 0),
            parseFloat(nomina.baseIRPF || 0),
            parseFloat(nomina.cuotaIRPF || nomina.deduccionIRPF || 0), // Fallback por si cambia el nombre
            parseFloat(nomina.totalDevengado || nomina.totalDevengos || 0),
            parseFloat(nomina.salarioNeto || 0),
            JSON.stringify(req.body)
        ];

        // Mapeo de campos corregido para coincidir con tu esquema de BD:
        // base_cc, base_cp, base_irpf, cuota_irpf, total_devengado, liquido_percibir

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