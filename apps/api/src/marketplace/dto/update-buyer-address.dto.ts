import { PartialType } from '@nestjs/mapped-types';
import { CreateBuyerAddressDto } from './create-buyer-address.dto';

export class UpdateBuyerAddressDto extends PartialType(CreateBuyerAddressDto) {}
