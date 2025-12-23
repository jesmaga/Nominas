// ==========================================================
// --- LÓGICA DE CÁLCULO DE NÓMINAS ---
// Este archivo contiene toda la lógica para calcular una nómina.
// ==========================================================

function calcularNomina(empleado, puesto, configSS, fechaInicio, fechaFin, fechaInicioBaja, fechaFinBaja, porcentajeIRPF, otrosDevengos, otrasDeducciones, baseMesAnterior, manualData = null) {
    // --- 1. Validaciones Iniciales ---
    if (!empleado || !puesto || !configSS || !fechaInicio || !fechaFin) {
        return { error: "Faltan datos esenciales (empleado, puesto, configSS, fechas)." };
    }
    const inicioPeriodo = new Date(fechaInicio + 'T00:00:00');
    const finPeriodo = new Date(fechaFin + 'T00:00:00');

    if (isNaN(inicioPeriodo.getTime()) || isNaN(finPeriodo.getTime())) {
        return { error: "Las fechas proporcionadas no son válidas." };
    }
    
    if (inicioPeriodo > finPeriodo) {
        return { error: "La fecha de inicio no puede ser posterior a la fecha de fin." };
    }
    const irpf = parseFloat(porcentajeIRPF) || 0;

    // --- 2. Preparación de Datos y Fechas ---
    const MS_PER_DAY = 1000 * 60 * 60 * 24;
    const diasDelMes = new Date(inicioPeriodo.getFullYear(), inicioPeriodo.getMonth() + 1, 0).getDate();
    const diasTrabajadosReal = Math.round((finPeriodo - inicioPeriodo) / MS_PER_DAY) + 1;
    let diasCalculoTotal = diasTrabajadosReal;

    // --- DETECCIÓN DE MES COMPLETO (Criterio Comercial 30 días) ---
    // ROBUST FIX: Usamos cadenas de texto para evitar problemas de zona horaria.
    // Si la fecha de inicio es 'YYYY-MM-01' y la fecha de fin es el último día de ese mes.
    const esInicioMes = fechaInicio.endsWith('-01');

    // Calcular el último día del mes de la fecha de inicio para comparar
    const [year, month, day] = fechaInicio.split('-').map(Number);
    const lastDayOfMonth = new Date(year, month, 0).getDate(); // Mes 1-12, día 0 es último del anterior. Wait.
    // month is 1-based in string? split('-') gives ["2026", "01", "01"].
    // new Date(2026, 1, 0) -> Feb 0 -> Jan 31. Correct.
    const fechaFinEsperada = `${year}-${month.toString().padStart(2, '0')}-${lastDayOfMonth}`;

    const esMesCompletoString = esInicioMes && (fechaFin === fechaFinEsperada);

    if (esMesCompletoString) {
        diasCalculoTotal = 30;
        console.log("NominaJS: Mes Completo Detectado (30 días).");
    } else {
        // Fallback lógica antigua por si acaso, o mantener diasTrabajadosReal
        if (esInicioMes && new Date(finPeriodo.getFullYear(), finPeriodo.getMonth() + 1, 0).getDate() === finPeriodo.getDate() && inicioPeriodo.getMonth() === finPeriodo.getMonth()) {
            diasCalculoTotal = 30;
        }
    }

    let diasBajaEnPeriodo = 0;
    let diasBajaAcumuladosInicio = 0;

    if (fechaInicioBaja && fechaFinBaja) {
        const inicioBaja = new Date(fechaInicioBaja + 'T00:00:00');
        const finBaja = new Date(fechaFinBaja + 'T00:00:00');
        if (inicioBaja <= finBaja) {
            const inicioRealBaja = new Date(Math.max(inicioPeriodo, inicioBaja));
            const finRealBaja = new Date(Math.min(finPeriodo, finBaja));
            if (finRealBaja >= inicioRealBaja) {
                diasBajaEnPeriodo = Math.round((finRealBaja - inicioRealBaja) / MS_PER_DAY) + 1;
                diasBajaAcumuladosInicio = Math.round((inicioRealBaja - inicioBaja) / MS_PER_DAY) + 1;
            }
        }
    }

    // Si es mes completo (30 días comerciales) y hay baja, restamos los días reales de baja
    // Pero ojo: si el mes tiene 31 días y hay 1 día de baja, ¿pagamos 29 o 30?
    // Criterio estándar: 30 - días de baja.
    // Si el mes tiene 28 días y hay 5 de baja: 30 - 5 = 25 días a pagar.
    // FIX: En meses de 31 días con baja completa, el cálculo (30 - 31) daba -1.
    // Clamp to 0.
    const diasTrabajados = Math.max(0, diasCalculoTotal - diasBajaEnPeriodo);
    const proporcionDiasTrabajados = diasDelMes > 0 ? diasTrabajados / 30 : 0; // Usamos 30 como base estándar

    // --- 3. Inicialización de Variables ---
    let salarioBasePeriodo = 0;
    let prorrataExtraPeriodo = 0;
    let prestacionEnfermedadLegal = 0;
    let complementoEnfermedadEmpresa = 0;
    let baseContingenciasComunes = 0;
    let baseContingenciasProfesionales = 0;
    let totalConceptos = 0;
    let conceptosDesglosados = [];

    // Procesar otros devengos (siempre se suman, salvo que manualData diga lo contrario, pero asumiremos que se suman)
    // Si es manual, el usuario puede haberlos metido ya en el "Plus Convenio" o querer añadirlos aparte.
    // Asumiremos que "Otros Devengos" del formulario se suman SIEMPRE.
    if (otrosDevengos && Array.isArray(otrosDevengos)) {
        otrosDevengos.forEach(d => {
            totalConceptos += d.importe;
            conceptosDesglosados.push(d);
        });
    }

    let totalDeduccionesOtras = 0;
    let deduccionesDesglosadas = [];
    if (otrasDeducciones && Array.isArray(otrasDeducciones)) {
        otrasDeducciones.forEach(d => {
            totalDeduccionesOtras += d.importe;
            deduccionesDesglosadas.push(d);
        });
    }

    // Variables para cálculos automáticos
    const salarioMensualPuesto = parseFloat(puesto.salario);
    const horasEstandarPuesto = parseFloat(puesto.horas);
    const horasContratoEmpleado = parseFloat(empleado.horas);
    const proporcionJornada = horasEstandarPuesto > 0 ? horasContratoEmpleado / horasEstandarPuesto : 0;
    const salarioBaseMensualCompleto = salarioMensualPuesto * proporcionJornada;
    const prorrataMensualCompleta = salarioBaseMensualCompleto / 6; // Estimación

    // --- 4. Cálculo de Conceptos del Puesto (CPP y otros) ---
    // MOVIDO ANTES DEL CÁLCULO DE BAJA para poder usar el CPP en el complemento.
    let totalCPP = 0; // Acumulará conceptos de antigüedad (periodicidad > 0)
    let totalConceptosTeoricoMensual = 0; // Acumulará el VALOR TEÓRICO MENSUAL de todos los conceptos (para base cotización defecto)

    if (puesto.conceptosAdicionales && Array.isArray(puesto.conceptosAdicionales)) {
        puesto.conceptosAdicionales.forEach(c => {
            let importe = parseFloat(c.importe) || 0;
            const periodicidad = parseInt(c.periodicidadAnios) || 0;

            // Si tiene periodicidad (ej: Antigüedad), calculamos cuántos tramos ha cumplido
            if (periodicidad > 0 && empleado.antiguedad) {
                const fechaAntiguedad = new Date(empleado.antiguedad);
                const hoy = new Date(inicioPeriodo); // Usamos fecha INICIO de nómina para cálculo de antigüedad

                let anos = hoy.getFullYear() - fechaAntiguedad.getFullYear();
                const m = hoy.getMonth() - fechaAntiguedad.getMonth();
                if (m < 0 || (m === 0 && hoy.getDate() < fechaAntiguedad.getDate())) {
                    anos--;
                }

                const tramos = Math.floor(anos / periodicidad);
                if (tramos > 0) {
                    // Cálculo del importe teórico mensual (ajustado a jornada, pero MES COMPLETO)
                    // Este valor se usa para:
                    // 1. Acumular en 'totalCPP' para el cálculo del complemento de baja (que busca garantizar el 100% del teórico).
                    const importeMensualTeoricoCPP = (importe * tramos) * proporcionJornada;
                    totalCPP += importeMensualTeoricoCPP;
                    totalConceptosTeoricoMensual += importeMensualTeoricoCPP;

                    // 2. Calcular el PAGO REAL en nómina (Concepto Devengado):
                    // Se debe prorratear por los días TRABAJADOS. 
                    // Si está de baja todo el mes, diasTrabajados = 0, por lo que este concepto será 0.
                    // El complemento de empresa cubrirá la diferencia.

                    const importePago = importeMensualTeoricoCPP * (diasTrabajados / 30);
                    const importeTotal = parseFloat(importePago.toFixed(2));

                    totalConceptos += importeTotal;

                    conceptosDesglosados.push({
                        nombre: c.nombre, // Para compatibilidad con Index.html
                        concepto: c.nombre,
                        importe: importeTotal,
                        periodos: `${tramos} tramo(s) de ${periodicidad} años`
                    });
                }
            } else {
                // Concepto fijo (Plus Convenio, etc.)
                // También se prorratea según los días trabajados

                // Teórico Mensual
                const importeMensualTeorico = importe * proporcionJornada;
                totalConceptosTeoricoMensual += importeMensualTeorico;

                // Pago Real (Días Trabajados)
                const importePago = importeMensualTeorico * (diasTrabajados / 30);
                const importeCalculado = parseFloat(importePago.toFixed(2));

                totalConceptos += importeCalculado;
                conceptosDesglosados.push({
                    nombre: c.nombre, // Para compatibilidad
                    concepto: c.nombre,
                    importe: importeCalculado
                });
            }
        });
    }

    // --- 5. Lógica Principal (Manual vs Automática) ---
    if (manualData) {
        // --- MODO MANUAL ---
        salarioBasePeriodo = manualData.salarioBase;
        prorrataExtraPeriodo = manualData.prorrata;
        prestacionEnfermedadLegal = manualData.prestacionBaja;
        complementoEnfermedadEmpresa = manualData.complementoBaja;

        // Si hay plus convenio manual, lo añadimos
        if (manualData.plusConvenio) {
            totalConceptos += manualData.plusConvenio;
            conceptosDesglosados.push({ concepto: "Plus Convenio / CPP (Manual)", importe: manualData.plusConvenio });
        }

        // Bases manuales
        baseContingenciasComunes = manualData.baseCotizacion;
        baseContingenciasProfesionales = manualData.baseCotizacion;

    } else {
        // --- MODO AUTOMÁTICO ---

        // Salario Base
        salarioBasePeriodo = salarioBaseMensualCompleto * (diasTrabajados / 30); // Usamos 30 días comercial
        prorrataExtraPeriodo = prorrataMensualCompleta * (diasTrabajados / 30);

        // Pre-Cálculo de Días de Baja Computables (Capado a 30 días si mes comercial)
        let diasBajaComputables = diasBajaEnPeriodo;
        if (diasCalculoTotal === 30 && diasBajaEnPeriodo > 30) {
            diasBajaComputables = 30;
        }

        // Baja
        if (diasBajaEnPeriodo > 0) {
            // FIX: Parsing robusto de baseMesAnterior (cambiar coma por punto si viene como string)
            let baseAnteriorNum = 0;
            if (baseMesAnterior) {
                const baseStr = baseMesAnterior.toString().replace(',', '.');
                baseAnteriorNum = parseFloat(baseStr);
            }

            // FIX: Si no hay baseMesAnterior (ej: primera nómina), usamos la suma de devengos TEÓRICA MENSUAL COMPLETA
            // (Salario Base + Prorrata + TOTAL CONCEPTOS TEÓRICOS)
            const baseReguladora = baseAnteriorNum || (salarioBaseMensualCompleto + prorrataMensualCompleta + totalConceptosTeoricoMensual);
            const baseReguladoraLegalDiaria = baseReguladora / 30;

            // Objetivo Complemento: 100% (Salario Base + CPP)
            // CPP aquí es 'totalCPP' calculado arriba (Suma de importes teóricos mensuales de antigüedad)
            const baseComplementoMensual = salarioBaseMensualCompleto + totalCPP;
            const baseComplementoDiaria = baseComplementoMensual / 30;

            for (let i = 0; i < diasBajaComputables; i++) {
                const diaActualDeBaja = diasBajaAcumuladosInicio + i;
                let pagoDiarioLegal = 0;
                let porcentajePago = 0;

                if (diaActualDeBaja >= 4 && diaActualDeBaja <= 20) {
                    porcentajePago = 0.60;
                    pagoDiarioLegal = baseReguladoraLegalDiaria * 0.60;
                } else if (diaActualDeBaja >= 21) {
                    porcentajePago = 0.75;
                    pagoDiarioLegal = baseReguladoraLegalDiaria * 0.75;
                }

                prestacionEnfermedadLegal += pagoDiarioLegal;

                if (diaActualDeBaja <= 90) { // Asumimos complemento hasta día 90 o según política
                    // Complemento = (Base + CPP) * (100% - %CubiertoSS)
                    // Equivalente a: (BaseDiariaComplemento * 100%) - PagoLegal
                    // Nota: Si el pago legal es 0 (días 1-3), el complemento es el 100% de la base.

                    // Cálculo directo según fórmula usuario:
                    // Complemento = (Salario Base + CPP) * (100% - PorcentajeCubierto)
                    // Porcentaje Cubierto es 'porcentajePago' (0, 0.60, 0.75)

                    const complementoDiario = baseComplementoDiaria * (1 - porcentajePago);

                    if (complementoDiario > 0) {
                        complementoEnfermedadEmpresa += complementoDiario;
                    }
                }
            }
        }

        // Bases de Cotización
        // Base Parte Trabajada
        const baseParteTrabajada = (salarioBaseMensualCompleto + prorrataMensualCompleta) * (diasTrabajados / 30);

        // Base Parte Baja
        let baseParteBaja = 0;
        if (diasBajaEnPeriodo > 0) {
            // FIX: Parsing robusto de baseMesAnterior
            let baseAnteriorNum = 0;
            if (baseMesAnterior) {
                const baseStr = baseMesAnterior.toString().replace(',', '.');
                baseAnteriorNum = parseFloat(baseStr);
            }

            // FIX: Misma lógica para base reguladora por defecto
            const baseReguladora = baseAnteriorNum || (salarioBaseMensualCompleto + prorrataMensualCompleta + totalConceptosTeoricoMensual);

            // Usamos diasBajaComputables (estandarizado a 30 en meses comerciales)
            baseParteBaja = (baseReguladora / 30) * diasBajaComputables;
        }

        baseContingenciasComunes = baseParteTrabajada + baseParteBaja + totalConceptos; // Sumamos conceptos a la base
        baseContingenciasProfesionales = baseContingenciasComunes;
    }

    // Procesar otros devengos (siempre se suman, salvo que manualData diga lo contrario, pero asumiremos que se suman)
    if (otrosDevengos && Array.isArray(otrosDevengos)) {
        otrosDevengos.forEach(d => {
            // EVITAR DUPLICADOS: Si el concepto ya existe (por ejemplo, añadido por el Puesto), no lo añadimos de nuevo.
            const yaExiste = conceptosDesglosados.some(c => c.concepto === d.concepto || c.nombre === d.concepto);

            if (!yaExiste) {
                totalConceptos += d.importe;
                conceptosDesglosados.push({
                    nombre: d.concepto, // Para compatibilidad
                    concepto: d.concepto,
                    importe: d.importe
                });
            }
        });
    }

    // --- 5. Totales y Deducciones ---
    // AÑADIDO: prorrataExtraPeriodo se incluye en el Total Devengado según petición usuario
    const totalDevengado = salarioBasePeriodo + prorrataExtraPeriodo + totalConceptos + prestacionEnfermedadLegal + complementoEnfermedadEmpresa;

    // Base de Cotización (BCC)
    // Si NO es manual, la calculamos. Si es manual, ya viene fijada.


    const porcCC = parseFloat(configSS['ss-cc-empleado']) / 100;
    const porcDesempleo = parseFloat(configSS['ss-desempleo-empleado']) / 100;
    const porcFP = parseFloat(configSS['ss-fp-empleado']) / 100;
    const porcMEI = parseFloat(configSS['ss-mei-empleado']) / 100;

    const deduccionCC = baseContingenciasComunes * porcCC;
    const deduccionDesempleo = baseContingenciasProfesionales * porcDesempleo;
    const deduccionFP = baseContingenciasProfesionales * porcFP;
    const deduccionMEI = baseContingenciasComunes * porcMEI;
    const totalDeduccionesSS = deduccionCC + deduccionDesempleo + deduccionFP + deduccionMEI;

    const baseIRPF = totalDevengado;
    const deduccionIRPF = baseIRPF * (irpf / 100);

    const totalDeducciones = totalDeduccionesSS + deduccionIRPF + totalDeduccionesOtras;
    const liquido = totalDevengado - totalDeducciones;

    // --- 6. Aportaciones Empresa ---
    let porcDesempleoEmpresa = 0;
    switch (empleado.tipoContrato) {
        case 'Temporal':
        case 'Formación y Aprendizaje':
        case 'Prácticas':
            porcDesempleoEmpresa = parseFloat(configSS['ss-desempleo-tem-gen-empresa']) / 100;
            break;
        default:
            porcDesempleoEmpresa = parseFloat(configSS['ss-desempleo-ind-gen-empresa']) / 100;
            break;
    }
    const porcCCEmpresa = parseFloat(configSS['ss-cc-empresa']) / 100;
    const porcATEPEmpresa = parseFloat(configSS['ss-at-ep-empresa']) / 100;
    const porcFPEmpresa = parseFloat(configSS['ss-fp-empresa']) / 100;
    const porcFogasaEmpresa = parseFloat(configSS['ss-fogasa-empresa']) / 100;

    const aportacionEmpresaCC = baseContingenciasComunes * porcCCEmpresa;
    const aportacionEmpresaATEP = baseContingenciasProfesionales * porcATEPEmpresa;
    const aportacionEmpresaDesempleo = baseContingenciasProfesionales * porcDesempleoEmpresa;
    const aportacionEmpresaFP = baseContingenciasProfesionales * porcFPEmpresa;
    const aportacionEmpresaFogasa = baseContingenciasProfesionales * porcFogasaEmpresa;
    const totalAportacionesEmpresa = aportacionEmpresaCC + aportacionEmpresaATEP + aportacionEmpresaDesempleo + aportacionEmpresaFP + aportacionEmpresaFogasa;
    const totalCoste = totalDevengado + totalAportacionesEmpresa;

    return {
        diasCalculoTotal, diasTrabajados, diasBajaEnPeriodo,
        salarioBaseMensualCompleto: salarioBaseMensualCompleto.toFixed(2),
        otrosDevengos: [], // Evitar duplicados en Index.html
        otrasDeducciones: deduccionesDesglosadas.map(d => ({ ...d, importe: d.importe.toFixed(2) })),
        salarioBasePeriodo: salarioBasePeriodo.toFixed(2),
        prorrataExtraPeriodo: prorrataExtraPeriodo.toFixed(2),
        conceptosCalculados: conceptosDesglosados,
        prestacionEnfermedadLegal: prestacionEnfermedadLegal.toFixed(2),
        complementoEnfermedadEmpresa: complementoEnfermedadEmpresa.toFixed(2),
        totalDevengos: totalDevengado.toFixed(2),
        baseCotizacion: baseContingenciasComunes.toFixed(2),
        deduccionCC: deduccionCC.toFixed(2),
        porcCC: (porcCC * 100).toFixed(2),
        deduccionDesempleo: deduccionDesempleo.toFixed(2),
        porcDesempleo: (porcDesempleo * 100).toFixed(2),
        deduccionFP: deduccionFP.toFixed(2),
        porcFP: (porcFP * 100).toFixed(2),
        deduccionMEI: deduccionMEI.toFixed(2),
        porcMEI: (porcMEI * 100).toFixed(2),
        totalDeduccionesSS: totalDeduccionesSS.toFixed(2),
        deduccionIRPF: deduccionIRPF.toFixed(2),
        porcentajeIRPF: irpf.toFixed(2),
        totalDeducciones: totalDeducciones.toFixed(2),
        aportacionEmpresaCC: aportacionEmpresaCC.toFixed(2),
        porcCCEmpresa: (porcCCEmpresa * 100).toFixed(2),
        aportacionEmpresaATEP: aportacionEmpresaATEP.toFixed(2),
        porcATEPEmpresa: (porcATEPEmpresa * 100).toFixed(2),
        aportacionEmpresaDesempleo: aportacionEmpresaDesempleo.toFixed(2),
        porcDesempleoEmpresa: (porcDesempleoEmpresa * 100).toFixed(2),
        aportacionEmpresaFP: aportacionEmpresaFP.toFixed(2),
        porcFPEmpresa: (porcFPEmpresa * 100).toFixed(2),
        aportacionEmpresaFogasa: aportacionEmpresaFogasa.toFixed(2),
        porcFogasaEmpresa: (porcFogasaEmpresa * 100).toFixed(2),
        totalAportacionesEmpresa: totalAportacionesEmpresa.toFixed(2),
        totalCoste: totalCoste.toFixed(2),
        salarioNeto: liquido.toFixed(2)
    };
}