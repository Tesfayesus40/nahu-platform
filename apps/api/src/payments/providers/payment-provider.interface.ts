/**
 * G9 — Payment provider abstraction.
 * Business orchestration depends on this interface only; gateways plug in later.
 */

export type ProviderOperation =
  | 'AUTHORIZE'
  | 'CAPTURE'
  | 'REFUND'
  | 'DISBURSE';

export type ProviderResult = {
  ok: boolean;
  providerCode: string;
  operation: ProviderOperation;
  externalReference?: string | null;
  message?: string;
  raw?: Record<string, unknown>;
};

export type ProviderMoneyInput = {
  orderId: string;
  amountEtb: number;
  currency?: string;
  externalReference?: string | null;
  metadata?: Record<string, unknown>;
};

export interface PaymentProvider {
  readonly code: string;
  authorize(input: ProviderMoneyInput): Promise<ProviderResult>;
  capture(input: ProviderMoneyInput): Promise<ProviderResult>;
  refund(input: ProviderMoneyInput): Promise<ProviderResult>;
  disburse(input: ProviderMoneyInput & { partyCode: string }): Promise<ProviderResult>;
}
