import { PrismaClient } from '@prisma/client'

// Standard Next.js singleton: dev hot-reload must not leak connections.
const g = globalThis as unknown as { prisma?: PrismaClient }
export const db = g.prisma ?? new PrismaClient()
if (process.env.NODE_ENV !== 'production') g.prisma = db
