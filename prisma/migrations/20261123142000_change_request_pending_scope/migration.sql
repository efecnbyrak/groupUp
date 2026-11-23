-- Tek PENDING kuralı kulüp kapsamlı: aynı kişi için iki farklı kulüp ayrı talep açabilir.
DROP INDEX "ChangeRequest_one_pending_per_target";
CREATE UNIQUE INDEX "ChangeRequest_one_pending_per_target" ON "ChangeRequest"("type", "targetId", COALESCE("clubId", '')) WHERE "status" = 'PENDING';
