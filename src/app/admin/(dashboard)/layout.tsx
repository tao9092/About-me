import Link from "next/link";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { AdminNav } from "@/components/admin-nav";

export default async function Layout({children}:{children:React.ReactNode}){
  await requireAdmin();
  return <div className="admin-shell"><AdminNav/><main id="main" className="admin-main"><div className="admin-return-row"><Link href="/"><ArrowLeft/> Back to main site <ExternalLink/></Link></div>{children}</main></div>;
}
