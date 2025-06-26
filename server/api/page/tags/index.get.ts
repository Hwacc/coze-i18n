import prisma from '~/server/libs/prisma'
import { z } from 'zod/v4'

const zQuery = z.object({
  pageID: z.string(),
})

/**
 * @route GET /api/tag
 * @query pageID
 * @description Get page all tags
 * @access Private
 */
export default defineEventHandler(async (event) => {
  await requireUserSession(event)
  const { pageID } = await getValidatedQuery(event, zQuery.parse)
  const tags = await prisma.tag.findMany({
    where: {
      pageID: parseInt(pageID),
    },
    include: {
      translation: true,
    },
  })
  return tags
})
