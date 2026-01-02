/**
 * Generador de Certificado de Empresa - Estilo Oficial SEPE
 * Versión 2.1: Soporte para Vacaciones Retribuidas (input manual)
 */

function generarCertificadoEmpresa(empresa, empleado, cotizaciones, causa, fechaBaja, diasVac, baseVac) {
    if (!window.jspdf) {
        alert("Error: La librería jsPDF no está cargada correctamente.");
        return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p', 'mm', 'a4');

    // CONFIGURACIÓN
    const MARGIN = 15;
    const PAGE_WIDTH = 210;
    const CONTENT_WIDTH = PAGE_WIDTH - (MARGIN * 2);
    const colorBorde = [0, 0, 0];
    const colorRellenoCabecera = [230, 230, 230];

    // Helpers
    const drawBox = (x, y, w, h, title = null) => {
        doc.setDrawColor(...colorBorde);
        doc.setLineWidth(0.3);
        doc.rect(x, y, w, h);
        if (title) {
            doc.setFillColor(...colorRellenoCabecera);
            doc.rect(x, y, w, 6, 'F');
            doc.rect(x, y, w, 6, 'S');
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
        doc.text(label, x + 1, y + 3);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.setTextColor(0, 0, 0);
        doc.text(String(value || '').substring(0, 50), x + 1, y + 8);
    };

    // --- DIBUJO DEL DOCUMENTO ---
    let y = 15;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("CERTIFICADO DE EMPRESA", PAGE_WIDTH / 2, y, { align: "center" });
    y += 6;
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text("MINISTERIO DE TRABAJO Y ECONOMÍA SOCIAL - SEPE", PAGE_WIDTH / 2, y, { align: "center" });
    y += 15;

    // Caja Empresa
    const hEmpresa = 40;
    drawBox(MARGIN, y, CONTENT_WIDTH, hEmpresa, "DATOS DE LA EMPRESA");
    drawField("NOMBRE O RAZÓN SOCIAL", empresa.nombre, MARGIN + 2, y + 8, CONTENT_WIDTH - 4);
    drawField("NIF / CIF", empresa.cif, MARGIN + 2, y + 19, 40);
    drawField("CÓDIGO CUENTA COTIZACIÓN", empresa.ccc, MARGIN + 50, y + 19, 60);
    drawField("DOMICILIO SOCIAL", empresa.domicilio, MARGIN + 2, y + 30, CONTENT_WIDTH - 4);
    y += hEmpresa + 6;

    // Caja Trabajador
    const hTrabajador = 32;
    drawBox(MARGIN, y, CONTENT_WIDTH, hTrabajador, "DATOS DEL TRABAJADOR");
    drawField("APELLIDOS Y NOMBRE", empleado.nombre, MARGIN + 2, y + 8, CONTENT_WIDTH - 4);
    drawField("NIF / NIE", empleado.dni, MARGIN + 2, y + 19, 40);
    drawField("Nº AFILIACIÓN S.S.", empleado.ss, MARGIN + 50, y + 19, 60);
    drawField("CATEGORÍA / GRUPO", empleado.cotizacion, MARGIN + 120, y + 19, 50);
    y += hTrabajador + 6;

    // Caja Causa
    const hCausa = 28;
    drawBox(MARGIN, y, CONTENT_WIDTH, hCausa, "CAUSA DE LA EXTINCIÓN");
    drawField("CAUSA / MOTIVO", causa, MARGIN + 2, y + 8, CONTENT_WIDTH - 50);
    let fechaStr = fechaBaja;
    try { fechaStr = new Date(fechaBaja).toLocaleDateString('es-ES'); } catch (e) { }
    drawField("FECHA DE BAJA", fechaStr, MARGIN + 140, y + 8, 40);
    y += hCausa + 10;

    // Tabla Cotizaciones
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("COTIZACIONES DE LOS ÚLTIMOS 180 DÍAS", MARGIN, y);
    y += 2;

    const columns = [
        { header: 'AÑO', dataKey: 'anio' },
        { header: 'MES', dataKey: 'mes' },
        { header: 'DÍAS', dataKey: 'dias' },
        { header: 'BASE DE COTIZACIÓN', dataKey: 'base' }
    ];

    let dataTable = [];
    if (Array.isArray(cotizaciones)) {
        dataTable = cotizaciones.map(c => ({
            anio: c.anio,
            mes: c.mes,
            dias: parseFloat(c.dias_cotizados).toFixed(0),
            base: parseFloat(c.base_cp).toFixed(2)
        }));
    }

    // --- GESTIÓN DE VACACIONES ---
    const diasV = parseFloat(diasVac) || 0;
    const baseV = parseFloat(baseVac) || 0;

    dataTable.push({
        anio: '',
        mes: 'Vacaciones (13)',
        dias: diasV > 0 ? diasV.toFixed(0) : '',
        base: baseV > 0 ? baseV.toFixed(2) : ''
    });

    // TOTALES (Incluyendo vacaciones)
    const totalDias = cotizaciones.reduce((acc, c) => acc + (parseFloat(c.dias_cotizados) || 0), 0) + diasV;
    const totalBase = cotizaciones.reduce((acc, c) => acc + (parseFloat(c.base_cp) || 0), 0) + baseV;

    const footData = [[
        { content: 'TOTALES', colSpan: 2, styles: { halign: 'center', fontStyle: 'bold' } },
        { content: totalDias.toFixed(0), styles: { halign: 'center', fontStyle: 'bold' } },
        { content: totalBase.toFixed(2) + " €", styles: { halign: 'right', fontStyle: 'bold' } }
    ]];

    if (doc.autoTable) {
        doc.autoTable({
            startY: y + 2,
            margin: { left: MARGIN, right: MARGIN },
            columns: columns,
            body: dataTable,
            foot: footData,
            theme: 'plain',
            headStyles: { fillColor: [230, 230, 230], textColor: 0, fontStyle: 'bold', lineWidth: 0.1, lineColor: 0 },
            bodyStyles: { textColor: 0, lineWidth: 0.1, lineColor: 0, minCellHeight: 8, valign: 'middle' },
            footStyles: { fillColor: [240, 240, 240], textColor: 0, lineWidth: 0.1, lineColor: 0 },
            columnStyles: { dias: { halign: 'center' }, base: { halign: 'right' }, anio: { halign: 'center' }, mes: { halign: 'center' } },
            didParseCell: function (data) {
                if (data.section === 'body' && data.row.raw.mes === 'Vacaciones (13)') {
                    data.cell.styles.fontStyle = 'italic';
                }
            }
        });
        y = doc.lastAutoTable.finalY + 15;
    }

    // Firma
    doc.setDrawColor(0);
    doc.rect(MARGIN, y, CONTENT_WIDTH, 35);
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.text("Declaro bajo mi responsabilidad que son ciertos los datos consignados.", MARGIN + 2, y + 5);

    const hoy = new Date();
    const meses = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

    // 2. Define el tamaño de la imagen en mm
    const anchoFirma = 40; // 4 cm de ancho
    const altoFirma = 35;  // 4 cm de alto

    // 3. Define la posición (x, y)
    // MARGIN es la 'x' (15)
    // Calculamos la 'y' para que esté encima del texto "Firma y sello"
    const yImagen = y; // 5mm por encima del texto

    try {
        // 4. Dibuja la imagen
        doc.addImage(firmaBase64, 'PNG', MARGIN + 120, yImagen, anchoFirma, altoFirma);
    } catch (e) {
        console.error("Error al añadir la imagen de la firma:", e);
        doc.text("[Error al cargar firma]", MARGIN + 120, yImagen); // Texto alternativo si falla
    }
    doc.setFontSize(10);
    doc.text(`En EL PUERTO DE STA MARIA, a ${hoy.getDate()} de ${meses[hoy.getMonth()]} de ${hoy.getFullYear()}`, MARGIN + 2, y + 15);
    doc.setFont("helvetica", "bold");
    doc.text("SELLO Y FIRMA DE LA EMPRESA", MARGIN + 120, y + 15);

    const nombreArchivo = (empleado.nombre || 'Trabajador').replace(/[^a-zA-Z0-9]/g, '_');
    doc.save(`Certificado_SEPE_${nombreArchivo}.pdf`);
}