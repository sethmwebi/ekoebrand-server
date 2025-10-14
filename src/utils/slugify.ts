import slugify from "slugify";
import { randomUUID } from "crypto";
import { prisma } from "..";

export async function generateUniqueSlug(
  name: string,
  existingId?: string,
  maxAttempts = 100,
): Promise<string> {
  let slug = slugify(name, { lower: true, strict: true, trim: true });
  let existingProduct = await prisma.product.findFirst({
    where: {
      slug,
      NOT: { id: existingId },
    },
  });

  let counter = 1;
  const originalSlug = slug;

  while (existingProduct && counter <= maxAttempts) {
    slug = `${originalSlug}-${counter}`;
    existingProduct = await prisma.product.findFirst({
      where: {
        slug,
        NOT: { id: existingId },
      },
    });
    counter++;
  }

  if (counter > maxAttempts) {
    // Fallback to UUID if we can't find a unique slug
    return `${originalSlug}-${randomUUID().slice(0, 8)}`;
  }

  return slug;
}
