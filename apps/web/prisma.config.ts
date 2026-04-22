import 'dotenv/config';
import { defineConfig } from 'prisma/config';

const args = process.argv.map((arg) => String(arg).toLowerCase());
const isGenerateCommand = args.includes('generate');

const PLACEHOLDER_DATABASE_URL = 'postgresql://placeholder:placeholder@localhost:5432/placeholder?schema=public';
const datasourceUrl = process.env.DATABASE_URL ?? (isGenerateCommand ? PLACEHOLDER_DATABASE_URL : null);

if (!datasourceUrl) {
  throw new Error(
    'DATABASE_URL is required for Prisma commands other than generate. Set DATABASE_URL before running migrate, db, studio, or other Prisma operations.',
  );
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url: datasourceUrl,
  },
});
