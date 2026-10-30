import { projectNotificationEvent } from './notification-event-projector';

describe('projectNotificationEvent', () => {
  it('ReservationCreated: usa la plantilla guardada cuando existe, sustituyendo variables reales', () => {
    const result = projectNotificationEvent(
      {
        id: 'evt-1',
        aggregateId: 'res-1',
        eventType: 'ReservationCreated',
        payload: {
          organizationId: 'org-1',
          operatingCompanyId: 'company-1',
          branchId: 'branch-1',
          vehicleId: 'veh-1',
          startAt: '2026-09-25T00:00:00Z',
          createdBy: 'uid-agente',
        },
      },
      'Nueva reserva para {vehiculo} el {fecha}',
    );

    expect(result).toEqual({
      action: 'CREATE',
      item: expect.objectContaining({
        organizationId: 'org-1',
        companyId: 'company-1',
        branchId: 'branch-1',
        recipientFirebaseUid: 'uid-agente',
        notificationType: 'ReservationCreated',
        deepLink: '/reservas/res-1',
        sourceEventId: 'evt-1',
        title: expect.stringContaining('veh-1'),
      }),
    });
  });

  it('ReservationCreated: muestra marca, modelo y placa del vehiculo en vez del ID', () => {
    const result = projectNotificationEvent(
      {
        id: 'evt-label',
        aggregateId: 'res-9',
        eventType: 'ReservationCreated',
        payload: {
          organizationId: 'org-1',
          operatingCompanyId: 'company-1',
          branchId: 'branch-1',
          vehicleId: 'c0fe12f7-d67d-4965-8ced-6609f4b5f0ad',
          startAt: '2026-10-16T00:00:00Z',
          createdBy: 'uid-agente',
        },
      },
      null,
      { vehicleLabel: 'Hyundai Hilux - ABC-123' },
    );

    expect(result).toEqual({
      action: 'CREATE',
      item: expect.objectContaining({
        title: expect.stringContaining('Hyundai Hilux - ABC-123'),
        deepLink: '/reservas/res-9',
      }),
    });
    expect((result as { item: { title: string } }).item.title).not.toContain('c0fe12f7');
  });

  it('ReservationCreated: sin plantilla guardada, usa el texto generico de respaldo', () => {
    const result = projectNotificationEvent(
      {
        id: 'evt-2',
        aggregateId: 'res-2',
        eventType: 'ReservationCreated',
        payload: {
          organizationId: 'org-1',
          operatingCompanyId: 'company-1',
          branchId: 'branch-1',
          vehicleId: 'veh-2',
          startAt: '2026-09-25T00:00:00Z',
          createdBy: 'uid-agente',
        },
      },
      null,
    );

    expect(result.action).toBe('CREATE');
    if (result.action === 'CREATE') {
      expect(result.item.title).toContain('veh-2');
    }
  });

  it('ReservationConfirmed: el destinatario es quien confirmo', () => {
    const result = projectNotificationEvent(
      {
        id: 'evt-3',
        aggregateId: 'res-1',
        eventType: 'ReservationConfirmed',
        payload: { organizationId: 'org-1', operatingCompanyId: 'company-1', branchId: 'branch-1', confirmedBy: 'uid-confirmador' },
      },
      null,
    );

    expect(result).toEqual({
      action: 'CREATE',
      item: expect.objectContaining({ recipientFirebaseUid: 'uid-confirmador', notificationType: 'ReservationConfirmed' }),
    });
  });

  it('ReservationCancelled: el destinatario es quien cancelo', () => {
    const result = projectNotificationEvent(
      {
        id: 'evt-4',
        aggregateId: 'res-1',
        eventType: 'ReservationCancelled',
        payload: { organizationId: 'org-1', operatingCompanyId: 'company-1', branchId: 'branch-1', reason: 'NO_SHOW', cancelledBy: 'uid-cancelador' },
      },
      null,
    );

    expect(result).toEqual({
      action: 'CREATE',
      item: expect.objectContaining({ recipientFirebaseUid: 'uid-cancelador', notificationType: 'ReservationCancelled' }),
    });
  });

  it('V-04: ReservationCancelled muestra el motivo legible y no el codigo interno', () => {
    const result = projectNotificationEvent(
      {
        id: 'evt-4b',
        aggregateId: 'res-1',
        eventType: 'ReservationCancelled',
        payload: { organizationId: 'org-1', operatingCompanyId: 'company-1', branchId: 'branch-1', reason: 'CUSTOMER_REQUESTED_CHANGE', cancelledBy: 'uid-cancelador' },
      },
      null,
    );
    const json = JSON.stringify(result);
    expect(json).toContain('cambio solicitado por el cliente');
    expect(json).not.toContain('CUSTOMER_REQUESTED_CHANGE');
  });

  it('ignora eventos que no le corresponden', () => {
    const result = projectNotificationEvent({ id: 'evt-5', aggregateId: 'x', eventType: 'InquiryCreated', payload: {} }, null);
    expect(result).toEqual({ action: 'IGNORE' });
  });

  describe('TR-07 - Eventos de modulos no-Reservation', () => {
    it('ContratoFirmado.v1: IGNORE porque el payload no incluye organizationId ni actor', () => {
      const result = projectNotificationEvent(
        {
          id: 'evt-10',
          aggregateId: 'rental-1',
          eventType: 'ContratoFirmado.v1',
          payload: { rentalId: 'rental-1', documentRef: 'doc-001', signedAt: '2026-10-10T00:00:00Z' },
        },
        null,
      );
      expect(result).toEqual({ action: 'IGNORE' });
    });

    it('EntregaCompletada.v1: IGNORE porque el payload no incluye organizationId ni actor', () => {
      const result = projectNotificationEvent(
        {
          id: 'evt-11',
          aggregateId: 'rental-2',
          eventType: 'EntregaCompletada.v1',
          payload: { rentalId: 'rental-2', vehicleId: 'vehicle-1', customerId: 'customer-1', deliveredAt: '2026-10-10T00:00:00Z' },
        },
        null,
      );
      expect(result).toEqual({ action: 'IGNORE' });
    });

    it('FaltaGraveAmpliacionRegistrada.v1: IGNORE porque el payload no incluye organizationId ni actor', () => {
      const result = projectNotificationEvent(
        {
          id: 'evt-12',
          aggregateId: 'rental-3',
          eventType: 'FaltaGraveAmpliacionRegistrada.v1',
          payload: { rentalId: 'rental-3', extensionId: 'ext-1', customerId: 'customer-2' },
        },
        null,
      );
      expect(result).toEqual({ action: 'IGNORE' });
    });

    it('DevolucionCompletada.v1: IGNORE porque el payload no incluye actor/recipient', () => {
      const result = projectNotificationEvent(
        {
          id: 'evt-13',
          aggregateId: 'return-1',
          eventType: 'DevolucionCompletada.v1',
          payload: {
            returnId: 'return-1',
            rentalId: 'rental-1',
            vehicleId: 'vehicle-1',
            customerId: 'customer-1',
            status: 'CERRADA',
            closedAt: '2026-10-10T00:00:00Z',
            organizationId: 'org-1',
            operatingCompanyId: 'company-1',
            branchId: 'branch-1',
          },
        },
        null,
      );
      expect(result).toEqual({ action: 'IGNORE' });
    });

    it('CandidatoSeleccionado.v1: CREATE con destinatario decidedBy y deepLink /reclutamiento', () => {
      const result = projectNotificationEvent(
        {
          id: 'evt-14',
          aggregateId: 'candidate-1',
          eventType: 'CandidatoSeleccionado.v1',
          payload: {
            candidateId: 'candidate-1',
            vacancyId: 'vacancy-1',
            fullName: 'Maria Lopez',
            documentNumber: '87654321',
            decision: 'CONTRATADO',
            decidedAt: '2026-10-10T00:00:00Z',
            decidedBy: 'uid-recruiter',
            organizationId: 'org-1',
            operatingCompanyId: 'company-1',
            branchId: 'branch-1',
          },
        },
        null,
      );

      expect(result).toEqual({
        action: 'CREATE',
        item: expect.objectContaining({
          organizationId: 'org-1',
          companyId: 'company-1',
          branchId: 'branch-1',
          recipientFirebaseUid: 'uid-recruiter',
          notificationType: 'CandidatoSeleccionado.v1',
          deepLink: '/reclutamiento',
          sourceEventId: 'evt-14',
          title: expect.stringContaining('Maria Lopez'),
        }),
      });
    });

    it('CandidatoSeleccionado.v1: usa plantilla guardada cuando existe', () => {
      const result = projectNotificationEvent(
        {
          id: 'evt-15',
          aggregateId: 'candidate-2',
          eventType: 'CandidatoSeleccionado.v1',
          payload: {
            candidateId: 'candidate-2',
            vacancyId: 'vacancy-2',
            fullName: 'Pedro Rios',
            documentNumber: '11111111',
            decision: 'CONTRATADO',
            decidedAt: '2026-10-10T00:00:00Z',
            decidedBy: 'uid-recruiter-2',
            organizationId: 'org-1',
            operatingCompanyId: 'company-1',
            branchId: 'branch-1',
          },
        },
        'El candidato {nombre} fue seleccionado exitosamente.',
      );

      expect(result.action).toBe('CREATE');
      if (result.action === 'CREATE') {
        expect(result.item.title).toBe('El candidato Pedro Rios fue seleccionado exitosamente.');
      }
    });

    it('PersonalIncorporado.v1: CREATE con destinatario actorUserId y deepLink /personal', () => {
      const result = projectNotificationEvent(
        {
          id: 'evt-16',
          aggregateId: 'onboarding-1',
          eventType: 'PersonalIncorporado.v1',
          payload: {
            candidateId: 'candidate-3',
            vacancyId: 'vacancy-3',
            startDate: '2026-11-01T00:00:00Z',
            isMechanic: false,
            completedAt: '2026-10-10T00:00:00Z',
            actorUserId: 'uid-hr-recruiter',
            organizationId: 'org-1',
            operatingCompanyId: 'company-1',
            branchId: 'branch-1',
          },
        },
        null,
      );

      expect(result).toEqual({
        action: 'CREATE',
        item: expect.objectContaining({
          organizationId: 'org-1',
          companyId: 'company-1',
          branchId: 'branch-1',
          recipientFirebaseUid: 'uid-hr-recruiter',
          notificationType: 'PersonalIncorporado.v1',
          deepLink: '/personal',
          sourceEventId: 'evt-16',
        }),
      });
    });

    it('RelacionLaboralTerminada.v1: CREATE con destinatario actorUserId y deepLink /personal', () => {
      const result = projectNotificationEvent(
        {
          id: 'evt-17',
          aggregateId: 'employee-1',
          eventType: 'RelacionLaboralTerminada.v1',
          payload: {
            employeeId: 'employee-1',
            terminationId: 'termination-1',
            reason: 'DESPIDO',
            noticeDays: 30,
            terminatedAt: '2026-10-10T00:00:00Z',
            areaId: 'area-2',
            areaName: 'Operaciones',
            jobTitle: 'Operador',
            actorUserId: 'uid-hr-manager',
            organizationId: 'org-1',
            operatingCompanyId: 'company-1',
            branchId: 'branch-1',
          },
        },
        null,
      );

      expect(result).toEqual({
        action: 'CREATE',
        item: expect.objectContaining({
          organizationId: 'org-1',
          companyId: 'company-1',
          branchId: 'branch-1',
          recipientFirebaseUid: 'uid-hr-manager',
          notificationType: 'RelacionLaboralTerminada.v1',
          deepLink: '/personal',
          sourceEventId: 'evt-17',
          title: expect.stringContaining('DESPIDO'),
        }),
      });
    });
  });
});
