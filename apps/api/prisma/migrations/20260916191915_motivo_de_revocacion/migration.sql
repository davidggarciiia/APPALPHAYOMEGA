-- CreateEnum
CREATE TYPE "MotivoRevocacion" AS ENUM ('rotacion', 'cierre', 'reuso');

-- AlterTable
ALTER TABLE "tokens_refresco" ADD COLUMN     "motivoRevocacion" "MotivoRevocacion";
