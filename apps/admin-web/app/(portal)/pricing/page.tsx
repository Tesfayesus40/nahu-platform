"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { ConfirmActionModal } from "@/components/ConfirmActionModal";
import { usePortal } from "@/components/PortalShell";
import { bffGet, bffPatch, bffPut, type BffError } from "@/lib/client";

type DeliveryTariff = {
  id: string;
  vehicleType: string;
  baseFareEtb: number;
  perKmEtb: number;
  perKgEtb: number;
  perM3Etb: number;
  minFareEtb: number;
  maxFareEtb: number | null;
  isActive: boolean;
};

type FeeSchedule = {
  id: string;
  code: string;
  displayName: string;
  version: number;
  isActive: boolean;
  platformFees: { buyerFeePct: number; farmerFeePct: number } | null;
  deliveryCommission: {
    commissionType: string;
    commissionValue: number;
  } | null;
  deliveryTariffs: DeliveryTariff[];
};

export default function PricingPage() {
  const { capabilities } = usePortal();
  const canRead = capabilities.permissions.includes(
    "admin.system.config.read",
  );
  const canWrite = capabilities.permissions.includes(
    "admin.system.config.write",
  );

  const [schedules, setSchedules] = useState<FeeSchedule[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [buyerFeePct, setBuyerFeePct] = useState("2");
  const [farmerFeePct, setFarmerFeePct] = useState("2");
  const [commissionType, setCommissionType] = useState("PERCENT");
  const [commissionValue, setCommissionValue] = useState("15");
  const [feesOpen, setFeesOpen] = useState(false);
  const [commissionOpen, setCommissionOpen] = useState(false);
  const [tariffEdit, setTariffEdit] = useState<DeliveryTariff | null>(null);
  const [tariffForm, setTariffForm] = useState({
    baseFareEtb: "",
    perKmEtb: "",
    perKgEtb: "",
    perM3Etb: "",
    minFareEtb: "",
    maxFareEtb: "",
  });

  const active = schedules.find((s) => s.isActive) ?? schedules[0] ?? null;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await bffGet<FeeSchedule[]>("/api/pricing/schedules");
      setSchedules(rows);
      const a = rows.find((s) => s.isActive) ?? rows[0];
      if (a?.platformFees) {
        setBuyerFeePct(String(a.platformFees.buyerFeePct));
        setFarmerFeePct(String(a.platformFees.farmerFeePct));
      }
      if (a?.deliveryCommission) {
        setCommissionType(a.deliveryCommission.commissionType);
        setCommissionValue(String(a.deliveryCommission.commissionValue));
      }
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

  async function saveFees(input: { reauthPassword: string; reason?: string }) {
    const buyer = Number(buyerFeePct);
    const farmer = Number(farmerFeePct);
    if (!Number.isFinite(buyer) || !Number.isFinite(farmer)) {
      throw { message: "Enter valid fee percentages" };
    }
    const rows = await bffPatch<FeeSchedule[]>("/api/pricing/platform-fees", {
      buyerFeePct: buyer,
      farmerFeePct: farmer,
      reauthPassword: input.reauthPassword,
      reason: input.reason,
    });
    setSchedules(rows);
    setFlash("Platform fees updated.");
  }

  async function saveCommission(input: {
    reauthPassword: string;
    reason?: string;
  }) {
    const value = Number(commissionValue);
    if (!Number.isFinite(value) || value < 0) {
      throw { message: "Enter a valid commission value" };
    }
    const rows = await bffPatch<FeeSchedule[]>(
      "/api/pricing/delivery-commission",
      {
        commissionType,
        commissionValue: value,
        reauthPassword: input.reauthPassword,
        reason: input.reason,
      },
    );
    setSchedules(rows);
    setFlash("Delivery commission updated.");
  }

  async function saveTariff(input: {
    reauthPassword: string;
    reason?: string;
  }) {
    if (!tariffEdit) return;
    const rows = await bffPut<FeeSchedule[]>("/api/pricing/delivery-tariffs", {
      vehicleType: tariffEdit.vehicleType,
      baseFareEtb: Number(tariffForm.baseFareEtb),
      perKmEtb: Number(tariffForm.perKmEtb),
      perKgEtb: Number(tariffForm.perKgEtb),
      perM3Etb: Number(tariffForm.perM3Etb || 0),
      minFareEtb: Number(tariffForm.minFareEtb),
      maxFareEtb: tariffForm.maxFareEtb
        ? Number(tariffForm.maxFareEtb)
        : null,
      isActive: true,
      reauthPassword: input.reauthPassword,
      reason: input.reason,
    });
    setSchedules(rows);
    setFlash(`Tariff updated for ${tariffEdit.vehicleType}.`);
    setTariffEdit(null);
  }

  if (!canRead) {
    return (
      <main>
        <PageHeader title="Pricing" />
        <p className="form-error">Missing admin.system.config.read</p>
      </main>
    );
  }

  return (
    <main>
      <PageHeader
        title="Pricing"
        subtitle="Platform fees, delivery tariffs, and courier commission (Revenue Engine schedule). Mutations require reauth. Live payment rails are not connected — intents remain stubs."
      />
      <p className="muted" style={{ marginBottom: 16 }}>
        Commercial model: buyer + farmer platform % fees from the active schedule;
        delivery fee dynamic flag is OFF for pilot unless explicitly enabled.
        See docs/09-platform-evolution/35-g9 and 37-production-readiness.
      </p>
      {flash ? <p className="flash-ok">{flash}</p> : null}
      {error ? <p className="form-error">{error}</p> : null}
      {loading ? <p>Loading…</p> : null}

      {active ? (
        <div className="card-grid">
          <div className="card">
            <h2>Active schedule</h2>
            <dl className="kv">
              <dt>Name</dt>
              <dd>
                {active.displayName} (v{active.version})
              </dd>
              <dt>Code</dt>
              <dd className="mono">{active.code}</dd>
              <dt>Buyer fee</dt>
              <dd>{active.platformFees?.buyerFeePct ?? 0}%</dd>
              <dt>Farmer fee</dt>
              <dd>{active.platformFees?.farmerFeePct ?? 0}%</dd>
              <dt>Delivery commission</dt>
              <dd>
                {active.deliveryCommission
                  ? `${active.deliveryCommission.commissionValue}${
                      active.deliveryCommission.commissionType === "PERCENT"
                        ? "%"
                        : " ETB"
                    }`
                  : "—"}
              </dd>
            </dl>
            {canWrite ? (
              <div className="row-actions" style={{ marginTop: 12 }}>
                <button
                  type="button"
                  className="btn"
                  onClick={() => setFeesOpen(true)}
                >
                  Edit platform fees
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setCommissionOpen(true)}
                >
                  Edit delivery commission
                </button>
              </div>
            ) : null}
          </div>

          <div className="card">
            <h2>Incidence model</h2>
            <p>
              Buyer pays goods + buyer fee + delivery. Farmer receives goods −
              farmer fee. Courier receives delivery − commission.
            </p>
          </div>
        </div>
      ) : null}

      {active?.deliveryTariffs?.length ? (
        <div className="card" style={{ marginTop: 16 }}>
          <h2>Vehicle tariffs</h2>
          <table className="data-table">
            <thead>
              <tr>
                <th>Vehicle</th>
                <th>Base</th>
                <th>/km</th>
                <th>/kg</th>
                <th>/m³</th>
                <th>Min</th>
                <th>Max</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {active.deliveryTariffs.map((t) => (
                <tr key={t.id}>
                  <td>{t.vehicleType}</td>
                  <td>{t.baseFareEtb}</td>
                  <td>{t.perKmEtb}</td>
                  <td>{t.perKgEtb}</td>
                  <td>{t.perM3Etb}</td>
                  <td>{t.minFareEtb}</td>
                  <td>{t.maxFareEtb ?? "—"}</td>
                  <td>
                    {canWrite ? (
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => {
                          setTariffEdit(t);
                          setTariffForm({
                            baseFareEtb: String(t.baseFareEtb),
                            perKmEtb: String(t.perKmEtb),
                            perKgEtb: String(t.perKgEtb),
                            perM3Etb: String(t.perM3Etb),
                            minFareEtb: String(t.minFareEtb),
                            maxFareEtb:
                              t.maxFareEtb != null ? String(t.maxFareEtb) : "",
                          });
                        }}
                      >
                        Edit
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <ConfirmActionModal
        open={feesOpen}
        title="Update platform fees"
        confirmLabel="Save fees"
        onClose={() => setFeesOpen(false)}
        onConfirm={async (input) => {
          await saveFees(input);
          setFeesOpen(false);
        }}
      >
        <label>
          Buyer fee %
          <input
            value={buyerFeePct}
            onChange={(e) => setBuyerFeePct(e.target.value)}
            inputMode="decimal"
          />
        </label>
        <label>
          Farmer fee %
          <input
            value={farmerFeePct}
            onChange={(e) => setFarmerFeePct(e.target.value)}
            inputMode="decimal"
          />
        </label>
      </ConfirmActionModal>

      <ConfirmActionModal
        open={commissionOpen}
        title="Update delivery commission"
        confirmLabel="Save commission"
        onClose={() => setCommissionOpen(false)}
        onConfirm={async (input) => {
          await saveCommission(input);
          setCommissionOpen(false);
        }}
      >
        <label>
          Type
          <select
            value={commissionType}
            onChange={(e) => setCommissionType(e.target.value)}
          >
            <option value="PERCENT">PERCENT</option>
            <option value="FIXED">FIXED</option>
          </select>
        </label>
        <label>
          Value
          <input
            value={commissionValue}
            onChange={(e) => setCommissionValue(e.target.value)}
            inputMode="decimal"
          />
        </label>
      </ConfirmActionModal>

      <ConfirmActionModal
        open={Boolean(tariffEdit)}
        title={`Edit tariff — ${tariffEdit?.vehicleType ?? ""}`}
        confirmLabel="Save tariff"
        onClose={() => setTariffEdit(null)}
        onConfirm={saveTariff}
      >
        {(
          [
            ["baseFareEtb", "Base fare (ETB)"],
            ["perKmEtb", "Per km"],
            ["perKgEtb", "Per kg"],
            ["perM3Etb", "Per m³"],
            ["minFareEtb", "Min fare"],
            ["maxFareEtb", "Max fare (optional)"],
          ] as const
        ).map(([key, label]) => (
          <label key={key}>
            {label}
            <input
              value={tariffForm[key]}
              onChange={(e) =>
                setTariffForm((prev) => ({ ...prev, [key]: e.target.value }))
              }
              inputMode="decimal"
            />
          </label>
        ))}
      </ConfirmActionModal>
    </main>
  );
}
