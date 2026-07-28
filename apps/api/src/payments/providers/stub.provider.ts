import { PaymentRailsService } from '../../pricing/payment-rails.service';
import {
  PaymentProvider,
  ProviderMoneyInput,
  ProviderResult,
} from './payment-provider.interface';

/**
 * Stub gateway for Telebirr / CBE Birr / Chapa / etc.
 * Records pricing.payment_intents only — no live HTTP.
 */
export class StubPaymentProvider implements PaymentProvider {
  constructor(
    readonly code: string,
    private readonly rails: PaymentRailsService,
  ) {}

  async authorize(input: ProviderMoneyInput): Promise<ProviderResult> {
    // Authorize is in-memory for stubs — capture records the BUYER_CAPTURE intent.
    return {
      ok: true,
      providerCode: this.code,
      operation: 'AUTHORIZE',
      externalReference: input.externalReference,
      message: `${this.code} authorize stub (no intent row)`,
      raw: { stub: true, phase: 'AUTHORIZE' },
    };
  }

  async capture(input: ProviderMoneyInput): Promise<ProviderResult> {
    await this.rails.recordIntent({
      orderId: input.orderId,
      providerCode: this.code,
      intentType: 'BUYER_CAPTURE',
      amountEtb: input.amountEtb,
      externalReference: input.externalReference,
      metadataJson: { ...(input.metadata ?? {}), phase: 'CAPTURE', stub: true },
    });
    return {
      ok: true,
      providerCode: this.code,
      operation: 'CAPTURE',
      externalReference: input.externalReference,
      message: `${this.code} capture stub recorded`,
      raw: { stub: true },
    };
  }

  async refund(input: ProviderMoneyInput): Promise<ProviderResult> {
    await this.rails.recordIntent({
      orderId: input.orderId,
      providerCode: this.code,
      intentType: 'BUYER_REFUND',
      amountEtb: input.amountEtb,
      externalReference: input.externalReference,
      metadataJson: { ...(input.metadata ?? {}), stub: true },
    });
    return {
      ok: true,
      providerCode: this.code,
      operation: 'REFUND',
      externalReference: input.externalReference,
      message: `${this.code} refund stub recorded`,
      raw: { stub: true },
    };
  }

  async disburse(
    input: ProviderMoneyInput & { partyCode: string },
  ): Promise<ProviderResult> {
    const intentType =
      input.partyCode === 'COURIER'
        ? 'COURIER_DISBURSEMENT'
        : input.partyCode === 'FARMER'
          ? 'FARMER_DISBURSEMENT'
          : 'FARMER_DISBURSEMENT';
    if (input.partyCode === 'PLATFORM') {
      return {
        ok: true,
        providerCode: this.code,
        operation: 'DISBURSE',
        message: 'Platform revenue retained (no disbursement rail)',
        raw: { stub: true, partyCode: 'PLATFORM' },
      };
    }
    await this.rails.recordIntent({
      orderId: input.orderId,
      providerCode: this.code === 'TEST' ? 'INTERNAL_DISBURSEMENT' : 'INTERNAL_DISBURSEMENT',
      intentType,
      amountEtb: input.amountEtb,
      externalReference: input.externalReference,
      metadataJson: {
        ...(input.metadata ?? {}),
        stub: true,
        partyCode: input.partyCode,
        provider: this.code,
      },
    });
    return {
      ok: true,
      providerCode: this.code,
      operation: 'DISBURSE',
      externalReference: input.externalReference,
      message: `${this.code} disbursement stub for ${input.partyCode}`,
      raw: { stub: true, partyCode: input.partyCode },
    };
  }
}
