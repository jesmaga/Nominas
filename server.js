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
        await client.query('DROP TABLE IF EXISTS nominas');

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
app.post('/api/guardar', async (req, res) => {
    const { empleado, periodo, nomina } = req.body;
    try {
        const values = [
            empleado.id,
            parseInt(periodo.anio),
            parseInt(periodo.mes),
            parseFloat(nomina.diasCotizados || 0),
            parseFloat(nomina.baseContingenciasComunes || 0),
            parseFloat(nomina.baseContingenciasProfesionales || 0),
            parseFloat(nomina.baseIRPF || 0),
            parseFloat(nomina.cuotaIRPF || 0),
            parseFloat(nomina.totalDevengado || 0),
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
    } catch (e) { res.status(500).json({ error: e.message }); }
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

// Arrancar servidor
app.listen(port, () => {
    console.log(`Servidor escuchando en puerto ${port}`);
});