import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { sql } from '../db.js'

const shareBody = z.object({
  prayer_id: z.string().min(1),
  encrypted_data: z.string().min(1),
  expires_in_days: z.number().int().min(1).max(365).optional(),
})

export async function shareRoutes(app: FastifyInstance) {
  // POST /share — cria link de compartilhamento
  app.post('/share', { onRequest: [app.authenticate] }, async (req, reply) => {
    const result = shareBody.safeParse(req.body)
    if (!result.success) return reply.status(400).send({ error: 'Dados inválidos' })

    const { userId } = req.user as { userId: string }
    const { prayer_id, encrypted_data, expires_in_days } = result.data

    const [shared] = await sql`
      INSERT INTO shared_prayers (user_id, prayer_id, encrypted_data, expires_at)
      VALUES (
        ${userId},
        ${prayer_id},
        ${encrypted_data},
        ${expires_in_days ? sql`NOW() + ${expires_in_days} * INTERVAL '1 day'` : null}
      )
      RETURNING share_token, expires_at, created_at
    `
    return reply.status(201).send(shared)
  })

  // GET /share/:token — acessa oração compartilhada (público, sem auth)
  app.get('/share/:token', async (req, reply) => {
    const { token } = req.params as { token: string }
    const [shared] = await sql`
      SELECT prayer_id, encrypted_data, expires_at, view_count, created_at
      FROM shared_prayers
      WHERE share_token = ${token}
        AND (expires_at IS NULL OR expires_at > NOW())
    `
    if (!shared) return reply.status(404).send({ error: 'Link não encontrado ou expirado' })

    await sql`
      UPDATE shared_prayers SET view_count = view_count + 1 WHERE share_token = ${token}
    `
    return shared
  })

  // GET /share — lista compartilhamentos do usuário
  app.get('/share', { onRequest: [app.authenticate] }, async (req) => {
    const { userId } = req.user as { userId: string }
    return sql`
      SELECT id, prayer_id, share_token, expires_at, view_count, created_at
      FROM shared_prayers WHERE user_id = ${userId}
      ORDER BY created_at DESC
    `
  })

  // DELETE /share/:id — remove compartilhamento
  app.delete('/share/:id', { onRequest: [app.authenticate] }, async (req, reply) => {
    const { userId } = req.user as { userId: string }
    const { id } = req.params as { id: string }
    const result = await sql`
      DELETE FROM shared_prayers WHERE id = ${id} AND user_id = ${userId}
    `
    if (result.count === 0) return reply.status(404).send({ error: 'Não encontrado' })
    return reply.status(204).send()
  })
}
