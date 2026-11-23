import { describe, expect, it } from "vitest";

import { renderTemplate } from "./templates";

describe("mail şablonları", () => {
  it("verify-email: kod konu, HTML ve düz metinde; dil seçilir", () => {
    const tr = renderTemplate("verify-email", "tr", { name: "Ayşe", code: "012345" });
    expect(tr.subject).toContain("012345");
    expect(tr.html).toContain("012345");
    expect(tr.text).toContain("Merhaba Ayşe");
    expect(renderTemplate("verify-email", "en", { name: "A", code: "1" }).text).toContain("Hi A");
  });

  it("değişkenler HTML-escape edilir", () => {
    const mail = renderTemplate("password-changed", "tr", { name: '<script>alert("x")</script>' });
    expect(mail.html).not.toContain("<script>");
    expect(mail.html).toContain("&lt;script&gt;");
  });

  it("password-reset bağlantıyı buton ve düz metin olarak içerir", () => {
    const url = "http://localhost:3000/sifre-sifirla?token=abc";
    const mail = renderTemplate("password-reset", "tr", { name: "A", url });
    expect(mail.html).toContain(`href="${url}"`);
    expect(mail.text).toContain(url);
  });

  it("delete-account onay bağlantısı ve süre uyarısı içerir (TR/EN)", () => {
    const url = "http://localhost:3000/hesap/sil/onay?token=abc";
    const tr = renderTemplate("delete-account", "tr", { name: "A", url });
    expect(tr.html).toContain(`href="${url}"`);
    expect(tr.text).toContain("30 dakika");
    expect(renderTemplate("delete-account", "en", { name: "A", url }).subject).toMatch(/delet/i);
  });

  it("request-decided: tip etiketi, kulüp ve ret gerekçesi (escape)", () => {
    const mail = renderTemplate("request-decided", "tr", { name: "A", type: "STAFF_ASSIGN", clubName: "Satranç <Kulübü>", approved: false, reason: "Gerekçe <b>metni</b>" });
    expect(mail.subject).toMatch(/reddedildi/i);
    expect(mail.text).toContain("Görevli atama");
    expect(mail.text).toContain("Gerekçe <b>metni</b>");
    expect(mail.html).toContain("&lt;b&gt;");
    expect(mail.html).toContain("Satranç &lt;Kulübü&gt;");
    const ok = renderTemplate("request-decided", "en", { name: "A", type: "CLUB_UPDATE", clubName: "C", approved: true, reason: null });
    expect(ok.subject).toMatch(/approved/i);
  });

  it("alumni-result: onay/ret ve bağlantı", () => {
    const rej = renderTemplate("alumni-result", "tr", { name: "A", approved: false, reason: "Belge okunaklı değil, lütfen tekrar yükleyin.", url: "http://x/mezun-dogrulama" });
    expect(rej.text).toContain("okunaklı");
    expect(rej.html).toContain('href="http://x/mezun-dogrulama"');
    expect(renderTemplate("alumni-result", "en", { name: "A", approved: true, reason: null, url: "http://x/giris" }).subject).toMatch(/approved|verified/i);
  });
});
