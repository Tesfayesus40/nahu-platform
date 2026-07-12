import { Injectable } from '@nestjs/common';

export type PaymentProviderStatus = 'active' | 'coming_soon';

export interface PaymentMethodInfo {
  code: string;
  nameEn: string;
  nameAm: string;
  status: PaymentProviderStatus;
  brandColor: string;
  icon: string;
}

const PAYMENT_METHODS: PaymentMethodInfo[] = [
  {
    code: 'TELEBIRR',
    nameEn: 'Telebirr',
    nameAm: 'ቴሌብር',
    status: 'active',
    brandColor: '#0066CC',
    icon: '📱',
  },
  {
    code: 'CBE_BIRR',
    nameEn: 'CBE Birr',
    nameAm: 'ሲቢኢ ብር',
    status: 'active',
    brandColor: '#7B2D8E',
    icon: '🏦',
  },
  {
    code: 'MPESA',
    nameEn: 'M-Pesa',
    nameAm: 'ኤም-ፔሳ',
    status: 'coming_soon',
    brandColor: '#00A651',
    icon: '💚',
  },
  {
    code: 'CHAPA',
    nameEn: 'Chapa',
    nameAm: 'ቻፓ',
    status: 'coming_soon',
    brandColor: '#6C3CE9',
    icon: '💳',
  },
  {
    code: 'SANTIMPAY',
    nameEn: 'SantimPay',
    nameAm: 'ሳንቲምፔይ',
    status: 'coming_soon',
    brandColor: '#F59E0B',
    icon: '🪙',
  },
];

@Injectable()
export class PaymentsService {
  listMethods() {
    return {
      methods: PAYMENT_METHODS,
      activeCodes: PAYMENT_METHODS.filter(m => m.status === 'active').map(m => m.code),
    };
  }

  getMethod(code: string) {
    return PAYMENT_METHODS.find(m => m.code === code.toUpperCase()) ?? null;
  }

  isActive(code: string): boolean {
    const method = this.getMethod(code);
    return method?.status === 'active';
  }
}
