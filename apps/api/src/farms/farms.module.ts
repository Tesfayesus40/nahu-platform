import { Module } from '@nestjs/common';
import { FarmsController, PlotsController } from './farms.controller';
import { FarmsService } from './farms.service';

@Module({
  controllers: [FarmsController, PlotsController],
  providers: [FarmsService],
  exports: [FarmsService],
})
export class FarmsModule {}
