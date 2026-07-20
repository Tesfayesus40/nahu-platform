import json
import urllib.error
import urllib.request
from pathlib import Path

base = 'https://nahu-api-staging.up.railway.app/api/v1'
phone = '+251911000001'
out = Path(r'C:\NahuAI\nahu-platform\docs\08-guides\_am_farmer_smoke.txt')

EXPECTED = {
    'PLANTING': 'መትከል',
    'SPRAYING': 'ርጭት',
    'WEEDING': 'አረም ማረም',
    'PRUNING': 'ግርዛት',
    'SCOUTING': 'የማሳ ምርመራ',
}


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
    if isinstance(payload, dict) and 'data' in payload:
        return payload['data']
    return payload


def main():
    lines = []
    otp_res = req('POST', '/auth/request-otp', {'phone': phone, 'role': 'FARMER'})
    otp = otp_res.get('dev_otp') or otp_res.get('devOtp') or '123456'
    verify = req('POST', '/auth/verify-otp', {'phone': phone, 'otp': otp, 'role': 'FARMER'})
    token = (
        verify.get('access_token')
        or verify.get('accessToken')
        or verify.get('token')
    )
    if not token and isinstance(verify.get('data'), dict):
        token = verify['data'].get('access_token') or verify['data'].get('accessToken')
    if not token:
        raise SystemExit(f'No token in verify response keys={list(verify.keys())}')

    # Ensure farmer profile exists (same path as ProfileSetupScreen).
    try:
        profile = unwrap(req('GET', '/farmers/profile', token=token))
        lines.append('profile=existing')
    except RuntimeError as e:
        if '404' not in str(e) and 'not found' not in str(e).lower():
            # Some APIs return 400 without profile — try create anyway.
            lines.append(f'profile_get_note={str(e)[:120]}')
        profile = unwrap(
            req(
                'POST',
                '/farmers/profile',
                {
                    'firstName': 'Amharic',
                    'fathersName': 'Smoke',
                    'region': 'Oromia',
                    'zone': 'Jimma',
                    'woreda': 'Goma',
                    'primaryLanguage': 'አማርኛ',
                },
                token=token,
            )
        )
        lines.append('profile=created')

    # Farms list / create (same path as FarmsScreen / FarmFormScreen).
    try:
        farms_payload = unwrap(req('GET', '/farms/mine', token=token))
    except RuntimeError as e:
        lines.append(f'farms_mine_error={str(e)[:200]}')
        raise

    farm_list = farms_payload
    if isinstance(farm_list, dict):
        farm_list = farm_list.get('data') or farm_list.get('items') or farm_list.get('farms') or []
    if not isinstance(farm_list, list):
        farm_list = []

    if farm_list:
        farm_id = farm_list[0]['id']
        lines.append('farm=existing')
    else:
        farm = unwrap(
            req(
                'POST',
                '/farms',
                {
                    'name': 'Amharic Label Smoke Farm',
                    'nameAm': 'የአማርኛ ምልክት ማረጋገጫ እርሻ',
                    'region': 'Oromia',
                    'zone': 'Jimma',
                    'woreda': 'Goma',
                },
                token=token,
            )
        )
        farm_id = farm['id']
        lines.append('farm=created')

    types = unwrap(req('GET', '/activity-types', token=token))
    form_ok = all(
        next(t['nameAm'] for t in types if t['code'] == c) == am
        for c, am in EXPECTED.items()
    )
    lines.append(f'form_picker_ok={form_ok}')
    for c, am in EXPECTED.items():
        got = next(t['nameAm'] for t in types if t['code'] == c)
        lines.append(f'type|{c}|{got}|{"OK" if got == am else "BAD"}')

    created = unwrap(
        req(
            'POST',
            f'/farms/{farm_id}/activities',
            {
                'activityTypeCode': 'SPRAYING',
                'occurredOn': '2026-07-17',
                'notes': 'Amharic label smoke',
            },
            token=token,
        )
    )
    act_id = created['id']
    detail = unwrap(req('GET', f'/farm-activities/{act_id}', token=token))
    listed = unwrap(req('GET', f'/farms/{farm_id}/activities', token=token))
    items = listed
    if isinstance(items, dict):
        items = items.get('data') or items.get('items') or []
    first = next((x for x in items if x.get('id') == act_id), items[0] if items else {})

    spray_am = (
        detail.get('activityTypeNameAm')
        or created.get('activityTypeNameAm')
        or first.get('activityTypeNameAm')
    )
    spray_match = spray_am == 'ርጭት'
    lines.extend(
        [
            f'farm_id={farm_id}',
            f'activity_id={act_id}',
            f'created_type_am={created.get("activityTypeNameAm")}',
            f'list_type_am={first.get("activityTypeNameAm")}',
            f'detail_type_am={detail.get("activityTypeNameAm")}',
            f'spray_match={spray_match}',
            'ui_form=FarmActivityFormScreen: language===am ? t.nameAm : t.nameEn',
            'ui_list=FarmActivitiesScreen: activityTypeNameAm',
            'ui_detail=FarmActivityDetailScreen: activityTypeNameAm',
        ]
    )
    passed = form_ok and spray_match
    lines.insert(0, f'result={"PASS" if passed else "FAIL"}')
    out.write_text('\n'.join(lines) + '\n', encoding='utf-8')
    # Avoid Windows console charmap crashes on Amharic — file is source of truth.
    print('PASS' if passed else 'FAIL')
    for line in lines:
        safe = line.encode('ascii', 'backslashreplace').decode('ascii')
        print(safe)


if __name__ == '__main__':
    try:
        main()
    except Exception as exc:
        msg = str(exc)
        out.write_text(f'ERROR\n{msg}\n', encoding='utf-8')
        print('ERROR:', msg.encode('ascii', 'backslashreplace').decode('ascii'))
        raise SystemExit(1)
