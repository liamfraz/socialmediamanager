import { ChevronRight, FileText } from "lucide-react";
import { Link } from "wouter";

export interface BreadcrumbItem {
  label: string;
  href?: string;
  onClick?: () => void;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
}

export default function Breadcrumb({ items }: BreadcrumbProps) {
  return (
    <nav 
      className="flex items-center gap-1.5 text-sm"
      aria-label="Breadcrumb"
      data-testid="nav-breadcrumb"
    >
      <Link 
        href="/review"
        className="flex items-center text-muted-foreground hover:text-foreground"
        data-testid="link-breadcrumb-review"
      >
        <FileText className="h-4 w-4" />
      </Link>

      {items.map((item, index) => (
        <div key={index} className="flex items-center gap-1.5">
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
          {item.href ? (
            <Link 
              href={item.href}
              className="text-muted-foreground hover:text-foreground"
              data-testid={`link-breadcrumb-${index}`}
            >
              {item.label}
            </Link>
          ) : item.onClick ? (
            <button
              type="button"
              onClick={item.onClick}
              className="text-muted-foreground hover:text-foreground cursor-pointer"
              data-testid={`link-breadcrumb-${index}`}
            >
              {item.label}
            </button>
          ) : (
            <span 
              className="font-medium text-foreground"
              data-testid={`text-breadcrumb-${index}`}
            >
              {item.label}
            </span>
          )}
        </div>
      ))}
    </nav>
  );
}
