/**
 * Generador de Certificado de Empresa para desempleo (SEPE)
 * Basado estrictamente en el estilo de pdfGenerator.js
 */

function generarCertificadoEmpresa(empresa, empleado, cotizaciones, causa, fechaBaja) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p', 'mm', 'a4');

    // --- CONFIGURACIÓN DE ESTILO (Copiado de pdfGenerator.js) ---
    const MARGIN = 15;
    const headerStartY = 20; // Un poco más abajo que el título principal
    const boxHeight = 28;
    const lineHeight = 4.5;
    const separatorX = 102.5;
    const col1X = MARGIN + 2;
    const col2X = separatorX + 2;
    const labelSize = 8;
    const valueSize = 10;
    const spaceAfterLabel = 1.5;
    const blueColor = [0, 0, 139];

    const textRight = (text, y, x = 200) => {
        doc.text(String(text), x, y, { align: 'right' });
    };

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

    // --- TÍTULO PRINCIPAL (Centrado) ---
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0, 0, 0);
    doc.text("CERTIFICADO DE EMPRESA", 105, 10, { align: "center" });
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text("Ministerio de Trabajo / SEPE", 105, 15, { align: "center" });

    // --- ESTRUCTURA DE CABECERA (RECUADRO) ---
    doc.setLineWidth(0.2);
    doc.rect(MARGIN, headerStartY, 185, boxHeight);
    doc.line(separatorX, headerStartY, separatorX, headerStartY + boxHeight);

    let y = headerStartY + 5;

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
    y = headerStartY + boxHeight + 12;
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0, 0, 0);
    doc.text("DATOS DE LA EXTINCIÓN DE LA RELACIÓN LABORAL", MARGIN, y);
    y += 2;
    doc.line(MARGIN, y, 200, y);
    y += 6;

    doc.setFontSize(labelSize);
    doc.setFont("helvetica", "normal");
    doc.text(`Causa de extinción:`, MARGIN, y);
    doc.setFontSize(valueSize);
    doc.setFont("courier", "bold");
    doc.setTextColor(blueColor[0], blueColor[1], blueColor[2]);
    doc.text(causa, MARGIN + 35, y);

    y += 6;
    const fechaBajaFormat = new Date(fechaBaja).toLocaleDateString('es-ES');
    doc.setFontSize(labelSize);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(0, 0, 0);
    doc.text(`Fecha de baja definitiva:`, MARGIN, y);
    doc.setFontSize(valueSize);
    doc.setFont("courier", "bold");
    doc.setTextColor(blueColor[0], blueColor[1], blueColor[2]);
    doc.text(fechaBajaFormat, MARGIN + 40, y);

    // --- SECCIÓN: COTIZACIONES ---
    y += 12;
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0, 0, 0);
    doc.text("COTIZACIONES DE LOS ÚLTIMOS 180 DÍAS", MARGIN, y);

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
        theme: 'grid',
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

    // --- FIRMA Y SELLO (PIE DE PÁGINA) ---
    // Posición fija al final si la tabla es corta, o relativa si es larga.
    // Como son max 6-12 filas, usamos una constante para uniformidad
    y = Math.max(doc.lastAutoTable.finalY + 20, 240);

    const hoy = new Date();
    const meses = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(0, 0, 0);
    doc.text(`En EL PUERTO DE STA MARIA, a ${hoy.getDate()} de ${meses[hoy.getMonth()]} de ${hoy.getFullYear()}`, MARGIN, y);

    y += 12;
    doc.setFont("helvetica", "bold");
    doc.text("Firma y sello de la empresa", MARGIN, y);

    // --- RECUPERACIÓN Y LIMPIEZA DEL SELLO ---
    const logoBase64 = localStorage.getItem('empresaLogo');
    if (logoBase64 && logoBase64.trim() !== "") {
        try {
            // Limpieza agresiva de saltos de línea y espacios (User Fix)
            const imgClean = logoBase64.trim().replace(/[\r\n]+/gm, "");

            // Si no tiene el prefijo de data URI, lo añadimos si parece base64 puro
            let finalImg = imgClean;
            if (!finalImg.startsWith('data:image')) {
                finalImg = 'data:image/png;base64,' + imgClean;
            }

            doc.addImage(finalImg, 'PNG', MARGIN, y - 18, 40, 35);
        } catch (e) {
            console.error("Error al añadir el sello al PDF:", e);
        }
    }

    const fileName = `Certificado_Empresa_${empleado.nombre.replace(/\s+/g, '_')}.pdf`;
    doc.save(fileName);
}