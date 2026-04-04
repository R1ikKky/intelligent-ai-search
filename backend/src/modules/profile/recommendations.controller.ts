import { Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { ProfileService } from './profile.service';
import { BootstrapResponseDto } from './dto/bootstrap-response.dto';

@ApiTags('Recommendations')
@ApiBearerAuth()
@Controller('recommendations')
export class RecommendationsController {
  constructor(private readonly profileService: ProfileService) {}

  @Post('bootstrap')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Cold-start: профиль + стартовые подсказки из похожих организаций (ETL)',
  })
  async bootstrap(@CurrentUser() user: JwtPayload): Promise<BootstrapResponseDto> {
    return this.profileService.bootstrap(user);
  }
}
