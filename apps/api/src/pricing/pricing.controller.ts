import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { IsNumber, IsOptional, IsString, Min, MinLength } from 'class-validator';
import { Type } from 'class-transformer';
import { PricingService } from './pricing.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

class CreateDeliveryQuoteDto {
  @IsString()
  @MinLength(2)
  vehicleType: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  distanceKm: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  weightKg: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  volumeM3?: number;
}

@Controller('pricing')
@UseGuards(ThrottlerGuard, JwtAuthGuard)
export class PricingController {
  constructor(private readonly pricing: PricingService) {}

  /** Active fee rates for checkout display (clients must not hardcode %). */
  @Get('active')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  async activeRates() {
    const enabled = await this.pricing.isPricingEnabled();
    const dynamicDelivery = await this.pricing.isDynamicDeliveryEnabled();
    if (!enabled) {
      return {
        enabled: false,
        dynamicDelivery,
        buyerFeePct: 0,
        farmerFeePct: 2,
        scheduleId: null,
        scheduleVersion: null,
      };
    }
    const schedule = await this.pricing.getActiveSchedule();
    return {
      enabled: true,
      dynamicDelivery,
      buyerFeePct: Number(schedule.platformFees?.buyerFeePct ?? 0),
      farmerFeePct: Number(schedule.platformFees?.farmerFeePct ?? 0),
      scheduleId: schedule.id,
      scheduleVersion: schedule.version,
      deliveryCommission: schedule.deliveryCommissions
        ? {
            commissionType: schedule.deliveryCommissions.commissionType,
            commissionValue: Number(
              schedule.deliveryCommissions.commissionValue,
            ),
          }
        : null,
    };
  }

  @Post('delivery-quotes')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  createQuote(
    @CurrentUser() user: { userId: string },
    @Body() dto: CreateDeliveryQuoteDto,
  ) {
    return this.pricing.createDeliveryQuote({
      buyerUserId: user.userId,
      vehicleType: dto.vehicleType,
      distanceKm: dto.distanceKm,
      weightKg: dto.weightKg,
      volumeM3: dto.volumeM3,
    });
  }
}
