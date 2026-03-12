import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DietService } from './diet.service';
import { DietController } from './diet.controller';
import { DietRecord } from './entities/diet-record.entity';
import { DietRecordItem } from './entities/diet-record-item.entity';
import { AIModule } from '../../shared/ai/ai.module';
import { UserModule } from '../user/user.module';

@Module({
  imports: [TypeOrmModule.forFeature([DietRecord, DietRecordItem]), AIModule, UserModule],
  controllers: [DietController],
  providers: [DietService],
  exports: [DietService],
})
export class DietModule {}
