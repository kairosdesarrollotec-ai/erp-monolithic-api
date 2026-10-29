import { AlcoholTestResult } from '../../domain/alcohol-test-result';

export class RegisterAlcoholTestCommand {
  constructor(
    public readonly id: string,
    public readonly firebaseUid: string,
    public readonly companyId: string,
    public readonly branchId: string,
    public readonly expectedVersion: number,
    public readonly result: AlcoholTestResult,
    public readonly notes?: string,
    /** A-02: confirmacion manual RENIEC / MTC (obligatoria para continuar con resultado FAVORABLE). */
    public readonly reniecVerified: boolean = false,
    public readonly mtcVerified: boolean = false,
    /** Excepcion de RENIEC por Gerencia (con motivo). MTC no admite excepcion. */
    public readonly reniecExceptionReason?: string,
  ) {}
}
