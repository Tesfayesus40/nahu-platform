import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { MarketplaceService } from './marketplace.service';
import { CreateFarmerProfileDto } from './dto/create-farmer-profile.dto';
import { UpdateFarmerProfileDto } from './dto/update-farmer-profile.dto';
import { CreateListingDto } from './dto/create-listing.dto';
import { UpdateListingDto } from './dto/update-listing.dto';
import { QueryListingsDto } from './dto/query-listings.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard, Roles } from '../common/guards/roles.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayload } from '../common/jwt-payload.interface';

@Controller('farmers')
export class FarmersController {
  constructor(private readonly marketplace: MarketplaceService) {}

  @Get('profile')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('FARMER')
  getMyProfile(@CurrentUser() user: JwtPayload) {
    return this.marketplace.getMyProfile(user.userId);
  }

  @Post('profile')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('FARMER')
  createProfile(@CurrentUser() user: JwtPayload, @Body() dto: CreateFarmerProfileDto) {
    return this.marketplace.createFarmerProfile(user.userId, dto);
  }

  @Patch('profile')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('FARMER')
  updateProfile(@CurrentUser() user: JwtPayload, @Body() dto: UpdateFarmerProfileDto) {
    return this.marketplace.updateFarmerProfile(user.userId, dto);
  }

  // Public — static paths before parameterized routes
  @Get('cooperatives/list')
  getCooperatives() {
    return this.marketplace.getCooperatives();
  }

  @Get(':id')
  getPublicProfile(@Param('id') id: string) {
    return this.marketplace.getPublicProfile(id);
  }
}

@Controller('listings')
export class ListingsController {
  constructor(private readonly marketplace: MarketplaceService) {}

  // Public — browse listings
  @Get()
  getListings(@Query() query: QueryListingsDto) {
    return this.marketplace.getListings(query);
  }

  // Public — view a single listing
  @Get(':id')
  getListingById(@Param('id') id: string) {
    return this.marketplace.getListingById(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('FARMER')
  createListing(@CurrentUser() user: JwtPayload, @Body() dto: CreateListingDto) {
    return this.marketplace.createListing(user.userId, dto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('FARMER')
  updateListing(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateListingDto,
  ) {
    return this.marketplace.updateListing(user.userId, id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('FARMER')
  withdrawListing(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.marketplace.withdrawListing(user.userId, id);
  }
}
