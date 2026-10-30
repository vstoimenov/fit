import Link from "next/link";
import { buttonClass } from "@/components/ui/button";
import { Logo } from "@/components/ui/logo";
import { WRAP } from "@/components/site/styles";

/**
 * The gym page's own header: just the logo and „Вход“ (or „Изход“). The public site's menu leads
 * to the online club, which is not what these clients came for.
 */
export function StudioHeader({ signedIn }: { signedIn: boolean }) {
  return (
    <header className="border-b border-line bg-white">
      <div className={`${WRAP} flex h-16 items-center justify-between`}>
        <Link href="/zala" aria-label="I AM STRONG — тренировки на място">
          <Logo />
        </Link>
        {signedIn ? (
          // A plain link: a Next <Link> would prefetch the route handler and sign her out unseen.
          <a href="/auth/signout?next=/zala" className={buttonClass("secondary", "md")}>
            Изход
          </a>
        ) : (
          <Link href="/login?next=/zala" className={buttonClass("secondary", "md")}>
            Вход
          </Link>
        )}
      </div>
    </header>
  );
}
