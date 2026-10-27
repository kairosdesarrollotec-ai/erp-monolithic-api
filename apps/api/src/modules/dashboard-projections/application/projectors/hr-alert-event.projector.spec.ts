import { describe, it, expect } from '@jest/globals';
import { projectHrAlertEvent } from './hr-alert-event.projector';

describe('projectHrAlertEvent', () => {
  it('proyecta FinPeriodoPruebaProximo.v1 con permiso RECEIVE_HR_ALERTS y deepLink a periodo-de-prueba', () => {
    const projection = projectHrAlertEvent({
      id: 'evt-1',
      aggregateId: 'onb-1',
      eventType: 'FinPeriodoPruebaProximo.v1',
      payload: {
        candidateId: 'cand-1',
        fullName: 'Ana María',
        daysLeft: 10,
        organizationId: 'org-1',
        operatingCompanyId: 'comp-1',
        branchId: 'branch-1',
      },
    });

    expect(projection.action).toBe('ALERT');
    if (projection.action === 'ALERT') {
      expect(projection.item.permission).toBe('RECEIVE_HR_ALERTS');
      expect(projection.item.priority).toBe(85);
      expect(projection.item.title).toContain('Ana María');
      expect(projection.item.title).toContain('10 días restantes');
      expect(projection.item.deepLink).toBe('/reclutamiento/candidatos/cand-1/periodo-de-prueba');
      expect(projection.item.sourceId).toBe('cand-1');
      expect(projection.scope).toEqual({
        organizationId: 'org-1',
        operatingCompanyId: 'comp-1',
        branchId: 'branch-1',
      });
    }
  });

  it('PasoAPlanilla.v1 reemplaza alertas previas del candidato', () => {
    const projection = projectHrAlertEvent({
      id: 'evt-2',
      aggregateId: 'onb-1',
      eventType: 'PasoAPlanilla.v1',
      payload: {
        candidateId: 'cand-1',
        fullName: 'Ana María',
        organizationId: 'org-1',
        operatingCompanyId: 'comp-1',
        branchId: 'branch-1',
      },
    });

    expect(projection.action).toBe('ALERT');
    if (projection.action === 'ALERT') {
      expect(projection.replaceSource).toEqual({
        sourceType: 'RECRUITMENT',
        sourceId: 'cand-1',
      });
    }
  });
});
