import { IsBoolean, IsOptional, IsString, IsUUID } from 'class-validator';

/**
 * BR-CON-004 (22-oct-2026): los documentos a validar dependen de la nacionalidad del cliente (el servidor la conoce; ver
 * `requiredDocuments` en la respuesta de Alquiler):
 * - PERUANO:    identityDocumentValid (DNI) + driverLicenseValid + addressOrStayProofValid (recibo de agua/luz).
 * - EXTRANJERO: passportValid + foreignerCardValid (CE) + driverLicenseValid + addressOrStayProofValid (constancia de
 *               hospedaje) + fecha de ingreso registrada en el cliente.
 * Los campos son opcionales en el cuerpo pero el handler exige los de la nacionalidad (422 DOCUMENTS_INCOMPLETE con
 * `missingDocuments` y `requiredDocuments`). Un cuerpo sin detalle ya NO valida nada.
 */
export class ValidateDocumentsDto {
  @IsUUID() companyId!: string;
  @IsUUID() branchId!: string;

  @IsOptional() @IsBoolean() identityDocumentValid?: boolean;
  @IsOptional() @IsBoolean() passportValid?: boolean;
  @IsOptional() @IsBoolean() foreignerCardValid?: boolean;
  @IsOptional() @IsBoolean() driverLicenseValid?: boolean;
  @IsOptional() @IsBoolean() addressOrStayProofValid?: boolean;

  @IsOptional() @IsString() notes?: string;
}
