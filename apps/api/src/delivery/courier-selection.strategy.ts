import { Injectable } from '@nestjs/common';
import {
  CourierCandidate,
  selectBestCourier,
} from './dispatch.rules';

/**
 * Courier selection port — swap RuleBased for AI implementation later
 * without changing DispatchService / API contracts.
 */
export interface CourierSelectionStrategy {
  readonly name: string;
  select(
    candidates: CourierCandidate[],
    context: { deliveryZone: string | null; maxActiveShipments: number },
  ): { userId: string; score: number; strategy: string } | null;
}

@Injectable()
export class RuleBasedCourierSelectionStrategy
  implements CourierSelectionStrategy
{
  readonly name = 'rule_based_v1';

  select(
    candidates: CourierCandidate[],
    context: { deliveryZone: string | null; maxActiveShipments: number },
  ) {
    const best = selectBestCourier(candidates, context);
    if (!best) return null;
    return { ...best, strategy: this.name };
  }
}

/** DI token for future AI strategy substitution. */
export const COURIER_SELECTION_STRATEGY = Symbol('COURIER_SELECTION_STRATEGY');
