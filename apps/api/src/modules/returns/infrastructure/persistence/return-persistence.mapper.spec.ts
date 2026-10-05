import { Prisma } from '@prisma/client';
import {
  ReturnWithRelations,
  toImmobilizationChargeRecord,
  toReturnDamageRecord,
  toReturnEvidenceRecord,
  toReturnRecord,
} from './return-persistence.mapper';

describe('ReturnPersistenceMapper', () => {
  const now = new Date('2026-10-05T12:00:00.000Z');

  const damageRow = {
    id: 'dmg-1',
    returnId: 'ret-1',
    origin: 'TECHNICAL' as const,
    severity: 'MODERADO' as const,
    damagedZone: null,
    estimatedAmount: new Prisma.Decimal('850.50'),
    externalReportReference: 'INFORME-MOTRIX-2026-0847',
    description: 'frenos',
    createdAt: now,
  };

  const chargeRow = {
    id: 'chg-1',
    returnId: 'ret-1',
    damageId: 'dmg-1',
    daysCharged: 2,
    dailyRate: new Prisma.Decimal('100.00'),
    totalAmount: new Prisma.Decimal('200.00'),
    notes: null,
    createdAt: now,
  };

  function buildRow(overrides: Partial<ReturnWithRelations> = {}): ReturnWithRelations {
    return {
      id: 'ret-1',
      organizationId: 'org-1',
      operatingCompanyId: 'comp-1',
      branchId: 'branch-1',
      rentalId: 'rent-1',
      vehicleId: 'veh-1',
      customerId: 'cust-1',
      status: 'CON_DANOS',
      custodyHolder: 'TALLER',
      customerPresent: true,
      mileageAtReturn: 45210,
      fuelLevelAtReturn: 'HALF',
      alcoholTestResult: 'FAVORABLE',
      alcoholTestNotes: null,
      alcoholEscalationDecision: null,
      alcoholEscalationMarkedRed: null,
      alcoholEscalationNotes: null,
      alcoholEscalationDecidedById: null,
      alcoholEscalationDecidedAt: null,
      responsibilitySignerName: null,
      responsibilitySignerIsHolder: null,
      responsibilitySignerRelation: null,
      responsibilitySignatureData: null,
      responsibilitySignedAt: null,
      scheduledAt: now,
      receivedAt: now,
      inspectedAt: now,
      closedAt: null,
      finalSettlementAmount: new Prisma.Decimal('200.00'),
      notes: 'nota',
      createdAt: now,
      createdBy: 'uid-1',
      updatedAt: now,
      updatedBy: 'uid-2',
      version: 4,
      vehicle: { plate: 'ABC-123', dailyRate: new Prisma.Decimal('120.00') },
      customer: { fullName: 'Juan Perez' },
      damages: [damageRow],
      immobilizationCharges: [chargeRow],
      ...overrides,
    };
  }

  it('toReturnDamageRecord convierte Decimal a number y conserva null en monto pendiente', () => {
    expect(toReturnDamageRecord(damageRow)).toMatchObject({
      id: 'dmg-1',
      origin: 'TECHNICAL',
      estimatedAmount: 850.5,
      externalReportReference: 'INFORME-MOTRIX-2026-0847',
    });
    expect(toReturnDamageRecord({ ...damageRow, estimatedAmount: null }).estimatedAmount).toBeNull();
  });

  it('toImmobilizationChargeRecord convierte importes a number', () => {
    expect(toImmobilizationChargeRecord(chargeRow)).toMatchObject({
      daysCharged: 2,
      dailyRate: 100,
      totalAmount: 200,
      damageId: 'dmg-1',
    });
  });

  it('toReturnEvidenceRecord copia todos los campos', () => {
    const row = {
      id: 'ev-1',
      organizationId: 'org-1',
      operatingCompanyId: 'comp-1',
      returnId: 'ret-1',
      type: 'PHOTO' as const,
      zone: 'capot',
      objectUrl: 'https://storage.googleapis.com/b/o.jpg',
      uploadedBy: 'uid-1',
      uploadedAt: now,
    };
    expect(toReturnEvidenceRecord(row)).toEqual(row);
  });

  it('toReturnRecord aplana placa/cliente, importes y subentidades', () => {
    const record = toReturnRecord(buildRow());
    expect(record).toMatchObject({
      id: 'ret-1',
      vehiclePlate: 'ABC-123',
      customerName: 'Juan Perez',
      status: 'CON_DANOS',
      custodyHolder: 'TALLER',
      finalSettlementAmount: 200,
      version: 4,
    });
    expect(record.damages).toHaveLength(1);
    expect(record.damages?.[0].estimatedAmount).toBe(850.5);
    expect(record.immobilizationCharges?.[0].totalAmount).toBe(200);
    expect(record.evidences).toBeUndefined();
  });

  it('toReturnRecord mantiene null en campos opcionales sin valor', () => {
    const record = toReturnRecord(
      buildRow({ finalSettlementAmount: null, receivedAt: null, damages: [], immobilizationCharges: [] }),
    );
    expect(record.finalSettlementAmount).toBeNull();
    expect(record.receivedAt).toBeNull();
    expect(record.damages).toEqual([]);
  });

  it('toReturnRecord expone dailyRate vigente del vehículo (number) o null si no tiene tarifa', () => {
    expect(toReturnRecord(buildRow()).vehicleDailyRate).toBe(120);
    expect(
      toReturnRecord(buildRow({ vehicle: { plate: 'ABC-123', dailyRate: null } })).vehicleDailyRate,
    ).toBeNull();
  });

  it('toReturnRecord copia escalada de alcolímetro y documento de responsabilidad', () => {
    const record = toReturnRecord(
      buildRow({
        alcoholEscalationDecision: 'CONTINUE_TO_INSPECTION',
        alcoholEscalationMarkedRed: true,
        alcoholEscalationNotes: 'Gerencia autoriza',
        alcoholEscalationDecidedById: 'uid-9',
        alcoholEscalationDecidedAt: now,
        responsibilitySignerName: 'Maria Lopez',
        responsibilitySignerIsHolder: false,
        responsibilitySignerRelation: 'Hermana',
        responsibilitySignatureData: 'data:image/png;base64,AAAA',
        responsibilitySignedAt: now,
      }),
    );
    expect(record).toMatchObject({
      alcoholEscalationDecision: 'CONTINUE_TO_INSPECTION',
      alcoholEscalationMarkedRed: true,
      alcoholEscalationNotes: 'Gerencia autoriza',
      alcoholEscalationDecidedById: 'uid-9',
      alcoholEscalationDecidedAt: now,
      responsibilitySignerName: 'Maria Lopez',
      responsibilitySignerIsHolder: false,
      responsibilitySignerRelation: 'Hermana',
      responsibilitySignatureData: 'data:image/png;base64,AAAA',
      responsibilitySignedAt: now,
    });
  });
});
