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
});
