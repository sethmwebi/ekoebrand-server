import { PrismaClient } from "../generated/prisma_client";
import fs from "fs";
import path from "path";

const prisma = new PrismaClient();

async function deleteAllData(orderedFileNames: string[]) {
  for (const fileName of orderedFileNames.reverse()) {
    const modelName = path.basename(fileName, path.extname(fileName));
    const model: any = prisma[modelName as keyof typeof prisma];

    if (!model) {
      console.warn(`Skipping unknown model: ${modelName}`);
      continue;
    }

    try {
      await model.deleteMany();
      console.log(`Cleared data from ${modelName}`);
    } catch (error) {
      console.error(`Error clearing data from ${modelName}:`, error);
    }
  }
}

async function main() {
  const dataDirectory = path.join(__dirname, "seedData");

  const orderedFileNames = [
    "category.json",
    "tag.json",
    "product.json",
    "productTags.json",
    "user.json",
    "address.json",
    "account.json",
    "verificationToken.json",
    "order.json",
    "orderItem.json",
    "payment.json",
    "cartItem.json",
    "review.json",
  ];

  // Delete all the existing data first
  await deleteAllData(orderedFileNames.reverse());

  // Insert new data
  for (const fileName of orderedFileNames) {
    const filePath = path.join(dataDirectory, fileName);

    if (!fs.existsSync(filePath)) {
      console.warn(`Skipping missing file: ${fileName}`);
      continue;
    }

    const jsonData = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    const modelName = path.basename(fileName, path.extname(fileName));

    if (modelName === "productTags") {
      // Handle many-to-many relationship seeding
      for (const data of jsonData) {
        await prisma.productTags.create({
          data: {
            productId: data.product_id,
            tagId: data.tag_id,
          },
        });
      }
    } else {
      // Handle regular seeding
      const model: any = prisma[modelName as keyof typeof prisma];
      if (!model) {
        console.warn(`Skipping unknown model: ${modelName}`);
        continue;
      }

      for (const data of jsonData) {
        await model.create({ data });
      }
    }

    console.log(`Seeded ${modelName} with data from ${fileName}`);
  }
}

main()
  .catch((e) => console.error(e))
  .finally(async () => await prisma.$disconnect());
