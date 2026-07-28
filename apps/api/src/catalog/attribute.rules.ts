/**
 * Pure validation helpers for G3/G4 listing attributes.
 */

export type AttributeDataType =
  | 'TEXT'
  | 'NUMBER'
  | 'DECIMAL'
  | 'BOOLEAN'
  | 'DATE'
  | 'ENUM';

export type AttributeValidationJson = {
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
  regex?: string;
  /** Allowed enum codes (optional; prefers definition.enumCodes when set). */
  enum?: string[];
};

export type AttributeDefinitionLike = {
  code: string;
  dataType: AttributeDataType;
  isRequired: boolean;
  validationJson?: AttributeValidationJson | null;
  enumCodes?: string[];
};

export type AttributeInputValue = {
  code: string;
  value?: string | number | boolean | null;
};

export class AttributeValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AttributeValidationError';
  }
}

export function coerceAttributePayload(
  inputs: AttributeInputValue[] | undefined,
): Map<string, string | number | boolean | null> {
  const map = new Map<string, string | number | boolean | null>();
  for (const item of inputs ?? []) {
    if (!item?.code) continue;
    map.set(String(item.code).toLowerCase(), item.value ?? null);
  }
  return map;
}

/**
 * Validates attribute inputs against definitions.
 * Required checks apply when `enforceRequired` is true (e.g. coffee publish).
 */
export function validateAttributeInputs(
  definitions: AttributeDefinitionLike[],
  inputs: Map<string, string | number | boolean | null>,
  opts: { enforceRequired?: boolean } = {},
): void {
  const enforceRequired = opts.enforceRequired ?? true;
  const byCode = new Map(definitions.map((d) => [d.code.toLowerCase(), d]));

  for (const [code] of inputs) {
    if (!byCode.has(code.toLowerCase())) {
      throw new AttributeValidationError(`Unknown attribute: ${code}`);
    }
  }

  for (const def of definitions) {
    const raw = inputs.get(def.code.toLowerCase());
    const missing =
      raw === undefined || raw === null || (typeof raw === 'string' && raw.trim() === '');

    if (enforceRequired && def.isRequired && missing) {
      throw new AttributeValidationError(`Attribute ${def.code} is required`);
    }
    if (missing) continue;

    const rules = (def.validationJson ?? {}) as AttributeValidationJson;

    switch (def.dataType) {
      case 'TEXT': {
        const text = String(raw);
        if (rules.minLength != null && text.length < rules.minLength) {
          throw new AttributeValidationError(
            `Attribute ${def.code} is shorter than minLength ${rules.minLength}`,
          );
        }
        if (rules.maxLength != null && text.length > rules.maxLength) {
          throw new AttributeValidationError(
            `Attribute ${def.code} exceeds maxLength ${rules.maxLength}`,
          );
        }
        if (rules.regex) {
          const re = new RegExp(rules.regex);
          if (!re.test(text)) {
            throw new AttributeValidationError(
              `Attribute ${def.code} failed regex validation`,
            );
          }
        }
        break;
      }
      case 'NUMBER':
      case 'DECIMAL': {
        const num = typeof raw === 'number' ? raw : Number(raw);
        if (!Number.isFinite(num)) {
          throw new AttributeValidationError(`Attribute ${def.code} must be numeric`);
        }
        if (rules.min != null && num < rules.min) {
          throw new AttributeValidationError(
            `Attribute ${def.code} must be >= ${rules.min}`,
          );
        }
        if (rules.max != null && num > rules.max) {
          throw new AttributeValidationError(
            `Attribute ${def.code} must be <= ${rules.max}`,
          );
        }
        break;
      }
      case 'BOOLEAN': {
        if (typeof raw !== 'boolean' && raw !== 'true' && raw !== 'false') {
          throw new AttributeValidationError(`Attribute ${def.code} must be boolean`);
        }
        break;
      }
      case 'DATE': {
        const d = new Date(String(raw));
        if (Number.isNaN(d.getTime())) {
          throw new AttributeValidationError(`Attribute ${def.code} must be a date`);
        }
        break;
      }
      case 'ENUM': {
        const code = String(raw).toUpperCase();
        const fromDef = (def.enumCodes ?? []).map((c) => c.toUpperCase());
        const fromRules = (rules.enum ?? []).map((c) => String(c).toUpperCase());
        const allowed = fromDef.length ? fromDef : fromRules;
        if (allowed.length && !allowed.includes(code)) {
          throw new AttributeValidationError(
            `Attribute ${def.code} must be one of: ${allowed.join(', ')}`,
          );
        }
        break;
      }
      default:
        break;
    }
  }
}

/** Map coffee legacy listing fields into attribute input codes. */
export function coffeeColumnsToAttributeInputs(listing: {
  grade?: string | null;
  processMethod?: string | null;
  variety?: string | null;
  region?: string | null;
  washingStation?: string | null;
  altitudeM?: number | null;
  cupScore?: number | null;
  moisturePct?: number | null;
  screenSize?: string | null;
}): AttributeInputValue[] {
  const out: AttributeInputValue[] = [];
  if (listing.grade != null) out.push({ code: 'quality_grade', value: listing.grade });
  if (listing.processMethod != null) {
    out.push({ code: 'process_method', value: listing.processMethod });
  }
  if (listing.variety != null) out.push({ code: 'variety', value: listing.variety });
  if (listing.region != null) out.push({ code: 'origin_region', value: listing.region });
  if (listing.washingStation != null) {
    out.push({ code: 'washing_station', value: listing.washingStation });
  }
  if (listing.altitudeM != null) out.push({ code: 'altitude_m', value: listing.altitudeM });
  if (listing.cupScore != null) out.push({ code: 'cup_score', value: listing.cupScore });
  if (listing.moisturePct != null) {
    out.push({ code: 'moisture_pct', value: listing.moisturePct });
  }
  if (listing.screenSize != null) out.push({ code: 'screen_size', value: listing.screenSize });
  return out;
}
