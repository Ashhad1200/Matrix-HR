import { IsString } from 'class-validator';

export class CreateEsignRequestDto {
  @IsString()
  entityType: string;

  @IsString()
  entityId: string;

  @IsString()
  signerEmail: string;

  @IsString()
  documentUrl: string;
}
