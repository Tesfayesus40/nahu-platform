/**
 * Pure builders for G4 listing schema / form / search metadata.
 * Engine: nahu.form.v1 (see docs/09-platform-evolution/19-d5-form-schema-specification.md)
 */

export type ShapedAttributeDefinition = {
  code: string;
  nameEn: string;
  nameAm?: string | null;
  dataType: string;
  scope?: string;
  isRequired: boolean;
  isFilterable?: boolean;
  isFacetable?: boolean;
  isListedInCard?: boolean;
  isVisible?: boolean;
  isEditable?: boolean;
  isSortable?: boolean;
  searchFilterType?: string;
  controlType?: string;
  helpTextEn?: string | null;
  helpTextAm?: string | null;
  placeholderEn?: string | null;
  placeholderAm?: string | null;
  sectionCode?: string | null;
  sectionNameEn?: string | null;
  sectionNameAm?: string | null;
  unitCode?: string | null;
  unitDimension?: string | null;
  validation?: Record<string, unknown>;
  legacyColumn?: string | null;
  sortOrder: number;
  enumSetCode?: string | null;
  enumValues?: Array<{
    code: string;
    nameEn: string;
    nameAm?: string | null;
    sortOrder?: number;
  }>;
};

export type ListingSchemaCategory = {
  code: string;
  nameEn: string;
  nameAm?: string | null;
  verticalCode: string;
  listingKind: string;
  sellEnabled?: boolean;
};

const VALUE_TYPE: Record<string, string> = {
  TEXT: 'string',
  NUMBER: 'number',
  DECIMAL: 'number',
  BOOLEAN: 'boolean',
  DATE: 'string',
  ENUM: 'string',
};

function snakeToCamel(code: string): string {
  return code.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
}

function buildValidators(def: ShapedAttributeDefinition) {
  const validators: Array<Record<string, unknown>> = [];
  if (def.isRequired) {
    validators.push({ type: 'required' });
  }
  const v = def.validation ?? {};
  if (v.min != null) validators.push({ type: 'min', value: v.min });
  if (v.max != null) validators.push({ type: 'max', value: v.max });
  if (v.minLength != null) validators.push({ type: 'minLength', value: v.minLength });
  if (v.maxLength != null) validators.push({ type: 'maxLength', value: v.maxLength });
  if (v.regex) validators.push({ type: 'regex', pattern: v.regex });
  if (def.dataType === 'ENUM' && def.enumSetCode) {
    validators.push({ type: 'inEnum', enumSetCode: def.enumSetCode });
  }
  return validators;
}

function attributeToField(def: ShapedAttributeDefinition) {
  const control = def.controlType || inferControl(def.dataType);
  const field: Record<string, unknown> = {
    key: snakeToCamel(def.code),
    binding: {
      type: 'attribute',
      attributeCode: def.code,
      ...(def.legacyColumn ? { legacyColumn: def.legacyColumn } : {}),
    },
    control,
    valueType: VALUE_TYPE[def.dataType] ?? 'string',
    required: def.isRequired,
    editable: def.isEditable !== false,
    visible: def.isVisible !== false,
    labelEn: def.nameEn,
    labelAm: def.nameAm ?? null,
    helpEn: def.helpTextEn ?? null,
    helpAm: def.helpTextAm ?? null,
    placeholderEn: def.placeholderEn ?? null,
    placeholderAm: def.placeholderAm ?? null,
    labelKey: `attrs.${def.code}`,
    helpKey: def.helpTextEn ? `attrs.${def.code}.help` : null,
    unit: def.unitCode ? { code: def.unitCode, dimension: def.unitDimension } : null,
    validators: buildValidators(def),
    sortOrder: def.sortOrder,
    search: {
      filterable: Boolean(def.isFilterable),
      facet: Boolean(def.isFacetable),
      sortable: Boolean(def.isSortable),
      filterType: def.searchFilterType ?? 'NONE',
    },
  };

  if (def.dataType === 'ENUM' || control === 'select') {
    field.options = {
      source: 'enum',
      enumSetCode: def.enumSetCode,
      values: def.enumValues ?? [],
    };
  }

  return field;
}

function inferControl(dataType: string): string {
  switch (dataType) {
    case 'ENUM':
      return 'select';
    case 'BOOLEAN':
      return 'boolean';
    case 'DATE':
      return 'date';
    case 'NUMBER':
    case 'DECIMAL':
      return 'number';
    default:
      return 'text';
  }
}

/** Core listing.create fields shared across categories (not category attributes). */
export function buildCoreListingCreateFields(): Array<Record<string, unknown>> {
  return [
    {
      key: 'quantity',
      binding: { type: 'core', path: 'quantity' },
      control: 'unitQuantity',
      valueType: 'number',
      required: true,
      editable: true,
      visible: true,
      labelEn: 'Quantity',
      labelKey: 'fields.quantity',
      validators: [{ type: 'required' }, { type: 'min', value: 0.001 }],
      sortOrder: 0,
    },
    {
      key: 'unitCode',
      binding: { type: 'core', path: 'unitCode' },
      control: 'select',
      valueType: 'string',
      required: true,
      editable: true,
      visible: true,
      labelEn: 'Unit',
      labelKey: 'fields.unitCode',
      options: { source: 'units' },
      validators: [{ type: 'required' }],
      sortOrder: 1,
    },
    {
      key: 'pricePerUnit',
      binding: { type: 'core', path: 'pricePerUnit' },
      control: 'money',
      valueType: 'number',
      required: true,
      editable: true,
      visible: true,
      labelEn: 'Price per unit (ETB)',
      labelKey: 'fields.pricePerUnit',
      validators: [{ type: 'required' }, { type: 'min', value: 0 }],
      sortOrder: 2,
    },
    {
      key: 'offerDate',
      binding: { type: 'core', path: 'offerDate' },
      control: 'date',
      valueType: 'string',
      required: false,
      editable: true,
      visible: true,
      labelEn: 'Offer / harvest date',
      labelKey: 'fields.offerDate',
      validators: [],
      sortOrder: 3,
    },
  ];
}

export function groupAttributesIntoSections(attributes: ShapedAttributeDefinition[]) {
  const visible = attributes.filter((a) => a.isVisible !== false);
  const sectionMap = new Map<
    string,
    {
      id: string;
      titleEn: string;
      titleAm: string | null;
      titleKey: string;
      fields: Array<Record<string, unknown>>;
      minSort: number;
    }
  >();

  for (const def of visible) {
    const id = def.sectionCode || 'details';
    let section = sectionMap.get(id);
    if (!section) {
      section = {
        id,
        titleEn: def.sectionNameEn || 'Details',
        titleAm: def.sectionNameAm ?? null,
        titleKey: `forms.listing.sections.${id}`,
        fields: [],
        minSort: def.sortOrder,
      };
      sectionMap.set(id, section);
    }
    section.minSort = Math.min(section.minSort, def.sortOrder);
    section.fields.push(attributeToField(def));
  }

  return [...sectionMap.values()]
    .sort((a, b) => a.minSort - b.minSort || a.id.localeCompare(b.id))
    .map(({ minSort: _m, ...rest }) => ({
      ...rest,
      fields: rest.fields.sort(
        (a, b) => Number(a.sortOrder ?? 0) - Number(b.sortOrder ?? 0),
      ),
    }));
}

export function collectEnumerations(attributes: ShapedAttributeDefinition[]) {
  const enums: Record<
    string,
    Array<{ code: string; nameEn: string; nameAm?: string | null; sortOrder?: number }>
  > = {};
  for (const def of attributes) {
    if (!def.enumSetCode || !def.enumValues?.length) continue;
    if (!enums[def.enumSetCode]) {
      enums[def.enumSetCode] = def.enumValues.map((v) => ({
        code: v.code,
        nameEn: v.nameEn,
        nameAm: v.nameAm ?? null,
        sortOrder: v.sortOrder,
      }));
    }
  }
  return enums;
}

export function buildSearchMetadata(attributes: ShapedAttributeDefinition[]) {
  const filters = attributes
    .filter(
      (a) =>
        a.isFilterable ||
        (a.searchFilterType && a.searchFilterType !== 'NONE'),
    )
    .map((a) => ({
      code: a.code,
      nameEn: a.nameEn,
      nameAm: a.nameAm ?? null,
      dataType: a.dataType,
      filterType: a.searchFilterType ?? (a.dataType === 'ENUM' ? 'ENUM' : 'TEXT'),
      rangeSupported:
        (a.searchFilterType ?? '') === 'RANGE' ||
        a.dataType === 'NUMBER' ||
        a.dataType === 'DECIMAL',
      enumerationSupported: a.dataType === 'ENUM',
      enumSetCode: a.enumSetCode ?? null,
      enumValues: a.dataType === 'ENUM' ? a.enumValues ?? [] : [],
      sortable: Boolean(a.isSortable),
      facetable: Boolean(a.isFacetable),
      sortOrder: a.sortOrder,
    }))
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const sortable = attributes
    .filter((a) => a.isSortable)
    .map((a) => ({
      code: a.code,
      nameEn: a.nameEn,
      dataType: a.dataType,
      sortOrder: a.sortOrder,
    }))
    .sort((a, b) => a.sortOrder - b.sortOrder);

  return { filters, sortable };
}

/**
 * Presentation-friendly listing attribute for detail pages.
 */
export function shapePresentationAttribute(value: {
  code: string;
  nameEn: string;
  nameAm?: string | null;
  dataType: string;
  value: string | number | boolean | null;
  enumCode?: string | null;
  enumNameEn?: string | null;
  enumNameAm?: string | null;
  unitCode?: string | null;
  sectionCode?: string | null;
  sectionNameEn?: string | null;
  sortOrder?: number;
  isListedInCard?: boolean;
  displayOrder?: number;
}) {
  const displayValue =
    value.enumNameEn ??
    (value.enumCode != null ? String(value.enumCode) : null) ??
    (value.value == null ? null : String(value.value));

  return {
    code: value.code,
    nameEn: value.nameEn,
    nameAm: value.nameAm ?? null,
    dataType: value.dataType,
    value: value.value,
    displayValue,
    enumCode: value.enumCode ?? null,
    enumNameEn: value.enumNameEn ?? null,
    enumNameAm: value.enumNameAm ?? null,
    unitCode: value.unitCode ?? null,
    sectionCode: value.sectionCode ?? null,
    sectionNameEn: value.sectionNameEn ?? null,
    sortOrder: value.sortOrder ?? value.displayOrder ?? 0,
    isListedInCard: Boolean(value.isListedInCard),
  };
}

export function buildListingSchemaResponse(opts: {
  schemaId?: string;
  category: ListingSchemaCategory;
  attributes: ShapedAttributeDefinition[];
  units: Array<Record<string, unknown>>;
  version?: string;
}) {
  const schemaId = opts.schemaId || 'listing.create';
  const attributes = [...opts.attributes].sort(
    (a, b) => a.sortOrder - b.sortOrder || a.code.localeCompare(b.code),
  );
  const attributeSections = groupAttributesIntoSections(attributes);
  const sections =
    schemaId === 'listing.create' || schemaId === 'listing.edit'
      ? [
          {
            id: 'core',
            titleEn: 'Listing',
            titleAm: null,
            titleKey: 'forms.listing.sections.core',
            fields: buildCoreListingCreateFields(),
          },
          ...attributeSections,
        ]
      : attributeSections;

  const search = buildSearchMetadata(attributes);

  return {
    engine: 'nahu.form.v1',
    schemaId,
    version: opts.version ?? '1.0.0',
    verticalCode: opts.category.verticalCode,
    categoryCode: opts.category.code,
    listingKind: opts.category.listingKind,
    category: opts.category,
    attributes,
    validation: Object.fromEntries(
      attributes.map((a) => [
        a.code,
        {
          required: a.isRequired,
          dataType: a.dataType,
          ...(a.validation ?? {}),
          ...(a.dataType === 'ENUM' && a.enumSetCode
            ? { enumSetCode: a.enumSetCode }
            : {}),
        },
      ]),
    ),
    units: opts.units,
    enumerations: collectEnumerations(attributes),
    displayOrder: attributes.map((a) => a.code),
    sections,
    search,
    submit: {
      buildPayload: 'listing.v1',
    },
  };
}
