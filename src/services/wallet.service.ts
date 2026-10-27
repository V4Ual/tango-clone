import { prisma } from "@/lib/prisma";

export class WalletService {
  static async getBalance(userId: string): Promise<number> {
    const wallet = await prisma.wallet.findUnique({
      where: { userId },
    });
    return wallet?.coinBalance ?? 0;
  }

  static async getWallet(userId: string) {
    return prisma.wallet.findUnique({
      where: { userId },
    });
  }

  static async createWallet(userId: string, initialBalance = 1000) {
    return prisma.wallet.upsert({
      where: { userId },
      update: {},
      create: {
        userId,
        coinBalance: initialBalance,
      },
    });
  }
}
