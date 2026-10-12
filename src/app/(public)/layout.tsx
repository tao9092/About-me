import Link from "next/link";
import { PublicNav } from "@/components/public-nav";
import { RouteTransitionProvider } from "@/components/route-transition";
export default function PublicLayout({ children }: { children: React.ReactNode }) { return <RouteTransitionProvider><PublicNav/><main id="main" className="public-main">{children}</main><footer className="site-footer"><div><strong>Personal Achievement Hub</strong><p>Built as a living record, not a static portfolio.</p></div><Link href="/admin/login">Owner sign in</Link></footer></RouteTransitionProvider>; }
