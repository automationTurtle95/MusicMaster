-- CreateTable
CREATE TABLE "Instrument" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "inventoryNumber" TEXT NOT NULL,
    "condition" TEXT NOT NULL,
    "notes" TEXT,
    "memberId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Instrument_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Instrument_inventoryNumber_key" ON "Instrument"("inventoryNumber");

-- CreateIndex
CREATE INDEX "Instrument_memberId_idx" ON "Instrument"("memberId");
