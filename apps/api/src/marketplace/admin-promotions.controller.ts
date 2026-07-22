import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { Request } from 'express';
import {
  AdminCooperativesService,
  AdminPromotionsService,
} from './admin-promotions.service';
import { AdminAuthGuard } from '../common/guards/admin-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { CurrentAdmin } from '../common/decorators/current-admin.decorator';
import { AdminRequestUser } from '../common/admin/admin-request.types';
import {
  ListCooperativesQueryDto,
  ListPromotionsQueryDto,
  UpdateCooperativeDto,
  UpsertPromotionDto,
} from './dto/promotions-coops.dto';

@Controller('admin/promotions')
@UseGuards(ThrottlerGuard, AdminAuthGuard, PermissionsGuard)
export class AdminPromotionsController {
  constructor(private readonly promotions: AdminPromotionsService) {}

  private meta(req: Request) {
    return {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      requestId: req.headers['x-request-id'] as string | undefined,
    };
  }

  @Get()
  @RequirePermissions('marketplace.promotions.read')
  list(@Query() query: ListPromotionsQueryDto) {
    return this.promotions.list(query);
  }

  @Get(':id')
  @RequirePermissions('marketplace.promotions.read')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.promotions.get(id);
  }

  @Post()
  @RequirePermissions('marketplace.promotions.manage')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  create(
    @CurrentAdmin() admin: AdminRequestUser,
    @Body() dto: UpsertPromotionDto,
    @Req() req: Request,
  ) {
    return this.promotions.create(admin, dto, this.meta(req));
  }

  @Patch(':id')
  @RequirePermissions('marketplace.promotions.manage')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  update(
    @CurrentAdmin() admin: AdminRequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpsertPromotionDto,
    @Req() req: Request,
  ) {
    return this.promotions.update(admin, id, dto, this.meta(req));
  }
}

@Controller('admin/cooperatives')
@UseGuards(ThrottlerGuard, AdminAuthGuard, PermissionsGuard)
export class AdminCooperativesController {
  constructor(private readonly coops: AdminCooperativesService) {}

  private meta(req: Request) {
    return {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      requestId: req.headers['x-request-id'] as string | undefined,
    };
  }

  @Get()
  @RequirePermissions('marketplace.cooperatives.read')
  list(@Query() query: ListCooperativesQueryDto) {
    return this.coops.list(query);
  }

  @Get(':id')
  @RequirePermissions('marketplace.cooperatives.read')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.coops.get(id);
  }

  @Patch(':id')
  @RequirePermissions('marketplace.cooperatives.manage')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  update(
    @CurrentAdmin() admin: AdminRequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCooperativeDto,
    @Req() req: Request,
  ) {
    return this.coops.update(admin, id, dto, this.meta(req));
  }
}
