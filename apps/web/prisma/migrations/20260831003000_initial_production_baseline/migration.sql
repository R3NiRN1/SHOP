-- Initial reviewed migration for new PostgreSQL deployments.
-- Existing databases created with `prisma db push` must be baselined deliberately before `prisma migrate deploy`.
CREATE TYPE "Role" AS ENUM ('ADMIN', 'EDITOR', 'GROWER');

CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "role" "Role" NOT NULL DEFAULT 'EDITOR',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Grower" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "bio" TEXT,
    "region" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Grower_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Variety" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "species" TEXT,
    "description" TEXT,
    "price" DECIMAL(10,2),
    "stock" INTEGER,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Variety_price_range_check" CHECK ("price" IS NULL OR ("price" >= 0 AND "price" <= 10000.00)),
    CONSTRAINT "Variety_stock_range_check" CHECK ("stock" IS NULL OR ("stock" >= 0 AND "stock" <= 1000000)),
    CONSTRAINT "Variety_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Story" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "growerId" TEXT,
    "varietyId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Story_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Subscriber" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "consentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" TEXT,
    CONSTRAINT "Subscriber_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "Variety_slug_key" ON "Variety"("slug");
CREATE INDEX "Variety_published_name_idx" ON "Variety"("published", "name");
CREATE UNIQUE INDEX "Subscriber_email_key" ON "Subscriber"("email");

ALTER TABLE "Story" ADD CONSTRAINT "Story_growerId_fkey" FOREIGN KEY ("growerId") REFERENCES "Grower"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Story" ADD CONSTRAINT "Story_varietyId_fkey" FOREIGN KEY ("varietyId") REFERENCES "Variety"("id") ON DELETE SET NULL ON UPDATE CASCADE;
