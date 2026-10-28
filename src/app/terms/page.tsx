import { LegalDocument } from "@/components/site/legal-document";
import { TERMS } from "@/lib/legal/terms";

export const metadata = { title: TERMS.title };

export default function TermsPage() {
  return <LegalDocument doc={TERMS} />;
}
