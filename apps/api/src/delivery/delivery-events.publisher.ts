import { Injectable, Logger } from '@nestjs/common';

export type DeliveryLifecyclePublication = {
  shipmentId: string;
  eventType: string;
  fromStatus: string | null;
  toStatus: string | null;
  actorUserId: string | null;
  occurredAt: Date;
  payload?: Record<string, unknown> | null;
};

/**
 * D5 — Emit lifecycle publications for notifications / analytics / AI / ETA.
 * Does NOT deliver notifications yet — only records/publishes domain intent
 * after ShipmentEvent is persisted (canonical stream remains shipment_events).
 */
@Injectable()
export class DeliveryEventsPublisher {
  private readonly logger = new Logger(DeliveryEventsPublisher.name);
  /** In-process subscribers for tests / future wiring. */
  private readonly listeners: Array<(e: DeliveryLifecyclePublication) => void> =
    [];

  onPublish(listener: (e: DeliveryLifecyclePublication) => void) {
    this.listeners.push(listener);
    return () => {
      const i = this.listeners.indexOf(listener);
      if (i >= 0) this.listeners.splice(i, 1);
    };
  }

  publish(event: DeliveryLifecyclePublication) {
    this.logger.debug(
      `[delivery-events] ${event.eventType} shipment=${event.shipmentId} ${event.fromStatus}→${event.toStatus}`,
    );
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (err) {
        this.logger.warn(
          `Delivery event listener failed: ${(err as Error).message}`,
        );
      }
    }
    // TODO(D6+/A13): fan-out to AdminNotificationsService / mobile push consumers
  }
}
