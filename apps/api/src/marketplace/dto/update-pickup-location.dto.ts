import { PartialType } from '@nestjs/mapped-types';
import { CreatePickupLocationDto } from './create-pickup-location.dto';

export class UpdatePickupLocationDto extends PartialType(CreatePickupLocationDto) {}
