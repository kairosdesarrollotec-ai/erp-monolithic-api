import { IsEmail, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * Nunca incluye la contrasena - TR-01 punto 11 (eventos auditables) lo
 * prohibe explicitamente.
 */
export class RecordLoginAttemptDto {
  @IsEmail()
  email!: string;

  @IsIn(['SUCCESS', 'FAILURE'])
  outcome!: 'SUCCESS' | 'FAILURE';

  @IsOptional()
  @IsString()
  @MaxLength(200)
  reason?: string;
}
