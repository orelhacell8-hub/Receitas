import { createHash, createHmac, timingSafeEqual } from "node:crypto"
import { NextRequest, NextResponse } from "next/server"

const cookieName = "doce-ritual-admin"
const sessionLifetime = 8 * 60 * 60

function sessionSecret() {
  const secret = process.env.ADMIN_SESSION_SECRET
  if (!secret || secret.length < 32) {
    throw new Error("ADMIN_SESSION_SECRET precisa ter pelo menos 32 caracteres.")
  }
  return secret
}

function passwordMatches(input: string, expected: string) {
  const inputHash = createHash("sha256").update(input).digest()
  const expectedHash = createHash("sha256").update(expected).digest()
  return timingSafeEqual(inputHash, expectedHash)
}

export function verifyAdminPassword(input: string) {
  const expected = process.env.ADMIN_PASSWORD
  if (!expected) throw new Error("ADMIN_PASSWORD não está configurado.")
  return passwordMatches(input, expected)
}

function sign(payload: string) {
  return createHmac("sha256", sessionSecret()).update(payload).digest("base64url")
}

export function createAdminCookie(response: NextResponse) {
  const payload = Buffer.from(
    JSON.stringify({ expiresAt: Date.now() + sessionLifetime * 1000 }),
  ).toString("base64url")

  response.cookies.set(cookieName, `${payload}.${sign(payload)}`, {
    httpOnly: true,
    maxAge: sessionLifetime,
    path: "/",
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
  })
}

export function clearAdminCookie(response: NextResponse) {
  response.cookies.set(cookieName, "", {
    httpOnly: true,
    maxAge: 0,
    path: "/",
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
  })
}

export function isAdminRequest(request: NextRequest) {
  const value = request.cookies.get(cookieName)?.value
  if (!value) return false

  const [payload, signature, extra] = value.split(".")
  if (!payload || !signature || extra) return false

  try {
    const expected = Buffer.from(sign(payload))
    const actual = Buffer.from(signature)
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
      return false
    }

    const session = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    ) as { expiresAt?: unknown }
    return typeof session.expiresAt === "number" && session.expiresAt > Date.now()
  } catch {
    return false
  }
}
