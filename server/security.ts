import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>

export const sha256 = (s: string) => createHash('sha256').update(s).digest('hex')
export const newToken = () => randomBytes(32).toString('base64url')
export const newId = () => randomBytes(12).toString('base64url')

export async function hashPassword(pw: string): Promise<string> {
  const salt = randomBytes(16)
  const hash = await scrypt(pw, salt, 64)
  return `scrypt$${salt.toString('base64')}$${hash.toString('base64')}`
}

export async function verifyPassword(pw: string, stored: string): Promise<boolean> {
  const [alg, salt, hash] = stored.split('$')
  if (alg !== 'scrypt' || !salt || !hash) return false
  const expected = Buffer.from(hash, 'base64')
  const actual = await scrypt(pw, Buffer.from(salt, 'base64'), expected.length)
  return timingSafeEqual(actual, expected)
}

export const validEmail = (e: string) => e.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)
