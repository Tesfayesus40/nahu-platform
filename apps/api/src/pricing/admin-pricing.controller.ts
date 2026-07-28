import { Body, Controller, Get, Patch, Put, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import {
  IsBoolean,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PricingService } from './pricing.service';
import { AdminAuthGuard } from '../common/guards/admin-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { CurrentAdmin } from '../common/decorators/current-admin.decorator';
import { AdminRequestUser } from '../common/admin/admin-request.types';
import { AdminAuthService } from '../identity/admin/admin-auth.service';

class UpdatePlatformFeesDto {
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  buyerFeePct: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  farmerFeePct: number;

  @IsString()
  @MinLength(1)
  reauthPassword: string;

  @IsOptional()
  @IsString()
  reason?: string;
}

class UpdateDeliveryCommissionDto {
  @IsIn(['PERCENT', 'FIXED'])
  commissionType: 'PERCENT' | 'FIXED';

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  commissionValue: number;

  @IsString()
  @MinLength(1)
  reauthPassword: string;

  @IsOptional()
  @IsString()
  reason?: string;
}

class UpsertDeliveryTariffDto {
  @IsString()
  @MinLength(2)
  vehicleType: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  baseFareEtb: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  perKmEtb: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  perKgEtb: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  perM3Etb?: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minFareEtb: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxFareEtb?: number | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsString()
  @MinLength(1)
  reauthPassword: string;

  @IsOptional()
  @IsString()
  reason?: string;
}

@Controller('admin/pricing')
@UseGuards(ThrottlerGuard, AdminAuthGuard, PermissionsGuard)
export class AdminPricingController {
  constructor(
    private readonly pricing: PricingService,
    private readonly adminAuth: AdminAuthService,
  ) {}

  @Get('schedules')
  @RequirePermissions('admin.system.config.read')
  listSchedules() {
    return this.pricing.listSchedules();
  }

  @Patch('platform-fees')
  @RequirePermissions('admin.system.config.write')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async updatePlatformFees(
    @CurrentAdmin() admin: AdminRequestUser,
    @Body() dto: UpdatePlatformFeesDto,
  ) {
    await this.adminAuth.requireReauth(admin, dto.reauthPassword);
    return this.pricing.updateActivePlatformFees(dto);
  }

  @Patch('delivery-commission')
  @RequirePermissions('admin.system.config.write')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async updateCommission(
    @CurrentAdmin() admin: AdminRequestUser,
    @Body() dto: UpdateDeliveryCommissionDto,
  ) {
    await this.adminAuth.requireReauth(admin, dto.reauthPassword);
    return this.pricing.updateDeliveryCommission(dto);
  }

  @Put('delivery-tariffs')
  @RequirePermissions('admin.system.config.write')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async upsertTariff(
    @CurrentAdmin() admin: AdminRequestUser,
    @Body() dto: UpsertDeliveryTariffDto,
  ) {
    await this.adminAuth.requireReauth(admin, dto.reauthPassword);
    return this.pricing.upsertDeliveryTariff(dto);
  }
}
