/**
 * Mail adresinden aranacak domain adayları — AUTH-EMAIL §1.2.
 * "Ali@A.Ogr.Kent.edu.tr" → ["a.ogr.kent.edu.tr", "ogr.kent.edu.tr", "kent.edu.tr", "edu.tr"]
 * (tam eşleşme önce, sonra en az iki etiketli üst domainler). Eşleşme yalnızca
 * UniversityDomain kayıtlarıyla yapıldığından "edu.tr" gibi sonekler sorun olmaz.
 */
export function candidateDomains(email: string): string[] {
  const at = email.lastIndexOf("@");
  if (at < 1) return [];
  const labels = email.slice(at + 1).trim().toLowerCase().split(".").filter(Boolean);
  const candidates: string[] = [];
  for (let i = 0; i <= labels.length - 2; i++) candidates.push(labels.slice(i).join("."));
  return candidates;
}

const DOMAIN_PATTERN = /^(?=.{4,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

/**
 * Panelde girilen domaini normalize eder: "@Ogr.Kent.edu.tr", "https://ogr.kent.edu.tr/" →
 * "ogr.kent.edu.tr". Geçersizse null.
 */
export function normalizeDomain(input: string): string | null {
  const domain = input
    .trim()
    .toLowerCase()
    .replace(/^[a-z]+:\/\//, "")
    .replace(/^@/, "")
    .replace(/\/.*$/, "")
    .replace(/\.$/, "");
  return DOMAIN_PATTERN.test(domain) ? domain : null;
}
