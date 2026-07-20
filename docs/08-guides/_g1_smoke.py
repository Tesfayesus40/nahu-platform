import json
import urllib.error
import urllib.request
from pathlib import Path

base = 'https://nahu-api-staging.up.railway.app/api/v1'
phone = '+251911000001'
out = Path(r'C:\NahuAI\nahu-platform\docs\08-guides\_g1_smoke.txt')
lines = []


def req(method, path, body=None, token=None):
    headers = {'Content-Type': 'application/json'}
    if token:
        headers['Authorization'] = f'Bearer {token}'
    data = None if body is None else json.dumps(body).encode('utf-8')
    r = urllib.request.Request(base + path, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(r, timeout=60) as resp:
            raw = resp.read().decode('utf-8')
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        err = e.read().decode('utf-8', errors='replace')
        raise RuntimeError(f'{method} {path} -> {e.code}: {err}') from e


def unwrap(payload):
    if isinstance(payload, dict) and 'data' in payload and not isinstance(payload.get('id'), str):
        return payload['data']
    return payload


def check_contract(listing, label):
    required = [
        'quantity', 'unitCode', 'pricePerUnit', 'qualityGrade',
        'quantityKg', 'pricePerKg', 'grade', 'processMethod', 'extensions',
    ]
    missing = [k for k in required if k not in listing]
    coffee = (listing.get('extensions') or {}).get('coffee') or {}
    coffee_ok = all(k in coffee for k in ('processMethod', 'cupScore', 'washingStation', 'cooperative', 'altitudeM', 'variety'))
    packaging_present = 'packagingLabel' in listing and 'packagingQuantity' in listing
    lines.append(f'{label}_missing={missing}')
    lines.append(f'{label}_coffee_ext_ok={coffee_ok}')
    lines.append(f'{label}_packaging_keys={packaging_present}')
    lines.append(f'{label}_quantity={listing.get("quantity")}')
    lines.append(f'{label}_unitCode={listing.get("unitCode")}')
    lines.append(f'{label}_pricePerUnit={listing.get("pricePerUnit")}')
    lines.append(f'{label}_qualityGrade={listing.get("qualityGrade")}')
    lines.append(f'{label}_grade={listing.get("grade")}')
    lines.append(f'{label}_quantityKg={listing.get("quantityKg")}')
    return not missing and coffee_ok and packaging_present


def main():
    otp_res = req('POST', '/auth/request-otp', {'phone': phone, 'role': 'FARMER'})
    otp = otp_res.get('dev_otp') or otp_res.get('devOtp') or '123456'
    verify = req('POST', '/auth/verify-otp', {'phone': phone, 'otp': otp, 'role': 'FARMER'})
    token = verify.get('access_token') or verify.get('accessToken') or verify.get('token')
    if not token and isinstance(verify.get('data'), dict):
        token = verify['data'].get('access_token') or verify['data'].get('accessToken')
    if not token:
        raise SystemExit('no token')

    existing = unwrap(req('GET', '/listings?limit=5', token=token))
    if isinstance(existing, dict):
        existing = existing.get('data') or existing.get('items') or []
    lines.append(f'existing_count={len(existing)}')
    existing_ok = True
    if existing:
        existing_ok = check_contract(existing[0], 'existing')
    else:
        lines.append('existing_none=True')

    legacy = unwrap(req('POST', '/listings', {
        'region': 'ጅማ',
        'regionEn': 'Jimma',
        'woreda': 'Goma',
        'washingStation': 'G1 Legacy Station',
        'cooperative': 'G1 Legacy Coop',
        'grade': 'GRADE_2',
        'processMethod': 'WASHED',
        'quantityKg': 25,
        'pricePerKg': 310,
        'harvestDate': '2026-07-17',
        'altitudeM': 1800,
        'cupScore': 84,
        'variety': 'Heirloom',
    }, token=token))
    legacy_ok = check_contract(legacy, 'legacy')
    legacy_dual = (
        legacy.get('unitCode') == 'KG'
        and float(legacy.get('quantity') or 0) == 25
        and float(legacy.get('pricePerUnit') or 0) == 310
        and legacy.get('qualityGrade') == 'GRADE_2'
        and (legacy.get('extensions') or {}).get('coffee', {}).get('processMethod') == 'WASHED'
    )
    lines.append(f'legacy_dual_write_ok={legacy_dual}')

    modern = unwrap(req('POST', '/listings', {
        'productCode': 'ETHIOPIAN_ARABICA_COFFEE',
        'region': 'ይርጋጨፌ',
        'regionEn': 'Yirgacheffe',
        'woreda': 'Kochere',
        'quantity': 40,
        'unitCode': 'KG',
        'pricePerUnit': 280,
        'packagingLabel': 'bag',
        'packagingQuantity': 40,
        'qualityGrade': 'GRADE_1',
        'processMethod': 'NATURAL',
        'washingStation': 'G1 Modern Station',
        'cooperative': 'G1 Modern Coop',
        'harvestDate': '2026-07-17',
        'altitudeM': 1900,
        'cupScore': 86,
        'variety': 'Heirloom',
    }, token=token))
    modern_ok = check_contract(modern, 'modern')
    modern_dual = (
        modern.get('unitCode') == 'KG'
        and float(modern.get('quantity') or 0) == 40
        and float(modern.get('quantityKg') or 0) == 40
        and float(modern.get('pricePerUnit') or 0) == 280
        and float(modern.get('pricePerKg') or 0) == 280
        and modern.get('packagingLabel') == 'bag'
        and float(modern.get('packagingQuantity') or 0) == 40
        and modern.get('qualityGrade') == 'GRADE_1'
        and modern.get('grade') == 'GRADE_1'
        and (modern.get('extensions') or {}).get('coffee', {}).get('washingStation') == 'G1 Modern Station'
    )
    lines.append(f'modern_dual_write_ok={modern_dual}')

    mine = unwrap(req('GET', '/listings/mine', token=token))
    if isinstance(mine, dict):
        mine = mine.get('data') or mine.get('items') or []
    mine_ids = {x.get('id') for x in mine}
    mine_ok = legacy.get('id') in mine_ids and modern.get('id') in mine_ids
    lines.append(f'mine_contains_created={mine_ok}')

    passed = existing_ok and legacy_ok and legacy_dual and modern_ok and modern_dual and mine_ok
    lines.insert(0, f'result={"PASS" if passed else "FAIL"}')
    out.write_text('\n'.join(lines) + '\n', encoding='utf-8')
    print('PASS' if passed else 'FAIL')
    for line in lines:
        print(line.encode('ascii', 'backslashreplace').decode('ascii'))


if __name__ == '__main__':
    try:
        main()
    except Exception as exc:
        out.write_text(f'ERROR\n{exc}\n', encoding='utf-8')
        print('ERROR:', str(exc).encode('ascii', 'backslashreplace').decode('ascii'))
        raise SystemExit(1)
