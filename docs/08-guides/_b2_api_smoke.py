"""B2 thin API smoke: farmerId on listings, q= search, seller profile shape."""
import json
import urllib.error
import urllib.request
from pathlib import Path

base = 'https://nahu-api-staging.up.railway.app/api/v1'
out = Path(r'C:\NahuAI\nahu-platform\docs\08-guides\_b2_api_smoke.txt')
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


def main():
    listings_payload = req('GET', '/listings?limit=5')
    listings = unwrap(listings_payload)
    if isinstance(listings, dict):
        listings = listings.get('data') or listings.get('items') or []
    lines.append(f'listings_count={len(listings)}')

    has_farmer_id = False
    farmer_id = None
    if listings:
        sample = listings[0]
        has_farmer_id = 'farmerId' in sample and sample.get('farmerId')
        farmer_id = sample.get('farmerId')
        lines.append(f'sample_farmerId={farmer_id}')
        lines.append(f'sample_has_quantity={("quantity" in sample)}')
        lines.append(f'sample_unitCode={sample.get("unitCode")}')

    lines.append(f'farmerId_on_listing={bool(has_farmer_id)}')

    seller_ok = False
    if farmer_id:
        seller = unwrap(req('GET', f'/farmers/{farmer_id}'))
        seller_ok = (
            seller.get('id') == farmer_id
            and 'location' in seller
            and 'farms' in seller
            and 'certificates' in seller
            and 'activeListingsCount' in seller
            and 'extensions' in seller
            and 'ratings' in (seller.get('extensions') or {})
        )
        lines.append(f'seller_ok={seller_ok}')
        lines.append(f'seller_farms={len(seller.get("farms") or [])}')
        lines.append(f'seller_certs={len(seller.get("certificates") or [])}')
        lines.append(f'seller_active={seller.get("activeListingsCount")}')
        lines.append(f'seller_ext_keys={list((seller.get("extensions") or {}).keys())}')

        by_farmer = unwrap(req('GET', f'/listings?farmerId={farmer_id}&limit=20'))
        if isinstance(by_farmer, dict):
            by_farmer = by_farmer.get('data') or []
        lines.append(f'listings_by_farmer={len(by_farmer)}')
        farmer_filter_ok = all(x.get('farmerId') == farmer_id for x in by_farmer) if by_farmer else True
        lines.append(f'farmer_filter_ok={farmer_filter_ok}')
    else:
        farmer_filter_ok = False
        lines.append('seller_skipped=no_farmerId')

    search = unwrap(req('GET', '/listings?q=coffee&limit=10'))
    if isinstance(search, dict):
        search = search.get('data') or []
    # q may match Amharic product names too; just ensure endpoint works
    lines.append(f'search_q_count={len(search)}')
    search_ok = isinstance(search, list)
    lines.append(f'search_ok={search_ok}')

    cats = unwrap(req('GET', '/categories'))
    if isinstance(cats, dict):
        cats = cats.get('data') or cats
    lines.append(f'categories_count={len(cats) if isinstance(cats, list) else "n/a"}')

    passed = bool(has_farmer_id) and seller_ok and farmer_filter_ok and search_ok
    lines.append(f'B2_API_SMOKE={"PASS" if passed else "FAIL"}')
    out.write_text('\n'.join(lines) + '\n', encoding='utf-8')
    print('\n'.join(lines))
    raise SystemExit(0 if passed else 1)


if __name__ == '__main__':
    main()
