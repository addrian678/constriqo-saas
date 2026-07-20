type VisualFieldProps = {
  label: string;
  value: string;
};

export function VisualField({ label, value }: VisualFieldProps) {
  return (
    <div className="visual-field">
      <span className="visual-field-label">{label}</span>
      <span className="visual-field-value">{value}</span>
    </div>
  );
}
