"""B2 E2E API path: search → listing → seller → modern order → pay → complete → cert."""
import json
import urllib.error
import urllib.request
from pathlib import Path

base = 'https://nahu-api-staging.up.railway.app/api/v1'
farmer_phone = '+251911000001'
buyer_phone = '+251911000002'
out = Path(r'C:\NahuAI\nahu-platform\docs\08-guides\_b2_e2e_smoke.txt')
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
    if isinstance(payload, dict) and 'data' in payload and 'id' not in payload:
        return payload['data']
    return payload


def login(phone, role):
    otp_res = req('POST', '/auth/request-otp', {'phone': phone, 'role': role})
    otp = otp_res.get('dev_otp') or otp_res.get('devOtp') or '123456'
    verify = req('POST', '/auth/verify-otp', {'phone': phone, 'otp': otp, 'role': role})
    token = verify.get('access_token') or verify.get('accessToken') or verify.get('token')
    if not token and isinstance(verify.get('data'), dict):
        token = verify['data'].get('access_token') or verify['data'].get('accessToken')
    if not token:
        raise SystemExit(f'no token for {role}')
    return token


def main():
    farmer_token = login(farmer_phone, 'FARMER')
    buyer_token = login(buyer_phone, 'BUYER')

    listing = unwrap(req('POST', '/listings', {
        'productCode': 'ETHIOPIAN_ARABICA_COFFEE',
        'region': 'ይርጋጨፌ',
        'regionEn': 'Yirgacheffe',
        'woreda': 'Kochere',
        'quantity': 20,
        'unitCode': 'KG',
        'pricePerUnit': 300,
        'qualityGrade': 'GRADE_1',
        'processMethod': 'WASHED',
        'washingStation': 'B2 E2E Station',
        'cooperative': 'B2 E2E Coop',
        'harvestDate': '2026-07-17',
        'altitudeM': 1850,
        'cupScore': 85,
        'variety': 'Heirloom',
    }, token=farmer_token))
    lines.append(f'listing_id={listing.get("id")}')
    lines.append(f'listing_farmerId={listing.get("farmerId")}')
    farmer_id = listing.get('farmerId')

    search = unwrap(req('GET', '/listings?q=Yirgacheffe&limit=20'))
    if isinstance(search, dict):
        search = search.get('data') or []
    found = any(x.get('id') == listing['id'] for x in search)
    lines.append(f'search_found_listing={found}')

    seller = unwrap(req('GET', f'/farmers/{farmer_id}'))
    lines.append(f'seller_has_farms={"farms" in seller}')
    lines.append(f'seller_has_certs={"certificates" in seller}')

    order_res = unwrap(req('POST', '/orders', {
        'listingId': listing['id'],
        'quantity': 3,
        'unitCode': 'KG',
        'paymentMethod': 'TELEBIRR',
        'deliveryAddress': 'B2 E2E Addis',
    }, token=buyer_token))
    order = order_res.get('order') or order_res
    lines.append(f'order_qty={order.get("quantity")}')
    lines.append(f'order_unit={order.get("unitCode")}')
    order_ok = float(order.get('quantity') or 0) == 3 and order.get('unitCode') == 'KG'

    paid = unwrap(req('PATCH', f'/orders/{order["id"]}/confirm-payment', {}, token=buyer_token))
    done = unwrap(req('PATCH', f'/orders/{order["id"]}/confirm-delivery', {}, token=buyer_token))
    cert = unwrap(req('GET', f'/certificates/order/{order["id"]}', token=buyer_token))
    cert_body = cert.get('certificate') or cert
    cert_ok = float(cert_body.get('quantity') or 0) == 3 and cert_body.get('unitCode') == 'KG'

    lines.append(f'paid={paid.get("status")}')
    lines.append(f'completed={done.get("status")}')
    lines.append(f'cert_ok={cert_ok}')

    passed = found and order_ok and paid.get('status') == 'PAID_ESCROW' and done.get('status') == 'COMPLETED' and cert_ok
    lines.append(f'B2_E2E_SMOKE={"PASS" if passed else "FAIL"}')
    out.write_text('\n'.join(lines) + '\n', encoding='utf-8')
    print('\n'.join(lines))
    raise SystemExit(0 if passed else 1)


if __name__ == '__main__':
    main()
