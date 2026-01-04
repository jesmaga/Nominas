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
    const esInicioMes = fechaInicio.endsWith('-01');
    const [year, month, day] = fechaInicio.split('-').map(Number);
    const lastDayOfMonth = new Date(year, month, 0).getDate();
    const fechaFinEsperada = `${year}-${month.toString().padStart(2, '0')}-${lastDayOfMonth}`;
    const esMesCompletoString = esInicioMes && (fechaFin === fechaFinEsperada);

    if (esMesCompletoString) {
        diasCalculoTotal = 30;
    } else {
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

    const diasTrabajados = Math.max(0, diasCalculoTotal - diasBajaEnPeriodo);
    const proporcionDiasTrabajados = diasDelMes > 0 ? diasTrabajados / 30 : 0;

    // --- 3. Inicialización de Variables ---
    let salarioBasePeriodo = 0;
    let prorrataExtraPeriodo = 0;
    let prestacionEnfermedadLegal = 0;
    let complementoEnfermedadEmpresa = 0;
    let baseContingenciasComunes = 0;
    let baseContingenciasProfesionales = 0;
    let totalConceptos = 0;
    let conceptosDesglosados = [];

    // Variables para cálculos automáticos auxiliares
    const salarioMensualPuesto = parseFloat(puesto.salario);
    const horasEstandarPuesto = parseFloat(puesto.horas);
    const horasContratoEmpleado = parseFloat(empleado.horas);
    const proporcionJornada = horasEstandarPuesto > 0 ? horasContratoEmpleado / horasEstandarPuesto : 0;
    const salarioBaseMensualCompleto = salarioMensualPuesto * proporcionJornada;
    const prorrataMensualCompleta = salarioBaseMensualCompleto / 6;

    // Variables para CPP
    let totalCPP = 0;
    let totalConceptosTeoricoMensual = 0;

    // =================================================================================
    // --- 4. Cálculo de Conceptos del Puesto (CPP y otros) ---
    // CORRECCIÓN: Solo calculamos esto automáticamente SI NO ES MANUAL
    // =================================================================================
    if (!manualData) {
        if (puesto.conceptosAdicionales && Array.isArray(puesto.conceptosAdicionales)) {
            puesto.conceptosAdicionales.forEach(c => {
                let importe = parseFloat(c.importe) || 0;
                const periodicidad = parseInt(c.periodicidadAnios) || 0;

                // Si tiene periodicidad (ej: Antigüedad)
                if (periodicidad > 0 && empleado.antiguedad) {
                    const fechaAntiguedad = new Date(empleado.antiguedad);
                    const hoy = new Date(inicioPeriodo);

                    let anos = hoy.getFullYear() - fechaAntiguedad.getFullYear();
                    const m = hoy.getMonth() - fechaAntiguedad.getMonth();
                    if (m < 0 || (m === 0 && hoy.getDate() < fechaAntiguedad.getDate())) {
                        anos--;
                    }

                    const tramos = Math.floor(anos / periodicidad);
                    if (tramos > 0) {
                        const importeMensualTeoricoCPP = (importe * tramos) * proporcionJornada;
                        totalCPP += importeMensualTeoricoCPP;
                        totalConceptosTeoricoMensual += importeMensualTeoricoCPP;

                        const importePago = importeMensualTeoricoCPP * (diasTrabajados / 30);
                        const importeTotal = parseFloat(importePago.toFixed(2));

                        totalConceptos += importeTotal;

                        conceptosDesglosados.push({
                            nombre: c.nombre,
                            concepto: c.nombre,
                            importe: importeTotal,
                            periodos: `${tramos} tramo(s) de ${periodicidad} años`
                        });
                    }
                } else {
                    // Concepto fijo
                    const importeMensualTeorico = importe * proporcionJornada;
                    totalConceptosTeoricoMensual += importeMensualTeorico;

                    const importePago = importeMensualTeorico * (diasTrabajados / 30);
                    const importeCalculado = parseFloat(importePago.toFixed(2));

                    totalConceptos += importeCalculado;
                    conceptosDesglosados.push({
                        nombre: c.nombre,
                        concepto: c.nombre,
                        importe: importeCalculado
                    });
                }
            });
        }
    }

    // --- 5. Lógica Principal (Manual vs Automática) ---
    if (manualData) {
        // --- MODO MANUAL ---
        salarioBasePeriodo = manualData.salarioBase;
        prorrataExtraPeriodo = manualData.prorrata;
        prestacionEnfermedadLegal = manualData.prestacionBaja;
        complementoEnfermedadEmpresa = manualData.complementoBaja;

        // Si hay plus convenio manual, lo añadimos (será el único concepto)
        if (manualData.plusConvenio) {
            totalConceptos += manualData.plusConvenio;
            conceptosDesglosados.push({
                nombre: "Plus Convenio / CPP (Manual)",
                concepto: "Plus Convenio / CPP (Manual)",
                importe: manualData.plusConvenio
            });
        }

        // Bases manuales
        baseContingenciasComunes = manualData.baseCotizacion;
        baseContingenciasProfesionales = manualData.baseCotizacion;

    } else {
        // --- MODO AUTOMÁTICO ---
        salarioBasePeriodo = salarioBaseMensualCompleto * (diasTrabajados / 30);
        prorrataExtraPeriodo = prorrataMensualCompleta * (diasTrabajados / 30);

        let diasBajaComputables = diasBajaEnPeriodo;
        if (diasCalculoTotal === 30 && diasBajaEnPeriodo > 30) {
            diasBajaComputables = 30;
        }

        // Baja Automática
        if (diasBajaEnPeriodo > 0) {
            let baseAnteriorNum = 0;
            if (baseMesAnterior) {
                const baseStr = baseMesAnterior.toString().replace(',', '.');
                baseAnteriorNum = parseFloat(baseStr);
            }
            const baseReguladora = baseAnteriorNum || (salarioBaseMensualCompleto + prorrataMensualCompleta + totalConceptosTeoricoMensual);
            const baseReguladoraLegalDiaria = baseReguladora / 30;
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

                if (diaActualDeBaja <= 90) {
                    const complementoDiario = baseComplementoDiaria * (1 - porcentajePago);
                    if (complementoDiario > 0) {
                        complementoEnfermedadEmpresa += complementoDiario;
                    }
                }
            }
        }

        // Bases de Cotización Automáticas
        const baseParteTrabajada = (salarioBaseMensualCompleto + prorrataMensualCompleta) * (diasTrabajados / 30);
        let baseParteBaja = 0;
        if (diasBajaEnPeriodo > 0) {
            let baseAnteriorNum = 0;
            if (baseMesAnterior) {
                const baseStr = baseMesAnterior.toString().replace(',', '.');
                baseAnteriorNum = parseFloat(baseStr);
            }
            const baseReguladora = baseAnteriorNum || (salarioBaseMensualCompleto + prorrataMensualCompleta + totalConceptosTeoricoMensual);
            baseParteBaja = (baseReguladora / 30) * diasBajaComputables;
        }

        baseContingenciasComunes = baseParteTrabajada + baseParteBaja + totalConceptos;
        baseContingenciasProfesionales = baseContingenciasComunes;
    }

    // --- Procesar Otros Devengos (Array dinámico) ---
    // Se suman tanto en manual como en automático
    if (otrosDevengos && Array.isArray(otrosDevengos)) {
        otrosDevengos.forEach(d => {
            // Evitamos duplicados si el concepto manual ya se añadió (raro en este flujo, pero por seguridad)
            const yaExiste = conceptosDesglosados.some(c => c.concepto === d.concepto && d.concepto === "Plus Convenio / CPP (Manual)");

            if (!yaExiste) {
                totalConceptos += d.importe;
                conceptosDesglosados.push({
                    nombre: d.concepto,
                    concepto: d.concepto,
                    importe: d.importe
                });
            }
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

    // --- 5. Totales y Deducciones ---
    const totalDevengado = salarioBasePeriodo + prorrataExtraPeriodo + totalConceptos + prestacionEnfermedadLegal + complementoEnfermedadEmpresa;

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
        diasCotizados: diasCalculoTotal,
        diasCalculoTotal, diasTrabajados, diasBajaEnPeriodo,
        salarioBaseMensualCompleto: salarioBaseMensualCompleto.toFixed(2),
        otrosDevengos: [],
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