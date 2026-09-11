import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';

import { ValidationServiceException } from '../../common/errors/service.exception';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { CreateIncomeDto } from './dto/create-income.dto';
import { UpdateIncomeDto } from './dto/update-income.dto';
import { IncomeBalanceImportService } from './income-balance-import.service';
import { IncomesService } from './incomes.service';

@Controller('incomes')
@UseGuards(JwtAuthGuard, RolesGuard)
export class IncomesController {
  constructor(
    private readonly incomesService: IncomesService,
    private readonly incomeBalanceImportService: IncomeBalanceImportService
  ) {}

  @Get()
  findAll() {
    return this.incomesService.findAll();
  }

  @Post()
  @Roles('admin')
  create(@Body() dto: CreateIncomeDto) {
    return this.incomesService.create(dto);
  }

  @Post('imports/balance-report')
  @Roles('admin')
  @UseInterceptors(FileInterceptor('file'))
  importBalanceReport(@UploadedFile() file?: Express.Multer.File) {
    if (!file?.buffer?.length) {
      throw new ValidationServiceException('Файл импорта не передан');
    }

    return this.incomeBalanceImportService.importFromBuffer(file.buffer);
  }

  @Get(':id/receipt.pdf')
  async receiptPdf(@Param('id') id: string, @Res() res: Response) {
    const buffer = await this.incomesService.generateReceiptPdf(id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="income-receipt-${id}.pdf"`);
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.send(buffer);
  }

  @Patch(':id')
  @Roles('admin')
  update(@Param('id') id: string, @Body() dto: UpdateIncomeDto) {
    return this.incomesService.update(id, dto);
  }

  @Delete(':id')
  @Roles('admin')
  remove(@Param('id') id: string) {
    return this.incomesService.remove(id);
  }
}
