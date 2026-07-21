import Link from "next/link";
import { cn } from "@/lib/utils";

export function Button({ className, variant="primary", ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?:"primary"|"secondary"|"danger" }) {
  return <button className={cn("button", variant !== "primary" && `button-${variant}`, className)} {...props}/>;
}
export function LinkButton({ href, children, className, secondary=false }: {href:string;children:React.ReactNode;className?:string;secondary?:boolean}) {
  return <Link className={cn("button", secondary && "button-secondary", className)} href={href}>{children}</Link>;
}
export function Badge({ children, tone="default" }: {children:React.ReactNode;tone?:"default"|"success"|"warning"|"danger"}) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}
export function EmptyState({ title, description, action, href }: {title:string;description:string;action?:string;href?:string}) {
  return <div className="empty-state"><div className="empty-icon" aria-hidden>✦</div><h2>{title}</h2><p>{description}</p>{action&&href&&<LinkButton href={href}>{action}</LinkButton>}</div>;
}
export function PageHeader({ eyebrow, title, description }: {eyebrow?:string;title:string;description:string}) {
  return <header className="page-header">{eyebrow&&<p className="eyebrow">{eyebrow}</p>}<h1>{title}</h1><p>{description}</p></header>;
}
