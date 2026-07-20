"""B1 staging smoke: legacy + modern order create, order shape, cancel restore."""
import json
import urllib.error
import urllib.request
from pathlib import Path

base = 'https://nahu-api-staging.up.railway.app/api/v1'
farmer_phone = '+251911000001'
buyer_phone = '+251911000002'
out = Path(r'C:\NahuAI\nahu-platform\docs\08-guides\_b1_smoke.txt')
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


def check_order(order, label, expect_qty, expect_unit='KG'):
    required = ['quantity', 'unitCode', 'pricePerUnit', 'quantityKg', 'totalEtb', 'status']
    missing = [k for k in required if k not in order]
    ok = (
        not missing
        and float(order.get('quantity') or 0) == float(expect_qty)
        and order.get('unitCode') == expect_unit
        and float(order.get('quantityKg') or 0) == float(expect_qty)
        and order.get('pricePerUnit') is not None
    )
    lines.append(f'{label}_missing={missing}')
    lines.append(f'{label}_ok={ok}')
    lines.append(f'{label}_quantity={order.get("quantity")}')
    lines.append(f'{label}_unitCode={order.get("unitCode")}')
    lines.append(f'{label}_pricePerUnit={order.get("pricePerUnit")}')
    lines.append(f'{label}_quantityKg={order.get("quantityKg")}')
    lines.append(f'{label}_qualityGrade={order.get("qualityGrade")}')
    lines.append(f'{label}_productCode={order.get("productCode")}')
    coffee = (order.get('extensions') or {}).get('coffee')
    lines.append(f'{label}_has_coffee_ext={bool(coffee)}')
    return ok


def create_listing(farmer_token, qty, price, tag):
    listing = unwrap(req('POST', '/listings', {
        'productCode': 'ETHIOPIAN_ARABICA_COFFEE',
        'region': 'ይርጋጨፌ',
        'regionEn': 'Yirgacheffe',
        'woreda': 'Kochere',
        'quantity': qty,
        'unitCode': 'KG',
        'pricePerUnit': price,
        'qualityGrade': 'GRADE_1',
        'processMethod': 'WASHED',
        'washingStation': f'B1 {tag} Station',
        'cooperative': f'B1 {tag} Coop',
        'harvestDate': '2026-07-17',
        'altitudeM': 1850,
        'cupScore': 85,
        'variety': 'Heirloom',
    }, token=farmer_token))
    lines.append(f'listing_{tag}_id={listing.get("id")}')
    lines.append(f'listing_{tag}_qty={listing.get("quantity")}')
    return listing


def main():
    farmer_token = login(farmer_phone, 'FARMER')
    buyer_token = login(buyer_phone, 'BUYER')

    # Existing orders still readable
    existing = unwrap(req('GET', '/orders/my', token=buyer_token))
    if isinstance(existing, dict):
        existing = existing.get('data') or existing.get('items') or []
    lines.append(f'existing_orders_count={len(existing) if isinstance(existing, list) else "n/a"}')
    if isinstance(existing, list) and existing:
        eo = existing[0]
        lines.append(f'existing_has_quantity={"quantity" in eo}')
        lines.append(f'existing_unitCode={eo.get("unitCode")}')

    legacy_listing = create_listing(farmer_token, 30, 250, 'legacy')
    legacy_res = unwrap(req('POST', '/orders', {
        'listingId': legacy_listing['id'],
        'quantityKg': 5,
        'paymentMethod': 'TELEBIRR',
        'deliveryAddress': 'B1 legacy smoke Addis',
    }, token=buyer_token))
    legacy_order = legacy_res.get('order') or legacy_res
    legacy_ok = check_order(legacy_order, 'legacy', 5)

    # Cancel to restore stock for cleanliness
    cancel = unwrap(req('PATCH', f'/orders/{legacy_order["id"]}/cancel', {}, token=buyer_token))
    lines.append(f'legacy_cancel_status={cancel.get("status")}')

    modern_listing = create_listing(farmer_token, 40, 280, 'modern')
    modern_res = unwrap(req('POST', '/orders', {
        'listingId': modern_listing['id'],
        'quantity': 8,
        'unitCode': 'KG',
        'paymentMethod': 'CBE_BIRR',
        'deliveryAddress': 'B1 modern smoke Addis',
    }, token=buyer_token))
    modern_order = modern_res.get('order') or modern_res
    modern_ok = check_order(modern_order, 'modern', 8)
    modern_total_ok = abs(float(modern_order.get('totalEtb') or 0) - (280 * 8)) < 0.01
    lines.append(f'modern_total_ok={modern_total_ok}')

    # Pay + complete + certificate (small qty so we don't strand inventory forever)
    paid = unwrap(req('PATCH', f'/orders/{modern_order["id"]}/confirm-payment', {}, token=buyer_token))
    lines.append(f'paid_status={paid.get("status")}')
    done = unwrap(req('PATCH', f'/orders/{modern_order["id"]}/confirm-delivery', {}, token=buyer_token))
    lines.append(f'completed_status={done.get("status")}')

    cert = unwrap(req('GET', f'/certificates/order/{modern_order["id"]}', token=buyer_token))
    cert_body = cert.get('certificate') or cert
    cert_ok = (
        float(cert_body.get('quantity') or 0) == 8
        and cert_body.get('unitCode') == 'KG'
        and float(cert_body.get('quantityKg') or 0) == 8
        and 'extensions' in cert_body
    )
    lines.append(f'cert_ok={cert_ok}')
    lines.append(f'cert_quantity={cert_body.get("quantity")}')
    lines.append(f'cert_unitCode={cert_body.get("unitCode")}')
    lines.append(f'cert_qualityGrade={cert_body.get("qualityGrade")}')
    lines.append(f'cert_productCode={cert_body.get("productCode")}')

    passed = legacy_ok and modern_ok and modern_total_ok and cert_ok and paid.get('status') and done.get('status') == 'COMPLETED'
    lines.append(f'B1_SMOKE={"PASS" if passed else "FAIL"}')
    out.write_text('\n'.join(lines) + '\n', encoding='utf-8')
    print('\n'.join(lines))
    raise SystemExit(0 if passed else 1)


if __name__ == '__main__':
    main()
