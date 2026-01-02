/**
 * Generador de Certificado de Empresa - Estilo Oficial SEPE
 * Versión 2.0: Márgenes ajustados y filas de totales/vacaciones
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

    // Colores
    const colorBorde = [0, 0, 0];
    const colorRellenoCabecera = [230, 230, 230]; // Gris un poco más claro

    // Helpers de dibujo
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
        const textVal = String(value || '').substring(0, 50);
        doc.text(textVal, x + 1, y + 8);
    };

    // --- 1. CABECERA ---
    let y = 15;
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

    // --- 2. DATOS DE LA EMPRESA (Caja Ampliada) ---
    // Aumentamos altura a 40 para más aire abajo
    const hEmpresa = 40;
    drawBox(MARGIN, y, CONTENT_WIDTH, hEmpresa, "DATOS DE LA EMPRESA");

    let yBox = y + 8; // Un poco más de margen superior interno
    // Fila 1
    drawField("NOMBRE O RAZÓN SOCIAL", empresa.nombre, MARGIN + 2, yBox, CONTENT_WIDTH - 4);

    yBox += 11; // Más separación entre filas
    // Fila 2
    drawField("NIF / CIF", empresa.cif, MARGIN + 2, yBox, 40);
    drawField("CÓDIGO CUENTA COTIZACIÓN (Seguridad Social)", empresa.ccc, MARGIN + 50, yBox, 60);

    yBox += 11;
    // Fila 3
    drawField("DOMICILIO SOCIAL", empresa.domicilio, MARGIN + 2, yBox, CONTENT_WIDTH - 4);

    y += hEmpresa + 6; // Separación entre cajas

    // --- 3. DATOS DEL TRABAJADOR (Caja Ampliada) ---
    // Aumentamos altura a 32 para más aire abajo
    const hTrabajador = 32;
    drawBox(MARGIN, y, CONTENT_WIDTH, hTrabajador, "DATOS DEL TRABAJADOR");

    yBox = y + 8;
    // Fila 1
    drawField("APELLIDOS Y NOMBRE", empleado.nombre, MARGIN + 2, yBox, CONTENT_WIDTH - 4);

    yBox += 11;
    // Fila 2
    drawField("NIF / NIE", empleado.dni, MARGIN + 2, yBox, 40);
    drawField("NÚMERO DE AFILIACIÓN A LA S.S.", empleado.ss, MARGIN + 50, yBox, 60);
    drawField("CATEGORÍA / GRUPO", empleado.cotizacion || 'Ver Contrato', MARGIN + 120, yBox, 50);

    y += hTrabajador + 6;

    // --- 4. CAUSA DE EXTINCIÓN ---
    const hCausa = 28;
    drawBox(MARGIN, y, CONTENT_WIDTH, hCausa, "CAUSA DE LA EXTINCIÓN DE LA RELACIÓN LABORAL");

    yBox = y + 8;
    drawField("CAUSA / MOTIVO", causa || 'Fin de contrato', MARGIN + 2, yBox, CONTENT_WIDTH - 50);

    let fechaStr = fechaBaja || new Date().toLocaleDateString();
    try {
        const fechaObj = new Date(fechaBaja);
        if (!isNaN(fechaObj.getTime())) {
            fechaStr = fechaObj.toLocaleDateString('es-ES');
        }
    } catch (e) { }

    drawField("FECHA DE BAJA", fechaStr, MARGIN + 140, yBox, 40);

    y += hCausa + 10;

    // --- 5. TABLA DE COTIZACIONES ---
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

    // Preparar datos
    let dataTable = [];
    if (Array.isArray(cotizaciones)) {
        dataTable = cotizaciones.map(c => ({
            anio: c.anio,
            mes: c.mes,
            dias: parseFloat(c.dias_cotizados).toFixed(0),
            base: parseFloat(c.base_cp).toFixed(2)
        }));
    }

    // CALCULAR TOTALES
    const totalDias = cotizaciones.reduce((acc, c) => acc + (parseFloat(c.dias_cotizados) || 0), 0);
    const totalBase = cotizaciones.reduce((acc, c) => acc + (parseFloat(c.base_cp) || 0), 0);

    // --- FILA EXTRA: VACACIONES (13) ---
    // Como el dato de vacaciones suele ser aparte, lo añadimos visualmente a la tabla.
    // Nota: Aquí lo ponemos a 0 o vacío por defecto ya que no viene en el array 'cotizaciones' estándar.
    // Si tuvieras el dato real, habría que pasarlo a la función.
    dataTable.push({
        anio: '',
        mes: 'Vacaciones (13)',
        dias: '', // O poner '0' si prefieres
        base: ''  // O poner '0.00'
    });

    // --- PIE DE TABLA: TOTALES ---
    // Usamos el hook de 'foot' de autotable
    const footData = [
        [
            { content: 'TOTALES', colSpan: 2, styles: { halign: 'center', fontStyle: 'bold' } },
            { content: totalDias.toFixed(0), styles: { halign: 'center', fontStyle: 'bold' } },
            { content: totalBase.toFixed(2) + " €", styles: { halign: 'right', fontStyle: 'bold' } }
        ]
    ];

    if (doc.autoTable) {
        doc.autoTable({
            startY: y + 2,
            margin: { left: MARGIN, right: MARGIN },
            columns: columns,
            body: dataTable,
            foot: footData, // Añadimos el pie
            theme: 'plain',
            headStyles: {
                fillColor: [230, 230, 230],
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
            footStyles: {
                fillColor: [240, 240, 240], // Un gris diferente para totales
                textColor: 0,
                lineWidth: 0.1,
                lineColor: 0
            },
            columnStyles: {
                dias: { halign: 'center' },
                base: { halign: 'right' },
                anio: { halign: 'center' },
                mes: { halign: 'center' }
            },
            // Hook para detectar la fila de "Vacaciones" y darle estilo si se desea
            didParseCell: function (data) {
                if (data.section === 'body' && data.row.raw.mes === 'Vacaciones (13)') {
                    // Opcional: Poner en cursiva la fila de vacaciones
                    data.cell.styles.fontStyle = 'italic';
                }
            }
        });

        y = doc.lastAutoTable.finalY + 15;
    }

    // --- 6. FIRMA ---
    doc.setDrawColor(0);
    doc.rect(MARGIN, y, CONTENT_WIDTH, 35);

    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.text("Declaro bajo mi responsabilidad que son ciertos los datos consignados en el presente certificado.", MARGIN + 2, y + 5);

    const hoyFirma = new Date();
    const meses = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
    const fechaFirma = `En EL PUERTO DE STA MARIA, a ${hoyFirma.getDate()} de ${meses[hoyFirma.getMonth()]} de ${hoyFirma.getFullYear()}`;

    // 2. Define el tamaño de la imagen en mm
    const anchoFirma = 40; // 4 cm de ancho
    const altoFirma = 40;  // 3.5 cm de alto

    // 3. Define la posición (x, y)
    // MARGIN es la 'x' (15)
    // Calculamos la 'y' para que esté encima del texto "Firma y sello"
    const yImagen = y + 5; // 5mm por debajo del texto

    try {
        // 4. Dibuja la imagen
        doc.addImage(firmaBase64, 'PNG', MARGIN + 120, yImagen, anchoFirma, altoFirma);
    } catch (e) {
        console.error("Error al añadir la imagen de la firma:", e);
        doc.text("[Error al cargar firma]", MARGIN + 120, y); // Texto alternativo si falla
    }
    doc.setFontSize(10);
    doc.text(fechaFirma, MARGIN + 2, y + 15);
    doc.setFont("helvetica", "bold");
    doc.text("SELLO Y FIRMA DE LA EMPRESA", MARGIN + 120, y + 15);

    // Nombre de archivo limpio
    const nombreArchivo = (empleado.nombre || 'Trabajador').replace(/[^a-zA-Z0-9]/g, '_');
    doc.save(`Certificado_SEPE_${nombreArchivo}.pdf`);
}