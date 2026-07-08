import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';

/**
 * @Global, same pattern as PrismaModule — registered once in AppModule,
 * then JwtService (and the JwtAuthGuard/RolesGuard that depend on it) are
 * usable from any feature module without each one re-registering JwtModule
 * itself. Package 002 originally registered this inside IdentityModule
 * only, which would have blocked Marketplace (or any later module) from
 * using JwtAuthGuard — pulled out here before that became a real problem.
 */
@Global()
@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('jwt.secret'),
        signOptions: { expiresIn: config.get<string>('jwt.expiresIn') },
      }),
    }),
  ],
  exports: [JwtModule],
})
export class JwtConfigModule {}
