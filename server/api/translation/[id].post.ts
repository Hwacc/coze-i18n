import { omit } from 'lodash-es'
import prisma from '~/server/libs/prisma'
import { numericID } from '~/utils/id'
import { zTranslation } from '~/utils/schemas'
import { readZodBody } from '~/utils/validate'

/**
 * @route POST /api/translation/:id
 * @description Update a translation
 * @access Private
 */
export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Missing id',
    })
  }
  const nID = numericID(id)
  const body = await readZodBody(event, zTranslation.parse)
  if (!body.origin) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Missing origin text',
    })
  }
  const existing = await prisma.translation.findUnique({
    where: {
      id: nID,
    },
  })
  if (!existing) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Translation not found',
    })
  }
  // generate new fingerprint
  try {
    const updatedTranslation = await prisma.translation.update({
      where: {
        id: nID,
      },
      data: {
        ...omit(body, ['id', 'fingerprint']),
      },
    })
    await prisma.translationLog.create({
      data: {
        action: 'UPDATE',
        status: 'SUCCESS',
        origin: body.origin,
        fingerprint: existing.fingerprint,
        userID: numericID(session.user.id),
      },
    })
    return updatedTranslation
  } catch (error) {
    console.error(error)
    await prisma.translationLog.create({
      data: {
        action: 'UPDATE',
        status: 'ERROR',
        origin: body.origin,
        fingerprint: existing.fingerprint,
        userID: numericID(session.user.id),
      },
    })
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to update translation',
    })
  }
})
