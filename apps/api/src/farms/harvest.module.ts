import { Module } from '@nestjs/common';
import { FarmsModule } from './farms.module';
import { InventoryModule } from '../inventory/inventory.module';
import { HarvestController } from './harvest.controller';
import { HarvestService } from './harvest.service';

@Module({
  imports: [FarmsModule, InventoryModule],
  controllers: [HarvestController],
  providers: [HarvestService],
  exports: [HarvestService],
})
export class HarvestModule {}
