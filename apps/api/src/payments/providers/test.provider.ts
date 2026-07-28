import {
  PaymentProvider,
  ProviderMoneyInput,
  ProviderResult,
} from './payment-provider.interface';

/** Deterministic in-process provider for tests and local simulation. */
export class TestPaymentProvider implements PaymentProvider {
  readonly code = 'TEST';

  async authorize(input: ProviderMoneyInput): Promise<ProviderResult> {
    return this.ok('AUTHORIZE', input);
  }

  async capture(input: ProviderMoneyInput): Promise<ProviderResult> {
    return this.ok('CAPTURE', input);
  }

  async refund(input: ProviderMoneyInput): Promise<ProviderResult> {
    return this.ok('REFUND', input);
  }

  async disburse(
    input: ProviderMoneyInput & { partyCode: string },
  ): Promise<ProviderResult> {
    return {
      ok: true,
      providerCode: this.code,
      operation: 'DISBURSE',
      externalReference: input.externalReference ?? `test-disburse-${input.partyCode}`,
      message: `Test disbursement to ${input.partyCode}`,
      raw: { simulated: true, partyCode: input.partyCode },
    };
  }

  private ok(
    operation: ProviderResult['operation'],
    input: ProviderMoneyInput,
  ): ProviderResult {
    return {
      ok: true,
      providerCode: this.code,
      operation,
      externalReference:
        input.externalReference ?? `test-${operation.toLowerCase()}-${input.orderId.slice(0, 8)}`,
      message: `Test provider ${operation} succeeded`,
      raw: { simulated: true },
    };
  }
}
