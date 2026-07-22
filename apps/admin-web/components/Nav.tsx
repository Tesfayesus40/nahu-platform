"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { bffPost } from "@/lib/client";

export type NavSection = {
  href: string;
  label: string;
  /** Permission required to see this section; null means always visible. */
  permission: string | null;
};

export const NAV_SECTIONS: NavSection[] = [
  { href: "/", label: "Dashboard", permission: "admin.dashboard.read" },
  { href: "/users", label: "Users", permission: "identity.users.read" },
  {
    href: "/verification",
    label: "Verification",
    permission: "verification.read",
  },
  {
    href: "/listings",
    label: "Listings",
    permission: "marketplace.listings.read",
  },
  {
    href: "/disputes",
    label: "Disputes",
    permission: "orders.disputes.read",
  },
  { href: "/orders", label: "Orders", permission: "orders.read" },
  { href: "/delivery", label: "Delivery", permission: "delivery.read" },
  {
    href: "/promotions",
    label: "Promotions",
    permission: "marketplace.promotions.read",
  },
  {
    href: "/cooperatives",
    label: "Cooperatives",
    permission: "marketplace.cooperatives.read",
  },
  { href: "/audit", label: "Audit", permission: "audit.read" },
  { href: "/system", label: "System", permission: "admin.system.health.read" },
  { href: "/account", label: "Account", permission: null },
];

export function Nav({
  permissions,
  email,
}: {
  permissions: string[];
  email: string | null;
}) {
  const pathname = usePathname();
  const router = useRouter();

  const visible = NAV_SECTIONS.filter(
    (section) =>
      section.permission === null || permissions.includes(section.permission),
  );

  async function handleLogout() {
    try {
      await bffPost("/api/auth/logout");
    } catch {
      // Cookies are cleared by the BFF regardless; proceed to login.
    }
    router.replace("/login");
    router.refresh();
  }

  return (
    <aside className="sidebar">
      <div className="brand">
        <span className="mark">N</span>
        <span className="name">Nahu Admin</span>
      </div>
      <nav aria-label="Main navigation">
        {visible.map((section) => (
          <Link
            key={section.href}
            href={section.href}
            className={
              section.href === "/"
                ? pathname === "/"
                  ? "active"
                  : undefined
                : pathname === section.href ||
                    pathname.startsWith(`${section.href}/`)
                  ? "active"
                  : undefined
            }
          >
            {section.label}
          </Link>
        ))}
      </nav>
      <div className="session">
        {email ? <div className="email">{email}</div> : null}
        <button type="button" className="logout-btn" onClick={handleLogout}>
          Sign out
        </button>
      </div>
    </aside>
  );
}
