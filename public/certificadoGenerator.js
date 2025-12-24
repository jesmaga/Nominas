/**
 * Generador de Certificado de Empresa para desempleo (SEPE)
 * Utiliza jsPDF y jsPDF-AutoTable
 */

function generarCertificadoEmpresa(empresa, empleado, cotizaciones, causa, fechaBaja) {
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
    doc.text("MINISTERIO DE TRABAJO Y ECONOMÍA SOCIAL - SERVICIO PÚBLICO DE EMPLEO ESTATAL", 105, y, { align: "center" });

    y += 15;
    // --- DATOS DE LA EMPRESA ---
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
    // --- DATOS DEL TRABAJADOR ---
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
    const fechaBajaFormat = new Date(fechaBaja).toLocaleDateString('es-ES');
    doc.text(`Fecha de baja definitiva: ${fechaBajaFormat}`, MARGIN, y);

    y += 15;
    // --- TABLA DE COTIZACIONES ---
    doc.setFont("helvetica", "bold");
    doc.text("COTIZACIONES DE LOS ÚLTIMOS 180 DÍAS (o últimos periodos)", MARGIN, y);
    y += 5;

    // Preparar datos para la tabla
    const body = cotizaciones.map(c => [
        c.anio,
        c.mes,
        parseFloat(c.dias_cotizados).toFixed(2),
        parseFloat(c.base_cp).toFixed(2) + " €"
    ]);

    const totalDias = cotizaciones.reduce((acc, c) => acc + parseFloat(c.dias_cotizados || 0), 0);
    const totalBases = cotizaciones.reduce((acc, c) => acc + parseFloat(c.base_cp || 0), 0);

    doc.autoTable({
        startY: y,
        margin: { left: MARGIN, right: MARGIN },
        head: [['Año', 'Mes', 'Días Cotizados', 'Base Contingencias Prof. (Desempleo)']],
        body: body,
        foot: [[
            'TOTAL',
            '',
            totalDias.toFixed(2),
            totalBases.toFixed(2) + " €"
        ]],
        theme: 'grid',
        headStyles: { fillGray: true, textColor: 0, fontStyle: 'bold' },
        footStyles: { fillGray: true, textColor: 0, fontStyle: 'bold' }
    });

    y = doc.lastAutoTable.finalY + 20;

    // --- FIRMA Y SELLO ---
    const hoy = new Date();
    const meses = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
    doc.text(`En EL PTO STA MARIA, a ${hoy.getDate()} de ${meses[hoy.getMonth()]} de ${hoy.getFullYear()}`, MARGIN, y);

    y += 10;
    doc.text("Firma y sello de la empresa", MARGIN, y);

    // Añadir sello si existe
    if (typeof firmaBase64 !== 'undefined') {
        try {
            // Ajustamos posición para que quede encima del texto
            doc.addImage(firmaBase64, 'PNG', MARGIN, y - 15, 35, 30);
        } catch (e) {
            console.error("No se pudo añadir la firma al certificado:", e);
        }
    }

    // Guardar
    const nombreArchivo = `Certificado_Empresa_${empleado.nombre.replace(/\s+/g, '_')}.pdf`;
    doc.save(nombreArchivo);
}
