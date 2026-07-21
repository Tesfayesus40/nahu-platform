export function RoleChips({ roles }: { roles: string[] }) {
  if (roles.length === 0) {
    return <span className="muted">—</span>;
  }
  return (
    <span className="role-chips">
      {roles.map((role) => (
        <span key={role} className="role-chip">
          {role}
        </span>
      ))}
    </span>
  );
}
