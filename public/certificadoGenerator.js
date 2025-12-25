/**
 * Generador de Certificado de Empresa (Versión Robusta ante datos faltantes)
 */

function generarCertificadoEmpresa(empresa, empleado, cotizaciones, causa, fechaBaja) {
    // 1. Verificación de librerías
    if (!window.jspdf) {
        alert("Error: La librería jsPDF no está cargada correctamente.");
        return;
    }

    // 2. Inicialización segura (evita errores si el objeto es null)
    const datosEmpresa = empresa || {};
    const datosEmpleado = empleado || {};
    const listaCotizaciones = Array.isArray(cotizaciones) ? cotizaciones : [];

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
    // Usamos || '' para que si falta el dato, ponga cadena vacía o guiones
    doc.text(`Nombre/Razón Social: ${datosEmpresa.nombre || '----------------'}`, MARGIN, y);
    y += 5;
    doc.text(`CIF/NIF: ${datosEmpresa.cif || '----------------'}`, MARGIN, y);
    doc.text(`C.C.C.: ${datosEmpresa.ccc || '----------------'}`, 100, y);
    y += 5;
    doc.text(`Domicilio: ${datosEmpresa.domicilio || '----------------'}`, MARGIN, y);

    y += 15;

    // --- DATOS TRABAJADOR ---
    doc.setFont("helvetica", "bold");
    doc.text("DATOS DEL TRABAJADOR", MARGIN, y);
    y += 5;
    doc.line(MARGIN, y, 210 - MARGIN, y);
    y += 7;

    doc.setFont("helvetica", "normal");
    doc.text(`Nombre y Apellidos: ${datosEmpleado.nombre || 'Desconocido'}`, MARGIN, y);
    y += 5;
    doc.text(`NIF/NIE: ${datosEmpleado.dni || ''}`, MARGIN, y);
    doc.text(`Nº Afiliación S.S.: ${datosEmpleado.ss || ''}`, 100, y);

    y += 15;

    // --- CAUSA DE LA BAJA ---
    doc.setFont("helvetica", "bold");
    doc.text("DETALLES DE LA EXTINCIÓN", MARGIN, y);
    y += 5;
    doc.line(MARGIN, y, 210 - MARGIN, y);
    y += 7;

    doc.setFont("helvetica", "normal");
    doc.text(`Causa de extinción: ${causa || 'Fin de contrato'}`, MARGIN, y);
    y += 5;

    // Formateo seguro de fecha
    let fechaStr = fechaBaja || new Date().toLocaleDateString();
    try {
        const fechaObj = new Date(fechaBaja);
        if (!isNaN(fechaObj.getTime())) {
            fechaStr = fechaObj.toLocaleDateString('es-ES');
        }
    } catch (e) { console.error(e); }

    doc.text(`Fecha de baja definitiva: ${fechaStr}`, MARGIN, y);

    y += 15;

    // --- TABLA DE COTIZACIONES ---
    doc.setFont("helvetica", "bold");
    doc.text("COTIZACIONES (Últimos 180 días)", MARGIN, y);
    y += 5;

    // Mapeo seguro: si un valor viene null, ponemos 0 o '-'
    const body = listaCotizaciones.map(c => [
        c.anio || '-',
        c.mes || '-',
        parseFloat(c.dias_cotizados || 0).toFixed(2),
        parseFloat(c.base_cp || 0).toFixed(2) + " €"
    ]);

    // Calcular Totales de forma segura
    const totalDias = listaCotizaciones.reduce((acc, c) => acc + parseFloat(c.dias_cotizados || 0), 0);
    const totalBases = listaCotizaciones.reduce((acc, c) => acc + parseFloat(c.base_cp || 0), 0);

    // Comprobamos si el plugin autoTable está cargado
    if (doc.autoTable) {
        doc.autoTable({
            startY: y,
            margin: { left: MARGIN, right: MARGIN },
            head: [['Año', 'Mes', 'Días Cotizados', 'Base Cont. Desempleo']],
            body: body,
            foot: [['TOTAL ACUMULADO', '', totalDias.toFixed(2), totalBases.toFixed(2) + " €"]],
            theme: 'grid',
            headStyles: { fillColor: [220, 220, 220], textColor: 0, fontStyle: 'bold' },
            footStyles: { fillColor: [220, 220, 220], textColor: 0, fontStyle: 'bold' },
            styles: { fontSize: 9 }
        });
        // Actualizamos Y para lo siguiente
        y = doc.lastAutoTable.finalY + 20;
    } else {
        doc.text("Tabla de cotizaciones (AutoTable no disponible)", MARGIN, y);
        y += 20;
    }

    // --- PIE DE PÁGINA ---
    const hoy = new Date();
    const meses = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

    doc.setFont("helvetica", "normal");
    doc.text(`En EL PUERTO DE STA MARIA, a ${hoy.getDate()} de ${meses[hoy.getMonth()]} de ${hoy.getFullYear()}`, MARGIN, y);

    y += 10;
    doc.text("Firma y sello de la empresa:", MARGIN, y);

    // Nombre de archivo limpio
    const nombreArchivo = (datosEmpleado.nombre || 'Trabajador').replace(/[^a-zA-Z0-9]/g, '_');
    doc.save(`Certificado_Empresa_${nombreArchivo}.pdf`);
}