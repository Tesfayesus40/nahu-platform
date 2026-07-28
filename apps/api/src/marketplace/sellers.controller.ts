import { Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { SellerPartyService } from './seller-party.service';
import { UpdateSellerPartyDto } from './dto/update-seller-party.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard, Roles } from '../common/guards/roles.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayload } from '../common/jwt-payload.interface';
import { IsBoolean, IsOptional } from 'class-validator';
import { Transform } from 'class-transformer';

class QuerySellerTypesDto {
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  activeOnly?: boolean;
}

/** Additive G7 seller APIs — does not replace /farmers/*. */
@Controller('sellers')
export class SellersController {
  constructor(private readonly sellers: SellerPartyService) {}

  @Get('types')
  listTypes(@Query() query: QuerySellerTypesDto) {
    return this.sellers.listTypes(query.activeOnly !== false);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('FARMER')
  getMine(@CurrentUser() user: JwtPayload) {
    return this.sellers.getMine(user.userId);
  }

  @Patch('me')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('FARMER')
  updateMine(@CurrentUser() user: JwtPayload, @Body() dto: UpdateSellerPartyDto) {
    return this.sellers.updateMine(user.userId, dto);
  }

  @Get(':id')
  getById(@Param('id') id: string) {
    return this.sellers.getById(id);
  }
}
