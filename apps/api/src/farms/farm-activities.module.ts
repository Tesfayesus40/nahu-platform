import { Module } from '@nestjs/common';
import { FarmsModule } from './farms.module';
import { FarmActivitiesController } from './farm-activities.controller';
import { FarmActivitiesService } from './farm-activities.service';

@Module({
  imports: [FarmsModule],
  controllers: [FarmActivitiesController],
  providers: [FarmActivitiesService],
  exports: [FarmActivitiesService],
})
export class FarmActivitiesModule {}
