import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ShipmentAggregateService } from './shipment-aggregate.service';
import { CourierNotificationsService } from './courier-notifications.service';
import {
  isValidEthiopianPlate,
  normalizePlateNumber,
} from './plate.rules';
import {
  SubmitVerificationDto,
  UpdateCourierProfileDto,
  UpdateNotificationPrefsDto,
  UpsertPayoutAccountDto,
  UpsertVehicleDto,
} from './dto/courier-crm.dto';
import { toUiAvailability } from './shipment.domain.rules';

const DEFAULT_PREFS: Record<string, boolean> = {
  shipmentAssigned: true,
  shipmentAccepted: true,
  pickupReminder: true,
  pickupConfirmed: true,
  deliveryStarted: true,
  deliveryCompleted: true,
  paymentReleased: true,
  verification: true,
  accountMessages: true,
  systemAnnouncements: true,
};

const ET_PHONE = /^\+251[79]\d{8}$/;

@Injectable()
export class CourierProfileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly shipments: ShipmentAggregateService,
    private readonly notifications: CourierNotificationsService,
  ) {}

  async getMe(userId: string, phone?: string | null) {
    await this.shipments.ensureCourierProfile(userId, phone);
    const [profile, user, vehicles, payouts, verification, unread] =
      await Promise.all([
        this.prisma.courierProfile.findUniqueOrThrow({ where: { userId } }),
        this.prisma.user.findUniqueOrThrow({
          where: { id: userId },
          select: {
            id: true,
            phone: true,
            email: true,
            firstName: true,
            middleName: true,
            lastName: true,
            preferredLanguage: true,
          },
        }),
        this.prisma.courierVehicle.findMany({
          where: { courierUserId: userId, deletedAt: null },
          orderBy: [{ isActive: 'desc' }, { updatedAt: 'desc' }],
        }),
        this.prisma.courierPayoutAccount.findMany({
          where: { courierUserId: userId, deletedAt: null },
          orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }],
        }),
        this.prisma.courierVerificationCase.findFirst({
          where: { courierUserId: userId },
          orderBy: { submittedAt: 'desc' },
          include: { documents: true },
        }),
        this.prisma.courierNotification.count({
          where: {
            courierUserId: userId,
            deletedAt: null,
            readAt: null,
          },
        }),
      ]);

    const activeVehicle =
      vehicles.find((v) => v.id === profile.activeVehicleId) ||
      vehicles.find((v) => v.isActive) ||
      null;
    const defaultPayout = payouts.find((p) => p.isDefault) || null;
    const prefs = {
      ...DEFAULT_PREFS,
      ...((profile.notificationPrefs as Record<string, boolean>) || {}),
    };

    return {
      userId: profile.userId,
      phone: user.phone,
      email: user.email,
      firstName: user.firstName,
      middleName: user.middleName,
      lastName: user.lastName,
      displayName:
        profile.displayName ||
        [user.firstName, user.lastName].filter(Boolean).join(' ') ||
        null,
      photoUrl: profile.photoUrl,
      gender: profile.gender,
      dateOfBirth: profile.dateOfBirth,
      emergencyContactName: profile.emergencyContactName,
      emergencyContactPhone: profile.emergencyContactPhone,
      preferredLanguage:
        profile.preferredLanguage || user.preferredLanguage || 'en',
      vehicleType: profile.vehicleType || activeVehicle?.vehicleType || null,
      vehiclePlate: activeVehicle?.plateNumber || null,
      active: profile.active,
      verified: profile.verified,
      verificationStatus: profile.verificationStatus,
      verificationRejectionReason: profile.verificationRejectionReason,
      availability: toUiAvailability(profile.availability),
      availabilityDb: profile.availability,
      serviceRegions: profile.serviceRegions,
      notificationPrefs: prefs,
      activeVehicle,
      vehicles,
      defaultPayout,
      payoutAccounts: payouts,
      verification,
      unreadNotifications: unread,
    };
  }

  async updateMe(userId: string, dto: UpdateCourierProfileDto) {
    if (dto.emergencyContactPhone && !ET_PHONE.test(dto.emergencyContactPhone)) {
      throw new BadRequestException(
        'Emergency contact phone must be +2517/9XXXXXXXX',
      );
    }
    if (dto.dateOfBirth) {
      const dob = new Date(dto.dateOfBirth);
      if (Number.isNaN(dob.getTime()) || dob >= new Date()) {
        throw new BadRequestException('dateOfBirth must be a past date');
      }
    }

    await this.shipments.ensureCourierProfile(userId);

    const userData: Prisma.UserUpdateInput = {};
    if (dto.firstName !== undefined) userData.firstName = dto.firstName.trim() || null;
    if (dto.middleName !== undefined) userData.middleName = dto.middleName.trim() || null;
    if (dto.lastName !== undefined) userData.lastName = dto.lastName.trim() || null;
    if (dto.email !== undefined) {
      const email = dto.email.trim().toLowerCase() || null;
      if (email) {
        const clash = await this.prisma.user.findFirst({
          where: { email, NOT: { id: userId } },
        });
        if (clash) throw new ConflictException('Email already in use');
      }
      userData.email = email;
    }
    if (dto.preferredLanguage !== undefined) {
      userData.preferredLanguage = dto.preferredLanguage;
    }

    const profileData: Prisma.CourierProfileUpdateInput = {
      updatedAt: new Date(),
    };
    if (dto.gender !== undefined) profileData.gender = dto.gender;
    if (dto.dateOfBirth !== undefined) {
      profileData.dateOfBirth = new Date(dto.dateOfBirth);
    }
    if (dto.emergencyContactName !== undefined) {
      profileData.emergencyContactName = dto.emergencyContactName.trim() || null;
    }
    if (dto.emergencyContactPhone !== undefined) {
      profileData.emergencyContactPhone = dto.emergencyContactPhone || null;
    }
    if (dto.preferredLanguage !== undefined) {
      profileData.preferredLanguage = dto.preferredLanguage;
    }
    if (dto.photoUrl !== undefined) profileData.photoUrl = dto.photoUrl || null;

    const first =
      dto.firstName !== undefined
        ? dto.firstName
        : (
            await this.prisma.user.findUnique({
              where: { id: userId },
              select: { firstName: true, lastName: true },
            })
          )?.firstName;
    const last =
      dto.lastName !== undefined
        ? dto.lastName
        : (
            await this.prisma.user.findUnique({
              where: { id: userId },
              select: { lastName: true },
            })
          )?.lastName;
    const display = [first, last].filter(Boolean).join(' ').trim();
    if (display) profileData.displayName = display;

    await this.prisma.$transaction(async (tx) => {
      if (Object.keys(userData).length) {
        await tx.user.update({ where: { id: userId }, data: userData });
      }
      await tx.courierProfile.update({
        where: { userId },
        data: profileData,
      });
    });

    return this.getMe(userId);
  }

  async updateNotificationPrefs(
    userId: string,
    dto: UpdateNotificationPrefsDto,
  ) {
    await this.shipments.ensureCourierProfile(userId);
    const current = await this.prisma.courierProfile.findUniqueOrThrow({
      where: { userId },
    });
    const merged = {
      ...DEFAULT_PREFS,
      ...((current.notificationPrefs as Record<string, boolean>) || {}),
      ...dto.prefs,
    };
    await this.prisma.courierProfile.update({
      where: { userId },
      data: { notificationPrefs: merged, updatedAt: new Date() },
    });
    return { notificationPrefs: merged };
  }

  // ---- Vehicles ------------------------------------------------------------

  async listVehicles(userId: string) {
    return this.prisma.courierVehicle.findMany({
      where: { courierUserId: userId, deletedAt: null },
      orderBy: [{ isActive: 'desc' }, { updatedAt: 'desc' }],
    });
  }

  async createVehicle(userId: string, dto: UpsertVehicleDto) {
    const plate = this.requirePlate(dto.plateNumber);
    await this.assertPlateUnique(plate);
    await this.shipments.ensureCourierProfile(userId);

    const vehicle = await this.prisma.courierVehicle.create({
      data: {
        courierUserId: userId,
        vehicleType: dto.vehicleType,
        brand: dto.brand?.trim() || null,
        model: dto.model?.trim() || null,
        year: dto.year ?? null,
        colour: dto.colour?.trim() || null,
        plateNumber: plate,
        registrationNumber: dto.registrationNumber?.trim() || null,
        insuranceExpiry: dto.insuranceExpiry
          ? new Date(dto.insuranceExpiry)
          : null,
        photoUrl: dto.photoUrl || null,
        isActive: false,
      },
    });

    if (dto.isActive !== false) {
      // First vehicle or explicit activate
      const count = await this.prisma.courierVehicle.count({
        where: { courierUserId: userId, deletedAt: null },
      });
      if (dto.isActive === true || count === 1) {
        return this.activateVehicle(userId, vehicle.id);
      }
    }
    return vehicle;
  }

  async updateVehicle(userId: string, id: string, dto: UpsertVehicleDto) {
    const existing = await this.requireOwnVehicle(userId, id);
    const plate = this.requirePlate(dto.plateNumber);
    await this.assertPlateUnique(plate, id);

    const updated = await this.prisma.courierVehicle.update({
      where: { id: existing.id },
      data: {
        vehicleType: dto.vehicleType,
        brand: dto.brand?.trim() || null,
        model: dto.model?.trim() || null,
        year: dto.year ?? null,
        colour: dto.colour?.trim() || null,
        plateNumber: plate,
        registrationNumber: dto.registrationNumber?.trim() || null,
        insuranceExpiry: dto.insuranceExpiry
          ? new Date(dto.insuranceExpiry)
          : null,
        photoUrl: dto.photoUrl || null,
        updatedAt: new Date(),
      },
    });

    if (dto.isActive === true) {
      return this.activateVehicle(userId, id);
    }
    if (existing.isActive) {
      await this.syncActiveVehicleOntoProfile(userId, updated);
    }
    return updated;
  }

  async deleteVehicle(userId: string, id: string) {
    const existing = await this.requireOwnVehicle(userId, id);
    await this.prisma.courierVehicle.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false, updatedAt: new Date() },
    });
    if (existing.isActive) {
      const next = await this.prisma.courierVehicle.findFirst({
        where: { courierUserId: userId, deletedAt: null },
        orderBy: { updatedAt: 'desc' },
      });
      if (next) {
        await this.activateVehicle(userId, next.id);
      } else {
        await this.prisma.courierProfile.update({
          where: { userId },
          data: {
            activeVehicleId: null,
            vehicleType: null,
            updatedAt: new Date(),
          },
        });
      }
    }
    return { ok: true };
  }

  async activateVehicle(userId: string, id: string) {
    const vehicle = await this.requireOwnVehicle(userId, id);
    await this.prisma.$transaction(async (tx) => {
      await tx.courierVehicle.updateMany({
        where: { courierUserId: userId, deletedAt: null },
        data: { isActive: false, updatedAt: new Date() },
      });
      await tx.courierVehicle.update({
        where: { id },
        data: { isActive: true, updatedAt: new Date() },
      });
      await tx.courierProfile.update({
        where: { userId },
        data: {
          activeVehicleId: id,
          vehicleType: vehicle.vehicleType,
          updatedAt: new Date(),
        },
      });
    });
    return this.requireOwnVehicle(userId, id);
  }

  // ---- Payout accounts -----------------------------------------------------

  async listPayoutAccounts(userId: string) {
    return this.prisma.courierPayoutAccount.findMany({
      where: { courierUserId: userId, deletedAt: null },
      orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }],
    });
  }

  async createPayoutAccount(userId: string, dto: UpsertPayoutAccountDto) {
    this.assertPayoutDto(dto);
    await this.shipments.ensureCourierProfile(userId);
    const count = await this.prisma.courierPayoutAccount.count({
      where: { courierUserId: userId, deletedAt: null },
    });
    const makeDefault = dto.isDefault === true || count === 0;

    return this.prisma.$transaction(async (tx) => {
      if (makeDefault) {
        await tx.courierPayoutAccount.updateMany({
          where: { courierUserId: userId, deletedAt: null },
          data: { isDefault: false, updatedAt: new Date() },
        });
      }
      return tx.courierPayoutAccount.create({
        data: {
          courierUserId: userId,
          methodType: dto.methodType,
          bankName: dto.bankName?.trim() || null,
          accountName: dto.accountName.trim(),
          accountNumber: dto.accountNumber?.trim() || null,
          phoneNumber: dto.phoneNumber?.trim() || null,
          isDefault: makeDefault,
        },
      });
    });
  }

  async updatePayoutAccount(
    userId: string,
    id: string,
    dto: UpsertPayoutAccountDto,
  ) {
    this.assertPayoutDto(dto);
    await this.requireOwnPayout(userId, id);
    return this.prisma.$transaction(async (tx) => {
      if (dto.isDefault === true) {
        await tx.courierPayoutAccount.updateMany({
          where: { courierUserId: userId, deletedAt: null },
          data: { isDefault: false, updatedAt: new Date() },
        });
      }
      return tx.courierPayoutAccount.update({
        where: { id },
        data: {
          methodType: dto.methodType,
          bankName: dto.bankName?.trim() || null,
          accountName: dto.accountName.trim(),
          accountNumber: dto.accountNumber?.trim() || null,
          phoneNumber: dto.phoneNumber?.trim() || null,
          isDefault: dto.isDefault === true ? true : undefined,
          updatedAt: new Date(),
        },
      });
    });
  }

  async deletePayoutAccount(userId: string, id: string) {
    const existing = await this.requireOwnPayout(userId, id);
    await this.prisma.courierPayoutAccount.update({
      where: { id },
      data: { deletedAt: new Date(), isDefault: false, updatedAt: new Date() },
    });
    if (existing.isDefault) {
      const next = await this.prisma.courierPayoutAccount.findFirst({
        where: { courierUserId: userId, deletedAt: null },
        orderBy: { updatedAt: 'desc' },
      });
      if (next) {
        await this.prisma.courierPayoutAccount.update({
          where: { id: next.id },
          data: { isDefault: true, updatedAt: new Date() },
        });
      }
    }
    return { ok: true };
  }

  // ---- Verification --------------------------------------------------------

  async getVerification(userId: string) {
    const profile = await this.prisma.courierProfile.findUnique({
      where: { userId },
    });
    const latest = await this.prisma.courierVerificationCase.findFirst({
      where: { courierUserId: userId },
      orderBy: { submittedAt: 'desc' },
      include: { documents: true },
    });
    return {
      status: profile?.verificationStatus || 'NOT_SUBMITTED',
      rejectionReason: profile?.verificationRejectionReason || null,
      case: latest,
    };
  }

  async submitVerification(userId: string, dto: SubmitVerificationDto) {
    if (dto.documentType !== 'PASSPORT' && !dto.backImageUrl) {
      throw new BadRequestException('Back image is required for this document type');
    }
    await this.shipments.ensureCourierProfile(userId);

    const pending = await this.prisma.courierVerificationCase.findFirst({
      where: { courierUserId: userId, status: 'PENDING' },
    });
    if (pending) {
      throw new ConflictException('A verification case is already pending review');
    }

    const docs: { side: string; fileUrl: string }[] = [
      { side: 'FRONT', fileUrl: dto.frontImageUrl },
      { side: 'SELFIE', fileUrl: dto.selfieImageUrl },
    ];
    if (dto.backImageUrl) {
      docs.push({ side: 'BACK', fileUrl: dto.backImageUrl });
    }

    const created = await this.prisma.$transaction(async (tx) => {
      const c = await tx.courierVerificationCase.create({
        data: {
          courierUserId: userId,
          documentType: dto.documentType,
          documentNumber: dto.documentNumber.trim().toUpperCase(),
          status: 'PENDING',
          documents: {
            create: docs.map((d) => ({
              side: d.side,
              fileUrl: d.fileUrl,
            })),
          },
        },
        include: { documents: true },
      });
      await tx.courierProfile.update({
        where: { userId },
        data: {
          verificationStatus: 'PENDING',
          verificationRejectionReason: null,
          verified: false,
          updatedAt: new Date(),
        },
      });
      return c;
    });

    return created;
  }

  async approveVerification(caseId: string, adminUserId: string) {
    const c = await this.prisma.courierVerificationCase.findUnique({
      where: { id: caseId },
      include: { documents: true },
    });
    if (!c) throw new NotFoundException('Verification case not found');
    if (c.status !== 'PENDING') {
      throw new BadRequestException('Case is not pending');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.courierVerificationCase.update({
        where: { id: caseId },
        data: {
          status: 'APPROVED',
          reviewedAt: new Date(),
          reviewedBy: adminUserId,
          rejectionReason: null,
          updatedAt: new Date(),
        },
      });
      await tx.courierProfile.update({
        where: { userId: c.courierUserId },
        data: {
          verificationStatus: 'APPROVED',
          verificationRejectionReason: null,
          verified: true,
          updatedAt: new Date(),
        },
      });
    });

    await this.notifications.notifyVerification(c.courierUserId, true);
    return this.prisma.courierVerificationCase.findUnique({
      where: { id: caseId },
      include: { documents: true },
    });
  }

  async rejectVerification(
    caseId: string,
    adminUserId: string,
    reason: string,
  ) {
    const c = await this.prisma.courierVerificationCase.findUnique({
      where: { id: caseId },
    });
    if (!c) throw new NotFoundException('Verification case not found');
    if (c.status !== 'PENDING') {
      throw new BadRequestException('Case is not pending');
    }
    const trimmed = reason.trim();
    if (trimmed.length < 3) {
      throw new BadRequestException('Rejection reason is required');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.courierVerificationCase.update({
        where: { id: caseId },
        data: {
          status: 'REJECTED',
          reviewedAt: new Date(),
          reviewedBy: adminUserId,
          rejectionReason: trimmed,
          updatedAt: new Date(),
        },
      });
      await tx.courierProfile.update({
        where: { userId: c.courierUserId },
        data: {
          verificationStatus: 'REJECTED',
          verificationRejectionReason: trimmed,
          verified: false,
          updatedAt: new Date(),
        },
      });
    });

    await this.notifications.notifyVerification(c.courierUserId, false, trimmed);
    return this.prisma.courierVerificationCase.findUnique({
      where: { id: caseId },
      include: { documents: true },
    });
  }

  async listVerifications(query: {
    status?: string;
    page?: number;
    limit?: number;
  }) {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 20, 100);
    const where: Prisma.CourierVerificationCaseWhereInput = {};
    if (query.status) where.status = query.status;

    const [items, total] = await Promise.all([
      this.prisma.courierVerificationCase.findMany({
        where,
        include: {
          documents: true,
        },
        orderBy: { submittedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.courierVerificationCase.count({ where }),
    ]);

    // Enrich with courier phone/name
    const userIds = [...new Set(items.map((i) => i.courierUserId))];
    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds } },
      select: {
        id: true,
        phone: true,
        firstName: true,
        lastName: true,
        email: true,
      },
    });
    const byId = new Map(users.map((u) => [u.id, u]));

    return {
      items: items.map((item) => ({
        ...item,
        courier: byId.get(item.courierUserId) || null,
      })),
      page,
      limit,
      total,
    };
  }

  async getVerificationCase(id: string) {
    const item = await this.prisma.courierVerificationCase.findUnique({
      where: { id },
      include: { documents: true },
    });
    if (!item) throw new NotFoundException('Verification case not found');
    const courier = await this.prisma.user.findUnique({
      where: { id: item.courierUserId },
      select: {
        id: true,
        phone: true,
        firstName: true,
        middleName: true,
        lastName: true,
        email: true,
      },
    });
    return { ...item, courier };
  }

  // ---- helpers -------------------------------------------------------------

  private requirePlate(raw: string) {
    const plate = normalizePlateNumber(raw);
    if (!isValidEthiopianPlate(plate)) {
      throw new BadRequestException(
        'Invalid Ethiopian plate number. Use format like AA-12345 or OR-1-23456.',
      );
    }
    return plate;
  }

  private async assertPlateUnique(plate: string, excludeId?: string) {
    const clash = await this.prisma.courierVehicle.findFirst({
      where: {
        deletedAt: null,
        plateNumber: { equals: plate, mode: 'insensitive' },
        ...(excludeId ? { NOT: { id: excludeId } } : {}),
      },
    });
    if (clash) {
      throw new ConflictException('Plate number already registered');
    }
  }

  private async requireOwnVehicle(userId: string, id: string) {
    const v = await this.prisma.courierVehicle.findFirst({
      where: { id, courierUserId: userId, deletedAt: null },
    });
    if (!v) throw new NotFoundException('Vehicle not found');
    return v;
  }

  private async requireOwnPayout(userId: string, id: string) {
    const p = await this.prisma.courierPayoutAccount.findFirst({
      where: { id, courierUserId: userId, deletedAt: null },
    });
    if (!p) throw new NotFoundException('Payout account not found');
    return p;
  }

  private assertPayoutDto(dto: UpsertPayoutAccountDto) {
    const bankLike = ['BANK_ACCOUNT', 'COMMERCIAL_BANK', 'CHAPA'].includes(
      dto.methodType,
    );
    const mobileLike = ['TELEBIRR', 'CBE_BIRR'].includes(dto.methodType);
    if (bankLike && !dto.accountNumber?.trim()) {
      throw new BadRequestException('Account number is required for bank methods');
    }
    if (mobileLike) {
      if (!dto.phoneNumber || !ET_PHONE.test(dto.phoneNumber)) {
        throw new BadRequestException(
          'Valid +251 phone is required for mobile money methods',
        );
      }
    }
  }

  private async syncActiveVehicleOntoProfile(
    userId: string,
    vehicle: { id: string; vehicleType: string },
  ) {
    await this.prisma.courierProfile.update({
      where: { userId },
      data: {
        activeVehicleId: vehicle.id,
        vehicleType: vehicle.vehicleType,
        updatedAt: new Date(),
      },
    });
  }
}
