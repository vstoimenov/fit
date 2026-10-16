import { ExternalLink, Users } from "lucide-react";
import { buttonClass } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

/** „Общност“ slot: a link to the external group when one is set, otherwise a quiet „coming soon“. */
export function CommunityCard({ url }: { url: string | null }) {
  return (
    <Card className="space-y-3 p-5">
      <div className="flex items-center gap-2">
        <Users size={20} strokeWidth={2} aria-hidden="true" />
        <h2 className="font-extrabold">Общност</h2>
      </div>
      {url ? (
        <>
          <p className="text-ink-soft">Място, където споделяме прогрес и се подкрепяме.</p>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonClass("secondary", "md")}
          >
            Влез в общността
            <span className="sr-only"> (отваря се в нов раздел)</span>
            <ExternalLink size={16} strokeWidth={2} aria-hidden="true" />
          </a>
        </>
      ) : (
        <p className="text-ink-soft">
          Общността идва скоро — място, където ще споделяме прогрес и ще се подкрепяме.
        </p>
      )}
    </Card>
  );
}
