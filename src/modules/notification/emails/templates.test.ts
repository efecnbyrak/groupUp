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

  it("F10 şablonları: konu/metin değişkenleri taşır ve escape edilir", () => {
    const pending = renderTemplate("approval-pending", "tr", { name: "A", clubName: "Satranç <K>", type: "CLUB_UPDATE", url: "http://x/talep" });
    expect(pending.html).toContain("&lt;K&gt;");
    expect(pending.html).toContain('href="http://x/talep"');

    const reply = renderTemplate("ticket-reply", "en", { name: "A", subject: "Help", url: "http://x/t/1" });
    expect(reply.subject).toMatch(/Help/);

    const role = renderTemplate("club-role", "tr", { name: "A", clubName: "Robotik", title: "Etkinlik Sorumlusu", url: "http://x/k" });
    expect(role.text).toContain("Etkinlik Sorumlusu");

    const team = renderTemplate("team-update", "tr", { name: "A", teamName: "Takım 1", eventTitle: "Hackathon", url: "http://x/t" });
    expect(team.text).toContain("Takım 1");

    const match = renderTemplate("match-scheduled", "tr", { name: "A", eventTitle: "Turnuva", opponent: "Rakip", scheduledAt: "25 Kasım 14:00", url: "http://x/m" });
    expect(match.text).toContain("Rakip");

    const deadline = renderTemplate("deadline-reminder", "tr", { name: "A", eventTitle: "Hackathon", clubName: "Kodcular", url: "http://x/e" });
    expect(deadline.text).toContain("Hackathon");

    const reminder = renderTemplate("event-reminder", "en", { name: "A", eventTitle: "Hackathon", startAt: "Nov 25, 14:00", url: "http://x/e" });
    expect(reminder.html).toContain('href="http://x/e"');
  });
});
