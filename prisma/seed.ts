import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const GIFTS = [
  {
    name: "Heart",
    coinPrice: 10,
    assetUrl: "/gifts/heart.svg",
  },
  {
    name: "Rose",
    coinPrice: 50,
    assetUrl: "/gifts/rose.svg",
  },
  {
    name: "Star",
    coinPrice: 100,
    assetUrl: "/gifts/star.svg",
  },
  {
    name: "Diamond",
    coinPrice: 500,
    assetUrl: "/gifts/diamond.svg",
  },
];

async function main() {
  console.log("Seeding predefined gifts...");

  for (const gift of GIFTS) {
    await prisma.gift.upsert({
      where: { name: gift.name },
      update: {
        coinPrice: gift.coinPrice,
        assetUrl: gift.assetUrl,
        isActive: true,
      },
      create: {
        name: gift.name,
        coinPrice: gift.coinPrice,
        assetUrl: gift.assetUrl,
        isActive: true,
      },
    });
  }

  console.log("Gifts successfully seeded!");
}

main()
  .catch((e) => {
    console.error("Error during seeding:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
