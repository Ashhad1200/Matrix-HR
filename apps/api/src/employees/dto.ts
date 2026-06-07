import { IsString, IsOptional, IsEmail, IsNumber, IsEnum } from 'class-validator';

export class CreateEmployeeDto {
  @IsString()
  employeeCode: string;

  @IsString()
  firstName: string;

  @IsString()
  lastName: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  cnic?: string;

  @IsOptional()
  @IsString()
  designationId?: string;

  @IsOptional()
  @IsString()
  departmentId?: string;

  @IsOptional()
  @IsString()
  managerId?: string;

  @IsOptional()
  @IsEnum(['PERMANENT', 'CONTRACT', 'PROBATION', 'INTERN'])
  employmentType?: 'PERMANENT' | 'CONTRACT' | 'PROBATION' | 'INTERN';

  @IsOptional()
  @IsString()
  dateOfJoining?: string;

  @IsOptional()
  @IsNumber()
  baseSalary?: number;
}

export class UpdateEmployeeDto extends CreateEmployeeDto {}

export class ImportCsvDto {
  rows: CreateEmployeeDto[];
}
