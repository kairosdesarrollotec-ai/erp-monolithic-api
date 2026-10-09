import { FieldTripCascadeService } from './field-trip-cascade.service';
import { FieldTripRepositoryPort } from '../ports/field-trip-repository.port';
import { EmployeeRepositoryPort } from '../ports/employee-repository.port';
import {
  AuthorizationLevelNotReachedError,
  FieldTripNotAuthorizedError,
  FieldTripNotFoundError,
  FieldTripNotPendingError,
  FieldTripTimeoutNotElapsedError,
  InvalidAuthorizationLevelError,
  NoAuthorizationAvailableError,
} from '../../domain/hr-administration-errors';
import type { FieldTripRequest, Employee } from '@prisma/client';

describe('FieldTripCascadeService', () => {
  let service: FieldTripCascadeService;
  let mockFieldTripRepo: jest.Mocked<FieldTripRepositoryPort>;
  let mockEmployeeRepo: jest.Mocked<EmployeeRepositoryPort>;

  const baseFieldTrip: FieldTripRequest = {
    id: 'ft-1',
    employeeId: 'emp-1',
    destination: 'Taller Huachipa',
    objective: 'Revisión técnica',
    estimatedDeparture: new Date('2026-10-15T09:00:00Z'),
    estimatedReturn: new Date('2026-10-15T13:00:00Z'),
    actualDeparture: null,
    actualReturn: null,
    status: 'PENDIENTE_NIVEL_1',
    authorizationLevel: null,
    authorizedById: null,
    authorizedByName: null,
    authorizedAt: null,
    level1TimeoutAt: new Date('2026-10-15T09:05:00Z'),
    level2TimeoutAt: null,
    level3TimeoutAt: null,
    lateMinutes: 0,
    returnNotes: null,
    createdAt: new Date('2026-10-15T09:00:00Z'),
    updatedAt: new Date('2026-10-15T09:00:00Z'),
  };

  const baseEmployee: Employee = {
    id: 'emp-1',
    organizationId: 'org-1',
    operatingCompanyId: 'comp-1',
    branchId: 'branch-1',
    candidateId: null,
    documentType: 'DNI',
    documentNumber: '12345678',
    fullName: 'Juan Mecánico',
    email: 'juan@kairos.pe',
    phone: '987654321',
    areaId: 'MECANICA',
    areaName: 'Taller Mecánico',
    jobTitle: 'Mecánico de Flota',
    status: 'PLANILLA',
    hireDate: new Date('2026-01-01'),
    probationEvaluatedAt: null,
    probationPassed: true,
    payrollStartedAt: new Date('2026-04-01'),
    terminatedAt: null,
    terminationReason: null,
    terminationNoticeDays: null,
    terminationNotes: null,
    fieldTripLateCount: 0,
    isFieldTripObserved: false,
    baseSalary: null,
    version: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    mockFieldTripRepo = {
      create: jest.fn(),
      findById: jest.fn(),
      findMany: jest.fn(),
      transition: jest.fn(),
    } as unknown as jest.Mocked<FieldTripRepositoryPort>;

    mockEmployeeRepo = {
      create: jest.fn(),
      findById: jest.fn(),
      findByCompanyAndDocument: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    } as unknown as jest.Mocked<EmployeeRepositoryPort>;

    service = new FieldTripCascadeService(mockFieldTripRepo, mockEmployeeRepo);
  });

  const employeeRef = {
    fullName: 'Juan Mecánico',
    organizationId: 'org-1',
    operatingCompanyId: 'comp-1',
    branchId: 'branch-1',
  };
  const withEmployee = (over: Partial<FieldTripRequest> = {}) => ({ ...baseFieldTrip, ...over, employee: employeeRef });
  const NOW = new Date('2026-10-15T09:06:00Z');

  describe('authorize', () => {
    it('autoriza en Nivel 1 (Fiorella) guardando el nivel alcanzado', async () => {
      mockFieldTripRepo.findById.mockResolvedValue(withEmployee());
      mockFieldTripRepo.transition.mockResolvedValue({
        ...baseFieldTrip,
        status: 'AUTORIZADA',
        authorizationLevel: 1,
        authorizedById: 'uid-fiorella',
        authorizedByName: 'Fiorella',
      });

      const result = await service.authorize({
        fieldTripId: 'ft-1',
        authorizationLevel: 1,
        userId: 'uid-fiorella',
        userName: 'Fiorella',
        now: NOW,
      });

      expect(result.status).toBe('AUTORIZADA');
      expect(result.authorizationLevel).toBe(1);
      expect(mockFieldTripRepo.transition).toHaveBeenCalledWith(
        'ft-1',
        ['PENDIENTE_NIVEL_1', 'PENDIENTE_NIVEL_2', 'PENDIENTE_NIVEL_3'],
        expect.objectContaining({ status: 'AUTORIZADA', authorizationLevel: 1, authorizedAt: NOW }),
        undefined,
      );
    });

    it('autoriza en Nivel 2 (José) cuando la cascada ya escaló a ese nivel', async () => {
      mockFieldTripRepo.findById.mockResolvedValue(withEmployee({ status: 'PENDIENTE_NIVEL_2' }));
      mockFieldTripRepo.transition.mockResolvedValue({ ...baseFieldTrip, status: 'AUTORIZADA', authorizationLevel: 2 });

      const result = await service.authorize({ fieldTripId: 'ft-1', authorizationLevel: 2, userId: 'uid-jose', now: NOW });
      expect(result.authorizationLevel).toBe(2);
    });

    it('rechaza nivel 4 (o 0) con InvalidAuthorizationLevelError: no existe 4to nivel automático', async () => {
      await expect(
        service.authorize({ fieldTripId: 'ft-1', authorizationLevel: 4, userId: 'u', now: NOW }),
      ).rejects.toThrow(InvalidAuthorizationLevelError);
      await expect(
        service.authorize({ fieldTripId: 'ft-1', authorizationLevel: 0, userId: 'u', now: NOW }),
      ).rejects.toThrow(InvalidAuthorizationLevelError);
      expect(mockFieldTripRepo.transition).not.toHaveBeenCalled();
    });

    it('no permite saltar niveles: autorizar en nivel 3 con la salida aún en nivel 1', async () => {
      mockFieldTripRepo.findById.mockResolvedValue(withEmployee({ status: 'PENDIENTE_NIVEL_1' }));
      await expect(
        service.authorize({ fieldTripId: 'ft-1', authorizationLevel: 3, userId: 'uid-cecilia', now: NOW }),
      ).rejects.toThrow(AuthorizationLevelNotReachedError);
    });

    it('lanza FieldTripNotPendingError si la salida ya fue autorizada', async () => {
      mockFieldTripRepo.findById.mockResolvedValue(withEmployee({ status: 'AUTORIZADA' }));
      await expect(
        service.authorize({ fieldTripId: 'ft-1', authorizationLevel: 2, userId: 'uid-jose', now: NOW }),
      ).rejects.toThrow(FieldTripNotPendingError);
    });

    it('si la cascada se agotó (NO_AUTORIZADA) responde NO_AUTHORIZATION_AVAILABLE y no aprueba por defecto', async () => {
      mockFieldTripRepo.findById.mockResolvedValue(withEmployee({ status: 'NO_AUTORIZADA' }));
      await expect(
        service.authorize({ fieldTripId: 'ft-1', authorizationLevel: 3, userId: 'uid-cecilia', now: NOW }),
      ).rejects.toThrow(NoAuthorizationAvailableError);
      expect(mockFieldTripRepo.transition).not.toHaveBeenCalled();
    });

    it('lanza FieldTripNotFoundError si no existe', async () => {
      mockFieldTripRepo.findById.mockResolvedValue(null);
      await expect(
        service.authorize({ fieldTripId: 'nope', authorizationLevel: 1, userId: 'u', now: NOW }),
      ).rejects.toThrow(FieldTripNotFoundError);
    });
  });

  describe('advanceTimeout', () => {
    it('avanza Nivel 1 a Nivel 2 fijando el temporizador de 5 min del nuevo nivel', async () => {
      mockFieldTripRepo.findById.mockResolvedValue(withEmployee());
      mockFieldTripRepo.transition.mockResolvedValue({ ...baseFieldTrip, status: 'PENDIENTE_NIVEL_2' });

      const res = await service.advanceTimeout({ fieldTripId: 'ft-1', now: NOW });
      expect(res.fieldTrip.status).toBe('PENDIENTE_NIVEL_2');
      expect(mockFieldTripRepo.transition).toHaveBeenCalledWith(
        'ft-1',
        ['PENDIENTE_NIVEL_1'],
        { status: 'PENDIENTE_NIVEL_2', level2TimeoutAt: new Date(NOW.getTime() + 5 * 60 * 1000) },
        undefined,
      );
    });

    it('avanza Nivel 2 a Nivel 3', async () => {
      mockFieldTripRepo.findById.mockResolvedValue(
        withEmployee({ status: 'PENDIENTE_NIVEL_2', level2TimeoutAt: new Date('2026-10-15T09:05:00Z') }),
      );
      mockFieldTripRepo.transition.mockResolvedValue({ ...baseFieldTrip, status: 'PENDIENTE_NIVEL_3' });

      const res = await service.advanceTimeout({ fieldTripId: 'ft-1', now: NOW });
      expect(res.fieldTrip.status).toBe('PENDIENTE_NIVEL_3');
    });

    it('al agotar el Nivel 3 finaliza en NO_AUTORIZADA sin crear un nivel 4 (BR-ADP-004)', async () => {
      mockFieldTripRepo.findById.mockResolvedValue(
        withEmployee({ status: 'PENDIENTE_NIVEL_3', level3TimeoutAt: new Date('2026-10-15T09:05:00Z') }),
      );
      mockFieldTripRepo.transition.mockResolvedValue({ ...baseFieldTrip, status: 'NO_AUTORIZADA' });

      const res = await service.advanceTimeout({ fieldTripId: 'ft-1', now: NOW });
      expect(res.fieldTrip.status).toBe('NO_AUTORIZADA');
      expect(res.message).toContain('Nadie autorizó');
      expect(mockFieldTripRepo.transition).toHaveBeenCalledWith(
        'ft-1',
        ['PENDIENTE_NIVEL_3'],
        { status: 'NO_AUTORIZADA' },
        undefined,
      );
    });

    it('no escala antes de que venza el temporizador de 5 minutos del nivel actual', async () => {
      mockFieldTripRepo.findById.mockResolvedValue(
        withEmployee({ level1TimeoutAt: new Date('2026-10-15T09:10:00Z') }),
      );
      await expect(service.advanceTimeout({ fieldTripId: 'ft-1', now: NOW })).rejects.toThrow(
        FieldTripTimeoutNotElapsedError,
      );
      expect(mockFieldTripRepo.transition).not.toHaveBeenCalled();
    });

    it('no avanza una salida que ya no está pendiente', async () => {
      mockFieldTripRepo.findById.mockResolvedValue(withEmployee({ status: 'NO_AUTORIZADA' }));
      await expect(service.advanceTimeout({ fieldTripId: 'ft-1', now: NOW })).rejects.toThrow(
        FieldTripNotPendingError,
      );
    });
  });

  describe('evaluateReturn', () => {
    it('retorno puntual: CERRADA_NORMAL sin tocar el contador del colaborador', async () => {
      mockFieldTripRepo.findById.mockResolvedValue(withEmployee({ status: 'AUTORIZADA' }));
      mockEmployeeRepo.findById.mockResolvedValue(baseEmployee);
      mockFieldTripRepo.transition.mockResolvedValue({ ...baseFieldTrip, status: 'CERRADA_NORMAL', lateMinutes: 0 });

      const res = await service.evaluateReturn({ fieldTripId: 'ft-1', actualReturn: new Date('2026-10-15T12:50:00Z') });

      expect(res.isLate).toBe(false);
      expect(res.isObserved).toBe(false);
      expect(mockEmployeeRepo.update).not.toHaveBeenCalled();
    });

    it('1ª tardanza = advertencia (BR-ADP-005): cierra normal e incrementa el contador', async () => {
      mockFieldTripRepo.findById.mockResolvedValue(withEmployee({ status: 'AUTORIZADA' }));
      mockEmployeeRepo.findById.mockResolvedValue({ ...baseEmployee, fieldTripLateCount: 0 });
      mockFieldTripRepo.transition.mockResolvedValue({ ...baseFieldTrip, status: 'CERRADA_NORMAL', lateMinutes: 30 });

      const res = await service.evaluateReturn({ fieldTripId: 'ft-1', actualReturn: new Date('2026-10-15T13:30:00Z') });

      expect(res.isLate).toBe(true);
      expect(res.newLateCount).toBe(1);
      expect(res.isObserved).toBe(false);
      expect(mockEmployeeRepo.update).toHaveBeenCalledWith(
        'emp-1',
        { fieldTripLateCount: 1, isFieldTripObserved: false },
        undefined,
      );
    });

    it('3ª tardanza sigue siendo advertencia', async () => {
      mockFieldTripRepo.findById.mockResolvedValue(withEmployee({ status: 'AUTORIZADA' }));
      mockEmployeeRepo.findById.mockResolvedValue({ ...baseEmployee, fieldTripLateCount: 2 });
      mockFieldTripRepo.transition.mockResolvedValue({ ...baseFieldTrip, status: 'CERRADA_NORMAL', lateMinutes: 30 });

      const res = await service.evaluateReturn({ fieldTripId: 'ft-1', actualReturn: new Date('2026-10-15T13:30:00Z') });
      expect(res.newLateCount).toBe(3);
      expect(res.isObserved).toBe(false);
      expect(mockFieldTripRepo.transition).toHaveBeenCalledWith(
        'ft-1',
        ['AUTORIZADA'],
        expect.objectContaining({ status: 'CERRADA_NORMAL' }),
        undefined,
      );
    });

    it('la 4ª tardanza deja la salida OBSERVADA y al colaborador "observado" (BR-ADP-005)', async () => {
      mockFieldTripRepo.findById.mockResolvedValue(withEmployee({ status: 'AUTORIZADA' }));
      mockEmployeeRepo.findById.mockResolvedValue({ ...baseEmployee, fieldTripLateCount: 3 });
      mockFieldTripRepo.transition.mockResolvedValue({ ...baseFieldTrip, status: 'OBSERVADA', lateMinutes: 20 });

      const res = await service.evaluateReturn({ fieldTripId: 'ft-1', actualReturn: new Date('2026-10-15T13:20:00Z') });

      expect(res.newLateCount).toBe(4);
      expect(res.isObserved).toBe(true);
      expect(mockFieldTripRepo.transition).toHaveBeenCalledWith(
        'ft-1',
        ['AUTORIZADA'],
        expect.objectContaining({ status: 'OBSERVADA', lateMinutes: 20 }),
        undefined,
      );
      expect(mockEmployeeRepo.update).toHaveBeenCalledWith(
        'emp-1',
        { fieldTripLateCount: 4, isFieldTripObserved: true },
        undefined,
      );
    });

    it('solo se evalúa el retorno de una salida AUTORIZADA', async () => {
      mockFieldTripRepo.findById.mockResolvedValue(withEmployee({ status: 'PENDIENTE_NIVEL_1' }));
      await expect(
        service.evaluateReturn({ fieldTripId: 'ft-1', actualReturn: new Date('2026-10-15T13:20:00Z') }),
      ).rejects.toThrow(FieldTripNotAuthorizedError);
    });
  });
});
