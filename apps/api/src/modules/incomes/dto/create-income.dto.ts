import { IsBoolean, IsDateString, IsIn, IsNumber, IsOptional, IsString, Min, MinLength } from 'class-validator';

export class CreateIncomeDto {
  @IsIn(['kwork', 'manual'])
  source: 'kwork' | 'manual';

  @IsString()
  @MinLength(2)
  sourceName: string;

  @IsDateString()
  incomeDate: string;

  @IsString()
  @MinLength(2)
  description: string;

  @IsOptional()
  @IsString()
  customerName?: string;

  @IsOptional()
  @IsString()
  orderTitle?: string;

  @IsNumber()
  @Min(0)
  grossAmount: number;

  @IsNumber()
  @Min(0)
  netAmount: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  platformCommission?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  payoutCommission?: number;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsBoolean()
  isReceived?: boolean;

  @IsOptional()
  @IsIn(['platform', 'bank_account', 'card_transfer', 'cash', 'other'])
  paymentMethod?: 'platform' | 'bank_account' | 'card_transfer' | 'cash' | 'other';

  @IsOptional()
  @IsIn(['platform_report', 'receipt', 'none'])
  confirmationDocumentType?: 'platform_report' | 'receipt' | 'none';

  @IsOptional()
  @IsString()
  receiptNumber?: string;

  @IsOptional()
  @IsDateString()
  receiptDate?: string;

  @IsOptional()
  @IsString()
  settlementPlace?: string;

  @IsOptional()
  @IsString()
  taxRegime?: string;

  @IsOptional()
  @IsString()
  cashRegisterExemptionReason?: string;
}
