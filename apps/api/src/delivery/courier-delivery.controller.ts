import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { Roles, RolesGuard } from '../common/guards/roles.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayload } from '../common/jwt-payload.interface';
import { ShipmentAggregateService } from './shipment-aggregate.service';
import {
  RejectShipmentDto,
  UpdateCourierAvailabilityDto,
  ExecutionNoteDto,
  MarkDeliveredDto,
  ListCourierShipmentsQueryDto,
} from './dto/courier-delivery.dto';
import {
  ListCourierNotificationsQueryDto,
  SubmitVerificationDto,
  UpdateCourierProfileDto,
  UpdateNotificationPrefsDto,
  UpsertPayoutAccountDto,
  UpsertVehicleDto,
} from './dto/courier-crm.dto';
import { ListCourierEarningsQueryDto } from './dto/settlement.dto';
import { DeliveryConfigService } from './delivery-config.service';
import { DispatchService } from './dispatch.service';
import { DeliveryExecutionService } from './delivery-execution.service';
import { ProofOfDeliveryService } from './proof-of-delivery.service';
import { SettlementService } from './settlement.service';
import { CourierProfileService } from './courier-profile.service';
import { CourierNotificationsService } from './courier-notifications.service';

@Controller('delivery/courier')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('COURIER')
export class CourierDeliveryController {
  constructor(
    private readonly shipments: ShipmentAggregateService,
    private readonly dispatch: DispatchService,
    private readonly execution: DeliveryExecutionService,
    private readonly config: DeliveryConfigService,
    private readonly pod: ProofOfDeliveryService,
    private readonly settlement: SettlementService,
    private readonly crm: CourierProfileService,
    private readonly notifications: CourierNotificationsService,
  ) {}

  private async assertCourierAppEnabled() {
    if (!(await this.config.courierAppEnabled())) {
      throw new ForbiddenException('Courier app is disabled');
    }
  }

  @Get('me')
  async me(@CurrentUser() user: JwtPayload) {
    await this.assertCourierAppEnabled();
    return this.crm.getMe(user.userId, user.phone);
  }

  @Patch('me')
  async updateMe(
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateCourierProfileDto,
  ) {
    await this.assertCourierAppEnabled();
    return this.crm.updateMe(user.userId, dto);
  }

  @Patch('me/notification-prefs')
  async updatePrefs(
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateNotificationPrefsDto,
  ) {
    await this.assertCourierAppEnabled();
    return this.crm.updateNotificationPrefs(user.userId, dto);
  }

  @Get('verification')
  async getVerification(@CurrentUser() user: JwtPayload) {
    await this.assertCourierAppEnabled();
    return this.crm.getVerification(user.userId);
  }

  @Post('verification')
  async submitVerification(
    @CurrentUser() user: JwtPayload,
    @Body() dto: SubmitVerificationDto,
  ) {
    await this.assertCourierAppEnabled();
    return this.crm.submitVerification(user.userId, dto);
  }

  @Get('vehicles')
  async listVehicles(@CurrentUser() user: JwtPayload) {
    await this.assertCourierAppEnabled();
    return this.crm.listVehicles(user.userId);
  }

  @Post('vehicles')
  async createVehicle(
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpsertVehicleDto,
  ) {
    await this.assertCourierAppEnabled();
    return this.crm.createVehicle(user.userId, dto);
  }

  @Patch('vehicles/:id')
  async updateVehicle(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpsertVehicleDto,
  ) {
    await this.assertCourierAppEnabled();
    return this.crm.updateVehicle(user.userId, id, dto);
  }

  @Delete('vehicles/:id')
  async deleteVehicle(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.assertCourierAppEnabled();
    return this.crm.deleteVehicle(user.userId, id);
  }

  @Post('vehicles/:id/activate')
  async activateVehicle(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.assertCourierAppEnabled();
    return this.crm.activateVehicle(user.userId, id);
  }

  @Get('payout-accounts')
  async listPayouts(@CurrentUser() user: JwtPayload) {
    await this.assertCourierAppEnabled();
    return this.crm.listPayoutAccounts(user.userId);
  }

  @Post('payout-accounts')
  async createPayout(
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpsertPayoutAccountDto,
  ) {
    await this.assertCourierAppEnabled();
    return this.crm.createPayoutAccount(user.userId, dto);
  }

  @Patch('payout-accounts/:id')
  async updatePayout(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpsertPayoutAccountDto,
  ) {
    await this.assertCourierAppEnabled();
    return this.crm.updatePayoutAccount(user.userId, id, dto);
  }

  @Delete('payout-accounts/:id')
  async deletePayout(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.assertCourierAppEnabled();
    return this.crm.deletePayoutAccount(user.userId, id);
  }

  @Get('notifications')
  async listNotifications(
    @CurrentUser() user: JwtPayload,
    @Query() query: ListCourierNotificationsQueryDto,
  ) {
    await this.assertCourierAppEnabled();
    return this.notifications.list(user.userId, query);
  }

  @Post('notifications/read-all')
  async markAllRead(@CurrentUser() user: JwtPayload) {
    await this.assertCourierAppEnabled();
    return this.notifications.markAllRead(user.userId);
  }

  @Post('notifications/:id/read')
  async markRead(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.assertCourierAppEnabled();
    return this.notifications.markRead(user.userId, id);
  }

  @Delete('notifications/:id')
  async deleteNotification(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.assertCourierAppEnabled();
    return this.notifications.softDelete(user.userId, id);
  }

  /** D11 — read-only earnings summary + ledger rows (no payout). */
  @Get('earnings')
  async earnings(
    @CurrentUser() user: JwtPayload,
    @Query() query: ListCourierEarningsQueryDto,
  ) {
    await this.assertCourierAppEnabled();
    return this.settlement.listCourierEarnings(user.userId, query);
  }

  @Patch('me/availability')
  async setAvailability(
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateCourierAvailabilityDto,
  ) {
    await this.assertCourierAppEnabled();
    return this.shipments.setCourierAvailability(user.userId, dto.availability);
  }

  @Get('shipments')
  async listShipments(
    @CurrentUser() user: JwtPayload,
    @Query() query: ListCourierShipmentsQueryDto,
  ) {
    await this.assertCourierAppEnabled();
    return this.shipments.listCourierShipments(user.userId, query);
  }

  @Get('shipments/:id')
  async getShipment(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.assertCourierAppEnabled();
    const detail = await this.shipments.getCourierShipment(user.userId, id);
    const requirements = await this.pod.getRequirements();
    return {
      ...detail,
      podRequirements: requirements,
    };
  }

  @Post('shipments/:id/accept')
  async accept(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.assertCourierAppEnabled();
    return this.dispatch.acceptAssignment(user.userId, id);
  }

  @Post('shipments/:id/reject')
  async reject(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectShipmentDto,
  ) {
    await this.assertCourierAppEnabled();
    return this.dispatch.rejectAssignment(user.userId, id, dto.reason);
  }

  @Post('shipments/:id/pickup/start')
  async startPickup(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.assertCourierAppEnabled();
    return this.execution.startPickup(user.userId, id);
  }

  @Post('shipments/:id/pickup')
  async confirmPickup(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.assertCourierAppEnabled();
    return this.execution.confirmPickup(user.userId, id);
  }

  @Post('shipments/:id/transit')
  async startTransit(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.assertCourierAppEnabled();
    return this.execution.startTransit(user.userId, id);
  }

  @Post('shipments/:id/arrived')
  async arrived(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.assertCourierAppEnabled();
    return this.execution.arriveAtDestination(user.userId, id);
  }

  @Post('shipments/:id/delivered')
  async delivered(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: MarkDeliveredDto,
  ) {
    await this.assertCourierAppEnabled();
    return this.execution.markDelivered(user.userId, id, {
      otpCode: dto.otpCode,
      photoUrl: dto.photoUrl,
      mediaUrls: dto.mediaUrls,
      recipientName: dto.recipientName,
      lat: dto.lat,
      lng: dto.lng,
      accuracyM: dto.accuracyM,
      notes: dto.notes,
      stopId: dto.stopId,
    });
  }

  @Post('shipments/:id/complete')
  async complete(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.assertCourierAppEnabled();
    return this.execution.completeDelivery(user.userId, id);
  }

  @Post('shipments/:id/fail')
  async fail(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ExecutionNoteDto,
  ) {
    await this.assertCourierAppEnabled();
    return this.execution.markFailed(user.userId, id, dto.reason);
  }

  @Post('shipments/:id/return')
  async markReturn(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ExecutionNoteDto,
  ) {
    await this.assertCourierAppEnabled();
    return this.execution.markReturned(user.userId, id, dto.reason);
  }
}
