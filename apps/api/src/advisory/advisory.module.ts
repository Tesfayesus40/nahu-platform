import { Module } from '@nestjs/common';
import { AdvisoryController } from './advisory.controller';
import { AdvisoryService } from './advisory.service';

@Module({
  controllers: [AdvisoryController],
  providers: [AdvisoryService],
})
export class AdvisoryModule {}
