import { Module } from '@nestjs/common';
import { FarmsController, PlotsController } from './farms.controller';
import { FarmsService } from './farms.service';
import { CroppingCyclesController } from './cropping-cycles.controller';
import { CroppingCyclesService } from './cropping-cycles.service';
import { DashboardService } from './dashboard.service';

@Module({
  controllers: [FarmsController, PlotsController, CroppingCyclesController],
  providers: [FarmsService, CroppingCyclesService, DashboardService],
  exports: [FarmsService, CroppingCyclesService],
})
export class FarmsModule {}
