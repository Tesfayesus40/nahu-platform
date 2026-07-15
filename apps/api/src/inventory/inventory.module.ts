import { Module } from '@nestjs/common';
import { FarmsModule } from '../farms/farms.module';
import { WarehouseModule } from '../warehouse/warehouse.module';
import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';

@Module({
  imports: [FarmsModule, WarehouseModule],
  controllers: [InventoryController],
  providers: [InventoryService],
  exports: [InventoryService],
})
export class InventoryModule {}
