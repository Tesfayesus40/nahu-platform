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

const SAMPLE_PRICES: Record<string, { grade1: number; grade2: number }> = {
  Yirgacheffe: { grade1: 285, grade2: 245 },
  Sidama: { grade1: 270, grade2: 235 },
  Jimma: { grade1: 250, grade2: 215 },
  Harrar: { grade1: 295, grade2: 260 },
};

const REGION_ALIASES: Record<string, string> = {
  yirgacheffe: 'Yirgacheffe',
  'ይርጋጨፌ': 'Yirgacheffe',
  yirga: 'Yirgacheffe',
  sidama: 'Sidama',
  'ሲዳማ': 'Sidama',
  jimma: 'Jimma',
  'ጅማ': 'Jimma',
  harrar: 'Harrar',
  harar: 'Harrar',
  'ሐረር': 'Harrar',
};

@Injectable()
export class AdvisoryService {
  private readonly logger = new Logger(AdvisoryService.name);
  private client: any = null;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  private get hasAnthropicKey(): boolean {
    return !!this.config.get<string>('anthropic.apiKey');
  }

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

  private normalizeRegion(region: string): string {
    const trimmed = decodeURIComponent(region).trim();
    const lower = trimmed.toLowerCase();
    return REGION_ALIASES[trimmed] ?? REGION_ALIASES[lower] ?? trimmed;
  }

  private staticPriceAdvice(region: string, prices: { grade1: number; grade2: number }): string {
    return (
      `የ${region} ቡና ዋጋ ዛሬ በECX: ደረጃ 1 ${prices.grade1} ብር/ኪ.ግ፣ ደረጃ 2 ${prices.grade2} ብር/ኪ.ግ። ` +
      'ዋጋ በክልል እና በቀን ይለዋወጣል። ከቀጥሎ ሳምንት ገበያ ትንተና ከመሸጥዎ በፊት ይመልከቱ። ' +
      'ቡናዎን ከብዛት ጋር በሚስማማ ዋጋ ለመሸጥ ዝግጁ ከሆኑ ለመሸጥ ጥሩ ጊዜ ሊሆን ይችላል።'
    );
  }

  private staticAnswer(message: string, language: string): string {
    const lower = message.toLowerCase();
    const amharic = language === 'amharic' || language === 'am';

    if (lower.includes('price') || lower.includes('ዋጋ') || lower.includes('ሸጥ')) {
      return amharic
        ? 'ዋጋ በክልል፣ በደረጃ እና በገበያ ቀን ይለዋወጣል። ከመሸጥዎ በፊት የዛሬ ዋጋ ቁልፍን ይጫኑ። ቡናዎን ከብዙ ገዢዎች ጋር ከመወያየት በኋላ ይሽጡ።'
        : 'Prices vary by region, grade, and market day. Use the price button before selling, and compare offers from multiple buyers.';
    }

    if (lower.includes('pest') || lower.includes('ተባይ') || lower.includes('ብጥብጥ')) {
      return amharic
        ? 'ተባዮችን ለመከላከል የቡና ቅጠላዎችን በደንብ ይጠብቁ፣ ጥሩ አየር መተላለፍ ያረጋግጡ፣ እና የቡና ዛፎችን በመደበኛ ይቁረጡ። ሲታዩ ችግሮችን ወዲያውኑ ያሳውቁ።'
        : 'Prevent pests by keeping the farm clean, ensuring good airflow, and pruning regularly. Report problems early.';
    }

    if (lower.includes('grade') || lower.includes('ደረጃ')) {
      return amharic
        ? 'ደረጃ 1 ለማግኘት ቡናን በጥራት ይምረጡ፣ ጥሩ ማብሰል/ማጠብ ያድርጉ፣ እና በንጹህ ሁኔታ ያቀርቡ። ጥራት ቀጣይነት ዋጋን ይጨምራል።'
        : 'For Grade 1, select cherries carefully, process consistently, and deliver clean coffee. Quality consistency raises your price.';
    }

    return amharic
      ? 'እኔ የቡና ምክር ረዳት ነኝ። ስለ ዋጋ፣ ማብሰል፣ ተባዮች እና ደረጃ ጥያቄዎችን መጠየቅ ይችላሉ። የዛሬ ዋጋ ቁልፍንም ይሞክሩ።'
      : 'I am your coffee advisory assistant. Ask about prices, processing, pests, or grading. Try the today\'s price button too.';
  }

  async askAdvisor(userId: string, dto: AskAdvisorDto) {
    if (!this.hasAnthropicKey) {
      return {
        answer: this.staticAnswer(dto.message, dto.language ?? 'amharic'),
        language: dto.language,
        fallback: true,
      };
    }

    const farmer = await this.prisma.farmerProfile.findUnique({ where: { userId } });

    const context = farmer
      ? `Farmer location: ${farmer.region}, ${farmer.zone ?? ''}, altitude: ${farmer.altitudeM ?? 'unknown'}m`
      : 'Farmer location: Ethiopia';

    const fullMessage = `${context}\n\nFarmer question: ${dto.message}`;
    const model = this.config.get<string>('anthropic.model');

    try {
      const response = await this.getClient().messages.create({
        model,
        max_tokens: 400,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: fullMessage }],
      });

      return {
        answer: response.content[0].text,
        language: dto.language,
        fallback: false,
      };
    } catch (err) {
      this.logger.warn(`Advisory AI unavailable: ${(err as Error).message}`);
      return {
        answer: this.staticAnswer(dto.message, dto.language ?? 'amharic'),
        language: dto.language,
        fallback: true,
      };
    }
  }

  async getPriceAlert(region: string) {
    const canonical = this.normalizeRegion(region);
    const prices = SAMPLE_PRICES[canonical] ?? SAMPLE_PRICES['Yirgacheffe'];

    if (!this.hasAnthropicKey) {
      return {
        region: canonical,
        prices,
        advice: this.staticPriceAdvice(canonical, prices),
        updatedAt: new Date().toISOString(),
        fallback: true,
      };
    }

    const model = this.config.get<string>('anthropic.model');
    const prompt = `Current ECX coffee prices for ${canonical}:
Grade 1: ${prices.grade1} ETB/kg
Grade 2: ${prices.grade2} ETB/kg
In 2 sentences in Amharic, tell the farmer if this is a good time to sell
and what to watch for in the coming week.`;

    try {
      const response = await this.getClient().messages.create({
        model,
        max_tokens: 200,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: prompt }],
      });

      return {
        region: canonical,
        prices,
        advice: response.content[0].text,
        updatedAt: new Date().toISOString(),
        fallback: false,
      };
    } catch (err) {
      this.logger.warn(`Price alert AI unavailable: ${(err as Error).message}`);
      return {
        region: canonical,
        prices,
        advice: this.staticPriceAdvice(canonical, prices),
        updatedAt: new Date().toISOString(),
        fallback: true,
      };
    }
  }

  getServiceCatalog() {
    return {
      services: [
        {
          id: 'ai_chat',
          status: 'active',
          nameEn: 'AI Advisor',
          nameAm: 'የቡና ምክር',
          descriptionEn: 'Ask questions about your coffee',
          descriptionAm: 'ስለ ቡናዎ ጥያቄ ይጠይቁ',
          icon: '🌱',
        },
        {
          id: 'coffee_prices',
          status: 'active',
          nameEn: 'Coffee Prices',
          nameAm: 'የቡና ዋጋ',
          descriptionEn: 'ECX price snapshot',
          descriptionAm: 'የECX ዋጋ ማጠቃለያ',
          icon: '📊',
        },
        {
          id: 'weather',
          status: 'preview',
          nameEn: 'Weather',
          nameAm: 'የአየር ሁኔታ',
          descriptionEn: 'Rain and temperature outlook',
          descriptionAm: 'ዝናብ እና ሙቀት ትንበያ',
          icon: '🌦️',
        },
        {
          id: 'disease_alerts',
          status: 'preview',
          nameEn: 'Disease Alerts',
          nameAm: 'የበሽታ ማስጠንቀቂያ',
          descriptionEn: 'Regional pest and disease watch',
          descriptionAm: 'ክልላዊ ተባዮች እና በሽታዎች',
          icon: '⚠️',
        },
        {
          id: 'harvest',
          status: 'preview',
          nameEn: 'Harvest Tips',
          nameAm: 'የመከዝ ምክር',
          descriptionEn: 'When and how to harvest',
          descriptionAm: 'መቼ እና እንዴት ማጨድ',
          icon: '🌾',
        },
      ],
    };
  }

  async getWeatherOutlook(region: string) {
    const canonical = this.normalizeRegion(region);
    return {
      region: canonical,
      status: 'preview',
      summary:
        `${canonical} ክልል — በቀጣዩ ሳምንት ቀን መካከል ቀላል ዝናብ እና ማታ ቀዝቃዛ አየር ይጠበቃል። ` +
        'የቡና ዛፎችን ከበሽታ ለመከላከል ጥሩ አየር መተላለፍ ያረጋግጡ። ይህ ቅድመ-ተዘጋጅ መረጃ ነው።',
      updatedAt: new Date().toISOString(),
      fallback: true,
    };
  }

  async getDiseaseAlerts(userId: string) {
    const farmer = await this.prisma.farmerProfile.findUnique({ where: { userId } });
    const region = farmer?.region ?? 'Ethiopia';

    return {
      region,
      status: 'preview',
      alerts: [
        {
          titleAm: 'ቡና ቅጠል ዝብብሽ',
          titleEn: 'Coffee leaf rust',
          level: 'watch',
          adviceAm: 'የቅጠላ ቀለምን ይቆጣጠሩ። አየር መተላለፍ ያሻሽሉ።',
          adviceEn: 'Monitor leaf colour. Improve airflow between trees.',
        },
        {
          titleAm: 'ተባዮች',
          titleEn: 'Berry borer watch',
          level: 'low',
          adviceAm: 'ቡና ከመቀመጥ በፊት ጥራት ይመርጡ።',
          adviceEn: 'Sort cherries carefully before storage.',
        },
      ],
      updatedAt: new Date().toISOString(),
      fallback: true,
    };
  }

  async getHarvestRecommendations(userId: string) {
    const farmer = await this.prisma.farmerProfile.findUnique({ where: { userId } });
    const altitude = farmer?.altitudeM ? `${farmer.altitudeM}m` : 'your area';

    return {
      status: 'preview',
      summary:
        `በ${altitude} ከፍታ ላይ ቡናን በቀስቱ ሲበስሉ ለመከዝ ዝግጁ ይሆናሉ። ` +
        'ቀይ ፍሬዎችን ብቻ ይምረጡ፣ በፀሐይ ላይ በቀጥታ አይደርቁ። ይህ ቅድመ-ተዘጋጅ መረጃ ነው።',
      summaryEn:
        `Cherries at ${altitude} are approaching harvest window. Pick only ripe red cherries and avoid drying in direct sun. Preview tips only.`,
      updatedAt: new Date().toISOString(),
      fallback: true,
    };
  }
}
