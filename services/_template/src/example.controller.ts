import { Controller, Get, UseGuards } from '@nestjs/common';
import type { JwtClaims } from '@conexa/contracts';
import { CurrentUser, JwtAuthGuard, Public } from '@conexa/service-kit';

@Controller('template')
export class ExampleController {
  @Public()
  @Get('ping')
  ping(): { status: 'ok' } {
    return { status: 'ok' };
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@CurrentUser() user: JwtClaims): { user_id: string; roles: string[] } {
    return { user_id: user.sub, roles: user.roles };
  }
}
