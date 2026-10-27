import { ExternalLink, Users } from "lucide-react";
import Link from "next/link";
import { buttonClass } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

/** „Общност“ slot: the in-app community, plus the external group when the owner has one. */
export function CommunityCard({ url }: { url: string | null }) {
  return (
    <Card className="space-y-3 p-5">
      <div className="flex items-center gap-2">
        <Users size={20} strokeWidth={2} aria-hidden="true" />
        <h2 className="font-extrabold">Общност</h2>
      </div>
      <p className="text-ink-soft">Място, където споделяме прогрес и се подкрепяме.</p>
      <div className="flex flex-wrap gap-2">
        <Link href="/app/community" className={buttonClass("primary", "md")}>
          Към общността
        </Link>
        {url && (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonClass("secondary", "md")}
          >
            Групата ни
            <span className="sr-only"> (отваря се в нов раздел)</span>
            <ExternalLink size={16} strokeWidth={2} aria-hidden="true" />
          </a>
        )}
      </div>
    </Card>
  );
}
