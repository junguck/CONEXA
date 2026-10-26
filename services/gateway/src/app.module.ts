import { Module } from '@nestjs/common';
import { HealthModule } from '@conexa/service-kit';

@Module({
  imports: [HealthModule.forRoot(async () => true)],
})
export class AppModule {}
