-- CreateEnum
CREATE TYPE "ExerciseKind" AS ENUM ('reps', 'hold');

-- CreateEnum
CREATE TYPE "TargetUnit" AS ENUM ('reps', 'sec');

-- CreateEnum
CREATE TYPE "PartKind" AS ENUM ('pull', 'push', 'legs', 'core', 'other');

-- CreateEnum
CREATE TYPE "SessionSource" AS ENUM ('app', 'import');

-- CreateEnum
CREATE TYPE "Discomfort" AS ENUM ('none', 'mild', 'pain');

-- CreateEnum
CREATE TYPE "Side" AS ENUM ('L', 'R');

-- CreateEnum
CREATE TYPE "AssistanceType" AS ENUM ('band', 'machine');

-- CreateEnum
CREATE TYPE "ImportKind" AS ENUM ('file', 'photo', 'quick_entry');

-- CreateEnum
CREATE TYPE "ImportStatus" AS ENUM ('draft', 'processing', 'needs_review', 'committed', 'undone', 'failed');

-- CreateEnum
CREATE TYPE "ImportImageStatus" AS ENUM ('queued', 'parsed', 'needs_review', 'confirmed', 'failed');

-- CreateTable
CREATE TABLE "user" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL,
    "image" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'America/Edmonton',
    "deloadEnabled" BOOLEAN NOT NULL DEFAULT true,
    "deloadEveryWeeks" INTEGER NOT NULL DEFAULT 4,
    "createdAt" TIMESTAMPTZ(3) NOT NULL,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session" (
    "id" TEXT NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "userId" TEXT NOT NULL,

    CONSTRAINT "session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMPTZ(3),
    "refreshTokenExpiresAt" TIMESTAMPTZ(3),
    "scope" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "createdAt" TIMESTAMPTZ(3),
    "updatedAt" TIMESTAMPTZ(3),

    CONSTRAINT "verification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exercise" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "aliases" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "kind" "ExerciseKind" NOT NULL,
    "perSide" BOOLEAN NOT NULL DEFAULT false,
    "allowsWeight" BOOLEAN NOT NULL DEFAULT false,
    "allowsAssistance" BOOLEAN NOT NULL DEFAULT false,
    "progressionChainId" TEXT,
    "notes" TEXT,
    "archivedAt" TIMESTAMPTZ(3),
    "archivedReason" TEXT,
    "replacedById" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "exercise_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "progression_chain" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "progression_chain_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "progression_step" (
    "id" TEXT NOT NULL,
    "chainId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "exerciseId" TEXT,

    CONSTRAINT "progression_step_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session_template" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "session_template_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "template_part" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "PartKind" NOT NULL,
    "goal" TEXT,
    "warmupKey" TEXT,

    CONSTRAINT "template_part_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "planned_exercise" (
    "id" TEXT NOT NULL,
    "partId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "exerciseId" TEXT NOT NULL,
    "altExerciseId" TEXT,
    "sets" INTEGER NOT NULL,
    "targetMin" INTEGER NOT NULL,
    "targetMax" INTEGER,
    "targetUnit" "TargetUnit" NOT NULL,
    "workingTarget" INTEGER,
    "maxSets" INTEGER,
    "restSec" INTEGER,
    "restMaxSec" INTEGER,
    "notes" TEXT,
    "supersetGroup" TEXT,

    CONSTRAINT "planned_exercise_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "target_change" (
    "id" TEXT NOT NULL,
    "plannedExerciseId" TEXT NOT NULL,
    "effectiveFrom" DATE NOT NULL,
    "sets" INTEGER NOT NULL,
    "targetMin" INTEGER NOT NULL,
    "targetMax" INTEGER,
    "workingTarget" INTEGER,
    "reason" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "target_change_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "program" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "program_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "program_day" (
    "id" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "weekday" INTEGER NOT NULL,
    "templateId" TEXT,

    CONSTRAINT "program_day_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workout_session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "startedAt" TIMESTAMPTZ(3),
    "endedAt" TIMESTAMPTZ(3),
    "templateId" TEXT,
    "title" TEXT,
    "sessionNotes" TEXT,
    "discomfort" "Discomfort",
    "discomfortNote" TEXT,
    "isDeload" BOOLEAN NOT NULL DEFAULT false,
    "source" "SessionSource" NOT NULL DEFAULT 'app',
    "importBatchId" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "deletedAt" TIMESTAMPTZ(3),

    CONSTRAINT "workout_session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exercise_entry" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "exerciseId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "partName" TEXT,
    "supersetGroup" TEXT,
    "plannedSets" INTEGER,
    "plannedTargetMin" INTEGER,
    "plannedTargetMax" INTEGER,
    "plannedUnit" "TargetUnit",
    "plannedWorking" INTEGER,
    "restSec" INTEGER,
    "breakAfterSec" INTEGER,
    "notes" TEXT,
    "variationStepId" TEXT,
    "discomfort" "Discomfort",
    "discomfortNote" TEXT,

    CONSTRAINT "exercise_entry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "set_entry" (
    "id" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "index" INTEGER NOT NULL,
    "value" INTEGER NOT NULL,
    "unit" "TargetUnit" NOT NULL,
    "side" "Side",
    "weightKg" DECIMAL(6,2),
    "assistanceType" "AssistanceType",
    "assistanceLabel" TEXT,
    "assistanceKg" DECIMAL(6,2),
    "rir" INTEGER,
    "clean" BOOLEAN,
    "restActualSec" INTEGER,
    "note" TEXT,

    CONSTRAINT "set_entry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bodyweight_log" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "kg" DECIMAL(5,2) NOT NULL,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "deletedAt" TIMESTAMPTZ(3),

    CONSTRAINT "bodyweight_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gtg_log" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "seconds" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gtg_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "import_batch" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "ImportKind" NOT NULL,
    "sourceName" TEXT,
    "rowCount" INTEGER NOT NULL DEFAULT 0,
    "status" "ImportStatus" NOT NULL DEFAULT 'draft',
    "summary" JSONB,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "committedAt" TIMESTAMPTZ(3),
    "undoneAt" TIMESTAMPTZ(3),

    CONSTRAINT "import_batch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "import_image" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "sessionGroup" TEXT,
    "status" "ImportImageStatus" NOT NULL DEFAULT 'queued',
    "modelOutput" JSONB,
    "fieldConfidence" JSONB,
    "error" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "import_image_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- CreateIndex
CREATE UNIQUE INDEX "session_token_key" ON "session"("token");

-- CreateIndex
CREATE INDEX "session_userId_idx" ON "session"("userId");

-- CreateIndex
CREATE INDEX "account_userId_idx" ON "account"("userId");

-- CreateIndex
CREATE INDEX "verification_identifier_idx" ON "verification"("identifier");

-- CreateIndex
CREATE INDEX "exercise_userId_idx" ON "exercise"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "exercise_userId_normalizedName_key" ON "exercise"("userId", "normalizedName");

-- CreateIndex
CREATE UNIQUE INDEX "progression_chain_userId_name_key" ON "progression_chain"("userId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "progression_step_chainId_order_key" ON "progression_step"("chainId", "order");

-- CreateIndex
CREATE INDEX "session_template_userId_idx" ON "session_template"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "template_part_templateId_order_key" ON "template_part"("templateId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "planned_exercise_partId_order_key" ON "planned_exercise"("partId", "order");

-- CreateIndex
CREATE INDEX "target_change_plannedExerciseId_effectiveFrom_idx" ON "target_change"("plannedExerciseId", "effectiveFrom");

-- CreateIndex
CREATE INDEX "program_userId_active_idx" ON "program"("userId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "program_day_programId_weekday_key" ON "program_day"("programId", "weekday");

-- CreateIndex
CREATE INDEX "workout_session_userId_date_idx" ON "workout_session"("userId", "date");

-- CreateIndex
CREATE INDEX "workout_session_userId_updatedAt_idx" ON "workout_session"("userId", "updatedAt");

-- CreateIndex
CREATE INDEX "exercise_entry_exerciseId_idx" ON "exercise_entry"("exerciseId");

-- CreateIndex
CREATE UNIQUE INDEX "exercise_entry_sessionId_order_key" ON "exercise_entry"("sessionId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "set_entry_entryId_index_side_key" ON "set_entry"("entryId", "index", "side");

-- CreateIndex
CREATE UNIQUE INDEX "bodyweight_log_userId_date_key" ON "bodyweight_log"("userId", "date");

-- CreateIndex
CREATE INDEX "gtg_log_userId_date_idx" ON "gtg_log"("userId", "date");

-- CreateIndex
CREATE INDEX "import_batch_userId_createdAt_idx" ON "import_batch"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "import_image_batchId_status_idx" ON "import_image"("batchId", "status");

-- AddForeignKey
ALTER TABLE "session" ADD CONSTRAINT "session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account" ADD CONSTRAINT "account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exercise" ADD CONSTRAINT "exercise_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exercise" ADD CONSTRAINT "exercise_progressionChainId_fkey" FOREIGN KEY ("progressionChainId") REFERENCES "progression_chain"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "progression_chain" ADD CONSTRAINT "progression_chain_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "progression_step" ADD CONSTRAINT "progression_step_chainId_fkey" FOREIGN KEY ("chainId") REFERENCES "progression_chain"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "progression_step" ADD CONSTRAINT "progression_step_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "exercise"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_template" ADD CONSTRAINT "session_template_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "template_part" ADD CONSTRAINT "template_part_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "session_template"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "planned_exercise" ADD CONSTRAINT "planned_exercise_partId_fkey" FOREIGN KEY ("partId") REFERENCES "template_part"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "planned_exercise" ADD CONSTRAINT "planned_exercise_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "exercise"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "planned_exercise" ADD CONSTRAINT "planned_exercise_altExerciseId_fkey" FOREIGN KEY ("altExerciseId") REFERENCES "exercise"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "target_change" ADD CONSTRAINT "target_change_plannedExerciseId_fkey" FOREIGN KEY ("plannedExerciseId") REFERENCES "planned_exercise"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "program" ADD CONSTRAINT "program_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "program_day" ADD CONSTRAINT "program_day_programId_fkey" FOREIGN KEY ("programId") REFERENCES "program"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "program_day" ADD CONSTRAINT "program_day_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "session_template"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workout_session" ADD CONSTRAINT "workout_session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workout_session" ADD CONSTRAINT "workout_session_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "session_template"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workout_session" ADD CONSTRAINT "workout_session_importBatchId_fkey" FOREIGN KEY ("importBatchId") REFERENCES "import_batch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exercise_entry" ADD CONSTRAINT "exercise_entry_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "workout_session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exercise_entry" ADD CONSTRAINT "exercise_entry_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "exercise"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exercise_entry" ADD CONSTRAINT "exercise_entry_variationStepId_fkey" FOREIGN KEY ("variationStepId") REFERENCES "progression_step"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "set_entry" ADD CONSTRAINT "set_entry_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "exercise_entry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bodyweight_log" ADD CONSTRAINT "bodyweight_log_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gtg_log" ADD CONSTRAINT "gtg_log_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_batch" ADD CONSTRAINT "import_batch_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_image" ADD CONSTRAINT "import_image_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "import_batch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
