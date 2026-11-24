import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DrizzleGroupsRepository, GroupsRepository } from '../db';
import { UsersModule } from '../users/users.module';
import { CoursesController } from './courses.controller';
import { GroupsController } from './groups.controller';
import { GroupsService } from './groups.service';

@Module({
  imports: [AuthModule, UsersModule],
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
