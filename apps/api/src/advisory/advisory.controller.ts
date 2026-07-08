import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { AdvisoryService } from './advisory.service';
import { AskAdvisorDto } from './dto/ask-advisor.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard, Roles } from '../common/guards/roles.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayload } from '../common/jwt-payload.interface';

@Controller('advisory')
export class AdvisoryController {
  constructor(private readonly advisory: AdvisoryService) {}

  @Post('ask')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('FARMER')
  ask(@CurrentUser() user: JwtPayload, @Body() dto: AskAdvisorDto) {
    return this.advisory.askAdvisor(user.userId, dto);
  }

  @Get('price-alert/:region')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('FARMER')
  priceAlert(@Param('region') region: string) {
    return this.advisory.getPriceAlert(region);
  }
}
