import { PartialType } from '@nestjs/mapped-types';
import { CreateFarmerProfileDto } from './create-farmer-profile.dto';

export class UpdateFarmerProfileDto extends PartialType(CreateFarmerProfileDto) {}
