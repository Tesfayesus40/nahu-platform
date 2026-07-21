export type FilterField = {
  key: string;
  label: string;
  type: "text" | "select";
  placeholder?: string;
  options?: Array<{ value: string; label: string }>;
};

export function FilterBar({
  fields,
  values,
  onChange,
  onSubmit,
  onReset,
}: {
  fields: FilterField[];
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
  onSubmit: () => void;
  onReset: () => void;
}) {
  return (
    <form
      className="filter-bar"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      {fields.map((field) => (
        <label key={field.key} className="filter-field">
          <span>{field.label}</span>
          {field.type === "select" ? (
            <select
              value={values[field.key] ?? ""}
              onChange={(e) => onChange(field.key, e.target.value)}
            >
              <option value="">All</option>
              {(field.options ?? []).map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          ) : (
            <input
              type="search"
              value={values[field.key] ?? ""}
              placeholder={field.placeholder}
              onChange={(e) => onChange(field.key, e.target.value)}
            />
          )}
        </label>
      ))}
      <div className="filter-actions">
        <button type="submit" className="btn btn-primary">
          Apply
        </button>
        <button type="button" className="btn btn-secondary" onClick={onReset}>
          Reset
        </button>
      </div>
    </form>
  );
}
