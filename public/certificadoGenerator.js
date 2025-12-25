/**
 * Generador de Certificado de Empresa para desempleo (SEPE)
 * VERSIÓN REFORZADA: Con manejo seguro de imágenes para evitar error Base64.
 */

function generarCertificadoEmpresa(empresa, empleado, cotizaciones, causa, fechaBaja) {
    // Protección: Aseguramos que jsPDF está cargado
    if (!window.jspdf) {
        alert("Error: La librería jsPDF no está cargada.");
        return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p', 'mm', 'a4');

    /**
     * Helper para añadir imágenes de forma segura (Previene el error Base64)
     */
    const safeAddImage = (doc, base64Data, format, x, y, width, height) => {
        if (!base64Data) return false;
        try {
            // Limpieza profunda del string Base64
            let cleanBase64 = base64Data.trim()
                .replace(/^data:image\/[a-z]+;base64,/, '') // Eliminar prefijo Data URI
                .replace(/\s/g, ''); // Eliminar espacios, saltos de línea, etc.

            if (cleanBase64.length < 10) return false;

            doc.addImage(cleanBase64, format, x, y, width, height);
            return true;
        } catch (e) {
            console.error("Error al añadir imagen al PDF:", e);
            return false;
        }
    };

    const MARGIN = 15;
    let y = 15;

    // --- 0. LOGO DE EMPRESA (OPCIONAL) ---
    const logoBase64 = localStorage.getItem('empresaLogo');
    if (logoBase64) {
        // Intentamos añadir logo en la esquina superior izquierda
        const logoAncho = 30;
        const logoAlto = 20;
        if (safeAddImage(doc, logoBase64, 'PNG', MARGIN, y, logoAncho, logoAlto)) {
            y += logoAlto + 10;
        } else {
            y += 5; // Fallback si no hay logo
        }
    } else {
        y += 10;
    }

    // --- 1. CABECERA ---
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.setTextColor(44, 62, 80); // Color elegante (Azul petróleo)
    doc.text("CERTIFICADO DE EMPRESA", 105, y, { align: "center" });

    y += 8;
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 100, 100);
    doc.text("MINISTERIO DE TRABAJO Y ECONOMÍA SOCIAL - SERVICIO PÚBLICO DE EMPLEO ESTATAL", 105, y, { align: "center" });

    y += 15;
    // --- 2. DATOS EMPRESA ---
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(52, 73, 94);
    doc.text("1. DATOS DE LA EMPRESA", MARGIN, y);
    y += 4;
    doc.setDrawColor(52, 73, 94);
    doc.setLineWidth(0.5);
    doc.line(MARGIN, y, 210 - MARGIN, y);
    y += 7;

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(0, 0, 0);

    // Cuadros de datos empresa
    doc.setFont("helvetica", "bold"); doc.text("Nombre/Razón Social:", MARGIN, y);
    doc.setFont("helvetica", "normal"); doc.text(`${empresa.nombre || ''}`, MARGIN + 40, y);
    y += 6;
    doc.setFont("helvetica", "bold"); doc.text("CIF/NIF:", MARGIN, y);
    doc.setFont("helvetica", "normal"); doc.text(`${empresa.cif || ''}`, MARGIN + 20, y);

    doc.setFont("helvetica", "bold"); doc.text("C.C.C.:", 110, y);
    doc.setFont("helvetica", "normal"); doc.text(`${empresa.ccc || ''}`, 110 + 15, y);
    y += 6;
    doc.setFont("helvetica", "bold"); doc.text("Domicilio:", MARGIN, y);
    doc.setFont("helvetica", "normal"); doc.text(`${empresa.domicilio || ''}`, MARGIN + 20, y);

    y += 15;
    // --- 3. DATOS TRABAJADOR ---
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(52, 73, 94);
    doc.text("2. DATOS DEL TRABAJADOR", MARGIN, y);
    y += 4;
    doc.line(MARGIN, y, 210 - MARGIN, y);
    y += 7;

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(0, 0, 0);
    doc.setFont("helvetica", "bold"); doc.text("Nombre y Apellidos:", MARGIN, y);
    doc.setFont("helvetica", "normal"); doc.text(`${empleado.nombre || ''}`, MARGIN + 40, y);
    y += 6;
    doc.setFont("helvetica", "bold"); doc.text("NIF/NIE:", MARGIN, y);
    doc.setFont("helvetica", "normal"); doc.text(`${empleado.dni || ''}`, MARGIN + 20, y);

    doc.setFont("helvetica", "bold"); doc.text("Nº Afiliación S.S.:", 110, y);
    doc.setFont("helvetica", "normal"); doc.text(`${empleado.ss || ''}`, 110 + 35, y);

    y += 15;
    // --- 4. CAUSA DE LA BAJA ---
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(52, 73, 94);
    doc.text("3. DETALLES DE LA EXTINCIÓN DE LA RELACIÓN LABORAL", MARGIN, y);
    y += 4;
    doc.line(MARGIN, y, 210 - MARGIN, y);
    y += 7;

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(0, 0, 0);
    doc.setFont("helvetica", "bold"); doc.text("Causa de extinción:", MARGIN, y);
    doc.setFont("helvetica", "normal"); doc.text(`${causa}`, MARGIN + 35, y);
    y += 6;

    // Formateo seguro de fecha
    let fechaStr = fechaBaja;
    try {
        const fechaObj = new Date(fechaBaja);
        if (!isNaN(fechaObj.getTime())) {
            fechaStr = fechaObj.toLocaleDateString('es-ES');
        }
    } catch (e) { console.error(e); }

    doc.setFont("helvetica", "bold"); doc.text("Fecha de baja definitiva:", MARGIN, y);
    doc.setFont("helvetica", "normal"); doc.text(`${fechaStr}`, MARGIN + 45, y);

    y += 15;
    // --- 5. TABLA DE COTIZACIONES ---
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(52, 73, 94);
    doc.text("4. COTIZACIONES (Últimos 180 días)", MARGIN, y);
    y += 5;

    // Preparar datos tabla con seguridad anti-nulos
    const body = (cotizaciones || []).map(c => [
        c.anio || '-',
        c.mes || '-',
        parseFloat(c.dias_cotizados || 0).toFixed(2),
        parseFloat(c.base_cp || 0).toFixed(2) + " €"
    ]);

    // Calcular Totales
    const totalDias = (cotizaciones || []).reduce((acc, c) => acc + parseFloat(c.dias_cotizados || 0), 0);
    const totalBases = (cotizaciones || []).reduce((acc, c) => acc + parseFloat(c.base_cp || 0), 0);

    doc.autoTable({
        startY: y,
        margin: { left: MARGIN, right: MARGIN },
        head: [['Año', 'Mes', 'Días Cotizados', 'Base Cont. Desempleo']],
        body: body,
        foot: [[
            'TOTAL ACUMULADO',
            '',
            totalDias.toFixed(2),
            totalBases.toFixed(2) + " €"
        ]],
        theme: 'grid',
        headStyles: { fillColor: [52, 73, 94], textColor: 255, fontStyle: 'bold' },
        footStyles: { fillColor: [240, 240, 240], textColor: 0, fontStyle: 'bold' },
        styles: { fontSize: 9, cellPadding: 3 }
    });

    // Posicionar pie de página
    y = doc.lastAutoTable.finalY + 15;

    // --- 6. PIE DE PÁGINA (CON SELLO/FIRMA SI EXISTE) ---
    const hoy = new Date();
    const meses = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

    doc.setFont("helvetica", "italic");
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    doc.text(`En EL PUERTO DE STA MARIA, a ${hoy.getDate()} de ${meses[hoy.getMonth()]} de ${hoy.getFullYear()}`, MARGIN, y);

    y += 12;
    doc.setFont("helvetica", "bold");
    doc.text("Firma y sello de la empresa", MARGIN, y);

    // Intentamos añadir el SELLO (firmaBase64 de sello.js)
    if (typeof firmaBase64 !== 'undefined') {
        const anchoSello = 45;
        const altoSello = 35;
        // Posicionamos el sello debajo del texto de firma
        safeAddImage(doc, firmaBase64, 'PNG', MARGIN, y + 2, anchoSello, altoSello);
    }

    // Guardar archivo
    const nombreClean = (empleado.nombre || 'Trabajador').replace(/\s+/g, '_');
    doc.save(`Certificado_Empresa_${nombreClean}.pdf`);
}