import { z } from "zod";

export const MIN_AGE = 13;

function isValidIsoDate(value: string): boolean {
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}

export const usernameSchema = z
  .string()
  .regex(/^[A-Za-z0-9_.]{3,32}$/, "Nome de usuário: 3 a 32 caracteres, letras, números, ponto ou sublinhado");

export const emailSchema = z.string().trim().toLowerCase().email("E-mail inválido").max(254);

// Limite máximo evita abuso do hash de senha com entradas enormes.
export const passwordSchema = z
  .string()
  .min(8, "A senha precisa ter no mínimo 8 caracteres")
  .max(200, "A senha é longa demais");

export const birthDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Data de nascimento inválida")
  .refine(isValidIsoDate, "Data de nascimento inválida");

export const displayNameSchema = z.string().trim().min(1, "Nome de exibição vazio").max(32);
export const bioSchema = z.string().max(190, "A bio pode ter até 190 caracteres");
export const statusSchema = z.enum(["online", "away", "dnd", "invisible"]);

export const registerSchema = z.object({
  email: emailSchema,
  username: usernameSchema,
  password: passwordSchema,
  birthDate: birthDateSchema,
  displayName: displayNameSchema.optional(),
});

export const loginSchema = z.object({
  identifier: z.string().trim().min(1).max(254),
  password: z.string().min(1).max(200),
});

export const updateProfileSchema = z
  .object({
    username: usernameSchema.optional(),
    displayName: displayNameSchema.optional(),
    bio: bioSchema.optional(),
    status: statusSchema.optional(),
  })
  .refine((data) => Object.keys(data).length > 0, "Nada para atualizar");

export const uuidParamSchema = z.object({ id: z.string().uuid() });

/** Idade completa em anos na data indicada (usa UTC para ser determinístico). */
export function ageOn(birthDate: string, on: Date): number {
  const [year, month, day] = birthDate.split("-").map(Number);
  let age = on.getUTCFullYear() - year;
  const monthDiff = on.getUTCMonth() + 1 - month;
  if (monthDiff < 0 || (monthDiff === 0 && on.getUTCDate() < day)) age -= 1;
  return age;
}

export function meetsMinimumAge(birthDate: string, on: Date = new Date()): boolean {
  return ageOn(birthDate, on) >= MIN_AGE;
}
