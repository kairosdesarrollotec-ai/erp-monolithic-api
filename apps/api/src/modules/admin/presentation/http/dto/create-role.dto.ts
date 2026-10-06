import { IsString, IsUUID } from 'class-validator';

/**
 * El largo (1..60) y el recorte de espacios los valida el handler para
 * responder el codigo de dominio 400 ROLE_NAME_INVALID (el ValidationPipe
 * respondería un 400 generico sin `code`).
 */
export class CreateRoleDto {
  @IsUUID() companyId!: string;
  @IsUUID() branchId!: string;
  @IsString() name!: string;
}
