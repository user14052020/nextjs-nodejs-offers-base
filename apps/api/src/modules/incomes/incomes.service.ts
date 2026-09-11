import { Injectable, OnModuleInit } from '@nestjs/common';

import {
  ConflictServiceException,
  NotFoundServiceException,
  ValidationServiceException
} from '../../common/errors/service.exception';
import { UnitOfWork } from '../../common/uow/unit-of-work';
import { OrganizationsService } from '../organizations/organizations.service';
import { SequencesService } from '../sequences/sequences.service';
import { CreateIncomeDto } from './dto/create-income.dto';
import { UpdateIncomeDto } from './dto/update-income.dto';
import { IncomeReceiptPdfService } from './income-receipt-pdf.service';
import { IncomesRepository } from './incomes.repository';

@Injectable()
export class IncomesService implements OnModuleInit {
  constructor(
    private readonly incomesRepository: IncomesRepository,
    private readonly organizationsService: OrganizationsService,
    private readonly sequencesService: SequencesService,
    private readonly incomeReceiptPdfService: IncomeReceiptPdfService,
    private readonly uow: UnitOfWork
  ) {}

  async onModuleInit() {
    await this.incomesRepository.backfillDates();
    await this.incomesRepository.backfillDefaults();
    await this.incomesRepository.ensureIndexes();
  }

  findAll() {
    return this.incomesRepository.findAll();
  }

  aggregateMonthlyReport(options: { receivedOnly: boolean }) {
    return this.incomesRepository.aggregateMonthlyReport(options);
  }

  async findById(id: string) {
    const income = await this.incomesRepository.findById(id);
    if (!income) {
      throw new NotFoundServiceException('Доход не найден');
    }
    return income;
  }

  async create(dto: CreateIncomeDto) {
    return this.uow.withTransaction(async (session) => {
      const grossAmount = this.normalizeAmount(dto.grossAmount);
      const netAmount = this.normalizeAmount(dto.netAmount);
      const platformCommission =
        dto.platformCommission === undefined
          ? Math.max(0, grossAmount - netAmount)
          : this.normalizeAmount(dto.platformCommission);
      const incomeDate = new Date(dto.incomeDate);
      const confirmationDocumentType =
        dto.confirmationDocumentType ?? (dto.source === 'kwork' ? 'platform_report' : 'receipt');
      const receiptDate = dto.receiptDate
        ? new Date(dto.receiptDate)
        : confirmationDocumentType === 'receipt'
          ? incomeDate
          : undefined;
      const receiptYear = receiptDate?.getFullYear();
      let receiptNumber = dto.receiptNumber?.trim() || undefined;
      if (confirmationDocumentType === 'receipt' && !receiptNumber) {
        if (!receiptYear) {
          throw new ValidationServiceException('Дата квитанции указана некорректно');
        }
        for (let attempt = 0; attempt < 100; attempt += 1) {
          const candidate = String(await this.sequencesService.next(`income-receipt-${receiptYear}`, session));
          const existingReceipt = await this.incomesRepository.findReceiptByNumber(receiptYear, candidate);
          if (!existingReceipt) {
            receiptNumber = candidate;
            break;
          }
        }
        if (!receiptNumber) {
          throw new ConflictServiceException('Не удалось подобрать свободный номер квитанции');
        }
      }
      if (confirmationDocumentType === 'receipt' && receiptNumber && receiptYear) {
        const existingReceipt = await this.incomesRepository.findReceiptByNumber(receiptYear, receiptNumber);
        if (existingReceipt) {
          throw new ConflictServiceException('Номер квитанции уже используется в этом году');
        }
      }

      return this.incomesRepository.create(
        {
          source: dto.source,
          sourceName: dto.sourceName.trim(),
          incomeDate,
          description: dto.description.trim(),
          customerName: dto.customerName?.trim() || undefined,
          orderTitle: dto.orderTitle?.trim() || undefined,
          grossAmount,
          netAmount,
          platformCommission,
          payoutCommission: this.normalizeAmount(dto.payoutCommission ?? 0),
          currency: dto.currency?.trim() || 'RUB',
          isReceived: dto.isReceived ?? true,
          paymentMethod: dto.paymentMethod ?? (dto.source === 'kwork' ? 'platform' : 'card_transfer'),
          confirmationDocumentType,
          receiptNumber,
          receiptDate,
          receiptYear,
          settlementPlace: dto.settlementPlace?.trim() || (dto.source === 'manual' ? 'дистанционный расчет' : undefined),
          taxRegime: dto.taxRegime?.trim() || 'ПСН',
          cashRegisterExemptionReason:
            dto.cashRegisterExemptionReason?.trim() || 'ККТ не применяется: ПСН, п. 2.1 ст. 2 54-ФЗ'
        },
        session
      );
    });
  }

  async update(id: string, dto: UpdateIncomeDto) {
    const updated = await this.uow.withTransaction(async (session) => {
      const existing = await this.incomesRepository.findById(id);
      if (!existing) {
        throw new NotFoundServiceException('Доход не найден');
      }

      const payload: Record<string, unknown> = { ...dto };
      const incomeDate = dto.incomeDate ? new Date(dto.incomeDate) : new Date(existing.incomeDate);
      payload.incomeDate = incomeDate;
      const confirmationDocumentType =
        dto.confirmationDocumentType ??
        existing.confirmationDocumentType ??
        (dto.source === 'kwork' ? 'platform_report' : 'receipt');
      payload.confirmationDocumentType = confirmationDocumentType;
      if (dto.sourceName) {
        payload.sourceName = dto.sourceName.trim();
      }
      if (dto.description) {
        payload.description = dto.description.trim();
      }
      if (dto.customerName !== undefined) {
        payload.customerName = dto.customerName.trim() || undefined;
      }
      if (dto.orderTitle !== undefined) {
        payload.orderTitle = dto.orderTitle.trim() || undefined;
      }
      if (dto.receiptNumber !== undefined) {
        payload.receiptNumber = dto.receiptNumber.trim() || undefined;
      }
      if (dto.settlementPlace !== undefined) {
        payload.settlementPlace = dto.settlementPlace.trim() || undefined;
      }
      if (dto.taxRegime !== undefined) {
        payload.taxRegime = dto.taxRegime.trim() || 'ПСН';
      }
      if (dto.cashRegisterExemptionReason !== undefined) {
        payload.cashRegisterExemptionReason =
          dto.cashRegisterExemptionReason.trim() || 'ККТ не применяется: ПСН, п. 2.1 ст. 2 54-ФЗ';
      }
      if (dto.grossAmount !== undefined) {
        payload.grossAmount = this.normalizeAmount(dto.grossAmount);
      }
      if (dto.netAmount !== undefined) {
        payload.netAmount = this.normalizeAmount(dto.netAmount);
      }
      if (dto.platformCommission !== undefined) {
        payload.platformCommission = this.normalizeAmount(dto.platformCommission);
      }
      if (dto.payoutCommission !== undefined) {
        payload.payoutCommission = this.normalizeAmount(dto.payoutCommission);
      }

      if (confirmationDocumentType === 'receipt') {
        const receiptDate = dto.receiptDate
          ? new Date(dto.receiptDate)
          : existing.receiptDate
            ? new Date(existing.receiptDate)
            : incomeDate;
        const receiptYear = receiptDate.getFullYear();
        let receiptNumber =
          dto.receiptNumber !== undefined ? dto.receiptNumber.trim() || undefined : existing.receiptNumber?.trim();

        if (!receiptNumber) {
          for (let attempt = 0; attempt < 100; attempt += 1) {
            const candidate = String(await this.sequencesService.next(`income-receipt-${receiptYear}`, session));
            const existingReceipt = await this.incomesRepository.findReceiptByNumber(receiptYear, candidate, id);
            if (!existingReceipt) {
              receiptNumber = candidate;
              break;
            }
          }
        }

        if (!receiptNumber) {
          throw new ConflictServiceException('Не удалось подобрать свободный номер квитанции');
        }

        const existingReceipt = await this.incomesRepository.findReceiptByNumber(receiptYear, receiptNumber, id);
        if (existingReceipt) {
          throw new ConflictServiceException('Номер квитанции уже используется в этом году');
        }

        payload.receiptDate = receiptDate;
        payload.receiptYear = receiptYear;
        payload.receiptNumber = receiptNumber;
      } else {
        payload.receiptDate = undefined;
        payload.receiptYear = undefined;
        payload.receiptNumber = undefined;
        payload.settlementPlace = dto.settlementPlace?.trim() || undefined;
      }

      const result = await this.incomesRepository.update(id, payload, session);
      return result;
    });

    return updated;
  }

  async remove(id: string) {
    const removed = await this.uow.withTransaction(async (session) => {
      const result = await this.incomesRepository.delete(id, session);
      if (!result) {
        throw new NotFoundServiceException('Доход не найден');
      }
      return result;
    });

    return removed;
  }

  async generateReceiptPdf(id: string) {
    const income = await this.findById(id);
    if (income.confirmationDocumentType !== 'receipt') {
      throw new ValidationServiceException('Для этого дохода квитанция не формируется');
    }

    const organizations = await this.organizationsService.findAll();
    const organization = organizations[0];
    if (!organization) {
      throw new ValidationServiceException('Добавьте организацию для печати квитанции');
    }

    return this.incomeReceiptPdfService.build(income, organization);
  }

  private normalizeAmount(value: unknown) {
    const amount = Number(value);
    return Number.isFinite(amount) && amount >= 0 ? amount : 0;
  }
}
