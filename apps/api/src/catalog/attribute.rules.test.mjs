import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

/** Mirrors apps/api/src/catalog/attribute.rules.ts */
function validateAttributeInputs(definitions, inputs, opts = {}) {
  const enforceRequired = opts.enforceRequired ?? true;
  const byCode = new Map(definitions.map((d) => [d.code.toLowerCase(), d]));
  for (const [code] of inputs) {
    if (!byCode.has(code.toLowerCase())) {
      throw new Error(`Unknown attribute: ${code}`);
    }
  }
  for (const def of definitions) {
    const raw = inputs.get(def.code.toLowerCase());
    const missing =
      raw === undefined || raw === null || (typeof raw === 'string' && raw.trim() === '');
    if (enforceRequired && def.isRequired && missing) {
      throw new Error(`Attribute ${def.code} is required`);
    }
    if (missing) continue;
    const rules = def.validationJson || {};
    if (def.dataType === 'ENUM') {
      const fromDef = (def.enumCodes || []).map((c) => c.toUpperCase());
      const fromRules = (rules.enum || []).map((c) => String(c).toUpperCase());
      const allowed = fromDef.length ? fromDef : fromRules;
      if (allowed.length && !allowed.includes(String(raw).toUpperCase())) {
        throw new Error(`Attribute ${def.code} invalid enum`);
      }
    }
    if (def.dataType === 'TEXT') {
      const text = String(raw);
      if (rules.minLength != null && text.length < rules.minLength) throw new Error('minLength');
      if (rules.maxLength != null && text.length > rules.maxLength) throw new Error('maxLength');
      if (rules.regex && !new RegExp(rules.regex).test(text)) throw new Error('regex');
    }
    if (def.dataType === 'DECIMAL' || def.dataType === 'NUMBER') {
      const num = Number(raw);
      if (!Number.isFinite(num)) throw new Error(`Attribute ${def.code} must be numeric`);
      if (rules.min != null && num < rules.min) throw new Error('min');
      if (rules.max != null && num > rules.max) throw new Error('max');
    }
  }
}

describe('attribute.rules', () => {
  const defs = [
    {
      code: 'quality_grade',
      dataType: 'ENUM',
      isRequired: true,
      enumCodes: ['GRADE_1', 'GRADE_2'],
    },
    {
      code: 'moisture_pct',
      dataType: 'DECIMAL',
      isRequired: false,
      validationJson: { min: 0, max: 100 },
    },
    {
      code: 'variety',
      dataType: 'TEXT',
      isRequired: false,
      validationJson: { minLength: 2, maxLength: 40, regex: '^[A-Za-z ]+$' },
    },
  ];

  it('requires quality_grade when enforceRequired', () => {
    assert.throws(() => validateAttributeInputs(defs, new Map()));
  });

  it('accepts valid enum and numeric range', () => {
    const inputs = new Map([
      ['quality_grade', 'GRADE_1'],
      ['moisture_pct', 12.5],
    ]);
    assert.doesNotThrow(() => validateAttributeInputs(defs, inputs));
  });

  it('rejects out-of-range moisture', () => {
    const inputs = new Map([
      ['quality_grade', 'GRADE_1'],
      ['moisture_pct', 150],
    ]);
    assert.throws(() => validateAttributeInputs(defs, inputs));
  });

  it('rejects text shorter than minLength', () => {
    const inputs = new Map([
      ['quality_grade', 'GRADE_1'],
      ['variety', 'A'],
    ]);
    assert.throws(() => validateAttributeInputs(defs, inputs));
  });

  it('rejects text failing regex', () => {
    const inputs = new Map([
      ['quality_grade', 'GRADE_1'],
      ['variety', 'Heirloom1'],
    ]);
    assert.throws(() => validateAttributeInputs(defs, inputs));
  });
});
