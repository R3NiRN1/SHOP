import 'dotenv/config';
import { defineConfig } from 'prisma/config';

const command = process.argv.slice(2).join(' ').toLowerCase();
const isGenerateCommand = command.includes('generate');

const datasourceUrl = process.env.DATABASE_URL
  ?? (isGenerateCommand ? 'postgresql://placeholder:placeholder@localhost:5432/placeholder?schema=public' : null);

if (!datasourceUrl) {
  throw new Error(
    'DATABASE_URL is required for this Prisma command. Set DATABASE_URL in your environment before running Prisma operations other than generate.',
  );
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url: datasourceUrl,
  },
});
