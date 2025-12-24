/**
 * Generador de Certificado de Empresa para desempleo (SEPE)
 * Basado en el estilo de pdfGenerator.js
 */

function generarCertificadoEmpresa(empresa, empleado, cotizaciones, causa, fechaBaja) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p', 'mm', 'a4');

    // --- CONFIGURACIÓN DE ESTILO (Copiado de pdfGenerator.js) ---
    const MARGIN = 15;
    const headerStartY = 15;
    const boxHeight = 28;
    const lineHeight = 4.5;
    const separatorX = 102.5;
    const col1X = MARGIN + 2;
    const col2X = separatorX + 2;
    const labelSize = 8;
    const valueSize = 10;
    const spaceAfterLabel = 1.5;
    const blueColor = [0, 0, 139]; // Mismo color azul de la nómina

    let y = headerStartY + 5;

    // --- FUNCIONES DE AYUDA (Mismas de pdfGenerator.js) ---
    const drawHeaderLine = (label, value, x, yPos) => {
        doc.setFontSize(labelSize);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(0, 0, 0);
        doc.text(label, x, yPos);

        const labelWidth = doc.getTextWidth(label);

        doc.setFontSize(valueSize);
        doc.setFont("courier", "bold");
        doc.setTextColor(blueColor[0], blueColor[1], blueColor[2]);
        doc.text(String(value || ''), x + labelWidth + spaceAfterLabel, yPos);
    };

    // --- TÍTULO PRINCIPAL ---
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0, 0, 0);
    doc.text("CERTIFICADO DE EMPRESA", 105, 10, { align: "center" });
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text("SEPE / Ministerio de Trabajo y Economía Social", 105, 14, { align: "center" });

    // --- ESTRUCTURA DE CABECERA (RECUADRO) ---
    doc.setLineWidth(0.2);
    doc.rect(MARGIN, headerStartY, 185, boxHeight);
    doc.line(separatorX, headerStartY, separatorX, headerStartY + boxHeight);

    // --- DATOS EMPRESA (Columna Izquierda) ---
    drawHeaderLine("Empresa:", empresa.nombre, col1X, y);
    drawHeaderLine("Domicilio:", empresa.domicilio, col1X, y + lineHeight);
    drawHeaderLine("CIF:", empresa.cif, col1X, y + (lineHeight * 2));

    doc.setFontSize(labelSize);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(0, 0, 0);
    doc.text("Código de Cuenta de Cotización a la S.S.:", col1X, y + (lineHeight * 3));
    doc.setFontSize(valueSize);
    doc.setFont("courier", "bold");
    doc.setTextColor(blueColor[0], blueColor[1], blueColor[2]);
    doc.text(empresa.ccc || '', col1X + 5, y + (lineHeight * 4));

    // --- DATOS TRABAJADOR (Columna Derecha) ---
    drawHeaderLine("Trabajador:", empleado.nombre, col2X, y);
    drawHeaderLine("NIF:", empleado.dni, col2X, y + lineHeight);
    drawHeaderLine("Nº Afiliación S.S.:", empleado.ss, col2X, y + (lineHeight * 2));

    // --- SECCIÓN: CAUSA DE EXTINCIÓN ---
    y = headerStartY + boxHeight + 10;
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0, 0, 0);
    doc.text("DATOS DE LA EXTINCIÓN DE LA RELACIÓN LABORAL", MARGIN, y);
    y += 2;
    doc.line(MARGIN, y, 200, y);
    y += 6;

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(`Causa de extinción:`, MARGIN, y);
    doc.setFont("helvetica", "bold");
    doc.text(causa, MARGIN + 35, y);

    y += 5;
    const fechaBajaFormat = new Date(fechaBaja).toLocaleDateString('es-ES');
    doc.setFont("helvetica", "normal");
    doc.text(`Fecha de baja definitiva:`, MARGIN, y);
    doc.setFont("helvetica", "bold");
    doc.text(fechaBajaFormat, MARGIN + 40, y);

    // --- SECCIÓN: COTIZACIONES ---
    y += 12;
    doc.setFont("helvetica", "bold");
    doc.text("COTIZACIONES DE LOS ÚLTIMOS 180 DÍAS (Periodos reportados)", MARGIN, y);

    const body = cotizaciones.map(c => [
        c.anio,
        c.mes,
        parseFloat(c.dias_cotizados).toFixed(2),
        parseFloat(c.base_cp).toFixed(2) + " €"
    ]);

    const totalDias = cotizaciones.reduce((acc, c) => acc + parseFloat(c.dias_cotizados || 0), 0);
    const totalBases = cotizaciones.reduce((acc, c) => acc + parseFloat(c.base_cp || 0), 0);

    doc.autoTable({
        startY: y + 2,
        margin: { left: MARGIN, right: MARGIN },
        theme: 'grid', // Estilo grid simple
        headStyles: { fillGray: true, textColor: 0, fontStyle: 'bold', fontSize: 8 },
        bodyStyles: { fontSize: 8 },
        footStyles: { fillGray: true, textColor: 0, fontStyle: 'bold', fontSize: 8 },
        head: [['Año', 'Mes', 'Días Cotizados', 'Base Contingencias Prof. (Desempleo)']],
        body: body,
        foot: [[
            'TOTALES',
            '',
            totalDias.toFixed(2),
            totalBases.toFixed(2) + " €"
        ]]
    });

    y = doc.lastAutoTable.finalY + 20;

    // --- FIRMA Y SELLO ---
    const hoy = new Date();
    const meses = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
    doc.text(`En EL PUERTO DE STA MARIA, a ${hoy.getDate()} de ${meses[hoy.getMonth()]} de ${hoy.getFullYear()}`, MARGIN, y);

    y += 10;
    doc.text("Firma y sello de la empresa", MARGIN, y);

    // --- CORRECCIÓN DEL ERROR ---
    // 1. Buscamos la imagen en window.sello_pinocho O en localStorage (por si acaso)
    // 2. Usamos 'let' para poder limpiarla
    let imagenSello = window.sello_pinocho || localStorage.getItem('empresaLogo');

    if (imagenSello) {
        try {
            // LIMPIEZA: Eliminamos saltos de línea (\n, \r) y espacios extras.
            // Esto es lo que arregla el error "The string did not match the expected pattern"
            const imgClean = imagenSello.trim().replace(/[\r\n]+/gm, "");

            // Ajustamos posición (x, y, ancho, alto)
            doc.addImage(imgClean, 'PNG', MARGIN, y - 15, 35, 30);
        } catch (e) {
            console.error("Error insertando el sello (formato inválido):", e);
        }
    }

    // Guardar
    const nombreArchivo = `Certificado_Empresa_${empleado.nombre.replace(/\s+/g, '_')}.pdf`;
    doc.save(nombreArchivo);
}