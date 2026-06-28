type PageHeaderProps = {
  eyebrow?: string;
  title: string;
  subtitle?: string;
};

function PageHeader({ eyebrow, title, subtitle }: PageHeaderProps) {
  return (
    <section className="page-header">
      {eyebrow && <p className="eyebrow">{eyebrow}</p>}
      <h2>{title}</h2>
      {subtitle && <p>{subtitle}</p>}
    </section>
  );
}

export default PageHeader;