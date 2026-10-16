import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CloseIncidentDto } from './close-incident.dto';
import { ReferLegalDto } from './refer-legal.dto';

const ids = { companyId: '0b1b6f0e-6a53-4a5e-9e57-1d1d7f0a1111', branchId: '0b1b6f0e-6a53-4a5e-9e57-1d1d7f0a2222' };

describe('DTOs con resultado estructurado de la decision de Gerencia', () => {
  it('close y refer-legal aceptan el cuerpo sin decision (otros tipos) y con decision valida', async () => {
    expect(await validate(plainToInstance(CloseIncidentDto, { ...ids, resolutionSummary: 'ok' }))).toHaveLength(0);
    expect(
      await validate(plainToInstance(CloseIncidentDto, { ...ids, resolutionSummary: 'ok', decision: { retainGuarantee: true, terminateContract: false } })),
    ).toHaveLength(0);
    expect(
      await validate(plainToInstance(ReferLegalDto, { ...ids, reason: 'x', decision: { retainGuarantee: true, terminateContract: true } })),
    ).toHaveLength(0);
  });

  it('rechaza una decision con campos no booleanos o incompletos', async () => {
    expect(
      await validate(plainToInstance(CloseIncidentDto, { ...ids, resolutionSummary: 'ok', decision: { retainGuarantee: 'si', terminateContract: false } })),
    ).not.toHaveLength(0);
    expect(await validate(plainToInstance(ReferLegalDto, { ...ids, reason: 'x', decision: { retainGuarantee: true } }))).not.toHaveLength(0);
  });
});
