import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { sql } from '../db.js'

const syncBody = z.object({
  encrypted_data: z.string().min(1),
  salt: z.string().min(1),
  client_version: z.number().int().positive(),
})

export async function vaultRoutes(app: FastifyInstance) {
  // GET /vault — puxa vault do servidor
  app.get('/vault', { onRequest: [app.authenticate] }, async (req, reply) => {
    const { userId } = req.user as { userId: string }
    const [vault] = await sql`
      SELECT encrypted_data, salt, client_version, updated_at
      FROM vaults WHERE user_id = ${userId}
    `
    if (!vault) return reply.status(404).send({ error: 'Vault não encontrado' })
    return vault
  })

  // PUT /vault — salva/sincroniza vault cifrado
  app.put('/vault', { onRequest: [app.authenticate] }, async (req, reply) => {
    const result = syncBody.safeParse(req.body)
    if (!result.success) return reply.status(400).send({ error: 'Dados inválidos' })

    const { userId } = req.user as { userId: string }
    const { encrypted_data, salt, client_version } = result.data

    const [vault] = await sql`
      INSERT INTO vaults (user_id, encrypted_data, salt, client_version)
      VALUES (${userId}, ${encrypted_data}, ${salt}, ${client_version})
      ON CONFLICT (user_id) DO UPDATE
        SET encrypted_data  = EXCLUDED.encrypted_data,
            salt            = EXCLUDED.salt,
            client_version  = EXCLUDED.client_version,
            updated_at      = NOW()
      RETURNING client_version, updated_at
    `
    return reply.status(200).send(vault)
  })

  // DELETE /vault
  app.delete('/vault', { onRequest: [app.authenticate] }, async (req, reply) => {
    const { userId } = req.user as { userId: string }
    await sql`DELETE FROM vaults WHERE user_id = ${userId}`
    return reply.status(204).send()
  })
}
