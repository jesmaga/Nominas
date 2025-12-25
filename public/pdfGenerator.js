// ==========================================================
// --- FUNCIÓN INTERNA DE DIBUJO (TU DISEÑO EXACTO) ---
// ==========================================================
// Esta función no crea ni guarda el PDF, solo dibuja en él.
function dibujarPaginaDeNomina(doc, datosNomina) {
    const { nomina, empleado, periodo, puesto, empresa } = datosNomina;
    if (!nomina || !empleado || !periodo || !puesto || !empresa) {
        console.error("Faltan datos para dibujar la página del PDF.");
        return;
    }

    const textRight = (text, y, x = 200) => {
        doc.text(String(text), x, y, { align: 'right' });
    };

    const MARGIN = 15;
    let y;

    // --- CABECERA ---
    const headerStartY = 15;
    const boxHeight = 28;
    const lineHeight = 4.5;
    const separatorX = 102.5; // Posición de la línea vertical, AHORA CONSISTENTE
    const col1X = MARGIN + 2;
    const col2X = separatorX + 2;
    const blueColor = [0, 0, 139];
    const labelSize = 8;
    const valueSize = 10;
    const spaceAfterLabel = 1.5;

    // --- Dibujar la estructura de recuadros ---
    doc.setLineWidth(0.2);
    // El ancho total ahora es 185mm (de 15 a 200), igual que el cuerpo
    doc.rect(MARGIN, headerStartY, 185, boxHeight); 
    doc.line(separatorX, headerStartY, separatorX, headerStartY + boxHeight); // Línea vertical divisoria

    y = headerStartY + 5;
    
    const drawHeaderLine = (label, value, x, yPos) => {
        doc.setFontSize(labelSize);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(0, 0, 0);
        doc.text(label, x, yPos);

        const labelWidth = doc.getTextWidth(label);
        
        doc.setFontSize(valueSize);
        doc.setFont("courier", "bold");
        doc.setTextColor(blueColor[0], blueColor[1], blueColor[2]);
        doc.text(value, x + labelWidth + spaceAfterLabel, yPos);
    };

    // --- Columna Izquierda (Empresa) ---
    drawHeaderLine("Empresa:", empresa.nombre, col1X, y);
    drawHeaderLine("Domicilio:", empresa.domicilio, col1X, y + lineHeight);
    drawHeaderLine("CIF:", empresa.cif, col1X, y + (lineHeight * 2));

    doc.setFontSize(labelSize);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(0, 0, 0);
    doc.text("Código de Cuenta de Cotización a la", col1X, y + (lineHeight * 3));
    doc.text("Seguridad Social:", col1X, y + (lineHeight * 4));
    
    const cccY = y + (lineHeight * 4); 
    doc.setFontSize(valueSize);
    doc.setFont("courier", "bold");
    doc.setTextColor(blueColor[0], blueColor[1], blueColor[2]);
    doc.text(empresa.ccc, col1X + 23, cccY);

    // --- Columna Derecha (Trabajador) ---
    drawHeaderLine("Trabajador:", empleado.nombre || '', col2X, y);
    drawHeaderLine("NIF:", empleado.dni || '', col2X, y + lineHeight);
    drawHeaderLine("Número de afiliación a la S.S.:", empleado.ss || '', col2X, y + (lineHeight * 2));
    drawHeaderLine("Grupo profesional:", puesto.nombre || '', col2X, y + (lineHeight * 3));

    const yLine4 = y + (lineHeight * 4);
    drawHeaderLine("Grupo de Cotización:", empleado.cotizacion || '09', col2X, yLine4);
    
    const antiguedadLabel = "Fecha de antigüedad:";
    const antiguedadLabelX = col2X + 40; 
    const antiguedadDate = new Date(empleado.antiguedad + 'T00:00:00').toLocaleDateString('es-ES');
    
    doc.setFontSize(labelSize);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(0, 0, 0);
    doc.text(antiguedadLabel, antiguedadLabelX, yLine4);

    doc.setFontSize(valueSize);
    doc.setFont("courier", "bold");
    doc.setTextColor(blueColor[0], blueColor[1], blueColor[2]);
    doc.text(antiguedadDate, antiguedadLabelX + doc.getTextWidth(antiguedadLabel) -6, yLine4);
    
    doc.setFontSize(labelSize);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(0, 0, 0);
    doc.text("Número empleado:", col2X + 35, y + lineHeight);

    // --- FIN DE LA SECCIÓN MODIFICADA ---
    
    doc.setTextColor(0, 0, 0);
    doc.setFont("helvetica", "normal");
    y = headerStartY + boxHeight + 3;

    doc.setDrawColor(0);
    doc.line(MARGIN, y, 215 - MARGIN, y);
    
    y += 5;
    doc.setFontSize(9);
    const mes = new Date(periodo.inicio + 'T00:00:00').toLocaleString('es-ES', { month: 'long' });
    const anio = new Date(periodo.inicio + 'T00:00:00').getFullYear();
    const textoPeriodo = `Periodo de liquidación: del ${new Date(periodo.inicio + 'T00:00:00').getDate()} al ${new Date(periodo.fin + 'T00:00:00').getDate()} de ${mes} de ${anio}`;
    doc.text(textoPeriodo, MARGIN, y);
    textRight(`Total días: ${nomina.diasCalculoTotal}`, y);

    y += 3;
    doc.line(MARGIN, y, 215 - MARGIN, y);
    
    // =================================================================
    // --- CUERPO Y PIE DE PÁGINA (CON ANCHO CORREGIDO) ---
    // =================================================================
    y += 5;
    const bodyStartY = y;

    doc.setLineWidth(0.2);
    doc.rect(MARGIN, y, 185, 75); // Ancho consistente de 185
    doc.line(separatorX, y, separatorX, y + 75); // Línea vertical consistente
    doc.line(MARGIN, y + 8, 200, y + 8);

    doc.setFont("helvetica", "bold");
    doc.text("I. DEVENGOS", MARGIN + 2, y + 5);
    doc.text("IMPORTE", separatorX - 2, y + 5, { align: 'right' });
    doc.text("II. DEDUCCIONES", separatorX + 2, y + 5);

    y += 12;
    let yDevengos = y;
    doc.setFont("helvetica", "bold");
    doc.text("1. Percepciones salariales", MARGIN + 2, yDevengos);
    doc.setFont("helvetica", "normal");
    yDevengos += 5;
    doc.setFontSize(labelSize); // Se resetea para el siguiente texto
    doc.setFont("helvetica", "normal");
    doc.setTextColor(0, 0, 0);
    doc.text("Salario base", MARGIN + 5, yDevengos);
    doc.setFontSize(valueSize);
    doc.setFont("courier", "bold");
    doc.setTextColor(blueColor[0], blueColor[1], blueColor[2]);
    textRight(nomina.salarioBasePeriodo, yDevengos, separatorX - 2);
    doc.setFontSize(labelSize); // Se resetea para el siguiente texto
    doc.setFont("helvetica", "normal");
    doc.setTextColor(0, 0, 0);
    yDevengos += 5;
    doc.text("Gratificaciones extraordinarias PRORRATA", MARGIN + 5, yDevengos);
    doc.setFontSize(valueSize);
    doc.setFont("courier", "bold");
    doc.setTextColor(blueColor[0], blueColor[1], blueColor[2]);
    textRight(nomina.prorrataExtraPeriodo, yDevengos, separatorX - 2);
    doc.setFontSize(labelSize); // Se resetea para el siguiente texto
    doc.setFont("helvetica", "normal");
    doc.setTextColor(0, 0, 0);
    
    if (nomina.conceptosCalculados && nomina.conceptosCalculados.length > 0) {
        yDevengos += 5;
        doc.setFont("helvetica", "bold");
        doc.text("Complementos salariales:", MARGIN + 2, yDevengos);
        doc.setFont("helvetica", "normal");
        nomina.conceptosCalculados.forEach(concepto => {
            yDevengos += 5;
            // Mostramos el nombre y el número de periodos (ej: Antigüedad (2))
            doc.text(`${concepto.nombre}`, MARGIN + 5, yDevengos);
            doc.setFontSize(valueSize);
            doc.setFont("courier", "bold");
            doc.setTextColor(blueColor[0], blueColor[1], blueColor[2]);
            textRight(concepto.importe, yDevengos, separatorX - 2);
            doc.setFontSize(labelSize); // Se resetea para el siguiente texto
            doc.setFont("helvetica", "normal");
            doc.setTextColor(0, 0, 0);
        });
    }

    (nomina.otrosDevengos || []).filter(d => parseFloat(d.importe) > 0).forEach(d => {
        yDevengos += 5;
        doc.text(d.concepto, MARGIN + 5, yDevengos);
        doc.setFontSize(valueSize);
        doc.setFont("courier", "bold");
        doc.setTextColor(blueColor[0], blueColor[1], blueColor[2]);
        textRight(d.importe, yDevengos, separatorX - 2);
        doc.setFontSize(labelSize); // Se resetea para el siguiente texto
        doc.setFont("helvetica", "normal");
        doc.setTextColor(0, 0, 0);
    });
    yDevengos += 5;
    doc.setFont("helvetica", "bold");
    doc.text("2. Percepciones no salariales", MARGIN + 2, yDevengos);
    doc.setFont("helvetica", "normal");
    if (nomina.complementoEnfermedadEmpresa > 0) {
        yDevengos += 5;
        doc.text("Complemento Empresa por Baja", MARGIN + 5, yDevengos);
        doc.setFontSize(valueSize);
        doc.setFont("courier", "bold");
        doc.setTextColor(blueColor[0], blueColor[1], blueColor[2]);
        textRight(nomina.complementoEnfermedadEmpresa, yDevengos, separatorX - 2);
        doc.setFontSize(labelSize); // Se resetea para el siguiente texto
        doc.setFont("helvetica", "normal");
        doc.setTextColor(0, 0, 0);
    }
    if (nomina.diasBajaEnPeriodo > 0) {
        yDevengos += 5;
        doc.text("Prestación por Baja", MARGIN + 5, yDevengos);
        doc.setFontSize(valueSize);
        doc.setFont("courier", "bold");
        doc.setTextColor(blueColor[0], blueColor[1], blueColor[2]);
        textRight(nomina.prestacionEnfermedadLegal, yDevengos, separatorX - 2);
        doc.setFontSize(labelSize); // Se resetea para el siguiente texto
        doc.setFont("helvetica", "normal");
        doc.setTextColor(0, 0, 0);
    }

    let yDeducciones = y;
    doc.setFont("helvetica", "bold");
    doc.text("1. Aportación del trabajador a las cotizaciones a la S. Social", separatorX + 2, yDeducciones);
    doc.setFont("helvetica", "normal");
    yDeducciones += 5;
    doc.text("Contingencias comunes", col2X, yDeducciones);
    doc.text(`${nomina.baseCotizacion}   ${nomina.porcCC}%`, 160, yDeducciones);
    doc.setFontSize(valueSize);
    doc.setFont("courier", "bold");
    doc.setTextColor(blueColor[0], blueColor[1], blueColor[2]);
    textRight(nomina.deduccionCC, yDeducciones);
    doc.setFontSize(labelSize); // Se resetea para el siguiente texto
    doc.setFont("helvetica", "normal");
    doc.setTextColor(0, 0, 0);
    yDeducciones += 5;
    doc.text("Desempleo", col2X, yDeducciones);
    doc.text(`${nomina.baseCotizacion}   ${nomina.porcDesempleo}%`, 160, yDeducciones);
    doc.setFontSize(valueSize);
    doc.setFont("courier", "bold");
    doc.setTextColor(blueColor[0], blueColor[1], blueColor[2]);
    textRight(nomina.deduccionDesempleo, yDeducciones);
    doc.setFontSize(labelSize); // Se resetea para el siguiente texto
    doc.setFont("helvetica", "normal");
    doc.setTextColor(0, 0, 0);
    yDeducciones += 5;
    doc.text("Formación Profesional", col2X, yDeducciones);
    doc.text(`${nomina.baseCotizacion}   ${nomina.porcFP}%`, 160, yDeducciones);
    doc.setFontSize(valueSize);
    doc.setFont("courier", "bold");
    doc.setTextColor(blueColor[0], blueColor[1], blueColor[2]);
    textRight(nomina.deduccionFP, yDeducciones);
    doc.setFontSize(labelSize); // Se resetea para el siguiente texto
    doc.setFont("helvetica", "normal");
    doc.setTextColor(0, 0, 0);
    yDeducciones += 5;
    doc.text("M.E.I.", col2X, yDeducciones);
    doc.text(`${nomina.baseCotizacion}   ${nomina.porcMEI}%`, 160, yDeducciones);
    doc.setFontSize(valueSize);
    doc.setFont("courier", "bold");
    doc.setTextColor(blueColor[0], blueColor[1], blueColor[2]);
    textRight(nomina.deduccionMEI, yDeducciones);
    doc.setFontSize(labelSize); // Se resetea para el siguiente texto
    doc.setFont("helvetica", "normal");
    doc.setTextColor(0, 0, 0);
    yDeducciones += 5;
    doc.line(col2X, yDeducciones - 2, 200, yDeducciones - 2);
    doc.setFont("helvetica", "bold");
    doc.text("TOTAL APORTACIONES", col2X, yDeducciones + 1);
    doc.setFontSize(valueSize);
    doc.setFont("courier", "bold");
    doc.setTextColor(blueColor[0], blueColor[1], blueColor[2]);
    textRight(nomina.totalDeduccionesSS, yDeducciones + 1);
    doc.setFontSize(labelSize); // Se resetea para el siguiente texto
    doc.setFont("helvetica", "normal");
    doc.setTextColor(0, 0, 0);
    yDeducciones += 10;
    doc.text("2. Impuesto sobre la renta de las personas fisicas", separatorX + 2, yDeducciones);
    doc.setFont("helvetica", "normal");
    //yDeducciones += 5;
    //doc.text(nomina.baseCotizacion, 160, yDeducciones);
    doc.setFontSize(valueSize);
    doc.setFont("courier", "bold");
    doc.setTextColor(blueColor[0], blueColor[1], blueColor[2]);
    doc.text(`      ${nomina.porcentajeIRPF}%`, 160, yDeducciones);
    textRight(nomina.deduccionIRPF, yDeducciones);
    doc.setFontSize(labelSize); // Se resetea para el siguiente texto
    doc.setFont("helvetica", "normal");
    doc.setTextColor(0, 0, 0);
    (nomina.otrasDeducciones || []).filter(d => parseFloat(d.importe) > 0).forEach(d => {
        yDeducciones += 5;
        doc.text(d.concepto, col2X, yDeducciones);
        doc.setFontSize(valueSize);
        doc.setFont("courier", "bold");
        doc.setTextColor(blueColor[0], blueColor[1], blueColor[2]);
        textRight(d.importe, yDeducciones);
        doc.setFontSize(labelSize); // Se resetea para el siguiente texto
        doc.setFont("helvetica", "normal");
        doc.setTextColor(0, 0, 0);
    });

    y = bodyStartY + 70;
    doc.line(MARGIN, y, 200, y);
    doc.setFont("helvetica", "bold");
    doc.text("A. TOTAL DEVENGADO", MARGIN + 2, y + 4);
    doc.setFontSize(valueSize);
    doc.setFont("courier", "bold");
    doc.setTextColor(blueColor[0], blueColor[1], blueColor[2]);
    textRight(nomina.totalDevengos, y + 4, separatorX - 2);
    doc.setFontSize(labelSize); // Se resetea para el siguiente texto
    doc.setFont("helvetica", "normal");
    doc.setTextColor(0, 0, 0);
    doc.text("B. TOTAL A DEDUCIR", separatorX + 2, y + 4);
    doc.setFontSize(valueSize);
    doc.setFont("courier", "bold");
    doc.setTextColor(blueColor[0], blueColor[1], blueColor[2]);
    textRight(nomina.totalDeducciones, y + 4);
    doc.setFontSize(labelSize); // Se resetea para el siguiente texto
    doc.setFont("helvetica", "normal");
    doc.setTextColor(0, 0, 0);
    y += 8;
    doc.line(MARGIN, y, 200, y);
    doc.text("LÍQUIDO TOTAL A PERCIBIR (A - B)", 105, y + 4, { align: 'center' });
    doc.setFontSize(valueSize);
    doc.setFont("courier", "bold");
    doc.setTextColor(blueColor[0], blueColor[1], blueColor[2]);
    textRight(nomina.salarioNeto + " €", y + 4);
    doc.setFontSize(labelSize); // Se resetea para el siguiente texto
    doc.setFont("helvetica", "normal");
    doc.setTextColor(0, 0, 0);

    y = bodyStartY + 125;
    doc.setFont("helvetica", "normal");
    doc.text(`En ${"EL PTO STA MARIA"}, a ${new Date(periodo.fin + 'T00:00:00').getDate()} de ${mes} de ${anio}`, MARGIN, y);
    doc.text("RECIBI", 180, y, { align: 'center' });

    // 2. Define el tamaño de la imagen en mm
    const anchoFirma = 40; // 4 cm de ancho
    const altoFirma = 35;  // 3.5 cm de alto

    // 3. Define la posición (x, y)
    // MARGIN es la 'x' (15)
    // Calculamos la 'y' para que esté encima del texto "Firma y sello"
    const yImagen = y - 10; // 10mm por encima del texto

    try {
        // 4. Dibuja la imagen
        doc.addImage(firmaBase64, 'PNG', MARGIN, yImagen, anchoFirma, altoFirma);
    } catch (e) {
        console.error("Error al añadir la imagen de la firma:", e);
        doc.text("[Error al cargar firma]", MARGIN, y); // Texto alternativo si falla
    }


    y += 5;
    doc.text("Firma y sello de la empresa", MARGIN, y);

    // =================================================================
    // ### SECCIÓN MODIFICADA: PIE DE PÁGINA EXACTO AL MODELO ###
    // =================================================================
    const PAGE_HEIGHT = 297;
    const footerStartY = PAGE_HEIGHT -80; // Posición inicial del pie
    y = footerStartY + 5;
    Margin_X = MARGIN + 1

    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0, 0, 0);
    doc.text("DETERMINACIÓN DE LAS BASES DE COTIZACIÓN A LA SEGURIDAD SOCIAL Y CONCEPTOS DE RECAUDACIÓN CONJUNTA Y DE", Margin_X, y);
    y += 4;
    doc.text("LA BASE SUJETA A RETENCIÓN DEL IRPF Y APORTACIÓN DE LA EMPRESA", Margin_X, y);
    
    y += 6;
    const baseX = 145;
    const tipoX = 165;
    const aportacionX = 198;
    doc.text("BASE", baseX-8, y, { align: 'center' });
    doc.text("TIPO", tipoX-5, y, { align: 'center' });
    doc.text("APORTACIÓN", aportacionX-9, y, { align: 'center' });
    doc.text("EMPRESA", aportacionX-9, y+3, { align: 'center' });

    const drawBlueValue = (text, x, yPos) => {
        doc.setFontSize(valueSize);
        doc.setFont("courier", "bold");
        doc.setTextColor(blueColor[0], blueColor[1], blueColor[2]);
        doc.text(String(text), x, yPos, { align: 'right' });
    };

    y += 5;
    doc.setFontSize(labelSize);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(0, 0, 0);
    doc.text("1. Contingencias comunes", Margin_X, y);
    
    const subLineY = y - 2;
    doc.text("Importe remuneración mensual", Margin_X + 45, subLineY);
    drawBlueValue(nomina.totalDevengos, 120, subLineY);
    doc.setFontSize(labelSize);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(0, 0, 0);
    doc.text("Importe prorrata pagas extraordinarias", Margin_X + 45, subLineY + 4);
    
    doc.text("TOTAL", Margin_X + 45, subLineY + 8);
    
    drawBlueValue(nomina.baseCotizacion, baseX, y + 6);
    drawBlueValue(nomina.porcCCEmpresa, tipoX, y + 6);
    drawBlueValue(nomina.aportacionEmpresaCC, aportacionX, y + 6);

    y += 12;
    doc.setFontSize(labelSize);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(0, 0, 0);
    doc.text("2. Contingencias profesionales y conceptos", Margin_X, y);
    doc.text("   de recaudación conjunta", Margin_X, y+4);

    const drawProLine = (label, yPos, base, tipo, aportacion) => {
        doc.setFontSize(labelSize);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(0, 0, 0);
        doc.text(label, Margin_X + 70, yPos);
        drawBlueValue(base, baseX, yPos);
        drawBlueValue(tipo, tipoX, yPos);
        drawBlueValue(aportacion, aportacionX, yPos);
    };

    y += 2;
    drawProLine("AT y EP", y, nomina.baseCotizacion, nomina.porcATEPEmpresa, nomina.aportacionEmpresaATEP);
    y += 4;
    drawProLine("Desempleo", y, nomina.baseCotizacion, nomina.porcDesempleoEmpresa, nomina.aportacionEmpresaDesempleo);
    y += 4;
    drawProLine("Formación Profesional", y, nomina.baseCotizacion, nomina.porcFPEmpresa, nomina.aportacionEmpresaFP);
    y += 4;
    drawProLine("Fondo Garantía Salarial", y, nomina.baseCotizacion, nomina.porcFogasaEmpresa, nomina.aportacionEmpresaFogasa);
    
    y += 6;
    doc.setFontSize(labelSize);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(0, 0, 0);
    doc.text("3. Cotización adicional horas extraordinarias", Margin_X, y);
    
    y += 5;
    doc.text("4. Base sujeta a retención del IRPF", Margin_X, y);
    drawBlueValue(nomina.totalDevengos, Margin_X + 70, y);

    doc.setFontSize(labelSize);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(0, 0, 0);
    doc.text("Total coste:", 110, y);
    drawBlueValue(nomina.totalCoste, 150, y);
    
    doc.setFontSize(labelSize);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(0, 0, 0);
    doc.text("Total:", 165, y);
    drawBlueValue(nomina.totalAportacionesEmpresa, aportacionX, y);
    
    // --- DIBUJAR EL RECUADRO EXTERIOR DEL PIE DE PÁGINA ---
    const footerHeight = (y + 5) - footerStartY;
    doc.setLineWidth(0.2);
    doc.rect(MARGIN, footerStartY, 185, footerHeight);
}


// ==========================================================
// --- FUNCIÓN PÚBLICA: EXPORTAR PDF ÚNICO ---
// ==========================================================
function generarPdfNomina(datosNomina) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p', 'mm', 'a4');
    
    // Llamamos a la función de dibujo principal
    dibujarPaginaDeNomina(doc, datosNomina);
    
    const fileName = `Nomina_${datosNomina.empleado.nombre.replace(/\s+/g, '_')}_${datosNomina.periodo.inicio}.pdf`;
    doc.save(fileName);
}


// ==========================================================
// --- FUNCIÓN PÚBLICA: EXPORTAR PDF EN LOTE (NUEVA) ---
// ==========================================================
function generarPdfLote(listaResultados, datosEmpresa, todosLosPuestos) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p', 'mm', 'a4');
    let primerEmpleado = true;

    listaResultados.forEach(resultado => {
        // Solo procesamos empleados sin errores
        if (resultado.nomina && !resultado.nomina.error) {
            
            if (!primerEmpleado) {
                doc.addPage(); // Añade nueva página para el siguiente empleado
            }
            
            // Buscamos el puesto del empleado actual
            const puestoEmpleado = todosLosPuestos.find(p => p.id === resultado.empleado.puestoId);
            
            // Preparamos el objeto de datos completo para la función de dibujo
            const datosPagina = {
                nomina: resultado.nomina,
                empleado: resultado.empleado,
                periodo: resultado.periodo,
                puesto: puestoEmpleado,
                empresa: datosEmpresa
            };
            
            // Llamamos a la función de dibujo principal
            dibujarPaginaDeNomina(doc, datosPagina);
            
            primerEmpleado = false;
        }
    });

    // Guardar el PDF multipágina
    if (primerEmpleado) {
        // Si 'primerEmpleado' sigue siendo true, significa que no se dibujó ninguna nómina (quizás todos tenían error)
        alert("No se pudo generar el PDF: No hay nóminas válidas para exportar.");
        return;
    }

    const mes = new Date(listaResultados[0].periodo.inicio + 'T00:00:00').toLocaleString('es-ES', { month: 'long' });
    const anio = new Date(listaResultados[0].periodo.inicio + 'T00:00:00').getFullYear();
    const fileName = `Nominas_Lote_${mes}_${anio}.pdf`;
    doc.save(fileName);
}