import * as argon2 from 'argon2';

export async function validateHash(
  plainPassword: string,
  hashedPassword: string,
): Promise<boolean> {
  return argon2.verify(hashedPassword, plainPassword);
}
