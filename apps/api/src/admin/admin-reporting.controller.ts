import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { Request } from 'express';
import {
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { AdminReportingService } from './admin-reporting.service';
import { AdminAuthGuard } from '../common/guards/admin-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { CurrentAdmin } from '../common/decorators/current-admin.decorator';
import { AdminRequestUser } from '../common/admin/admin-request.types';

class RunReportDto {
  @IsString()
  @MinLength(3)
  @MaxLength(80)
  reportType: string;

  @IsOptional()
  @IsObject()
  filters?: Record<string, unknown>;
}

class ListJobsQuery {
  @IsOptional()
  @Type(() => Number)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  limit?: number;

  @IsOptional()
  @IsString()
  reportType?: string;
}

@Controller('admin/reports')
@UseGuards(ThrottlerGuard, AdminAuthGuard, PermissionsGuard)
export class AdminReportingController {
  constructor(private readonly reports: AdminReportingService) {}

  @Get('catalog')
  @RequirePermissions('reports.read')
  catalog() {
    return this.reports.catalog();
  }

  @Get('jobs')
  @RequirePermissions('reports.read')
  listJobs(@Query() query: ListJobsQuery) {
    return this.reports.listJobs(query);
  }

  @Get('jobs/:id')
  @RequirePermissions('reports.read')
  getJob(
    @CurrentAdmin() admin: AdminRequestUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.reports.getJob(admin, id, false);
  }

  @Get('jobs/:id/download')
  @RequirePermissions('reports.read')
  async download(
    @CurrentAdmin() admin: AdminRequestUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const job = await this.reports.getJob(admin, id, true);
    if (!job.artifactCsv) {
      throw new NotFoundException('No artifact available');
    }
    return {
      filename: `report-${job.reportType}-${job.id.slice(0, 8)}.csv`,
      contentType: 'text/csv; charset=utf-8',
      body: job.artifactCsv,
      rowCount: job.rowCount,
      reportType: job.reportType,
      status: job.status,
    };
  }

  @Post('export')
  @RequirePermissions('reports.export')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  runExport(
    @CurrentAdmin() admin: AdminRequestUser,
    @Body() dto: RunReportDto,
    @Req() req: Request,
  ) {
    return this.reports.runExport(admin, dto, {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      requestId: req.headers['x-request-id'] as string | undefined,
    });
  }
}
