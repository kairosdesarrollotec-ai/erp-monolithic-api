import { resolveResponsibilityDocument } from './responsibility-document';
import { MissingResponsibilityDocumentError } from './return-errors';

describe('resolveResponsibilityDocument (BR-DEV-009 / DAT-DEV-005 / EX-DEV-001)', () => {
  const ok = { signerName: ' Juan Perez ', signerIsHolder: true, signatureData: 'data:image/png;base64,AAA' };

  it('sin documento -> MISSING_RESPONSIBILITY_DOCUMENT (422)', () => {
    expect(() => resolveResponsibilityDocument(undefined)).toThrow(MissingResponsibilityDocumentError);
    expect(() => resolveResponsibilityDocument(null)).toThrow(MissingResponsibilityDocumentError);
    try {
      resolveResponsibilityDocument(undefined);
    } catch (err) {
      expect((err as MissingResponsibilityDocumentError).code).toBe('MISSING_RESPONSIBILITY_DOCUMENT');
      expect((err as MissingResponsibilityDocumentError).httpStatus).toBe(422);
    }
  });

  it('nombre o firma en blanco -> error', () => {
    expect(() => resolveResponsibilityDocument({ ...ok, signerName: '  ' })).toThrow(MissingResponsibilityDocumentError);
    expect(() => resolveResponsibilityDocument({ ...ok, signatureData: '' })).toThrow(MissingResponsibilityDocumentError);
  });

  it('tercero (no titular) exige relación con el titular', () => {
    expect(() => resolveResponsibilityDocument({ ...ok, signerIsHolder: false })).toThrow(MissingResponsibilityDocumentError);
    expect(resolveResponsibilityDocument({ ...ok, signerIsHolder: false, signerRelationToHolder: ' Hermano ' })).toEqual({
      signerName: 'Juan Perez',
      signerIsHolder: false,
      signerRelationToHolder: 'Hermano',
      signatureData: 'data:image/png;base64,AAA',
    });
  });

  it('titular: normaliza y descarta la relación', () => {
    expect(resolveResponsibilityDocument({ ...ok, signerRelationToHolder: 'x' })).toEqual({
      signerName: 'Juan Perez',
      signerIsHolder: true,
      signerRelationToHolder: null,
      signatureData: 'data:image/png;base64,AAA',
    });
  });
});
