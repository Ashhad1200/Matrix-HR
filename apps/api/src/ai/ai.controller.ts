import { Controller, Post, Body, UseGuards, BadRequestException } from '@nestjs/common';
import { AiService } from './ai.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { EntitlementGuard } from '../common/guards/entitlement.guard';
import { CurrentUser, RequireFeature, TenantId } from '../common/decorators';

@Controller('ai')
@UseGuards(JwtAuthGuard)
export class AiController {
  constructor(private ai: AiService) {}

  @UseGuards(EntitlementGuard)
  @RequireFeature('ai.ask')
  @Post('ask')
  ask(
    @TenantId() tenantId: string,
    @CurrentUser('employeeId') employeeId: string,
    @Body('question') question: string,
  ) {
    return this.ai.askMatrixHR(tenantId, employeeId, question);
  }

  @Post('rank-candidate')
  rankCandidate(@Body() body: { jobDescription: string; resumeText?: string; resume?: string }) {
    const resumeText = body.resumeText ?? body.resume;
    if (!resumeText || !body.jobDescription) {
      throw new BadRequestException('jobDescription and resumeText are required');
    }
    return this.ai.rankCandidate(body.jobDescription, resumeText);
  }
}
