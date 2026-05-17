import Fastify from 'fastify'
import cors from '@fastify/cors'
import jwt from '@fastify/jwt'
import { env } from './env.js'
import { sql } from './db.js'
import { authRoutes } from './routes/auth.js'
import { vaultRoutes } from './routes/vault.js'
import { shareRoutes } from './routes/share.js'

const app = Fastify({ logger: true })

await app.register(cors, {
  origin: true,
  credentials: true,
})

await app.register(jwt, {
  secret: env.JWT_SECRET,
})

app.decorate('authenticate', async (req: any, reply: any) => {
  try {
    await req.jwtVerify()
    const token = req.headers.authorization?.replace('Bearer ', '') ?? ''
    const [session] = await sql`
      SELECT id FROM sessions WHERE token = ${token} AND expires_at > NOW()
    `
    if (!session) return reply.status(401).send({ error: 'Sessão inválida ou expirada' })
  } catch {
    return reply.status(401).send({ error: 'Token inválido' })
  }
})

await app.register(authRoutes)
await app.register(vaultRoutes)
await app.register(shareRoutes)

app.get('/health', async () => ({ status: 'ok', ts: new Date().toISOString() }))

try {
  await app.listen({ port: env.PORT, host: env.HOST })
} catch (err) {
  app.log.error(err)
  process.exit(1)
}
