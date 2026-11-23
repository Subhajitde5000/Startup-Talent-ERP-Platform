export default function PageHeader({
  module = 'Workspace',
  workspaceName = 'Acme Studio',
  title,
  description,
  actions,
  className = '',
}) {
  return (
    <div className={`mb-6 flex flex-wrap items-start justify-between gap-4 ${className}`}>
      <div>
        <p className="text-sm text-[#4A5568]">
          {workspaceName} <span className="mx-2 text-[#B8955A]">·</span> {module}
        </p>
        {title && <h1 className="serif mt-1 text-[30px] font-semibold text-[#0F1B2D]">{title}</h1>}
        {description && <p className="mt-1 text-sm text-[#4A5568]">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
