import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { AskAdvisorDto } from './dto/ask-advisor.dto';

const SYSTEM_PROMPT = `You are an agricultural advisor for Ethiopian coffee farmers.
Always respond in Amharic (አማርኛ) unless the user writes in another language.
Keep answers practical, short (3-5 sentences), and actionable.
You have knowledge of:
- Ethiopian coffee regions: Yirgacheffe, Sidama, Jimma, Harrar, Bench Maji, Kaffa
- Ethiopian seasons: Kiremt (June-Sept), Belg (Feb-May), Bega (dry season)
- Coffee processing: washed, natural, honey methods
- Common coffee pests and diseases in Ethiopian highlands
- Coffee grading: Grade 1, 2, 3 and cup scoring
- Market prices at ECX (Ethiopian Commodity Exchange)
- Cooperative structures: YCFCU, SCFCU and others

When giving price advice, remind farmers prices vary by region and day.
Never give advice that could harm the farmer financially.
Always be encouraging and respectful.`;

// Placeholder data — in production, fetch real ECX prices instead.
const SAMPLE_PRICES: Record<string, { grade1: number; grade2: number }> = {
  Yirgacheffe: { grade1: 285, grade2: 245 },
  Sidama: { grade1: 270, grade2: 235 },
  Jimma: { grade1: 250, grade2: 215 },
  Harrar: { grade1: 295, grade2: 260 },
};

@Injectable()
export class AdvisoryService {
  private readonly logger = new Logger(AdvisoryService.name);
  private client: any = null;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  private getClient() {
    if (!this.client) {
      const apiKey = this.config.get<string>('anthropic.apiKey');
      if (!apiKey) {
        throw new Error('ANTHROPIC_API_KEY must be set to use the advisory module.');
      }
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const Anthropic = require('@anthropic-ai/sdk');
      this.client = new Anthropic({ apiKey });
    }
    return this.client;
  }

  async askAdvisor(userId: string, dto: AskAdvisorDto) {
    const farmer = await this.prisma.farmerProfile.findUnique({ where: { userId } });

    const context = farmer
      ? `Farmer location: ${farmer.region}, ${farmer.zone ?? ''}, altitude: ${farmer.altitudeM ?? 'unknown'}m`
      : 'Farmer location: Ethiopia';

    const fullMessage = `${context}\n\nFarmer question: ${dto.message}`;
    const model = this.config.get<string>('anthropic.model');

    const response = await this.getClient().messages.create({
      model,
      max_tokens: 400,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: fullMessage }],
    });

    return {
      answer: response.content[0].text,
      language: dto.language,
    };
  }

  async getPriceAlert(region: string) {
    const prices = SAMPLE_PRICES[region] ?? SAMPLE_PRICES['Yirgacheffe'];
    const model = this.config.get<string>('anthropic.model');

    const prompt = `Current ECX coffee prices for ${region}:
Grade 1: ${prices.grade1} ETB/kg
Grade 2: ${prices.grade2} ETB/kg
In 2 sentences in Amharic, tell the farmer if this is a good time to sell
and what to watch for in the coming week.`;

    const response = await this.getClient().messages.create({
      model,
      max_tokens: 200,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: prompt }],
    });

    return {
      region,
      prices,
      advice: response.content[0].text,
      updatedAt: new Date().toISOString(),
    };
  }
}
