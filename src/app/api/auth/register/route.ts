import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword, createSessionToken, SESSION_COOKIE_CONFIG } from "@/lib/auth";
import { registerSchema } from "@/lib/validation";
import { WalletService } from "@/services/wallet.service";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const validatedData = registerSchema.safeParse(body);

    if (!validatedData.success) {
      return NextResponse.json(
        { error: "Validation failed", details: validatedData.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { username, email, password } = validatedData.data;

    // Check unique username & email
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { email: email.toLowerCase() },
          { username: { equals: username, mode: "insensitive" } },
        ],
      },
    });

    if (existingUser) {
      if (existingUser.email.toLowerCase() === email.toLowerCase()) {
        return NextResponse.json({ error: "Email is already registered" }, { status: 409 });
      }
      return NextResponse.json({ error: "Username is already taken" }, { status: 409 });
    }

    const passwordHash = await hashPassword(password);

    // Create user and initialize wallet with 1,000 test coins
    const newUser = await prisma.user.create({
      data: {
        username,
        email: email.toLowerCase(),
        passwordHash,
        avatarUrl: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(username)}`,
      },
    });

    await WalletService.createWallet(newUser.id, 1000);

    const token = await createSessionToken({
      userId: newUser.id,
      username: newUser.username,
      email: newUser.email,
    });

    const response = NextResponse.json(
      {
        message: "Registration successful",
        user: {
          id: newUser.id,
          username: newUser.username,
          email: newUser.email,
          avatarUrl: newUser.avatarUrl,
          coinBalance: 1000,
        },
      },
      { status: 201 }
    );

    response.cookies.set(
      SESSION_COOKIE_CONFIG.name,
      token,
      SESSION_COOKIE_CONFIG.options
    );

    return response;
  } catch (error) {
    console.error("Registration error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
