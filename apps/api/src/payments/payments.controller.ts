import { Controller, Get } from '@nestjs/common';
import { PaymentsService } from './payments.service';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  /** Catalog of supported and planned payment providers. */
  @Get('methods')
  listMethods() {
    return this.payments.listMethods();
  }
}
