"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { usePortal } from "@/components/PortalShell";
import { bffGet, bffPatch, bffPost, type BffError } from "@/lib/client";

type Vertical = {
  code: string;
  nameEn: string;
  nameAm: string | null;
  isActive: boolean;
  sortOrder: number;
  defaultBrand: string | null;
};

type Category = {
  code: string;
  categoryCode: string;
  verticalCode: string;
  nameEn: string;
  nameAm: string;
  listingKind: string;
  sellEnabled: boolean;
  isActive: boolean;
  sortOrder: number;
};

type Product = {
  id: string;
  code: string;
  productTypeCode: string;
  categoryCode: string;
  verticalCode: string;
  nameEn: string;
  nameAm: string;
  status: string;
  isDefault: boolean;
  sortOrder: number;
  defaultUnitCode: string;
  varieties: Array<{
    id?: string;
    code: string;
    nameEn: string;
    nameAm: string;
    isActive: boolean;
    sortOrder: number;
  }>;
};

type Tab = "verticals" | "categories" | "products";

export default function CatalogPage() {
  const { capabilities } = usePortal();
  const canRead = capabilities.permissions.includes("catalog.read");
  const canWrite = capabilities.permissions.includes("catalog.write");

  const [tab, setTab] = useState<Tab>("verticals");
  const [verticals, setVerticals] = useState<Vertical[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [verticalFilter, setVerticalFilter] = useState("AGRICULTURE");
  const [categoryFilter, setCategoryFilter] = useState("COFFEE");

  const [categoryForm, setCategoryForm] = useState({
    code: "",
    verticalCode: "AGRICULTURE",
    nameEn: "",
    nameAm: "",
    listingKind: "GOODS",
    sellEnabled: false,
    isActive: false,
    sortOrder: "0",
  });

  const [productForm, setProductForm] = useState({
    code: "",
    categoryCode: "COFFEE",
    nameEn: "",
    nameAm: "",
    defaultUnitCode: "KG",
    status: "INACTIVE",
    isDefault: false,
    sortOrder: "0",
  });

  const [varietyForm, setVarietyForm] = useState({
    productCode: "ETHIOPIAN_ARABICA_COFFEE",
    code: "",
    nameEn: "",
    nameAm: "",
    sortOrder: "0",
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [v, c, p] = await Promise.all([
        bffGet<Vertical[]>("/api/catalog/verticals"),
        bffGet<Category[]>("/api/catalog/categories"),
        bffGet<Product[]>("/api/catalog/products"),
      ]);
      setVerticals(v);
      setCategories(c);
      setProducts(p);
    } catch (err) {
      setError((err as BffError).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (canRead) void load();
    else setLoading(false);
  }, [canRead, load]);

  const filteredCategories = useMemo(
    () =>
      verticalFilter
        ? categories.filter((c) => c.verticalCode === verticalFilter)
        : categories,
    [categories, verticalFilter],
  );

  const filteredProducts = useMemo(
    () =>
      categoryFilter
        ? products.filter((p) => p.categoryCode === categoryFilter)
        : products,
    [products, categoryFilter],
  );

  async function toggleVerticalActive(v: Vertical) {
    if (!canWrite) return;
    setFlash(null);
    try {
      await bffPatch(`/api/catalog/verticals/${encodeURIComponent(v.code)}`, {
        isActive: !v.isActive,
      });
      setFlash(`Vertical ${v.code} updated`);
      await load();
    } catch (err) {
      setError((err as BffError).message);
    }
  }

  async function patchCategory(
    code: string,
    patch: Partial<{
      sellEnabled: boolean;
      isActive: boolean;
      sortOrder: number;
      listingKind: string;
    }>,
  ) {
    if (!canWrite) return;
    setFlash(null);
    try {
      await bffPatch(`/api/catalog/categories/${encodeURIComponent(code)}`, patch);
      setFlash(`Category ${code} updated`);
      await load();
    } catch (err) {
      setError((err as BffError).message);
    }
  }

  async function createCategory() {
    if (!canWrite) return;
    setFlash(null);
    try {
      await bffPost("/api/catalog/categories", {
        ...categoryForm,
        sortOrder: Number(categoryForm.sortOrder) || 0,
      });
      setFlash(`Category ${categoryForm.code} created`);
      setCategoryForm({
        code: "",
        verticalCode: "AGRICULTURE",
        nameEn: "",
        nameAm: "",
        listingKind: "GOODS",
        sellEnabled: false,
        isActive: false,
        sortOrder: "0",
      });
      await load();
    } catch (err) {
      setError((err as BffError).message);
    }
  }

  async function patchProduct(
    code: string,
    patch: Partial<{ status: string; isDefault: boolean; sortOrder: number }>,
  ) {
    if (!canWrite) return;
    setFlash(null);
    try {
      await bffPatch(`/api/catalog/products/${encodeURIComponent(code)}`, patch);
      setFlash(`Product ${code} updated`);
      await load();
    } catch (err) {
      setError((err as BffError).message);
    }
  }

  async function createProduct() {
    if (!canWrite) return;
    setFlash(null);
    try {
      await bffPost("/api/catalog/products", {
        ...productForm,
        sortOrder: Number(productForm.sortOrder) || 0,
      });
      setFlash(`Product ${productForm.code} created`);
      setProductForm({
        code: "",
        categoryCode: categoryFilter || "COFFEE",
        nameEn: "",
        nameAm: "",
        defaultUnitCode: "KG",
        status: "INACTIVE",
        isDefault: false,
        sortOrder: "0",
      });
      await load();
    } catch (err) {
      setError((err as BffError).message);
    }
  }

  async function createVariety() {
    if (!canWrite) return;
    setFlash(null);
    try {
      await bffPost(
        `/api/catalog/products/${encodeURIComponent(varietyForm.productCode)}/varieties`,
        {
          code: varietyForm.code,
          nameEn: varietyForm.nameEn,
          nameAm: varietyForm.nameAm,
          sortOrder: Number(varietyForm.sortOrder) || 0,
        },
      );
      setFlash(`Variety ${varietyForm.code} created`);
      setVarietyForm((f) => ({ ...f, code: "", nameEn: "", nameAm: "" }));
      await load();
    } catch (err) {
      setError((err as BffError).message);
    }
  }

  async function patchVariety(
    productCode: string,
    varietyCode: string,
    patch: { isActive?: boolean; sortOrder?: number },
  ) {
    if (!canWrite) return;
    setFlash(null);
    try {
      await bffPatch(
        `/api/catalog/products/${encodeURIComponent(productCode)}/varieties/${encodeURIComponent(varietyCode)}`,
        patch,
      );
      setFlash(`Variety ${varietyCode} updated`);
      await load();
    } catch (err) {
      setError((err as BffError).message);
    }
  }

  if (!canRead) {
    return (
      <div>
        <PageHeader
          title="Catalog"
          subtitle="Marketplace verticals, categories, and product types"
        />
        <p className="muted">You do not have permission to view the catalog.</p>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Catalog"
        subtitle="G2 Admin Catalog Foundation — verticals, categories, product types, varieties"
      />

      {error ? <p className="error">{error}</p> : null}
      {flash ? <p className="ok">{flash}</p> : null}

      <div className="tabs" style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {(
          [
            ["verticals", "Verticals"],
            ["categories", "Categories"],
            ["products", "Products & Varieties"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={tab === id ? "primary" : undefined}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
        <button type="button" onClick={() => void load()} disabled={loading}>
          Refresh
        </button>
      </div>

      {loading ? <p className="muted">Loading…</p> : null}

      {tab === "verticals" && !loading ? (
        <section>
          <p className="muted">
            Agriculture is the active vertical for RC1. Future verticals stay
            inactive until activated here.
          </p>
          <table className="data">
            <thead>
              <tr>
                <th>Code</th>
                <th>Name</th>
                <th>Brand</th>
                <th>Order</th>
                <th>Active</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {verticals.map((v) => (
                <tr key={v.code}>
                  <td>
                    <code>{v.code}</code>
                  </td>
                  <td>{v.nameEn}</td>
                  <td>{v.defaultBrand ?? "—"}</td>
                  <td>{v.sortOrder}</td>
                  <td>{v.isActive ? "Yes" : "No"}</td>
                  <td>
                    {canWrite ? (
                      <button type="button" onClick={() => void toggleVerticalActive(v)}>
                        {v.isActive ? "Deactivate" : "Activate"}
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}

      {tab === "categories" && !loading ? (
        <section>
          <label>
            Vertical filter{" "}
            <select
              value={verticalFilter}
              onChange={(e) => setVerticalFilter(e.target.value)}
            >
              <option value="">All</option>
              {verticals.map((v) => (
                <option key={v.code} value={v.code}>
                  {v.code}
                </option>
              ))}
            </select>
          </label>

          <table className="data" style={{ marginTop: 12 }}>
            <thead>
              <tr>
                <th>Code</th>
                <th>Vertical</th>
                <th>Name</th>
                <th>Kind</th>
                <th>Order</th>
                <th>Active</th>
                <th>Sell</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {filteredCategories.map((c) => (
                <tr key={c.code}>
                  <td>
                    <code>{c.code}</code>
                  </td>
                  <td>{c.verticalCode}</td>
                  <td>
                    {c.nameEn} / {c.nameAm}
                  </td>
                  <td>{c.listingKind}</td>
                  <td>{c.sortOrder}</td>
                  <td>{c.isActive ? "Yes" : "No"}</td>
                  <td>{c.sellEnabled ? "Yes" : "No"}</td>
                  <td style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {canWrite ? (
                      <>
                        <button
                          type="button"
                          onClick={() =>
                            void patchCategory(c.code, { isActive: !c.isActive })
                          }
                        >
                          Toggle active
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            void patchCategory(c.code, {
                              sellEnabled: !c.sellEnabled,
                            })
                          }
                        >
                          Toggle sell
                        </button>
                      </>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {canWrite ? (
            <div className="card" style={{ marginTop: 16 }}>
              <h3>Create category</h3>
              <div className="form-grid">
                <input
                  placeholder="CODE"
                  value={categoryForm.code}
                  onChange={(e) =>
                    setCategoryForm((f) => ({ ...f, code: e.target.value }))
                  }
                />
                <select
                  value={categoryForm.verticalCode}
                  onChange={(e) =>
                    setCategoryForm((f) => ({
                      ...f,
                      verticalCode: e.target.value,
                    }))
                  }
                >
                  {verticals.map((v) => (
                    <option key={v.code} value={v.code}>
                      {v.code}
                    </option>
                  ))}
                </select>
                <input
                  placeholder="Name (EN)"
                  value={categoryForm.nameEn}
                  onChange={(e) =>
                    setCategoryForm((f) => ({ ...f, nameEn: e.target.value }))
                  }
                />
                <input
                  placeholder="Name (AM)"
                  value={categoryForm.nameAm}
                  onChange={(e) =>
                    setCategoryForm((f) => ({ ...f, nameAm: e.target.value }))
                  }
                />
                <select
                  value={categoryForm.listingKind}
                  onChange={(e) =>
                    setCategoryForm((f) => ({
                      ...f,
                      listingKind: e.target.value,
                    }))
                  }
                >
                  <option value="GOODS">GOODS</option>
                  <option value="SUPPLIES">SUPPLIES</option>
                  <option value="SERVICE">SERVICE</option>
                </select>
                <input
                  placeholder="Sort order"
                  value={categoryForm.sortOrder}
                  onChange={(e) =>
                    setCategoryForm((f) => ({ ...f, sortOrder: e.target.value }))
                  }
                />
                <label>
                  <input
                    type="checkbox"
                    checked={categoryForm.isActive}
                    onChange={(e) =>
                      setCategoryForm((f) => ({
                        ...f,
                        isActive: e.target.checked,
                      }))
                    }
                  />{" "}
                  Active
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={categoryForm.sellEnabled}
                    onChange={(e) =>
                      setCategoryForm((f) => ({
                        ...f,
                        sellEnabled: e.target.checked,
                      }))
                    }
                  />{" "}
                  Sell enabled
                </label>
              </div>
              <button type="button" className="primary" onClick={() => void createCategory()}>
                Create category
              </button>
            </div>
          ) : null}
        </section>
      ) : null}

      {tab === "products" && !loading ? (
        <section>
          <label>
            Category filter{" "}
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              <option value="">All</option>
              {categories.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.code}
                </option>
              ))}
            </select>
          </label>

          <table className="data" style={{ marginTop: 12 }}>
            <thead>
              <tr>
                <th>Product type</th>
                <th>Category</th>
                <th>Name</th>
                <th>Status</th>
                <th>Default</th>
                <th>Order</th>
                <th>Varieties</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {filteredProducts.map((p) => (
                <tr key={p.code}>
                  <td>
                    <code>{p.productTypeCode}</code>
                  </td>
                  <td>{p.categoryCode}</td>
                  <td>
                    {p.nameEn} / {p.nameAm}
                  </td>
                  <td>{p.status}</td>
                  <td>{p.isDefault ? "Yes" : "No"}</td>
                  <td>{p.sortOrder}</td>
                  <td>
                    <ul style={{ margin: 0, paddingLeft: 16 }}>
                      {p.varieties.map((v) => (
                        <li key={v.code}>
                          {v.code} ({v.isActive ? "on" : "off"})
                          {canWrite ? (
                            <button
                              type="button"
                              style={{ marginLeft: 6 }}
                              onClick={() =>
                                void patchVariety(p.code, v.code, {
                                  isActive: !v.isActive,
                                })
                              }
                            >
                              Toggle
                            </button>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  </td>
                  <td style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {canWrite ? (
                      <>
                        <button
                          type="button"
                          onClick={() =>
                            void patchProduct(p.code, {
                              status:
                                p.status === "ACTIVE" ? "INACTIVE" : "ACTIVE",
                            })
                          }
                        >
                          Toggle status
                        </button>
                        {!p.isDefault ? (
                          <button
                            type="button"
                            onClick={() =>
                              void patchProduct(p.code, { isDefault: true })
                            }
                          >
                            Make default
                          </button>
                        ) : null}
                      </>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {canWrite ? (
            <>
              <div className="card" style={{ marginTop: 16 }}>
                <h3>Create product type</h3>
                <div className="form-grid">
                  <input
                    placeholder="CODE"
                    value={productForm.code}
                    onChange={(e) =>
                      setProductForm((f) => ({ ...f, code: e.target.value }))
                    }
                  />
                  <select
                    value={productForm.categoryCode}
                    onChange={(e) =>
                      setProductForm((f) => ({
                        ...f,
                        categoryCode: e.target.value,
                      }))
                    }
                  >
                    {categories.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.code}
                      </option>
                    ))}
                  </select>
                  <input
                    placeholder="Name (EN)"
                    value={productForm.nameEn}
                    onChange={(e) =>
                      setProductForm((f) => ({ ...f, nameEn: e.target.value }))
                    }
                  />
                  <input
                    placeholder="Name (AM)"
                    value={productForm.nameAm}
                    onChange={(e) =>
                      setProductForm((f) => ({ ...f, nameAm: e.target.value }))
                    }
                  />
                  <input
                    placeholder="Unit"
                    value={productForm.defaultUnitCode}
                    onChange={(e) =>
                      setProductForm((f) => ({
                        ...f,
                        defaultUnitCode: e.target.value,
                      }))
                    }
                  />
                  <select
                    value={productForm.status}
                    onChange={(e) =>
                      setProductForm((f) => ({ ...f, status: e.target.value }))
                    }
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="INACTIVE">INACTIVE</option>
                    <option value="COMING_SOON">COMING_SOON</option>
                    <option value="DISCONTINUED">DISCONTINUED</option>
                  </select>
                </div>
                <button
                  type="button"
                  className="primary"
                  onClick={() => void createProduct()}
                >
                  Create product type
                </button>
              </div>

              <div className="card" style={{ marginTop: 16 }}>
                <h3>Create variety</h3>
                <div className="form-grid">
                  <select
                    value={varietyForm.productCode}
                    onChange={(e) =>
                      setVarietyForm((f) => ({
                        ...f,
                        productCode: e.target.value,
                      }))
                    }
                  >
                    {products.map((p) => (
                      <option key={p.code} value={p.code}>
                        {p.code}
                      </option>
                    ))}
                  </select>
                  <input
                    placeholder="VARIETY_CODE"
                    value={varietyForm.code}
                    onChange={(e) =>
                      setVarietyForm((f) => ({ ...f, code: e.target.value }))
                    }
                  />
                  <input
                    placeholder="Name (EN)"
                    value={varietyForm.nameEn}
                    onChange={(e) =>
                      setVarietyForm((f) => ({ ...f, nameEn: e.target.value }))
                    }
                  />
                  <input
                    placeholder="Name (AM)"
                    value={varietyForm.nameAm}
                    onChange={(e) =>
                      setVarietyForm((f) => ({ ...f, nameAm: e.target.value }))
                    }
                  />
                </div>
                <button
                  type="button"
                  className="primary"
                  onClick={() => void createVariety()}
                >
                  Create variety
                </button>
              </div>
            </>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
