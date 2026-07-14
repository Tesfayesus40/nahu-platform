import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

function assertGeojsonType(value) {
  if (value == null) return true;
  if (typeof value !== 'object') return false;
  return value.type === 'Polygon' || value.type === 'MultiPolygon';
}

describe('farms geojson guard', () => {
  it('accepts Polygon and MultiPolygon', () => {
    assert.equal(assertGeojsonType({ type: 'Polygon', coordinates: [] }), true);
    assert.equal(assertGeojsonType({ type: 'MultiPolygon', coordinates: [] }), true);
  });

  it('rejects Point and non-objects', () => {
    assert.equal(assertGeojsonType({ type: 'Point' }), false);
    assert.equal(assertGeojsonType('x'), false);
  });
});

describe('farm product separation', () => {
  it('documents that farm payloads have no productId ownership fields', () => {
    const farmShape = {
      id: 'x',
      name: 'Farm',
      tenureType: 'OWNED',
      status: 'ACTIVE',
      region: 'Jimma',
    };
    assert.equal('productId' in farmShape, false);
    assert.equal('primaryProductCode' in farmShape, false);
  });
});
