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
  it('Gerencia ve documento, sueldo y datos sensibles', async () => {
    expect(await visibilityOf('GERENCIA')).toEqual({ canViewDocument: true, canViewSalary: true, canViewSensitiveData: true });
  });
  it('RRHH y Administracion ven el documento pero no el sueldo ni datos sensibles por defecto', async () => {
    expect(await visibilityOf('RRHH')).toEqual({ canViewDocument: true, canViewSalary: false, canViewSensitiveData: false });
    expect(await visibilityOf('ADMINISTRACION')).toEqual({ canViewDocument: true, canViewSalary: false, canViewSensitiveData: false });
  });
  it('Auditoria y Finanzas no ven ninguno por defecto', async () => {
    expect(await visibilityOf('AUDITORIA')).toEqual({ canViewDocument: false, canViewSalary: false, canViewSensitiveData: false });
    expect(await visibilityOf('FINANZAS')).toEqual({ canViewDocument: false, canViewSalary: false, canViewSensitiveData: false });
  });

  it('toEmployeeResponse enmascara y lista restrictedFields', () => {
    const e = buildEmployee({
      baseSalary: 3000 as never,
      bankName: 'BCP',
      bankAccountNumber: '191-12345678-0-99',
      contractType: 'PLANILLA',
    } as any);
    const full = toEmployeeResponse(e, { canViewDocument: true, canViewSalary: true, canViewSensitiveData: true });
    expect(full.documentNumber).toBe('45678912');
    expect(full.baseSalary).toBe(3000);
    expect(full.bankName).toBe('BCP');
    expect(full.bankAccountNumber).toBe('191-12345678-0-99');
    expect(full.contractType).toBe('PLANILLA');
    expect(full.restrictedFields).toEqual([]);

    const masked = toEmployeeResponse(e, { canViewDocument: false, canViewSalary: false, canViewSensitiveData: false });
    expect(masked.documentNumber).toBeNull();
    expect(masked.baseSalary).toBeNull();
    expect(masked.bankName).toBeNull();
    expect(masked.bankAccountNumber).toBeNull();
    expect(masked.contractType).toBeNull();
    expect(masked.restrictedFields).toEqual([
      'documentNumber',
      'baseSalary',
      'bankName',
      'bankAccountNumber',
      'bankAccountCci',
      'contractType',
      'contractUrl',
      'contractNotes',
    ]);

    const noSalary = toEmployeeResponse(e, { canViewDocument: true, canViewSalary: false, canViewSensitiveData: false });
    expect(noSalary.documentNumber).toBe('45678912');
    expect(noSalary.baseSalary).toBeNull();
    expect(noSalary.bankName).toBeNull();
    expect(noSalary.restrictedFields).toEqual([
      'baseSalary',
      'bankName',
      'bankAccountNumber',
      'bankAccountCci',
      'contractType',
      'contractUrl',
      'contractNotes',
    ]);
  });
});
