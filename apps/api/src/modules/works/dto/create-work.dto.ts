import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsMongoId,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
  ValidateNested
} from 'class-validator';

export class WorkItemDto {
  @IsString()
  @MinLength(1)
  name: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0.000001)
  quantity: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  price: number;
}

export class CreateWorkDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => WorkItemDto)
  items: WorkItemDto[];

  @IsOptional()
  @IsString()
  currency?: string;

  @IsMongoId()
  executorOrganizationId: string;

  @IsMongoId()
  clientId: string;

  @IsOptional()
  @IsString()
  actNumber?: string;

  @IsOptional()
  @IsString()
  invoiceNumber?: string;

  @IsOptional()
  @IsDateString()
  actDate?: string;

  @IsOptional()
  @IsDateString()
  invoiceDate?: string;
}
