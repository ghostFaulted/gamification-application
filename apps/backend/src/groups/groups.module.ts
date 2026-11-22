import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DrizzleGroupsRepository, GroupsRepository } from '../db';
import { CoursesController } from './courses.controller';
import { GroupsController } from './groups.controller';
import { GroupsService } from './groups.service';

@Module({
  imports: [AuthModule],
  controllers: [CoursesController, GroupsController],
  providers: [
    GroupsService,
    {
      provide: GroupsRepository,
      useClass: DrizzleGroupsRepository,
    },
  ],
  exports: [GroupsService, GroupsRepository],
})
export class GroupsModule {}
