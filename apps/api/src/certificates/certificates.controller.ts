import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { CertificatesService } from './certificates.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayload } from '../common/jwt-payload.interface';

@Controller('certificates')
export class CertificatesController {
  constructor(private readonly certificates: CertificatesService) {}

  @Get('order/:orderId')
  @UseGuards(JwtAuthGuard)
  getCertificate(@Param('orderId') orderId: string, @CurrentUser() user: JwtPayload) {
    return this.certificates.getCertificateForRequester(orderId, user.userId);
  }

  // Public — anyone with the certificate number can verify authenticity.
  @Get('verify/:certNumber')
  verifyCertificate(@Param('certNumber') certNumber: string) {
    return this.certificates.verifyCertificate(certNumber);
  }
}
