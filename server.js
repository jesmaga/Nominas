const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// Configuración de la conexión a Neon (PostgreSQL)
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Inicializar Base de Datos
const initDB = async () => {
    const client = await pool.connect();
    try {
        // 1. Tabla Empleados
        await client.query(`
            CREATE TABLE IF NOT EXISTS empleados (
                id SERIAL PRIMARY KEY,
                nombre VARCHAR(100) NOT NULL,
                puesto VARCHAR(100),
                salario_base NUMERIC(10, 2) NOT NULL,
                pagas INTEGER DEFAULT 14,
                irpf NUMERIC(5, 2) DEFAULT 0,
                hijos INTEGER DEFAULT 0,
                discapacidad NUMERIC(5, 2) DEFAULT 0,
                ascendientes INTEGER DEFAULT 0,
                tipo_contrato VARCHAR(50),
                dni VARCHAR(20),
                nss VARCHAR(20),
                antiguedad DATE
            );
        `);

        // 2. Tabla Nóminas
        // NOTA: La línea DROP TABLE está comentada para evitar borrar datos al reiniciar
        // await client.query('DROP TABLE IF EXISTS nominas');

        await client.query(`
            CREATE TABLE IF NOT EXISTS nominas (
                id SERIAL PRIMARY KEY,
                empleado_id INTEGER REFERENCES empleados(id) ON DELETE CASCADE,
                anio INTEGER NOT NULL,
                mes INTEGER NOT NULL,
                dias_cotizados NUMERIC(5, 2) DEFAULT 30,
                base_cc NUMERIC(10, 2),
                base_cp NUMERIC(10, 2),
                base_irpf NUMERIC(10, 2),
                cuota_irpf NUMERIC(10, 2),
                total_devengado NUMERIC(10, 2),
                liquido_percibir NUMERIC(10, 2),
                datos_completo JSONB,
                fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        console.log('Tablas verificadas/creadas correctamente');
    } catch (err) {
        console.error('Error inicializando DB:', err);
    } finally {
        client.release();
    }
};

initDB();

// --- RUTAS DE LA API ---

// 1. Obtener empleados
app.get('/api/empleados', async (req, res) => {
    try {
        const { rows } = await pool.query('SELECT * FROM empleados ORDER BY id ASC');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 2. Crear empleado
app.post('/api/empleados', async (req, res) => {
    const { nombre, puesto, salario, pagas, irpf, hijos, discapacidad, ascendientes, tipoContrato, dni, nss, antiguedad } = req.body;
    try {
        const { rows } = await pool.query(
            'INSERT INTO empleados (nombre, puesto, salario_base, pagas, irpf, hijos, discapacidad, ascendientes, tipo_contrato, dni, nss, antiguedad) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *',
            [nombre, puesto, salario, pagas, irpf, hijos, discapacidad, ascendientes, tipoContrato, dni, nss, antiguedad]
        );
        res.json(rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 3. Actualizar empleado
app.put('/api/empleados/:id', async (req, res) => {
    const { id } = req.params;
    const { nombre, puesto, salario, pagas, irpf, hijos, discapacidad, ascendientes, tipoContrato, dni, nss, antiguedad } = req.body;
    try {
        await pool.query(
            'UPDATE empleados SET nombre=$1, puesto=$2, salario_base=$3, pagas=$4, irpf=$5, hijos=$6, discapacidad=$7, ascendientes=$8, tipo_contrato=$9, dni=$10, nss=$11, antiguedad=$12 WHERE id=$13',
            [nombre, puesto, salario, pagas, irpf, hijos, discapacidad, ascendientes, tipoContrato, dni, nss, antiguedad, id]
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 4. Borrar empleado
app.delete('/api/empleados/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query('DELETE FROM empleados WHERE id=$1', [id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 5. Guardar Nómina
app.post('/api/guardar', async (req, res) => {
    const { empleado, periodo, nomina, mes, anio } = req.body;

    try {
        // Lógica para asegurar que mes y año son números válidos
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
            return res.status(400).json({ error: "No se pudo determinar el Mes o Año. Verifique fechas." });
        }

        const values = [
            empleado.id,
            anioFinal,
            mesFinal,
            parseFloat(nomina.diasCotizados || 30),
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

// 6. Obtener Historial de Nóminas (CORREGIDO)
app.get('/api/nominas', async (req, res) => {
    try {
        // AQUÍ ESTABA EL ERROR: Faltaba seleccionar 'datos_completo'
        const query = `
            SELECT 
                n.id, 
                n.anio, 
                n.mes, 
                n.total_devengado, 
                n.liquido_percibir, 
                n.fecha_creacion,
                n.datos_completo,  
                n.dias_cotizados,
                n.base_cp,
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

// 7. Obtener últimas cotizaciones (Para Certificado Empresa)
app.get('/api/nominas/ultimas-cotizaciones/:empleadoId', async (req, res) => {
    const { empleadoId } = req.params;
    try {
        const query = `
            SELECT 
                anio, mes, dias_cotizados, base_cp 
            FROM nominas 
            WHERE empleado_id = $1 
            ORDER BY anio DESC, mes DESC 
            LIMIT 6
        `;
        const { rows } = await pool.query(query, [empleadoId]);
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Error al obtener cotizaciones" });
    }
});

// 8. Borrar Nómina (Historial)
app.delete('/api/nominas/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query('DELETE FROM nominas WHERE id=$1', [id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.listen(port, () => {
    console.log(`Servidor corriendo en puerto ${port}`);
});