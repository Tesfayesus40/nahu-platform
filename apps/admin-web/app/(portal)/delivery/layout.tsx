import Link from "next/link";

const TABS = [
  { href: "/delivery", label: "Ops dashboard", exact: true },
  { href: "/delivery/shipments", label: "Shipments" },
  { href: "/delivery/couriers", label: "Couriers" },
  { href: "/delivery/verifications", label: "Courier KYC" },
  { href: "/delivery/fulfillments", label: "Fulfillments" },
  { href: "/delivery/earnings", label: "Earnings" },
];

export default function DeliveryLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div>
      <nav className="subnav" aria-label="Delivery sections">
        {TABS.map((tab) => (
          <Link key={tab.href} href={tab.href} className="subnav-link">
            {tab.label}
          </Link>
        ))}
      </nav>
      {children}
    </div>
  );
}
