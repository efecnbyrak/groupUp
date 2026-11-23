import { describe, expect, it, vi } from "vitest";

import { ConsoleMailProvider } from "./console";

describe("ConsoleMailProvider", () => {
  it("gönderilen maili gönderen adresiyle saklar ve loglar", async () => {
    const log = vi.fn();
    const provider = new ConsoleMailProvider("groupUp <no-reply@groupup.local>", log);

    await provider.send({ to: "ali@ogr.kent.edu.tr", subject: "Kod", text: "123456", html: "<p>123456</p>" });

    expect(provider.sent).toHaveLength(1);
    expect(provider.sent[0]).toMatchObject({ to: "ali@ogr.kent.edu.tr", from: "groupUp <no-reply@groupup.local>" });
    expect(log).toHaveBeenCalledWith(expect.stringContaining("ali@ogr.kent.edu.tr"));
  });
});
