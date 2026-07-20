import json, urllib.request
from pathlib import Path

base = 'https://nahu-api-staging.up.railway.app/api/v1'
phone = '+251911000001'

def post(path, body):
    req = urllib.request.Request(
        base + path,
        data=json.dumps(body).encode('utf-8'),
        headers={'Content-Type': 'application/json'},
        method='POST',
    )
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode('utf-8'))

def get(path, token):
    req = urllib.request.Request(
        base + path,
        headers={'Authorization': f'Bearer {token}'},
        method='GET',
    )
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode('utf-8'))

otp_res = post('/auth/request-otp', {'phone': phone, 'role': 'FARMER'})
otp = otp_res.get('dev_otp') or otp_res.get('devOtp') or '123456'
verify = post('/auth/verify-otp', {'phone': phone, 'otp': otp, 'role': 'FARMER'})
token = verify.get('access_token') or verify.get('accessToken') or verify.get('token')
if not token and isinstance(verify.get('data'), dict):
    token = verify['data'].get('access_token') or verify['data'].get('accessToken')
assert token, verify

types = get('/activity-types', token)
data = types['data'] if isinstance(types, dict) else types
expected = {
    'PLANTING': 'መትከል',
    'SPRAYING': 'ርጭት',
    'WEEDING': 'አረም ማረም',
    'PRUNING': 'ግርዛት',
    'SCOUTING': 'የማሳ ምርመራ',
}
ok = bad = 0
lines = ['code|nameEn|nameAm|check']
for t in data:
    code = t['code']
    am = t['nameAm']
    mark = 'OK'
    if code in expected:
        if am == expected[code]:
            ok += 1
        else:
            mark = f'MISMATCH got={am!r} want={expected[code]!r}'
            bad += 1
    lines.append(f"{code}|{t['nameEn']}|{am}|{mark}")

out = Path(r'C:\NahuAI\nahu-platform\docs\08-guides\_am_api_check.txt')
out.write_text(f'ok={ok} bad={bad} total={len(data)}\n' + '\n'.join(lines) + '\n', encoding='utf-8')
Path(r'C:\NahuAI\nahu-platform\docs\08-guides\_am_api_types.json').write_text(
    json.dumps(types, ensure_ascii=False, indent=2), encoding='utf-8'
)
print(f'ok={ok} bad={bad} total={len(data)}')
