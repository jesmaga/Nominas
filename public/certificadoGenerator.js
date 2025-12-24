/**
 * Generador de Certificado de Empresa para desempleo (SEPE)
 * Versión simplificada: SIN SELLO (para evitar errores base64)
 */

function generarCertificadoEmpresa(empresa, empleado, cotizaciones, causa, fechaBaja) {
    // Aseguramos acceso a jsPDF
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p', 'mm', 'a4');
    const MARGIN = 15;
    let y = 20;

    // --- CABECERA ---
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("CERTIFICADO DE EMPRESA", 105, y, { align: "center" });

    y += 10;
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text("MINISTERIO DE TRABAJO Y ECONOMÍA SOCIAL - SEPE", 105, y, { align: "center" });

    y += 15;
    // --- DATOS EMPRESA ---
    doc.setFont("helvetica", "bold");
    doc.text("DATOS DE LA EMPRESA", MARGIN, y);
    y += 5;
    doc.setLineWidth(0.5);
    doc.line(MARGIN, y, 210 - MARGIN, y);
    y += 7;

    doc.setFont("helvetica", "normal");
    doc.text(`Nombre/Razón Social: ${empresa.nombre || ''}`, MARGIN, y);
    y += 5;
    doc.text(`CIF/NIF: ${empresa.cif || ''}`, MARGIN, y);
    doc.text(`C.C.C.: ${empresa.ccc || ''}`, 100, y);
    y += 5;
    doc.text(`Domicilio: ${empresa.domicilio || ''}`, MARGIN, y);

    y += 15;
    // --- DATOS TRABAJADOR ---
    doc.setFont("helvetica", "bold");
    doc.text("DATOS DEL TRABAJADOR", MARGIN, y);
    y += 5;
    doc.line(MARGIN, y, 210 - MARGIN, y);
    y += 7;

    doc.setFont("helvetica", "normal");
    doc.text(`Nombre y Apellidos: ${empleado.nombre || ''}`, MARGIN, y);
    y += 5;
    doc.text(`NIF/NIE: ${empleado.dni || ''}`, MARGIN, y);
    doc.text(`Nº Afiliación S.S.: ${empleado.ss || ''}`, 100, y);

    y += 15;
    // --- CAUSA DE LA BAJA ---
    doc.setFont("helvetica", "bold");
    doc.text("DETALLES DE LA EXTINCIÓN", MARGIN, y);
    y += 5;
    doc.line(MARGIN, y, 210 - MARGIN, y);
    y += 7;

    doc.setFont("helvetica", "normal");
    doc.text(`Causa de extinción: ${causa}`, MARGIN, y);
    y += 5;
    // Formateo de fecha seguro
    const fechaObj = new Date(fechaBaja);
    const fechaStr = !isNaN(fechaObj) ? fechaObj.toLocaleDateString('es-ES') : fechaBaja;
    doc.text(`Fecha de baja definitiva: ${fechaStr}`, MARGIN, y);

    y += 15;
    // --- TABLA DE COTIZACIONES (180 DÍAS) ---
    doc.setFont("helvetica", "bold");
    doc.text("COTIZACIONES (Últimos 180 días)", MARGIN, y);
    y += 5;

    // Preparar datos tabla
    const body = cotizaciones.map(c => [
        c.anio,
        c.mes,
        parseFloat(c.dias_cotizados || 0).toFixed(2),
        parseFloat(c.base_cp || 0).toFixed(2) + " €"
    ]);

    // Totales
    const totalDias = cotizaciones.reduce((acc, c) => acc + parseFloat(c.dias_cotizados || 0), 0);
    const totalBases = cotizaciones.reduce((acc, c) => acc + parseFloat(c.base_cp || 0), 0);

    doc.autoTable({
        startY: y,
        margin: { left: MARGIN, right: MARGIN },
        head: [['Año', 'Mes', 'Días Cotizados', 'Base Contingencias Prof.']],
        body: body,
        foot: [[
            'TOTAL',
            '',
            totalDias.toFixed(2),
            totalBases.toFixed(2) + " €"
        ]],
        theme: 'grid',
        headStyles: { fillColor: [220, 220, 220], textColor: 0, fontStyle: 'bold' },
        footStyles: { fillColor: [220, 220, 220], textColor: 0, fontStyle: 'bold' }
    });

    y = doc.lastAutoTable.finalY + 20;

    // --- PIE DE PÁGINA (Sin imagen) ---
    const hoy = new Date();
    const meses = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

    doc.setFont("helvetica", "normal");
    doc.text(`En EL PUERTO DE STA MARIA, a ${hoy.getDate()} de ${meses[hoy.getMonth()]} de ${hoy.getFullYear()}`, MARGIN, y);

    y += 10;
    doc.text("Firma y sello de la empresa", MARGIN, y);

    // Espacio en blanco para firmar manual

    // Guardar
    const nombreClean = (empleado.nombre || 'Trabajador').replace(/\s+/g, '_');
    doc.save(`Certificado_Empresa_${nombreClean}.pdf`);
}