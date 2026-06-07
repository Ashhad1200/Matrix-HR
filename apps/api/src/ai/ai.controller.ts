import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { AiService } from './ai.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser, TenantId } from '../common/decorators';

@Controller('ai')
@UseGuards(JwtAuthGuard)
export class AiController {
  constructor(private ai: AiService) {}

  @Post('ask')
  ask(
    @TenantId() tenantId: string,
    @CurrentUser('employeeId') employeeId: string,
    @Body('question') question: string,
  ) {
    return this.ai.askMatrixHR(tenantId, employeeId, question);
  }

  @Post('rank-candidate')
  rankCandidate(@Body() body: { jobDescription: string; resumeText: string }) {
    return this.ai.rankCandidate(body.jobDescription, body.resumeText);
  }
}
