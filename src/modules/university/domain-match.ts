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
