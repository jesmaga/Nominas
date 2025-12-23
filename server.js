const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// Conexión a Base de Datos NEON
// Render inyectará la variable DATABASE_URL automáticamente
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

// Middleware
app.use(cors());
app.use(express.json());

// IMPORTANTE: Aquí decimos que sirva los archivos de la carpeta 'public'
app.use(express.static(path.join(__dirname, 'public')));

// --- Inicializar Tabla en Neon (Se ejecuta al iniciar) ---
const initDB = async () => {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS nominas (
                id SERIAL PRIMARY KEY,
                empleado_nombre TEXT NOT NULL,
                dni TEXT,
                periodo_inicio DATE,
                periodo_fin DATE,
                neto NUMERIC,
                datos_completo JSONB,
                fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log("--> Base de datos Neon conectada y tabla verificada.");
    } catch (err) {
        console.error("Error conectando a Neon:", err);
    }
};
initDB();

// --- API (Backend) ---

// Guardar nómina
app.post('/api/guardar', async (req, res) => {
    const { empleado, periodo, nomina } = req.body;
    try {
        const query = `
            INSERT INTO nominas (empleado_nombre, dni, periodo_inicio, periodo_fin, neto, datos_completo)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING id
        `;
        const values = [
            empleado.nombre,
            empleado.dni,
            periodo.inicio,
            periodo.fin,
            nomina.salarioNeto,
            JSON.stringify(req.body)
        ];
        const result = await pool.query(query, values);
        res.json({ success: true, id: result.rows[0].id });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Leer historial
app.get('/api/historial', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM nominas ORDER BY fecha_creacion DESC LIMIT 50');
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Ruta por defecto para cargar la app
app.get('/(.*)', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.listen(port, () => {
    console.log(`Servidor web corriendo en puerto ${port}`);
});