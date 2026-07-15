import { Module } from '@nestjs/common';
import { FarmsModule } from '../farms/farms.module';
import { WarehouseModule } from '../warehouse/warehouse.module';
import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';
import { ReservationsController } from './reservations.controller';
import { ReservationsService } from './reservations.service';

@Module({
  imports: [FarmsModule, WarehouseModule],
  controllers: [InventoryController, ReservationsController],
  providers: [InventoryService, ReservationsService],
  exports: [InventoryService, ReservationsService],
})
export class InventoryModule {}
