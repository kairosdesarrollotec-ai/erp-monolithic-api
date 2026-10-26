import {
  assertAuthorizationLevelReached,
  assertEmployeeStatusEditable,
  assertPayrollMonthClosable,
  assertTerminationRules,
  calculateAttendanceDeductionAmount,
  currentLevelTimeoutAt,
  evaluateReturnOutcome,
  getNextCascadeStatus,
  levelTimeoutFrom,
  pendingLevelOf,
  resolveAttendanceRecord,
  validateAuthorizationLevel,
  validateVacationAreaCapacity,
} from './hr-administration-rules';
import {
  AuthorizationLevelNotReachedError,
  DeductionsBeforeMonthEndError,
  EmployeeStatusTransitionNotAllowedError,
  FieldTripNotPendingError,
  FinalSettlementRequiredError,
  InvalidAttendanceRecordError,
  InvalidAuthorizationLevelError,
  InvalidPayrollMonthError,
  InvalidTerminationNoticeError,
  TerminationNotesRequiredError,
  VacationOverlapError,
} from './hr-administration-errors';

describe('HR Administration Domain Rules (ADP-01 a ADP-10)', () => {
  describe('BR-ADP-002 / DR-ADP-001: Capacidad de área para vacaciones (máximo 1 persona a la vez)', () => {
    const areaId = 'AREA-OPERACIONES';
    const areaName = 'Operaciones';

    it('permite programar vacaciones si no hay ninguna otra solicitud en el área', () => {
      expect(() =>
        validateVacationAreaCapacity(
          [],
          {
            employeeId: 'emp-1',
            areaId,
            startDate: new Date('2026-11-01'),
            endDate: new Date('2026-11-15'),
            status: 'SOLICITADA',
          },
          areaName,
        ),
      ).not.toThrow();
    });

    it('permite programar si las fechas no se solapan con otra persona del área', () => {
      const existing = [
        {
          id: 'vac-1',
          employeeId: 'emp-1',
          areaId,
          startDate: new Date('2026-11-01'),
          endDate: new Date('2026-11-15'),
          status: 'PROGRAMADA',
        },
      ];

      expect(() =>
        validateVacationAreaCapacity(
          existing,
          {
            employeeId: 'emp-2',
            areaId,
            startDate: new Date('2026-11-16'),
            endDate: new Date('2026-11-30'),
            status: 'SOLICITADA',
          },
          areaName,
        ),
      ).not.toThrow();
    });

    it('lanza VacationOverlapError si otra persona del área ya tiene vacaciones programadas en el mismo rango', () => {
      const existing = [
        {
          id: 'vac-1',
          employeeId: 'emp-1',
          areaId,
          startDate: new Date('2026-11-01'),
          endDate: new Date('2026-11-15'),
          status: 'PROGRAMADA',
        },
      ];

      expect(() =>
        validateVacationAreaCapacity(
          existing,
          {
            employeeId: 'emp-2',
            areaId,
            startDate: new Date('2026-11-10'),
            endDate: new Date('2026-11-20'),
            status: 'SOLICITADA',
          },
          areaName,
        ),
      ).toThrow(VacationOverlapError);
    });

    it('ignora solicitudes canceladas o completadas', () => {
      const existing = [
        {
          id: 'vac-1',
          employeeId: 'emp-1',
          areaId,
          startDate: new Date('2026-11-01'),
          endDate: new Date('2026-11-15'),
          status: 'CANCELADA',
        },
      ];

      expect(() =>
        validateVacationAreaCapacity(
          existing,
          {
            employeeId: 'emp-2',
            areaId,
            startDate: new Date('2026-11-05'),
            endDate: new Date('2026-11-12'),
            status: 'SOLICITADA',
          },
          areaName,
        ),
      ).not.toThrow();
    });
  });

  describe('BR-ADP-004 / DR-ADP-002 / TD-ADP-001: Cascada de salida a campo (3 niveles, sin 4to)', () => {
    it('avanza de PENDIENTE_NIVEL_1 a PENDIENTE_NIVEL_2', () => {
      const result = getNextCascadeStatus('PENDIENTE_NIVEL_1');
      expect(result.nextStatus).toBe('PENDIENTE_NIVEL_2');
    });

    it('avanza de PENDIENTE_NIVEL_2 a PENDIENTE_NIVEL_3', () => {
      const result = getNextCascadeStatus('PENDIENTE_NIVEL_2');
      expect(result.nextStatus).toBe('PENDIENTE_NIVEL_3');
    });

    it('al agotar PENDIENTE_NIVEL_3 transiciona a NO_AUTORIZADA sin 4to nivel automático', () => {
      const result = getNextCascadeStatus('PENDIENTE_NIVEL_3');
      expect(result.nextStatus).toBe('NO_AUTORIZADA');
      expect(result.message).toContain('Nadie autorizó');
      expect(result.message).toContain('Consulta manualmente con Fiorella o José');
    });

    it('lanza FieldTripNotPendingError si se intenta avanzar un estado no pendiente', () => {
      expect(() => getNextCascadeStatus('AUTORIZADA')).toThrow(FieldTripNotPendingError);
      expect(() => getNextCascadeStatus('NO_AUTORIZADA')).toThrow(FieldTripNotPendingError);
    });

    it('valida niveles de autorización 1, 2 y 3 pero rechaza nivel 4 o superior', () => {
      expect(() => validateAuthorizationLevel(1)).not.toThrow();
      expect(() => validateAuthorizationLevel(2)).not.toThrow();
      expect(() => validateAuthorizationLevel(3)).not.toThrow();
      expect(() => validateAuthorizationLevel(4)).toThrow(InvalidAuthorizationLevelError);
      expect(() => validateAuthorizationLevel(0)).toThrow(InvalidAuthorizationLevelError);
    });
  });

  describe('BR-ADP-005: Evaluación de retorno tardío de salida a campo', () => {
    const scheduled = new Date('2026-10-15T18:00:00Z');

    it('retorno puntual resulta en CERRADA_NORMAL sin aumentar contador de tardanzas', () => {
      const actual = new Date('2026-10-15T17:55:00Z');
      const outcome = evaluateReturnOutcome(0, scheduled, actual);
      expect(outcome.isLate).toBe(false);
      expect(outcome.newLateCount).toBe(0);
      expect(outcome.status).toBe('CERRADA_NORMAL');
      expect(outcome.isObserved).toBe(false);
    });

    it('1ª a 3ª tardanza resultan en CERRADA_NORMAL con mensaje de advertencia', () => {
      const actual = new Date('2026-10-15T18:30:00Z');
      const outcome1 = evaluateReturnOutcome(0, scheduled, actual);
      expect(outcome1.isLate).toBe(true);
      expect(outcome1.newLateCount).toBe(1);
      expect(outcome1.status).toBe('CERRADA_NORMAL');
      expect(outcome1.isObserved).toBe(false);
      expect(outcome1.message).toContain('1ª advertencia');

      const outcome3 = evaluateReturnOutcome(2, scheduled, actual);
      expect(outcome3.newLateCount).toBe(3);
      expect(outcome3.status).toBe('CERRADA_NORMAL');
      expect(outcome3.isObserved).toBe(false);
      expect(outcome3.message).toContain('3ª advertencia');
    });

    it('4ª tardanza deja al colaborador en estado OBSERVADO y estado OBSERVADA', () => {
      const actual = new Date('2026-10-15T18:30:00Z');
      const outcome4 = evaluateReturnOutcome(3, scheduled, actual);
      expect(outcome4.isLate).toBe(true);
      expect(outcome4.newLateCount).toBe(4);
      expect(outcome4.status).toBe('OBSERVADA');
      expect(outcome4.isObserved).toBe(true);
      expect(outcome4.message).toContain('OBSERVADO');
    });
  });

  describe('BR-ADP-001: Cálculo de deducción salarial por tardanzas y faltas', () => {
    const baseSalary = 3000; // S/ 3,000 al mes -> S/ 100 por día -> S/ 12.5 por hora -> ~S/ 0.208 por minuto

    it('calcula 1 día íntegro de sueldo por falta injustificada', () => {
      const deduction = calculateAttendanceDeductionAmount(baseSalary, 'FALTA_INJUSTIFICADA');
      expect(deduction).toBe(100);
    });

    it('calcula deducción proporcional exacta por minutos de tardanza', () => {
      const deduction60Min = calculateAttendanceDeductionAmount(baseSalary, 'TARDANZA', 60);
      expect(deduction60Min).toBe(12.5);

      const deduction30Min = calculateAttendanceDeductionAmount(baseSalary, 'TARDANZA', 30);
      expect(deduction30Min).toBe(6.25);
    });

    it('devuelve 0 si la falta es justificada o el estado es presente', () => {
      expect(calculateAttendanceDeductionAmount(baseSalary, 'PRESENTE')).toBe(0);
      expect(calculateAttendanceDeductionAmount(baseSalary, 'FALTA_JUSTIFICADA')).toBe(0);
      expect(calculateAttendanceDeductionAmount(baseSalary, 'PERMISO')).toBe(0);
    });
  });

  describe('BR-ADP-002: casos adicionales de capacidad de área', () => {
    const areaId = 'AREA-OPERACIONES';
    const existing = (status: string, employeeId = 'emp-1') => [
      {
        id: 'vac-1',
        employeeId,
        areaId,
        startDate: new Date('2026-11-01'),
        endDate: new Date('2026-11-15'),
        status,
      },
    ];
    const request = (employeeId: string) => ({
      employeeId,
      areaId,
      startDate: new Date('2026-11-15'),
      endDate: new Date('2026-11-20'),
      status: 'SOLICITADA',
    });

    it('un rango que solo comparte el último día igual se superpone (capacidad máxima de 1 persona)', () => {
      expect(() => validateVacationAreaCapacity(existing('PROGRAMADA'), request('emp-2'), 'Operaciones')).toThrow(
        VacationOverlapError,
      );
    });

    it('las vacaciones REPROGRAMADAS y SOLICITADAS también ocupan el cupo del área', () => {
      expect(() => validateVacationAreaCapacity(existing('REPROGRAMADA'), request('emp-2'), 'Operaciones')).toThrow(
        VacationOverlapError,
      );
      expect(() => validateVacationAreaCapacity(existing('SOLICITADA'), request('emp-2'), 'Operaciones')).toThrow(
        VacationOverlapError,
      );
    });

    it('COMPLETADA y CANCELADA liberan el cupo', () => {
      expect(() => validateVacationAreaCapacity(existing('COMPLETADA'), request('emp-2'), 'Operaciones')).not.toThrow();
      expect(() => validateVacationAreaCapacity(existing('CANCELADA'), request('emp-2'), 'Operaciones')).not.toThrow();
    });

    it('un colaborador tampoco puede solapar sus propias vacaciones', () => {
      expect(() => validateVacationAreaCapacity(existing('PROGRAMADA'), request('emp-1'), 'Operaciones')).toThrow(
        VacationOverlapError,
      );
    });
  });

  describe('BR-ADP-004: nivel pendiente, temporizador y salto de niveles', () => {
    it('pendingLevelOf resuelve el nivel esperado de cada estado pendiente y null en los demás', () => {
      expect(pendingLevelOf('PENDIENTE_NIVEL_1')).toBe(1);
      expect(pendingLevelOf('PENDIENTE_NIVEL_2')).toBe(2);
      expect(pendingLevelOf('PENDIENTE_NIVEL_3')).toBe(3);
      expect(pendingLevelOf('AUTORIZADA')).toBeNull();
      expect(pendingLevelOf('NO_AUTORIZADA')).toBeNull();
    });

    it('assertAuthorizationLevelReached permite niveles ya alcanzados y bloquea saltos', () => {
      expect(() => assertAuthorizationLevelReached(1, 'PENDIENTE_NIVEL_2', 'ft')).not.toThrow();
      expect(() => assertAuthorizationLevelReached(2, 'PENDIENTE_NIVEL_2', 'ft')).not.toThrow();
      expect(() => assertAuthorizationLevelReached(3, 'PENDIENTE_NIVEL_2', 'ft')).toThrow(
        AuthorizationLevelNotReachedError,
      );
      expect(() => assertAuthorizationLevelReached(1, 'AUTORIZADA', 'ft')).toThrow(FieldTripNotPendingError);
    });

    it('levelTimeoutFrom suma exactamente 5 minutos y currentLevelTimeoutAt lee el temporizador del nivel actual', () => {
      const now = new Date('2026-10-15T09:00:00Z');
      expect(levelTimeoutFrom(now).toISOString()).toBe('2026-10-15T09:05:00.000Z');
      const t = { level1TimeoutAt: new Date('2026-10-15T09:05:00Z'), level2TimeoutAt: null, level3TimeoutAt: null };
      expect(currentLevelTimeoutAt({ status: 'PENDIENTE_NIVEL_1', ...t })).toEqual(t.level1TimeoutAt);
      expect(currentLevelTimeoutAt({ status: 'PENDIENTE_NIVEL_2', ...t })).toBeNull();
      expect(currentLevelTimeoutAt({ status: 'AUTORIZADA', ...t })).toBeNull();
    });
  });

  describe('BR-ADP-001: registro de asistencia con descuento pendiente', () => {
    it('una falta injustificada genera descuento de un día; una justificada, ninguno', () => {
      expect(resolveAttendanceRecord({ status: 'FALTA_INJUSTIFICADA', baseSalary: 3000 })).toEqual({
        minutesLate: 0,
        deductionAmount: 100,
      });
      expect(resolveAttendanceRecord({ status: 'FALTA_JUSTIFICADA', baseSalary: 3000, deductionAmount: 50 })).toEqual({
        minutesLate: 0,
        deductionAmount: 0,
      });
    });

    it('una tardanza exige minutos y calcula el descuento proporcional', () => {
      expect(resolveAttendanceRecord({ status: 'TARDANZA', minutesLate: 30, baseSalary: 3000 })).toEqual({
        minutesLate: 30,
        deductionAmount: 6.25,
      });
      expect(() => resolveAttendanceRecord({ status: 'TARDANZA', minutesLate: 0, baseSalary: 3000 })).toThrow(
        InvalidAttendanceRecordError,
      );
    });

    it('un monto indicado por Jefatura reemplaza al calculado solo si el estado admite descuento', () => {
      expect(resolveAttendanceRecord({ status: 'FALTA_INJUSTIFICADA', baseSalary: 3000, deductionAmount: 40 })).toEqual({
        minutesLate: 0,
        deductionAmount: 40,
      });
      expect(resolveAttendanceRecord({ status: 'PRESENTE', minutesLate: 15, deductionAmount: 40 })).toEqual({
        minutesLate: 0,
        deductionAmount: 0,
      });
    });

    it('sin sueldo base el descuento calculado es 0', () => {
      expect(resolveAttendanceRecord({ status: 'FALTA_INJUSTIFICADA', baseSalary: null }).deductionAmount).toBe(0);
    });
  });

  describe('BR-ADP-001: los descuentos solo se aplican al cierre de mes (nunca en la quincena)', () => {
    it('rechaza aplicar descuentos a mitad de mes (quincena)', () => {
      expect(() => assertPayrollMonthClosable('2026-10', new Date('2026-10-15T17:00:00Z'))).toThrow(
        DeductionsBeforeMonthEndError,
      );
    });

    it('rechaza un mes futuro', () => {
      expect(() => assertPayrollMonthClosable('2026-12', new Date('2026-10-31T17:00:00Z'))).toThrow(
        DeductionsBeforeMonthEndError,
      );
    });

    it('permite desde el último día del mes (hora de Lima) y meses anteriores', () => {
      expect(() => assertPayrollMonthClosable('2026-10', new Date('2026-10-31T15:00:00Z'))).not.toThrow();
      expect(() => assertPayrollMonthClosable('2026-09', new Date('2026-10-09T12:00:00Z'))).not.toThrow();
    });

    it('usa la fecha de Lima: 01-nov 02:00 UTC todavía es 31-oct en Lima', () => {
      expect(() => assertPayrollMonthClosable('2026-10', new Date('2026-11-01T02:00:00Z'))).not.toThrow();
      expect(() => assertPayrollMonthClosable('2026-10', new Date('2026-10-31T04:00:00Z'))).toThrow(
        DeductionsBeforeMonthEndError,
      );
    });

    it('rechaza un mes con formato inválido', () => {
      expect(() => assertPayrollMonthClosable('2026-13', new Date())).toThrow(InvalidPayrollMonthError);
      expect(() => assertPayrollMonthClosable('octubre', new Date())).toThrow(InvalidPayrollMonthError);
    });
  });

  describe('BR-ADP-006 / BR-REC-008: término de la relación laboral', () => {
    it('la edición no puede terminar la relación laboral ni reactivar a un terminado', () => {
      expect(() => assertEmployeeStatusEditable('PERIODO_PRUEBA', 'PLANILLA')).not.toThrow();
      expect(() => assertEmployeeStatusEditable('PLANILLA', undefined)).not.toThrow();
      expect(() => assertEmployeeStatusEditable('PLANILLA', 'TERMINADO')).toThrow(EmployeeStatusTransitionNotAllowedError);
      expect(() => assertEmployeeStatusEditable('TERMINADO', 'PLANILLA')).toThrow(EmployeeStatusTransitionNotAllowedError);
    });

    it('renuncia sin previo aviso: exige haber pagado la quincena pendiente', () => {
      expect(() =>
        assertTerminationRules({ reason: 'RENUNCIA', noticeDays: 0, finalSettlementPaid: true }),
      ).not.toThrow();
      expect(() => assertTerminationRules({ reason: 'RENUNCIA', noticeDays: 0, finalSettlementPaid: false })).toThrow(
        FinalSettlementRequiredError,
      );
    });

    it('despido: documenta el motivo y el aviso es de 15 días (o 0)', () => {
      expect(() =>
        assertTerminationRules({
          reason: 'DESPIDO',
          noticeDays: 15,
          finalSettlementPaid: false,
          notes: 'Reincidencia tras 3 llamadas de atención',
        }),
      ).not.toThrow();
      expect(() => assertTerminationRules({ reason: 'DESPIDO', noticeDays: 15, finalSettlementPaid: false })).toThrow(
        TerminationNotesRequiredError,
      );
      expect(() =>
        assertTerminationRules({ reason: 'DESPIDO', noticeDays: 7, finalSettlementPaid: false, notes: 'Motivo documentado' }),
      ).toThrow(InvalidTerminationNoticeError);
    });

    it('los días de aviso deben ser enteros no negativos', () => {
      expect(() => assertTerminationRules({ reason: 'RENUNCIA', noticeDays: -1, finalSettlementPaid: true })).toThrow(
        InvalidTerminationNoticeError,
      );
    });
  });
});
