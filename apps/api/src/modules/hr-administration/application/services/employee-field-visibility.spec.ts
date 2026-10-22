import { buildEmployee, buildMatrixAuth, buildWorkContext } from '../../testing/hr-administration-test-fixtures';
import { toEmployeeResponse } from '../../presentation/http/hr-administration.mapper';
import { HrAdministrationAccessService } from './hr-administration-access.service';
import { EmployeeFieldVisibilityService } from './employee-field-visibility.service';

async function visibilityOf(role: Parameters<typeof buildWorkContext>[0]) {
  const wc = buildWorkContext(role);
  const service = new EmployeeFieldVisibilityService(wc, new HrAdministrationAccessService(wc, buildMatrixAuth()));
  return service.resolve({ firebaseUid: 'u', companyId: 'c', branchId: 'b' });
}

describe('visibilidad de campos sensibles de la ficha (HU-35)', () => {
  it('Gerencia ve documento y sueldo', async () => {
    expect(await visibilityOf('GERENCIA')).toEqual({ canViewDocument: true, canViewSalary: true });
  });
  it('RRHH y Administracion ven el documento pero no el sueldo (solo MANAGE_SALARY)', async () => {
    expect(await visibilityOf('RRHH')).toEqual({ canViewDocument: true, canViewSalary: false });
    expect(await visibilityOf('ADMINISTRACION')).toEqual({ canViewDocument: true, canViewSalary: false });
  });
  it('Auditoria y Finanzas no ven ninguno por defecto', async () => {
    expect(await visibilityOf('AUDITORIA')).toEqual({ canViewDocument: false, canViewSalary: false });
    expect(await visibilityOf('FINANZAS')).toEqual({ canViewDocument: false, canViewSalary: false });
  });

  it('toEmployeeResponse enmascara y lista restrictedFields', () => {
    const e = buildEmployee({ baseSalary: 3000 as never });
    const full = toEmployeeResponse(e, { canViewDocument: true, canViewSalary: true });
    expect(full.documentNumber).toBe('45678912');
    expect(full.baseSalary).toBe(3000);
    expect(full.restrictedFields).toEqual([]);
    const masked = toEmployeeResponse(e, { canViewDocument: false, canViewSalary: false });
    expect(masked.documentNumber).toBeNull();
    expect(masked.baseSalary).toBeNull();
    expect(masked.restrictedFields).toEqual(['documentNumber', 'baseSalary']);
    const noSalary = toEmployeeResponse(e, { canViewDocument: true, canViewSalary: false });
    expect(noSalary.restrictedFields).toEqual(['baseSalary']);
  });
});
