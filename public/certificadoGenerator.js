/**
 * Generador de Certificado de Empresa - Estilo Oficial SEPE
 * Dibuja casillas y estructura idéntica al modelo oficial.
 */

function generarCertificadoEmpresa(empresa, empleado, cotizaciones, causa, fechaBaja) {
    if (!window.jspdf) {
        alert("Error: La librería jsPDF no está cargada correctamente.");
        return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p', 'mm', 'a4');

    // --- CONFIGURACIÓN ESTÉTICA ---
    const MARGIN = 15;
    const PAGE_WIDTH = 210;
    const CONTENT_WIDTH = PAGE_WIDTH - (MARGIN * 2);
    const LINE_HEIGHT = 5;

    // Colores y Estilos
    const colorBorde = [0, 0, 0]; // Negro
    const colorRellenoCabecera = [220, 220, 220]; // Gris claro para títulos de cajas

    // Helpers para dibujar cajas
    const drawBox = (x, y, w, h, title = null) => {
        doc.setDrawColor(...colorBorde);
        doc.setLineWidth(0.3);
        doc.rect(x, y, w, h);
        if (title) {
            doc.setFillColor(...colorRellenoCabecera);
            doc.rect(x, y, w, 6, 'F'); // Fondo título
            doc.rect(x, y, w, 6, 'S'); // Borde título
            doc.setFont("helvetica", "bold");
            doc.setFontSize(9);
            doc.setTextColor(0, 0, 0);
            doc.text(title.toUpperCase(), x + 2, y + 4.5);
        }
    };

    const drawField = (label, value, x, y, w) => {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7);
        doc.setTextColor(100, 100, 100);
        doc.text(label, x + 1, y + 3); // Etiqueta pequeña

        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.setTextColor(0, 0, 0);
        // Recortar texto si es muy largo
        const textVal = String(value || '').substring(0, 45);
        doc.text(textVal, x + 1, y + 8); // Valor
    };

    // --- 1. CABECERA OFICIAL ---
    let y = 15;

    // Logo Texto (Simulado)
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("CERTIFICADO DE EMPRESA", PAGE_WIDTH / 2, y, { align: "center" });

    y += 6;
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text("MINISTERIO DE TRABAJO Y ECONOMÍA SOCIAL - SEPE", PAGE_WIDTH / 2, y, { align: "center" });

    y += 5;
    doc.setFontSize(7);
    doc.text("A los efectos de la solicitud de prestaciones por desempleo", PAGE_WIDTH / 2, y, { align: "center" });

    y += 10;

    // --- 2. DATOS DE LA EMPRESA (Caja 1) ---
    const hEmpresa = 35;
    drawBox(MARGIN, y, CONTENT_WIDTH, hEmpresa, "DATOS DE LA EMPRESA");

    let yBox = y + 7;
    // Fila 1: Nombre
    drawField("NOMBRE O RAZÓN SOCIAL", empresa.nombre, MARGIN + 2, yBox, CONTENT_WIDTH - 4);

    yBox += 10;
    // Fila 2: CIF y CCC
    drawField("NIF / CIF", empresa.cif, MARGIN + 2, yBox, 40);
    drawField("CÓDIGO CUENTA COTIZACIÓN (Seguridad Social)", empresa.ccc, MARGIN + 50, yBox, 60);

    yBox += 10;
    // Fila 3: Domicilio
    drawField("DOMICILIO SOCIAL", empresa.domicilio, MARGIN + 2, yBox, CONTENT_WIDTH - 4);

    y += hEmpresa + 5;

    // --- 3. DATOS DEL TRABAJADOR (Caja 2) ---
    const hTrabajador = 25;
    drawBox(MARGIN, y, CONTENT_WIDTH, hTrabajador, "DATOS DEL TRABAJADOR");

    yBox = y + 7;
    // Fila 1: Nombre
    drawField("APELLIDOS Y NOMBRE", empleado.nombre, MARGIN + 2, yBox, CONTENT_WIDTH - 4);

    yBox += 10;
    // Fila 2: DNI y NSS
    drawField("NIF / NIE", empleado.dni, MARGIN + 2, yBox, 40);
    drawField("NÚMERO DE AFILIACIÓN A LA S.S.", empleado.ss, MARGIN + 50, yBox, 60);
    drawField("CATEGORÍA / GRUPO COTIZACIÓN", empleado.cotizacion || 'Ver Contrato', MARGIN + 120, yBox, 50);

    y += hTrabajador + 5;

    // --- 4. CAUSA DE EXTINCIÓN (Caja 3) ---
    const hCausa = 25;
    drawBox(MARGIN, y, CONTENT_WIDTH, hCausa, "CAUSA DE LA EXTINCIÓN DE LA RELACIÓN LABORAL");

    yBox = y + 7;
    drawField("CAUSA / MOTIVO", causa || 'Fin de contrato', MARGIN + 2, yBox, CONTENT_WIDTH - 50);

    // Formatear fecha baja
    let fechaStr = fechaBaja || new Date().toLocaleDateString();
    try {
        const fechaObj = new Date(fechaBaja);
        if (!isNaN(fechaObj.getTime())) {
            fechaStr = fechaObj.toLocaleDateString('es-ES');
        }
    } catch (e) { }

    drawField("FECHA DE BAJA (Último día)", fechaStr, MARGIN + 140, yBox, 40);

    y += hCausa + 10;

    // --- 5. COTIZACIONES (Tabla Oficial) ---
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("COTIZACIONES DE LOS ÚLTIMOS 180 DÍAS", MARGIN, y);
    y += 2;

    // Definición de columnas para AutoTable
    const columns = [
        { header: 'AÑO', dataKey: 'anio' },
        { header: 'MES', dataKey: 'mes' },
        { header: 'DÍAS COTIZADOS', dataKey: 'dias' },
        { header: 'BASE DE COTIZACIÓN (Desempleo)', dataKey: 'base' }
    ];

    // Preparar datos asegurando 6 filas (incluso si están vacías para rellenar a mano)
    let dataTable = [];
    if (Array.isArray(cotizaciones)) {
        dataTable = cotizaciones.map(c => ({
            anio: c.anio,
            mes: c.mes,
            dias: parseFloat(c.dias_cotizados).toFixed(0),
            base: parseFloat(c.base_cp).toFixed(2) + " €"
        }));
    }

    // Dibujar la tabla usando autoTable con estilo limpio
    if (doc.autoTable) {
        doc.autoTable({
            startY: y + 2,
            margin: { left: MARGIN, right: MARGIN },
            columns: columns,
            body: dataTable,
            theme: 'plain', // Estilo plano para parecer formulario oficial
            headStyles: {
                fillColor: [220, 220, 220],
                textColor: 0,
                fontStyle: 'bold',
                lineWidth: 0.1,
                lineColor: 0
            },
            bodyStyles: {
                textColor: 0,
                lineWidth: 0.1,
                lineColor: 0,
                minCellHeight: 8,
                valign: 'middle'
            },
            columnStyles: {
                dias: { halign: 'center' },
                base: { halign: 'right' },
                anio: { halign: 'center' },
                mes: { halign: 'center' }
            }
        });

        y = doc.lastAutoTable.finalY + 15;
    }

    // --- 6. PIE Y FIRMA ---
    // Recuadro de firma
    doc.setDrawColor(0);
    doc.rect(MARGIN, y, CONTENT_WIDTH, 40);

    // Texto legal pequeño
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.text("Declaro bajo mi responsabilidad que son ciertos los datos consignados en el presente certificado.", MARGIN + 2, y + 5);

    // Fecha y Lugar
    const hoy = new Date();
    const meses = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
    const fechaFirma = `En EL PUERTO DE STA MARIA, a ${hoy.getDate()} de ${meses[hoy.getMonth()]} de ${hoy.getFullYear()}`;

    doc.setFontSize(10);
    doc.text(fechaFirma, MARGIN + 2, y + 15);

    doc.setFont("helvetica", "bold");
    doc.text("SELLO Y FIRMA DE LA EMPRESA", MARGIN + 120, y + 15);

    // Espacio para sello (si tuvieras imagen de sello, iría aquí)
    // doc.addImage(imgData, 'PNG', MARGIN + 130, y + 20, 30, 15);

    // Guardar
    const nombreArchivo = (empleado.nombre || 'Trabajador').replace(/[^a-zA-Z0-9]/g, '_');
    doc.save(`Certificado_SEPE_${nombreArchivo}.pdf`);
}