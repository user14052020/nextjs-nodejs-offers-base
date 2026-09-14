import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
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
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  creditedAmount?: number;

  @IsOptional()
  @IsBoolean()
  isPayed?: boolean;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsIn(['document', 'kwork'])
  source?: 'document' | 'kwork';

  @IsOptional()
  @IsString()
  sourceName?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  platformCommission?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  payoutCommission?: number;

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
