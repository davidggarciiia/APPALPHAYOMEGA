-- CreateEnum
CREATE TYPE "SexoUsuario" AS ENUM ('hombre', 'mujer');

-- AlterTable
ALTER TABLE "usuarios" ADD COLUMN     "sexo" "SexoUsuario";
