import type { FastifyInstance } from 'fastify'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { sql } from '../db.js'

const registerBody = z.object({
  email: z.string().email(),
  password: z.string().min(8),
})

const loginBody = z.object({
  email: z.string().email(),
  password: z.string(),
})

export async function authRoutes(app: FastifyInstance) {
  // POST /auth/register
  app.post('/auth/register', async (req, reply) => {
    const result = registerBody.safeParse(req.body)
    if (!result.success) return reply.status(400).send({ error: 'Dados inválidos' })

    const { email, password } = result.data
    const hash = await bcrypt.hash(password, 12)

    try {
      const [user] = await sql`
        INSERT INTO users (email, password_hash)
        VALUES (${email.toLowerCase()}, ${hash})
        RETURNING id, email, created_at
      `
      const token = app.jwt.sign({ userId: user.id }, { expiresIn: '7d' })
      await sql`
        INSERT INTO sessions (user_id, token, expires_at)
        VALUES (${user.id}, ${token}, NOW() + INTERVAL '7 days')
      `
      return reply.status(201).send({ token, user: { id: user.id, email: user.email } })
    } catch (e: any) {
      if (e.code === '23505') return reply.status(409).send({ error: 'Email já cadastrado' })
      throw e
    }
  })

  // POST /auth/login
  app.post('/auth/login', async (req, reply) => {
    const result = loginBody.safeParse(req.body)
    if (!result.success) return reply.status(400).send({ error: 'Dados inválidos' })

    const { email, password } = result.data
    const [user] = await sql`
      SELECT id, email, password_hash FROM users WHERE email = ${email.toLowerCase()}
    `
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return reply.status(401).send({ error: 'Email ou senha incorretos' })
    }

    const token = app.jwt.sign({ userId: user.id }, { expiresIn: '7d' })
    await sql`
      INSERT INTO sessions (user_id, token, expires_at)
      VALUES (${user.id}, ${token}, NOW() + INTERVAL '7 days')
    `
    return { token, user: { id: user.id, email: user.email } }
  })

  // POST /auth/logout
  app.post('/auth/logout', { onRequest: [app.authenticate] }, async (req, reply) => {
    const auth = req.headers.authorization?.replace('Bearer ', '') ?? ''
    await sql`DELETE FROM sessions WHERE token = ${auth}`
    return reply.status(204).send()
  })

  // GET /auth/me
  app.get('/auth/me', { onRequest: [app.authenticate] }, async (req) => {
    const { userId } = req.user as { userId: string }
    const [user] = await sql`SELECT id, email, created_at FROM users WHERE id = ${userId}`
    if (!user) throw { statusCode: 404, message: 'Usuário não encontrado' }
    return user
  })

  // DELETE /auth/account
  app.delete('/auth/account', { onRequest: [app.authenticate] }, async (req, reply) => {
    const { userId } = req.user as { userId: string }
    await sql`DELETE FROM users WHERE id = ${userId}`
    return reply.status(204).send()
  })
}
