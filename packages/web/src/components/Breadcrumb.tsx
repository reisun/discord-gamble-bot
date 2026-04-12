import { ChevronRight } from './icons';

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
}

export default function Breadcrumb({ items }: BreadcrumbProps) {
  return (
    <nav
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        fontSize: '14px',
        marginBottom: '24px',
        flexWrap: 'wrap',
      }}
    >
      {items.map((item, i) => {
        const isLast = i === items.length - 1;
        return (
          <span key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {i > 0 && <ChevronRight />}
            {item.href && !isLast ? (
              <a href={item.href} style={{ color: 'var(--color-text-muted)' }}>
                {item.label}
              </a>
            ) : (
              <span style={{ color: isLast ? 'var(--color-text)' : 'var(--color-text-muted)' }}>
                {item.label}
              </span>
            )}
          </span>
        );
      })}
    </nav>
  );
}
