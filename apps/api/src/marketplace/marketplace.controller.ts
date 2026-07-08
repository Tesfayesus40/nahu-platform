import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { MarketplaceService } from './marketplace.service';
import { CreateFarmerProfileDto } from './dto/create-farmer-profile.dto';
import { UpdateFarmerProfileDto } from './dto/update-farmer-profile.dto';
import { CreateListingDto } from './dto/create-listing.dto';
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

  // Public — buyers browsing farmer profiles
  @Get(':id')
  getPublicProfile(@Param('id') id: string) {
    return this.marketplace.getPublicProfile(id);
  }

  @Get('cooperatives/list')
  getCooperatives() {
    return this.marketplace.getCooperatives();
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
}
