import { Module } from '@nestjs/common';
import { IdentityController } from './identity.controller';
import { IdentityService } from './identity.service';
import { SmsService } from './sms/sms.service';

// JwtModule no longer registered here -- JwtService is now provided
// globally by JwtConfigModule (see app.module.ts), so any feature module
// (Marketplace, etc.) can use JwtAuthGuard without re-registering JWT.
@Module({
  controllers: [IdentityController],
  providers: [IdentityService, SmsService],
  exports: [IdentityService],
})
export class IdentityModule {}
