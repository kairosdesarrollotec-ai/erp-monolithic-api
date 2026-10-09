import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class ResolveLeaveDto {
  @IsIn(['AUTORIZADO', 'DENEGADO'])
  status!: 'AUTORIZADO' | 'DENEGADO';

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  resolutionNotes?: string | null;
}
