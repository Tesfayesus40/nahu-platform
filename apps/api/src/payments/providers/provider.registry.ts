import { Injectable } from '@nestjs/common';
import { PaymentRailsService } from '../../pricing/payment-rails.service';
import { PaymentProvider } from './payment-provider.interface';
import { StubPaymentProvider } from './stub.provider';
import { TestPaymentProvider } from './test.provider';

@Injectable()
export class PaymentProviderRegistry {
  private readonly providers = new Map<string, PaymentProvider>();

  constructor(private readonly rails: PaymentRailsService) {
    const test = new TestPaymentProvider();
    this.providers.set(test.code, test);

    for (const code of ['TELEBIRR', 'CBE_BIRR', 'CHAPA', 'MPESA', 'SANTIMPAY']) {
      this.providers.set(code, new StubPaymentProvider(code, rails));
    }
  }

  resolve(providerCode: string): PaymentProvider {
    const code = (providerCode || 'TEST').toUpperCase();
    return (
      this.providers.get(code) ?? new StubPaymentProvider(code, this.rails)
    );
  }

  listCodes(): string[] {
    return [...this.providers.keys()];
  }
}
