import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { CreateWorkDto } from './dto/create-work.dto';
import { UpdateWorkDto } from './dto/update-work.dto';
import { WorksService } from './works.service';

@Controller('works')
@UseGuards(JwtAuthGuard, RolesGuard)
export class WorksController {
  constructor(private readonly worksService: WorksService) {}

  @Get()
  findAll(@Query('q') query?: string) {
    return this.worksService.findAll(query);
  }

  @Get('reports/monthly-clients')
  getMonthlyClientReport(@Query('paidOnly') paidOnly?: string) {
    return this.worksService.getMonthlyClientReport(paidOnly !== 'false');
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.worksService.findById(id);
  }

  @Post()
  @Roles('admin')
  create(@Body() dto: CreateWorkDto) {
    return this.worksService.create(dto);
  }

  @Patch(':id')
  @Roles('admin')
  update(@Param('id') id: string, @Body() dto: UpdateWorkDto) {
    return this.worksService.update(id, dto);
  }

  @Delete(':id')
  @Roles('admin')
  remove(@Param('id') id: string) {
    return this.worksService.remove(id);
  }

  @Get(':id/act.pdf')
  async actPdf(@Param('id') id: string, @Res() res: Response) {
    const document = await this.worksService.generateActPdf(id);
    this.sendPdf(res, document.buffer, document.filename);
  }

  @Get(':id/invoice.pdf')
  async invoicePdf(@Param('id') id: string, @Res() res: Response) {
    const document = await this.worksService.generateInvoicePdf(id);
    this.sendPdf(res, document.buffer, document.filename);
  }

  @Get(':id/upd.pdf')
  async updPdf(@Param('id') id: string, @Res() res: Response) {
    const document = await this.worksService.generateUpdPdf(id);
    this.sendPdf(res, document.buffer, document.filename);
  }

  private sendPdf(res: Response, buffer: Buffer, filename: string) {
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', this.contentDisposition(filename));
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.send(buffer);
  }

  private contentDisposition(filename: string) {
    const fallback = filename.replace(/[^\x20-\x7E]/g, '_').replace(/["\\]/g, '_');
    return `inline; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
  }
}
