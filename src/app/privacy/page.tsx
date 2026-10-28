import { LegalDocument } from "@/components/site/legal-document";
import { PRIVACY } from "@/lib/legal/privacy";

export const metadata = { title: PRIVACY.title };

export default function PrivacyPage() {
  return <LegalDocument doc={PRIVACY} />;
}
