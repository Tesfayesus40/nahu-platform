import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { parseEarningFlatEtb, resolveFlagEnabled } from './delivery-config.rules';

/** Feature flag codes seeded in ops/006 (D1) + ops/009 (D10). */
export const DeliveryFeatureFlags = {
  buyerConfirmRequired: 'delivery.buyer_confirm_required',
  buyerConfirmFromEscrow: 'delivery.buyer_confirm_from_escrow',
  pickupPodRequired: 'delivery.pickup_pod_required',
  courierAppEnabled: 'delivery.courier_app.enabled',
  analyticsEnabled: 'delivery.analytics.enabled',
  podOtpRequired: 'delivery.pod.otp_required',
  podPhotoRequired: 'delivery.pod.photo_required',
  podGpsRequired: 'delivery.pod.gps_required',
  podRecipientRequired: 'delivery.pod.recipient_required',
} as const;

/** System setting codes seeded in ops/006 (D1) + ops/008 (D9). */
export const DeliverySettings = {
  earningFlatEtb: 'delivery.earning.flat_etb',
  maxActiveShipments: 'delivery.dispatch.max_active_shipments',
  slaInTransitHours: 'delivery.sla.in_transit_hours',
  slaPodPendingHours: 'delivery.sla.pod_pending_hours',
} as const;

/**
 * Reads Delivery Phase 1 config from ops.feature_flags + ops.system_settings.
 * Defaults match SAD when rows are missing (safe for pre-migrate local).
 */
@Injectable()
export class DeliveryConfigService {
  constructor(private readonly prisma: PrismaService) {}

  async isFlagEnabled(code: string, defaultEnabled: boolean): Promise<boolean> {
    const flag = await this.prisma.featureFlag.findUnique({ where: { code } });
    return resolveFlagEnabled(flag, defaultEnabled);
  }

  buyerConfirmRequired(): Promise<boolean> {
    return this.isFlagEnabled(DeliveryFeatureFlags.buyerConfirmRequired, true);
  }

  buyerConfirmFromEscrow(): Promise<boolean> {
    return this.isFlagEnabled(DeliveryFeatureFlags.buyerConfirmFromEscrow, false);
  }

  pickupPodRequired(): Promise<boolean> {
    return this.isFlagEnabled(DeliveryFeatureFlags.pickupPodRequired, false);
  }

  podOtpRequired(): Promise<boolean> {
    return this.isFlagEnabled(DeliveryFeatureFlags.podOtpRequired, true);
  }

  podPhotoRequired(): Promise<boolean> {
    return this.isFlagEnabled(DeliveryFeatureFlags.podPhotoRequired, true);
  }

  podGpsRequired(): Promise<boolean> {
    return this.isFlagEnabled(DeliveryFeatureFlags.podGpsRequired, false);
  }

  podRecipientRequired(): Promise<boolean> {
    return this.isFlagEnabled(DeliveryFeatureFlags.podRecipientRequired, true);
  }

  async podRequirements() {
    const [otpRequired, photoRequired, gpsRequired, recipientNameRequired] =
      await Promise.all([
        this.podOtpRequired(),
        this.podPhotoRequired(),
        this.podGpsRequired(),
        this.podRecipientRequired(),
      ]);
    return {
      otpRequired,
      photoRequired,
      gpsRequired,
      recipientNameRequired,
    };
  }

  courierAppEnabled(): Promise<boolean> {
    return this.isFlagEnabled(DeliveryFeatureFlags.courierAppEnabled, true);
  }

  analyticsEnabled(): Promise<boolean> {
    return this.isFlagEnabled(DeliveryFeatureFlags.analyticsEnabled, true);
  }

  async getSettingText(code: string, defaultValue: string): Promise<string> {
    const row = await this.prisma.systemSetting.findUnique({ where: { code } });
    if (!row) {
      return defaultValue;
    }
    return row.valueText;
  }

  async earningFlatEtb(): Promise<number> {
    const raw = await this.getSettingText(DeliverySettings.earningFlatEtb, '0');
    return parseEarningFlatEtb(raw);
  }

  async maxActiveShipments(): Promise<number> {
    const raw = await this.getSettingText(
      DeliverySettings.maxActiveShipments,
      '3',
    );
    const n = Number(raw);
    return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 3;
  }

  /** Hours a shipment may stay in PICKED_UP/IN_TRANSIT before flagged delayed. */
  async slaInTransitHours(): Promise<number> {
    const raw = await this.getSettingText(
      DeliverySettings.slaInTransitHours,
      '24',
    );
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? Math.min(Math.floor(n), 168) : 24;
  }

  /** Hours a shipment may stay in ARRIVED/DELIVERED before flagged POD-pending delay. */
  async slaPodPendingHours(): Promise<number> {
    const raw = await this.getSettingText(
      DeliverySettings.slaPodPendingHours,
      '12',
    );
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? Math.min(Math.floor(n), 168) : 12;
  }

  /** Snapshot for Admin/debug and later sync services. */
  async snapshot() {
    const [
      buyerConfirmRequired,
      buyerConfirmFromEscrow,
      pickupPodRequired,
      courierAppEnabled,
      analyticsEnabled,
      earningFlatEtb,
      maxActiveShipments,
      slaInTransitHours,
      slaPodPendingHours,
      podRequirements,
    ] = await Promise.all([
      this.buyerConfirmRequired(),
      this.buyerConfirmFromEscrow(),
      this.pickupPodRequired(),
      this.courierAppEnabled(),
      this.analyticsEnabled(),
      this.earningFlatEtb(),
      this.maxActiveShipments(),
      this.slaInTransitHours(),
      this.slaPodPendingHours(),
      this.podRequirements(),
    ]);

    return {
      buyerConfirmRequired,
      buyerConfirmFromEscrow,
      pickupPodRequired,
      courierAppEnabled,
      analyticsEnabled,
      earningFlatEtb,
      maxActiveShipments,
      slaInTransitHours,
      slaPodPendingHours,
      podRequirements,
    };
  }
}
