import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

/** Mirrors apps/api/src/catalog/listing-schema.rules.ts (selected helpers). */

function groupAttributesIntoSections(attributes) {
  const visible = attributes.filter((a) => a.isVisible !== false);
  const sectionMap = new Map();
  for (const def of visible) {
    const id = def.sectionCode || 'details';
    let section = sectionMap.get(id);
    if (!section) {
      section = {
        id,
        titleEn: def.sectionNameEn || 'Details',
        fields: [],
        minSort: def.sortOrder,
      };
      sectionMap.set(id, section);
    }
    section.minSort = Math.min(section.minSort, def.sortOrder);
    section.fields.push({
      key: def.code,
      binding: { type: 'attribute', attributeCode: def.code },
      control: def.controlType || 'text',
      required: def.isRequired,
      sortOrder: def.sortOrder,
      validators: def.isRequired ? [{ type: 'required' }] : [],
    });
  }
  return [...sectionMap.values()]
    .sort((a, b) => a.minSort - b.minSort || a.id.localeCompare(b.id))
    .map(({ minSort, ...rest }) => rest);
}

function collectEnumerations(attributes) {
  const enums = {};
  for (const def of attributes) {
    if (!def.enumSetCode || !def.enumValues?.length) continue;
    if (!enums[def.enumSetCode]) enums[def.enumSetCode] = def.enumValues;
  }
  return enums;
}

function buildSearchMetadata(attributes) {
  const filters = attributes
    .filter(
      (a) => a.isFilterable || (a.searchFilterType && a.searchFilterType !== 'NONE'),
    )
    .map((a) => ({
      code: a.code,
      filterType: a.searchFilterType ?? 'TEXT',
      rangeSupported:
        a.searchFilterType === 'RANGE' ||
        a.dataType === 'NUMBER' ||
        a.dataType === 'DECIMAL',
      enumerationSupported: a.dataType === 'ENUM',
      sortable: Boolean(a.isSortable),
    }));
  const sortable = attributes
    .filter((a) => a.isSortable)
    .map((a) => ({ code: a.code }));
  return { filters, sortable };
}

function buildListingSchemaResponse({ schemaId, category, attributes, units }) {
  const sorted = [...attributes].sort((a, b) => a.sortOrder - b.sortOrder);
  const attributeSections = groupAttributesIntoSections(sorted);
  const sections =
    schemaId === 'listing.create'
      ? [{ id: 'core', fields: [{ key: 'quantity' }] }, ...attributeSections]
      : attributeSections;
  return {
    engine: 'nahu.form.v1',
    schemaId,
    categoryCode: category.code,
    category,
    attributes: sorted,
    validation: Object.fromEntries(
      sorted.map((a) => [
        a.code,
        { required: a.isRequired, dataType: a.dataType, ...(a.validation || {}) },
      ]),
    ),
    units,
    enumerations: collectEnumerations(sorted),
    displayOrder: sorted.map((a) => a.code),
    sections,
    search: buildSearchMetadata(sorted),
  };
}

function shapePresentationAttribute(value) {
  const displayValue =
    value.enumNameEn ??
    (value.enumCode != null ? String(value.enumCode) : null) ??
    (value.value == null ? null : String(value.value));
  return {
    code: value.code,
    displayValue,
    sectionCode: value.sectionCode ?? null,
    isListedInCard: Boolean(value.isListedInCard),
  };
}

const coffeeAttrs = [
  {
    code: 'quality_grade',
    nameEn: 'Quality Grade',
    dataType: 'ENUM',
    isRequired: true,
    isFilterable: true,
    isVisible: true,
    isSortable: true,
    searchFilterType: 'ENUM',
    controlType: 'select',
    sectionCode: 'quality',
    sectionNameEn: 'Quality',
    sortOrder: 10,
    enumSetCode: 'COFFEE_GRADE',
    enumValues: [{ code: 'GRADE_1', nameEn: 'Grade 1' }],
    validation: {},
  },
  {
    code: 'moisture_pct',
    nameEn: 'Moisture %',
    dataType: 'DECIMAL',
    isRequired: false,
    isFilterable: true,
    isVisible: true,
    isSortable: true,
    searchFilterType: 'RANGE',
    controlType: 'number',
    sectionCode: 'specs',
    sectionNameEn: 'Specifications',
    sortOrder: 20,
    validation: { min: 0, max: 100 },
  },
  {
    code: 'hidden_internal',
    nameEn: 'Internal',
    dataType: 'TEXT',
    isRequired: false,
    isVisible: false,
    searchFilterType: 'NONE',
    controlType: 'hidden',
    sortOrder: 99,
    validation: {},
  },
];

describe('listing-schema.rules', () => {
  it('builds listing schema with category, sections, units, enums, displayOrder', () => {
    const schema = buildListingSchemaResponse({
      schemaId: 'listing.create',
      category: {
        code: 'COFFEE',
        nameEn: 'Coffee',
        verticalCode: 'AGRICULTURE',
        listingKind: 'GOODS',
      },
      attributes: coffeeAttrs,
      units: [{ code: 'KG', nameEn: 'Kilogram' }],
    });

    assert.equal(schema.engine, 'nahu.form.v1');
    assert.equal(schema.categoryCode, 'COFFEE');
    assert.deepEqual(schema.displayOrder, [
      'quality_grade',
      'moisture_pct',
      'hidden_internal',
    ]);
    assert.ok(schema.enumerations.COFFEE_GRADE?.length === 1);
    assert.equal(schema.validation.moisture_pct.min, 0);
    assert.equal(schema.validation.quality_grade.required, true);

    const sectionIds = schema.sections.map((s) => s.id);
    assert.ok(sectionIds.includes('core'));
    assert.ok(sectionIds.includes('quality'));
    assert.ok(sectionIds.includes('specs'));
    assert.ok(!sectionIds.includes('details'));

    const quality = schema.sections.find((s) => s.id === 'quality');
    assert.equal(quality.fields[0].binding.attributeCode, 'quality_grade');
    assert.equal(quality.fields[0].control, 'select');
  });

  it('exposes search metadata with range and enum filters', () => {
    const meta = buildSearchMetadata(coffeeAttrs);
    assert.equal(meta.filters.length, 2);
    const grade = meta.filters.find((f) => f.code === 'quality_grade');
    assert.equal(grade.filterType, 'ENUM');
    assert.equal(grade.enumerationSupported, true);
    const moisture = meta.filters.find((f) => f.code === 'moisture_pct');
    assert.equal(moisture.rangeSupported, true);
    assert.equal(meta.sortable.length, 2);
  });

  it('shapes presentation-friendly listing attribute values', () => {
    const shaped = shapePresentationAttribute({
      code: 'quality_grade',
      value: 'GRADE_1',
      enumCode: 'GRADE_1',
      enumNameEn: 'Grade 1',
      sectionCode: 'quality',
      isListedInCard: true,
    });
    assert.equal(shaped.displayValue, 'Grade 1');
    assert.equal(shaped.sectionCode, 'quality');
    assert.equal(shaped.isListedInCard, true);
  });
});
