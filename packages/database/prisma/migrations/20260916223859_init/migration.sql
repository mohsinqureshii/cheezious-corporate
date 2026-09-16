-- CreateEnum
CREATE TYPE "Locale" AS ENUM ('en', 'ur');

-- CreateEnum
CREATE TYPE "ContentStatus" AS ENUM ('DRAFT', 'IN_REVIEW', 'CHANGES_REQUESTED', 'APPROVED', 'SCHEDULED', 'PUBLISHED', 'UNPUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "TranslationStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'READY', 'PUBLISHED', 'OUTDATED');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('INVITED', 'ACTIVE', 'DISABLED');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'RESTORE', 'PUBLISH', 'UNPUBLISH', 'SCHEDULE', 'CANCEL_SCHEDULE', 'APPROVE', 'REQUEST_CHANGES', 'SUBMIT_FOR_REVIEW', 'ARCHIVE', 'LOGIN', 'LOGIN_FAILED', 'LOGOUT', 'PASSWORD_RESET_REQUESTED', 'PASSWORD_RESET_COMPLETED', 'ROLE_ASSIGNED', 'ROLE_REVOKED', 'PERMISSION_CHANGED', 'SETTINGS_CHANGED', 'MEDIA_UPLOADED', 'MEDIA_DELETED', 'EXPORT', 'STATUS_CHANGED');

-- CreateEnum
CREATE TYPE "MediaKind" AS ENUM ('IMAGE', 'VIDEO', 'DOCUMENT', 'AUDIO', 'OTHER');

-- CreateEnum
CREATE TYPE "MediaVisibility" AS ENUM ('PUBLIC_DOWNLOAD', 'CMS_ONLY', 'RESTRICTED');

-- CreateEnum
CREATE TYPE "PageType" AS ENUM ('STANDARD', 'LANDING', 'SECTION_INDEX', 'EDITORIAL', 'DOCUMENT_CENTRE', 'CONTACT', 'SYSTEM');

-- CreateEnum
CREATE TYPE "NavigationLocation" AS ENUM ('PRIMARY', 'FOOTER', 'UTILITY', 'LEGAL', 'MOBILE_ONLY');

-- CreateEnum
CREATE TYPE "NavigationItemKind" AS ENUM ('PAGE', 'EXTERNAL', 'GROUP', 'FEATURED');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('DRAFT', 'OPEN', 'PAUSED', 'CLOSED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "EmploymentType" AS ENUM ('FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERNSHIP', 'TEMPORARY', 'APPRENTICESHIP');

-- CreateEnum
CREATE TYPE "WorkplaceType" AS ENUM ('ON_SITE', 'HYBRID', 'REMOTE');

-- CreateEnum
CREATE TYPE "ApplicationStatus" AS ENUM ('NEW', 'REVIEWING', 'SHORTLISTED', 'INTERVIEW', 'OFFER', 'HIRED', 'REJECTED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "SupplierSubmissionStatus" AS ENUM ('NEW', 'REVIEWING', 'QUALIFIED', 'CONTACTED', 'APPROVED', 'REJECTED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "PropertySubmissionStatus" AS ENUM ('NEW', 'REVIEWING', 'INTERESTING', 'SITE_VISIT', 'ACCEPTED', 'REJECTED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "PartnershipSubmissionStatus" AS ENUM ('NEW', 'REVIEWING', 'IN_DISCUSSION', 'ACCEPTED', 'DECLINED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ContactSubmissionStatus" AS ENUM ('NEW', 'IN_PROGRESS', 'ANSWERED', 'CLOSED', 'SPAM');

-- CreateEnum
CREATE TYPE "ContactCategoryKey" AS ENUM ('CUSTOMER', 'CORPORATE', 'MEDIA', 'CAREERS', 'SUPPLIERS', 'REAL_ESTATE', 'PARTNERSHIPS', 'OTHER');

-- CreateEnum
CREATE TYPE "PropertyType" AS ENUM ('HIGH_STREET', 'SHOPPING_MALL', 'STANDALONE', 'FOOD_COURT', 'DRIVE_THROUGH', 'KIOSK', 'COMMERCIAL_PLAZA', 'OTHER');

-- CreateEnum
CREATE TYPE "OwnershipType" AS ENUM ('OWNER', 'AUTHORISED_AGENT', 'DEVELOPER', 'OTHER');

-- CreateEnum
CREATE TYPE "FormFieldType" AS ENUM ('TEXT', 'TEXTAREA', 'EMAIL', 'PHONE', 'NUMBER', 'SELECT', 'MULTISELECT', 'RADIO', 'CHECKBOX', 'DATE', 'FILE', 'CONSENT', 'HIDDEN');

-- CreateEnum
CREATE TYPE "ReportType" AS ENUM ('COMPANY_PROFILE', 'FACT_SHEET', 'IMPACT_REPORT', 'FOOD_SAFETY_OVERVIEW', 'SUPPLIER_CODE', 'POLICY', 'PRESENTATION', 'OTHER');

-- CreateEnum
CREATE TYPE "PublishingJobKind" AS ENUM ('PUBLISH', 'UNPUBLISH', 'REINDEX', 'MEDIA_VARIANTS', 'CONTENT_HEALTH_SCAN', 'EXPORT', 'NOTIFICATION');

-- CreateEnum
CREATE TYPE "PublishingJobStatus" AS ENUM ('PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "NotificationKind" AS ENUM ('SUBMITTED_FOR_REVIEW', 'CHANGES_REQUESTED', 'APPROVED', 'SCHEDULED', 'PUBLISHED', 'PUBLISH_FAILED', 'TRANSLATION_OUTDATED', 'SUBMISSION_ASSIGNED', 'MENTION');

-- CreateEnum
CREATE TYPE "SearchDocumentType" AS ENUM ('PAGE', 'STORY', 'NEWS', 'PRESS_RELEASE', 'PERSON', 'EMPLOYEE_STORY', 'JOB', 'REPORT', 'POLICY', 'INGREDIENT', 'AWARD', 'LOCATION');

-- CreateEnum
CREATE TYPE "ContentHealthIssueType" AS ENUM ('MISSING_SEO_TITLE', 'MISSING_META_DESCRIPTION', 'MISSING_OG_IMAGE', 'MISSING_ALT_TEXT', 'BROKEN_INTERNAL_LINK', 'MISSING_TRANSLATION', 'OUTDATED_TRANSLATION', 'EMPTY_REQUIRED_BLOCK', 'UNPUBLISHED_LINKED_CONTENT', 'ORPHAN_PAGE', 'INVALID_REDIRECT', 'PAST_REVIEW_DATE', 'UNPUBLISHED_CHANGES');

-- CreateEnum
CREATE TYPE "ContentHealthSeverity" AS ENUM ('INFO', 'WARNING', 'ERROR');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "jobTitle" TEXT,
    "passwordHash" TEXT,
    "status" "UserStatus" NOT NULL DEFAULT 'INVITED',
    "avatarId" TEXT,
    "lastLoginAt" TIMESTAMP(3),
    "lastLoginIp" TEXT,
    "failedLoginCount" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "passwordChangedAt" TIMESTAMP(3),
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
    "ssoSubject" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "invitedById" TEXT,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "group" TEXT NOT NULL,
    "isHighRisk" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_roles" (
    "userId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assignedById" TEXT,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("userId","roleId")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "roleId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("roleId","permissionId")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userAgent" TEXT,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastActiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "revokedReason" TEXT,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "password_resets" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipAddress" TEXT,

    CONSTRAINT "password_resets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "login_attempts" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "userId" TEXT,
    "successful" BOOLEAN NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "login_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "actorEmail" TEXT,
    "action" "AuditAction" NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "entityLabel" TEXT,
    "summary" TEXT,
    "changes" JSONB,
    "metadata" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_logs" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "verb" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "entityLabel" TEXT,
    "href" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "NotificationKind" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "href" TEXT,
    "entityType" TEXT,
    "entityId" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "site_settings" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "locale" "Locale" NOT NULL,
    "value" JSONB NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "group" TEXT NOT NULL DEFAULT 'general',
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "site_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "global_settings" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "group" TEXT NOT NULL DEFAULT 'general',
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "global_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feature_flags" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "config" JSONB,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "feature_flags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "locale_configs" (
    "id" TEXT NOT NULL,
    "code" "Locale" NOT NULL,
    "label" TEXT NOT NULL,
    "nativeLabel" TEXT NOT NULL,
    "direction" TEXT NOT NULL DEFAULT 'ltr',
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "locale_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_versions" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "data" JSONB NOT NULL,
    "status" "ContentStatus" NOT NULL,
    "note" TEXT,
    "restoredFromVersionId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "content_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_events" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "fromStatus" "ContentStatus" NOT NULL,
    "toStatus" "ContentStatus" NOT NULL,
    "note" TEXT,
    "actorId" TEXT,
    "actorName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workflow_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "block_definitions" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL,
    "icon" TEXT,
    "schema" JSONB NOT NULL,
    "defaults" JSONB,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "allowedPageTypes" "PageType"[] DEFAULT ARRAY[]::"PageType"[],
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "block_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pages" (
    "id" TEXT NOT NULL,
    "translationGroupId" TEXT NOT NULL,
    "locale" "Locale" NOT NULL,
    "path" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "navLabel" TEXT,
    "summary" TEXT,
    "type" "PageType" NOT NULL DEFAULT 'STANDARD',
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "translationStatus" "TranslationStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "publishedVersionId" TEXT,
    "hasUnpublishedChanges" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3),
    "scheduledFor" TIMESTAMP(3),
    "unpublishAt" TIMESTAMP(3),
    "firstPublishedAt" TIMESTAMP(3),
    "reviewDate" TIMESTAMP(3),
    "contentOwnerId" TEXT,
    "excludeFromSearch" BOOLEAN NOT NULL DEFAULT false,
    "excludeFromSitemap" BOOLEAN NOT NULL DEFAULT false,
    "parentId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT,
    "updatedById" TEXT,
    "publishedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "pages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "page_blocks" (
    "id" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "definitionId" TEXT NOT NULL,
    "blockKey" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isHidden" BOOLEAN NOT NULL DEFAULT false,
    "label" TEXT,
    "anchor" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "page_blocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "page_seo" (
    "id" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "title" TEXT,
    "description" TEXT,
    "canonicalUrl" TEXT,
    "noindex" BOOLEAN NOT NULL DEFAULT false,
    "nofollow" BOOLEAN NOT NULL DEFAULT false,
    "ogTitle" TEXT,
    "ogDescription" TEXT,
    "ogImageId" TEXT,
    "twitterCard" TEXT DEFAULT 'summary_large_image',
    "structuredData" JSONB,
    "keywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "changeFrequency" TEXT,
    "priority" DOUBLE PRECISION,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "page_seo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "slug_history" (
    "id" TEXT NOT NULL,
    "pageId" TEXT,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "locale" "Locale" NOT NULL,
    "oldPath" TEXT NOT NULL,
    "newPath" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,

    CONSTRAINT "slug_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "redirects" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "destination" TEXT NOT NULL,
    "statusCode" INTEGER NOT NULL DEFAULT 301,
    "locale" "Locale",
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "isAutomatic" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT,
    "hitCount" INTEGER NOT NULL DEFAULT 0,
    "lastHitAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "redirects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "navigations" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "location" "NavigationLocation" NOT NULL,
    "locale" "Locale" NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "navigations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "navigation_items" (
    "id" TEXT NOT NULL,
    "navigationId" TEXT NOT NULL,
    "kind" "NavigationItemKind" NOT NULL DEFAULT 'PAGE',
    "label" TEXT NOT NULL,
    "descriptor" TEXT,
    "pageId" TEXT,
    "externalUrl" TEXT,
    "opensInNewTab" BOOLEAN NOT NULL DEFAULT false,
    "featuredStoryId" TEXT,
    "featuredImageId" TEXT,
    "featuredEyebrow" TEXT,
    "featuredHeadline" TEXT,
    "isCallToAction" BOOLEAN NOT NULL DEFAULT false,
    "parentId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isVisible" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "navigation_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "footer_configurations" (
    "id" TEXT NOT NULL,
    "locale" "Locale" NOT NULL,
    "copyrightTemplate" TEXT NOT NULL DEFAULT 'Cheezious © {year}',
    "showLocaleSwitch" BOOLEAN NOT NULL DEFAULT true,
    "socialLinks" JSONB NOT NULL DEFAULT '[]',
    "legalLinks" JSONB NOT NULL DEFAULT '[]',
    "regionLabel" TEXT NOT NULL DEFAULT 'Pakistan',
    "note" TEXT,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "footer_configurations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media_folders" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "parentId" TEXT,
    "path" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "media_folders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media_assets" (
    "id" TEXT NOT NULL,
    "kind" "MediaKind" NOT NULL,
    "folderId" TEXT,
    "storageKey" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "byteSize" INTEGER NOT NULL,
    "checksum" TEXT,
    "width" INTEGER,
    "height" INTEGER,
    "duration" INTEGER,
    "placeholderColor" TEXT,
    "blurDataUrl" TEXT,
    "title" TEXT NOT NULL,
    "altText" TEXT,
    "caption" TEXT,
    "credit" TEXT,
    "copyright" TEXT,
    "usageNotes" TEXT,
    "focalX" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "focalY" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "visibility" "MediaVisibility" NOT NULL DEFAULT 'CMS_ONLY',
    "isBrandAsset" BOOLEAN NOT NULL DEFAULT false,
    "isPressAsset" BOOLEAN NOT NULL DEFAULT false,
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "media_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media_tags" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "media_tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media_tags_on_assets" (
    "assetId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,

    CONSTRAINT "media_tags_on_assets_pkey" PRIMARY KEY ("assetId","tagId")
);

-- CreateTable
CREATE TABLE "media_variants" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "byteSize" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "media_variants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media_usages" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "entityLabel" TEXT,
    "field" TEXT,
    "href" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "media_usages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "departments" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "summary" TEXT,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isCareerVisible" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "teams" (
    "id" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "summary" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "teams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leadership_groups" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "summary" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isPublished" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leadership_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "people" (
    "id" TEXT NOT NULL,
    "translationGroupId" TEXT NOT NULL,
    "locale" "Locale" NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "roleDetail" TEXT,
    "leadershipGroupId" TEXT,
    "departmentId" TEXT,
    "portraitId" TEXT,
    "heroImageId" TEXT,
    "shortBio" TEXT,
    "fullBio" TEXT,
    "responsibilities" TEXT,
    "careerBackground" TEXT,
    "quote" TEXT,
    "quoteAttribution" TEXT,
    "linkedinUrl" TEXT,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "translationStatus" "TranslationStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "publishedVersionId" TEXT,
    "hasUnpublishedChanges" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3),
    "scheduledFor" TIMESTAMP(3),
    "reviewDate" TIMESTAMP(3),
    "seoTitle" TEXT,
    "seoDescription" TEXT,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "people_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "story_categories" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "summary" TEXT,
    "family" TEXT NOT NULL DEFAULT 'company',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "story_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "story_tags" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,

    CONSTRAINT "story_tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stories" (
    "id" TEXT NOT NULL,
    "translationGroupId" TEXT NOT NULL,
    "locale" "Locale" NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'STORY',
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "excerpt" TEXT,
    "body" TEXT,
    "useBlocks" BOOLEAN NOT NULL DEFAULT false,
    "categoryId" TEXT,
    "heroImageId" TEXT,
    "thumbnailId" TEXT,
    "authorName" TEXT,
    "authorId" TEXT,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "readingMinutes" INTEGER,
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "translationStatus" "TranslationStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "publishedVersionId" TEXT,
    "hasUnpublishedChanges" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3),
    "scheduledFor" TIMESTAMP(3),
    "unpublishAt" TIMESTAMP(3),
    "reviewDate" TIMESTAMP(3),
    "seoTitle" TEXT,
    "seoDescription" TEXT,
    "ogImageId" TEXT,
    "noindex" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "stories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "story_tags_on_stories" (
    "storyId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,

    CONSTRAINT "story_tags_on_stories_pkey" PRIMARY KEY ("storyId","tagId")
);

-- CreateTable
CREATE TABLE "story_people" (
    "storyId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "role" TEXT,

    CONSTRAINT "story_people_pkey" PRIMARY KEY ("storyId","personId")
);

-- CreateTable
CREATE TABLE "story_relations" (
    "fromId" TEXT NOT NULL,
    "toId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "story_relations_pkey" PRIMARY KEY ("fromId","toId")
);

-- CreateTable
CREATE TABLE "press_release_categories" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "press_release_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "press_releases" (
    "id" TEXT NOT NULL,
    "translationGroupId" TEXT NOT NULL,
    "locale" "Locale" NOT NULL,
    "headline" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "summary" TEXT,
    "body" TEXT,
    "dateline" TEXT,
    "categoryId" TEXT,
    "imageId" TEXT,
    "mediaContactId" TEXT,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "translationStatus" "TranslationStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "publishedVersionId" TEXT,
    "hasUnpublishedChanges" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3),
    "scheduledFor" TIMESTAMP(3),
    "reviewDate" TIMESTAMP(3),
    "seoTitle" TEXT,
    "seoDescription" TEXT,
    "noindex" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "press_releases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "press_release_assets" (
    "id" TEXT NOT NULL,
    "pressReleaseId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "label" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "press_release_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media_coverage" (
    "id" TEXT NOT NULL,
    "locale" "Locale" NOT NULL DEFAULT 'en',
    "title" TEXT NOT NULL,
    "outlet" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "publishedOn" TIMESTAMP(3) NOT NULL,
    "summary" TEXT,
    "logoId" TEXT,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "media_coverage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media_contacts" (
    "id" TEXT NOT NULL,
    "locale" "Locale" NOT NULL DEFAULT 'en',
    "name" TEXT NOT NULL,
    "role" TEXT,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "region" TEXT,
    "topics" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "personId" TEXT,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "media_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "timeline_events" (
    "id" TEXT NOT NULL,
    "translationGroupId" TEXT NOT NULL,
    "locale" "Locale" NOT NULL,
    "year" INTEGER NOT NULL,
    "eventDate" TIMESTAMP(3),
    "headline" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "location" TEXT,
    "mediaId" TEXT,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isDemoContent" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "timeline_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AwardCategory" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "AwardCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "awards" (
    "id" TEXT NOT NULL,
    "translationGroupId" TEXT NOT NULL,
    "locale" "Locale" NOT NULL,
    "name" TEXT NOT NULL,
    "organisation" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "description" TEXT,
    "externalUrl" TEXT,
    "categoryId" TEXT,
    "imageId" TEXT,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "isDemoContent" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "awards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "regions" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'PROVINCE',
    "summary" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "regions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cities" (
    "id" TEXT NOT NULL,
    "regionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "summary" TEXT,
    "imageId" TEXT,
    "restaurantCount" INTEGER,
    "teamMemberCount" INTEGER,
    "firstOpeningYear" INTEGER,
    "facilityNote" TEXT,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "isDemoContent" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "corporate_locations" (
    "id" TEXT NOT NULL,
    "cityId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'OFFICE',
    "addressLine" TEXT,
    "summary" TEXT,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "corporate_locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ingredient_categories" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "summary" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ingredient_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ingredients" (
    "id" TEXT NOT NULL,
    "translationGroupId" TEXT NOT NULL,
    "locale" "Locale" NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "categoryId" TEXT,
    "summary" TEXT,
    "qualityInformation" TEXT,
    "sourcingInformation" TEXT,
    "allergenInformation" TEXT,
    "imageId" TEXT,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "isDemoContent" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "seoTitle" TEXT,
    "seoDescription" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ingredients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "impact_pillars" (
    "id" TEXT NOT NULL,
    "translationGroupId" TEXT NOT NULL,
    "locale" "Locale" NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "summary" TEXT,
    "description" TEXT,
    "icon" TEXT,
    "accentColor" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "impact_pillars_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "impact_metrics" (
    "id" TEXT NOT NULL,
    "pillarId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unit" TEXT,
    "prefix" TEXT,
    "suffix" TEXT,
    "description" TEXT,
    "methodology" TEXT,
    "internalSource" TEXT,
    "targetValue" DOUBLE PRECISION,
    "targetYear" INTEGER,
    "isPublishable" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "impact_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "impact_metric_values" (
    "id" TEXT NOT NULL,
    "metricId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "note" TEXT,
    "isDemoContent" BOOLEAN NOT NULL DEFAULT false,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "impact_metric_values_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "impact_stories" (
    "id" TEXT NOT NULL,
    "translationGroupId" TEXT NOT NULL,
    "locale" "Locale" NOT NULL,
    "pillarId" TEXT,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "excerpt" TEXT,
    "body" TEXT,
    "imageId" TEXT,
    "location" TEXT,
    "year" INTEGER,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "isDemoContent" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3),
    "seoTitle" TEXT,
    "seoDescription" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "impact_stories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "report_categories" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "summary" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "report_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reports" (
    "id" TEXT NOT NULL,
    "translationGroupId" TEXT NOT NULL,
    "locale" "Locale" NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "type" "ReportType" NOT NULL DEFAULT 'OTHER',
    "description" TEXT,
    "categoryId" TEXT,
    "coverId" TEXT,
    "publicationDate" TIMESTAMP(3),
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "isDemoContent" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "seoTitle" TEXT,
    "seoDescription" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "report_files" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "locale" "Locale" NOT NULL DEFAULT 'en',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "report_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "policy_categories" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "summary" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "policy_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "policies" (
    "id" TEXT NOT NULL,
    "translationGroupId" TEXT NOT NULL,
    "locale" "Locale" NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "summary" TEXT,
    "body" TEXT,
    "categoryId" TEXT,
    "documentId" TEXT,
    "version" TEXT NOT NULL DEFAULT '1.0',
    "effectiveDate" TIMESTAMP(3),
    "reviewDate" TIMESTAMP(3),
    "ownerLabel" TEXT,
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "translationStatus" "TranslationStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "publishedVersionId" TEXT,
    "hasUnpublishedChanges" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3),
    "scheduledFor" TIMESTAMP(3),
    "isDemoContent" BOOLEAN NOT NULL DEFAULT false,
    "seoTitle" TEXT,
    "seoDescription" TEXT,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "policy_versions" (
    "id" TEXT NOT NULL,
    "policyId" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "effectiveDate" TIMESTAMP(3),
    "supersededAt" TIMESTAMP(3),
    "summaryOfChanges" TEXT,
    "fileId" TEXT,
    "bodySnapshot" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "policy_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "career_categories" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "summary" TEXT,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isPublished" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "career_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_locations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "cityId" TEXT,
    "isRemote" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "job_locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "jobs" (
    "id" TEXT NOT NULL,
    "translationGroupId" TEXT NOT NULL,
    "locale" "Locale" NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "categoryId" TEXT,
    "departmentId" TEXT,
    "teamId" TEXT,
    "locationId" TEXT,
    "employmentType" "EmploymentType" NOT NULL DEFAULT 'FULL_TIME',
    "workplaceType" "WorkplaceType" NOT NULL DEFAULT 'ON_SITE',
    "summary" TEXT,
    "description" TEXT,
    "responsibilities" TEXT,
    "requirements" TEXT,
    "preferredQualifications" TEXT,
    "benefits" TEXT,
    "salaryMin" INTEGER,
    "salaryMax" INTEGER,
    "salaryCurrency" TEXT DEFAULT 'PKR',
    "salaryPeriod" TEXT DEFAULT 'MONTH',
    "openingsCount" INTEGER,
    "applicationDeadline" TIMESTAMP(3),
    "hiringManagerId" TEXT,
    "internalReference" TEXT,
    "formDefinitionId" TEXT,
    "status" "JobStatus" NOT NULL DEFAULT 'DRAFT',
    "translationStatus" "TranslationStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "publishedVersionId" TEXT,
    "hasUnpublishedChanges" BOOLEAN NOT NULL DEFAULT false,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "postedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "scheduledFor" TIMESTAMP(3),
    "seoTitle" TEXT,
    "seoDescription" TEXT,
    "noindex" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_applications" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "city" TEXT,
    "linkedinUrl" TEXT,
    "portfolioUrl" TEXT,
    "coverNote" TEXT,
    "answers" JSONB,
    "consentGivenAt" TIMESTAMP(3) NOT NULL,
    "consentText" TEXT NOT NULL,
    "status" "ApplicationStatus" NOT NULL DEFAULT 'NEW',
    "assigneeId" TEXT,
    "rating" INTEGER,
    "source" TEXT,
    "ipHash" TEXT,
    "userAgent" TEXT,
    "retentionUntil" TIMESTAMP(3),
    "anonymisedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "job_applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_application_files" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'CV',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "job_application_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_stories" (
    "id" TEXT NOT NULL,
    "translationGroupId" TEXT NOT NULL,
    "locale" "Locale" NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "excerpt" TEXT,
    "body" TEXT,
    "personId" TEXT,
    "personName" TEXT,
    "roleLabel" TEXT,
    "departmentLabel" TEXT,
    "locationLabel" TEXT,
    "portraitId" TEXT,
    "heroImageId" TEXT,
    "quote" TEXT,
    "careerTimeline" JSONB,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "isDemoContent" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3),
    "seoTitle" TEXT,
    "seoDescription" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employee_stories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_categories" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "summary" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "supplier_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_submissions" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "website" TEXT,
    "contactName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "categoryId" TEXT,
    "productsServices" TEXT NOT NULL,
    "citiesServed" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "certifications" TEXT,
    "productionCapacity" TEXT,
    "companyProfile" TEXT,
    "notes" TEXT,
    "consentGivenAt" TIMESTAMP(3) NOT NULL,
    "consentText" TEXT NOT NULL,
    "status" "SupplierSubmissionStatus" NOT NULL DEFAULT 'NEW',
    "assigneeId" TEXT,
    "ipHash" TEXT,
    "userAgent" TEXT,
    "retentionUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "supplier_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_attachments" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "label" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supplier_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "property_submissions" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "contactName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "company" TEXT,
    "cityId" TEXT,
    "cityName" TEXT NOT NULL,
    "area" TEXT,
    "address" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "propertyType" "PropertyType" NOT NULL DEFAULT 'HIGH_STREET',
    "totalAreaSqft" INTEGER,
    "groundFloorSqft" INTEGER,
    "frontageFeet" INTEGER,
    "parkingSpaces" INTEGER,
    "driveThroughFeasible" BOOLEAN,
    "ownership" "OwnershipType" NOT NULL DEFAULT 'OWNER',
    "expectedRent" TEXT,
    "availableFrom" TIMESTAMP(3),
    "notes" TEXT,
    "consentGivenAt" TIMESTAMP(3) NOT NULL,
    "consentText" TEXT NOT NULL,
    "status" "PropertySubmissionStatus" NOT NULL DEFAULT 'NEW',
    "assigneeId" TEXT,
    "ipHash" TEXT,
    "userAgent" TEXT,
    "retentionUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "property_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "property_attachments" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'PHOTO',
    "label" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "property_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "partnership_categories" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "summary" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "partnership_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "partnership_submissions" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "organisationName" TEXT NOT NULL,
    "website" TEXT,
    "contactName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "role" TEXT,
    "categoryId" TEXT,
    "proposal" TEXT NOT NULL,
    "notes" TEXT,
    "consentGivenAt" TIMESTAMP(3) NOT NULL,
    "consentText" TEXT NOT NULL,
    "status" "PartnershipSubmissionStatus" NOT NULL DEFAULT 'NEW',
    "assigneeId" TEXT,
    "ipHash" TEXT,
    "userAgent" TEXT,
    "retentionUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "partnership_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contact_categories" (
    "id" TEXT NOT NULL,
    "key" "ContactCategoryKey" NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "publicInstructions" TEXT,
    "routingEmail" TEXT,
    "formDefinitionId" TEXT,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "contact_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contact_submissions" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "categoryId" TEXT,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "subject" TEXT,
    "message" TEXT NOT NULL,
    "city" TEXT,
    "consentGivenAt" TIMESTAMP(3) NOT NULL,
    "consentText" TEXT NOT NULL,
    "status" "ContactSubmissionStatus" NOT NULL DEFAULT 'NEW',
    "assigneeId" TEXT,
    "ipHash" TEXT,
    "userAgent" TEXT,
    "spamScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "retentionUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "contact_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "submission_notes" (
    "id" TEXT NOT NULL,
    "authorId" TEXT,
    "body" TEXT NOT NULL,
    "jobApplicationId" TEXT,
    "supplierSubmissionId" TEXT,
    "propertySubmissionId" TEXT,
    "partnershipSubmissionId" TEXT,
    "contactSubmissionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "submission_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "form_definitions" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "purpose" TEXT,
    "recipientEmails" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "successMessage" TEXT NOT NULL DEFAULT 'Thank you. Your submission has been received.',
    "submitLabel" TEXT NOT NULL DEFAULT 'Submit',
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "spamProtection" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "form_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "form_fields" (
    "id" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "type" "FormFieldType" NOT NULL,
    "name" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "placeholder" TEXT,
    "helpText" TEXT,
    "isRequired" BOOLEAN NOT NULL DEFAULT false,
    "options" JSONB,
    "validation" JSONB,
    "width" TEXT NOT NULL DEFAULT 'full',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "form_fields_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "form_submissions" (
    "id" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "status" "ContactSubmissionStatus" NOT NULL DEFAULT 'NEW',
    "ipHash" TEXT,
    "userAgent" TEXT,
    "spamScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "retentionUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "form_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "form_submission_files" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "fieldName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "form_submission_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "search_documents" (
    "id" TEXT NOT NULL,
    "type" "SearchDocumentType" NOT NULL,
    "locale" "Locale" NOT NULL,
    "entityId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "body" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "section" TEXT,
    "category" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "publishedAt" TIMESTAMP(3),
    "boost" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "search_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_health_issues" (
    "id" TEXT NOT NULL,
    "type" "ContentHealthIssueType" NOT NULL,
    "severity" "ContentHealthSeverity" NOT NULL DEFAULT 'WARNING',
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "entityLabel" TEXT NOT NULL,
    "locale" "Locale" NOT NULL,
    "field" TEXT,
    "detail" TEXT,
    "href" TEXT,
    "dismissedAt" TIMESTAMP(3),
    "dismissedById" TEXT,
    "dismissReason" TEXT,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "content_health_issues_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "publishing_jobs" (
    "id" TEXT NOT NULL,
    "kind" "PublishingJobKind" NOT NULL,
    "status" "PublishingJobStatus" NOT NULL DEFAULT 'PENDING',
    "entityType" TEXT,
    "entityId" TEXT,
    "payload" JSONB,
    "runAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "lastError" TEXT,
    "idempotencyKey" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "publishing_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "integrations" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT false,
    "config" JSONB,
    "lastSyncAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "integrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhooks" (
    "id" TEXT NOT NULL,
    "integrationId" TEXT,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "events" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "secretRef" TEXT,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "lastDeliveryAt" TIMESTAMP(3),
    "lastDeliveryStatus" INTEGER,
    "failureCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "webhooks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "preview_tokens" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "locale" "Locale" NOT NULL,
    "createdById" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "preview_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_ssoSubject_key" ON "users"("ssoSubject");

-- CreateIndex
CREATE INDEX "users_status_idx" ON "users"("status");

-- CreateIndex
CREATE INDEX "users_deletedAt_idx" ON "users"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "roles_key_key" ON "roles"("key");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_key_key" ON "permissions"("key");

-- CreateIndex
CREATE INDEX "permissions_group_idx" ON "permissions"("group");

-- CreateIndex
CREATE INDEX "user_roles_roleId_idx" ON "user_roles"("roleId");

-- CreateIndex
CREATE INDEX "role_permissions_permissionId_idx" ON "role_permissions"("permissionId");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_tokenHash_key" ON "sessions"("tokenHash");

-- CreateIndex
CREATE INDEX "sessions_userId_idx" ON "sessions"("userId");

-- CreateIndex
CREATE INDEX "sessions_expiresAt_idx" ON "sessions"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "password_resets_tokenHash_key" ON "password_resets"("tokenHash");

-- CreateIndex
CREATE INDEX "password_resets_userId_idx" ON "password_resets"("userId");

-- CreateIndex
CREATE INDEX "password_resets_expiresAt_idx" ON "password_resets"("expiresAt");

-- CreateIndex
CREATE INDEX "login_attempts_email_createdAt_idx" ON "login_attempts"("email", "createdAt");

-- CreateIndex
CREATE INDEX "login_attempts_ipAddress_createdAt_idx" ON "login_attempts"("ipAddress", "createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_actorId_createdAt_idx" ON "audit_logs"("actorId", "createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_entityType_entityId_idx" ON "audit_logs"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "audit_logs_action_createdAt_idx" ON "audit_logs"("action", "createdAt");

-- CreateIndex
CREATE INDEX "activity_logs_createdAt_idx" ON "activity_logs"("createdAt");

-- CreateIndex
CREATE INDEX "notifications_userId_readAt_createdAt_idx" ON "notifications"("userId", "readAt", "createdAt");

-- CreateIndex
CREATE INDEX "site_settings_group_idx" ON "site_settings"("group");

-- CreateIndex
CREATE UNIQUE INDEX "site_settings_key_locale_key" ON "site_settings"("key", "locale");

-- CreateIndex
CREATE UNIQUE INDEX "global_settings_key_key" ON "global_settings"("key");

-- CreateIndex
CREATE UNIQUE INDEX "feature_flags_key_key" ON "feature_flags"("key");

-- CreateIndex
CREATE UNIQUE INDEX "locale_configs_code_key" ON "locale_configs"("code");

-- CreateIndex
CREATE INDEX "content_versions_entityType_entityId_createdAt_idx" ON "content_versions"("entityType", "entityId", "createdAt");

-- CreateIndex
CREATE INDEX "content_versions_createdById_idx" ON "content_versions"("createdById");

-- CreateIndex
CREATE UNIQUE INDEX "content_versions_entityType_entityId_versionNumber_key" ON "content_versions"("entityType", "entityId", "versionNumber");

-- CreateIndex
CREATE INDEX "workflow_events_entityType_entityId_createdAt_idx" ON "workflow_events"("entityType", "entityId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "block_definitions_key_key" ON "block_definitions"("key");

-- CreateIndex
CREATE INDEX "block_definitions_category_sortOrder_idx" ON "block_definitions"("category", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "pages_publishedVersionId_key" ON "pages"("publishedVersionId");

-- CreateIndex
CREATE INDEX "pages_status_locale_idx" ON "pages"("status", "locale");

-- CreateIndex
CREATE INDEX "pages_scheduledFor_idx" ON "pages"("scheduledFor");

-- CreateIndex
CREATE INDEX "pages_parentId_sortOrder_idx" ON "pages"("parentId", "sortOrder");

-- CreateIndex
CREATE INDEX "pages_deletedAt_idx" ON "pages"("deletedAt");

-- CreateIndex
CREATE INDEX "pages_reviewDate_idx" ON "pages"("reviewDate");

-- CreateIndex
CREATE UNIQUE INDEX "pages_locale_path_key" ON "pages"("locale", "path");

-- CreateIndex
CREATE UNIQUE INDEX "pages_translationGroupId_locale_key" ON "pages"("translationGroupId", "locale");

-- CreateIndex
CREATE INDEX "page_blocks_pageId_sortOrder_idx" ON "page_blocks"("pageId", "sortOrder");

-- CreateIndex
CREATE INDEX "page_blocks_blockKey_idx" ON "page_blocks"("blockKey");

-- CreateIndex
CREATE UNIQUE INDEX "page_seo_pageId_key" ON "page_seo"("pageId");

-- CreateIndex
CREATE INDEX "slug_history_entityType_entityId_idx" ON "slug_history"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "slug_history_locale_oldPath_idx" ON "slug_history"("locale", "oldPath");

-- CreateIndex
CREATE INDEX "redirects_isEnabled_idx" ON "redirects"("isEnabled");

-- CreateIndex
CREATE UNIQUE INDEX "redirects_source_locale_key" ON "redirects"("source", "locale");

-- CreateIndex
CREATE INDEX "navigations_location_locale_idx" ON "navigations"("location", "locale");

-- CreateIndex
CREATE UNIQUE INDEX "navigations_key_locale_key" ON "navigations"("key", "locale");

-- CreateIndex
CREATE INDEX "navigation_items_navigationId_parentId_sortOrder_idx" ON "navigation_items"("navigationId", "parentId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "footer_configurations_locale_key" ON "footer_configurations"("locale");

-- CreateIndex
CREATE INDEX "media_folders_path_idx" ON "media_folders"("path");

-- CreateIndex
CREATE UNIQUE INDEX "media_folders_parentId_slug_key" ON "media_folders"("parentId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "media_assets_storageKey_key" ON "media_assets"("storageKey");

-- CreateIndex
CREATE INDEX "media_assets_kind_createdAt_idx" ON "media_assets"("kind", "createdAt");

-- CreateIndex
CREATE INDEX "media_assets_folderId_idx" ON "media_assets"("folderId");

-- CreateIndex
CREATE INDEX "media_assets_visibility_idx" ON "media_assets"("visibility");

-- CreateIndex
CREATE INDEX "media_assets_deletedAt_idx" ON "media_assets"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "media_tags_name_key" ON "media_tags"("name");

-- CreateIndex
CREATE UNIQUE INDEX "media_tags_slug_key" ON "media_tags"("slug");

-- CreateIndex
CREATE INDEX "media_tags_on_assets_tagId_idx" ON "media_tags_on_assets"("tagId");

-- CreateIndex
CREATE UNIQUE INDEX "media_variants_storageKey_key" ON "media_variants"("storageKey");

-- CreateIndex
CREATE UNIQUE INDEX "media_variants_assetId_label_key" ON "media_variants"("assetId", "label");

-- CreateIndex
CREATE INDEX "media_usages_entityType_entityId_idx" ON "media_usages"("entityType", "entityId");

-- CreateIndex
CREATE UNIQUE INDEX "media_usages_assetId_entityType_entityId_field_key" ON "media_usages"("assetId", "entityType", "entityId", "field");

-- CreateIndex
CREATE UNIQUE INDEX "departments_key_key" ON "departments"("key");

-- CreateIndex
CREATE UNIQUE INDEX "departments_slug_key" ON "departments"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "teams_departmentId_slug_key" ON "teams"("departmentId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "leadership_groups_key_key" ON "leadership_groups"("key");

-- CreateIndex
CREATE UNIQUE INDEX "leadership_groups_slug_key" ON "leadership_groups"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "people_publishedVersionId_key" ON "people"("publishedVersionId");

-- CreateIndex
CREATE INDEX "people_leadershipGroupId_sortOrder_idx" ON "people"("leadershipGroupId", "sortOrder");

-- CreateIndex
CREATE INDEX "people_status_locale_idx" ON "people"("status", "locale");

-- CreateIndex
CREATE UNIQUE INDEX "people_locale_slug_key" ON "people"("locale", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "people_translationGroupId_locale_key" ON "people"("translationGroupId", "locale");

-- CreateIndex
CREATE UNIQUE INDEX "story_categories_key_key" ON "story_categories"("key");

-- CreateIndex
CREATE UNIQUE INDEX "story_categories_slug_key" ON "story_categories"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "story_tags_name_key" ON "story_tags"("name");

-- CreateIndex
CREATE UNIQUE INDEX "story_tags_slug_key" ON "story_tags"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "stories_publishedVersionId_key" ON "stories"("publishedVersionId");

-- CreateIndex
CREATE INDEX "stories_kind_status_publishedAt_idx" ON "stories"("kind", "status", "publishedAt");

-- CreateIndex
CREATE INDEX "stories_categoryId_publishedAt_idx" ON "stories"("categoryId", "publishedAt");

-- CreateIndex
CREATE INDEX "stories_isFeatured_publishedAt_idx" ON "stories"("isFeatured", "publishedAt");

-- CreateIndex
CREATE INDEX "stories_scheduledFor_idx" ON "stories"("scheduledFor");

-- CreateIndex
CREATE UNIQUE INDEX "stories_locale_slug_key" ON "stories"("locale", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "stories_translationGroupId_locale_key" ON "stories"("translationGroupId", "locale");

-- CreateIndex
CREATE INDEX "story_tags_on_stories_tagId_idx" ON "story_tags_on_stories"("tagId");

-- CreateIndex
CREATE INDEX "story_people_personId_idx" ON "story_people"("personId");

-- CreateIndex
CREATE INDEX "story_relations_toId_idx" ON "story_relations"("toId");

-- CreateIndex
CREATE UNIQUE INDEX "press_release_categories_key_key" ON "press_release_categories"("key");

-- CreateIndex
CREATE UNIQUE INDEX "press_release_categories_slug_key" ON "press_release_categories"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "press_releases_publishedVersionId_key" ON "press_releases"("publishedVersionId");

-- CreateIndex
CREATE INDEX "press_releases_status_publishedAt_idx" ON "press_releases"("status", "publishedAt");

-- CreateIndex
CREATE INDEX "press_releases_scheduledFor_idx" ON "press_releases"("scheduledFor");

-- CreateIndex
CREATE UNIQUE INDEX "press_releases_locale_slug_key" ON "press_releases"("locale", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "press_releases_translationGroupId_locale_key" ON "press_releases"("translationGroupId", "locale");

-- CreateIndex
CREATE UNIQUE INDEX "press_release_assets_pressReleaseId_assetId_key" ON "press_release_assets"("pressReleaseId", "assetId");

-- CreateIndex
CREATE INDEX "media_coverage_publishedOn_idx" ON "media_coverage"("publishedOn");

-- CreateIndex
CREATE INDEX "timeline_events_year_sortOrder_idx" ON "timeline_events"("year", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "timeline_events_translationGroupId_locale_key" ON "timeline_events"("translationGroupId", "locale");

-- CreateIndex
CREATE UNIQUE INDEX "AwardCategory_key_key" ON "AwardCategory"("key");

-- CreateIndex
CREATE UNIQUE INDEX "AwardCategory_slug_key" ON "AwardCategory"("slug");

-- CreateIndex
CREATE INDEX "awards_year_idx" ON "awards"("year");

-- CreateIndex
CREATE UNIQUE INDEX "awards_translationGroupId_locale_key" ON "awards"("translationGroupId", "locale");

-- CreateIndex
CREATE UNIQUE INDEX "regions_key_key" ON "regions"("key");

-- CreateIndex
CREATE UNIQUE INDEX "regions_slug_key" ON "regions"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "cities_slug_key" ON "cities"("slug");

-- CreateIndex
CREATE INDEX "cities_regionId_sortOrder_idx" ON "cities"("regionId", "sortOrder");

-- CreateIndex
CREATE INDEX "corporate_locations_cityId_idx" ON "corporate_locations"("cityId");

-- CreateIndex
CREATE UNIQUE INDEX "ingredient_categories_key_key" ON "ingredient_categories"("key");

-- CreateIndex
CREATE UNIQUE INDEX "ingredient_categories_slug_key" ON "ingredient_categories"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "ingredients_locale_slug_key" ON "ingredients"("locale", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "ingredients_translationGroupId_locale_key" ON "ingredients"("translationGroupId", "locale");

-- CreateIndex
CREATE UNIQUE INDEX "impact_pillars_locale_slug_key" ON "impact_pillars"("locale", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "impact_pillars_translationGroupId_locale_key" ON "impact_pillars"("translationGroupId", "locale");

-- CreateIndex
CREATE UNIQUE INDEX "impact_metrics_pillarId_key_key" ON "impact_metrics"("pillarId", "key");

-- CreateIndex
CREATE INDEX "impact_metric_values_year_idx" ON "impact_metric_values"("year");

-- CreateIndex
CREATE UNIQUE INDEX "impact_metric_values_metricId_year_key" ON "impact_metric_values"("metricId", "year");

-- CreateIndex
CREATE UNIQUE INDEX "impact_stories_locale_slug_key" ON "impact_stories"("locale", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "impact_stories_translationGroupId_locale_key" ON "impact_stories"("translationGroupId", "locale");

-- CreateIndex
CREATE UNIQUE INDEX "report_categories_key_key" ON "report_categories"("key");

-- CreateIndex
CREATE UNIQUE INDEX "report_categories_slug_key" ON "report_categories"("slug");

-- CreateIndex
CREATE INDEX "reports_year_type_idx" ON "reports"("year", "type");

-- CreateIndex
CREATE UNIQUE INDEX "reports_locale_slug_key" ON "reports"("locale", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "reports_translationGroupId_locale_key" ON "reports"("translationGroupId", "locale");

-- CreateIndex
CREATE UNIQUE INDEX "report_files_reportId_assetId_locale_key" ON "report_files"("reportId", "assetId", "locale");

-- CreateIndex
CREATE UNIQUE INDEX "policy_categories_key_key" ON "policy_categories"("key");

-- CreateIndex
CREATE UNIQUE INDEX "policy_categories_slug_key" ON "policy_categories"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "policies_publishedVersionId_key" ON "policies"("publishedVersionId");

-- CreateIndex
CREATE INDEX "policies_categoryId_idx" ON "policies"("categoryId");

-- CreateIndex
CREATE UNIQUE INDEX "policies_locale_slug_key" ON "policies"("locale", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "policies_translationGroupId_locale_key" ON "policies"("translationGroupId", "locale");

-- CreateIndex
CREATE UNIQUE INDEX "policy_versions_policyId_version_key" ON "policy_versions"("policyId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "career_categories_key_key" ON "career_categories"("key");

-- CreateIndex
CREATE UNIQUE INDEX "career_categories_slug_key" ON "career_categories"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "job_locations_slug_key" ON "job_locations"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "jobs_publishedVersionId_key" ON "jobs"("publishedVersionId");

-- CreateIndex
CREATE INDEX "jobs_status_postedAt_idx" ON "jobs"("status", "postedAt");

-- CreateIndex
CREATE INDEX "jobs_categoryId_status_idx" ON "jobs"("categoryId", "status");

-- CreateIndex
CREATE INDEX "jobs_departmentId_status_idx" ON "jobs"("departmentId", "status");

-- CreateIndex
CREATE INDEX "jobs_locationId_status_idx" ON "jobs"("locationId", "status");

-- CreateIndex
CREATE INDEX "jobs_applicationDeadline_idx" ON "jobs"("applicationDeadline");

-- CreateIndex
CREATE UNIQUE INDEX "jobs_locale_slug_key" ON "jobs"("locale", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "jobs_translationGroupId_locale_key" ON "jobs"("translationGroupId", "locale");

-- CreateIndex
CREATE UNIQUE INDEX "job_applications_reference_key" ON "job_applications"("reference");

-- CreateIndex
CREATE INDEX "job_applications_jobId_status_createdAt_idx" ON "job_applications"("jobId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "job_applications_status_createdAt_idx" ON "job_applications"("status", "createdAt");

-- CreateIndex
CREATE INDEX "job_applications_email_idx" ON "job_applications"("email");

-- CreateIndex
CREATE INDEX "job_application_files_applicationId_idx" ON "job_application_files"("applicationId");

-- CreateIndex
CREATE INDEX "employee_stories_isPublished_publishedAt_idx" ON "employee_stories"("isPublished", "publishedAt");

-- CreateIndex
CREATE UNIQUE INDEX "employee_stories_locale_slug_key" ON "employee_stories"("locale", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "employee_stories_translationGroupId_locale_key" ON "employee_stories"("translationGroupId", "locale");

-- CreateIndex
CREATE UNIQUE INDEX "supplier_categories_key_key" ON "supplier_categories"("key");

-- CreateIndex
CREATE UNIQUE INDEX "supplier_categories_slug_key" ON "supplier_categories"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "supplier_submissions_reference_key" ON "supplier_submissions"("reference");

-- CreateIndex
CREATE INDEX "supplier_submissions_status_createdAt_idx" ON "supplier_submissions"("status", "createdAt");

-- CreateIndex
CREATE INDEX "supplier_submissions_categoryId_status_idx" ON "supplier_submissions"("categoryId", "status");

-- CreateIndex
CREATE INDEX "supplier_attachments_submissionId_idx" ON "supplier_attachments"("submissionId");

-- CreateIndex
CREATE UNIQUE INDEX "property_submissions_reference_key" ON "property_submissions"("reference");

-- CreateIndex
CREATE INDEX "property_submissions_status_createdAt_idx" ON "property_submissions"("status", "createdAt");

-- CreateIndex
CREATE INDEX "property_submissions_cityName_status_idx" ON "property_submissions"("cityName", "status");

-- CreateIndex
CREATE INDEX "property_attachments_submissionId_idx" ON "property_attachments"("submissionId");

-- CreateIndex
CREATE UNIQUE INDEX "partnership_categories_key_key" ON "partnership_categories"("key");

-- CreateIndex
CREATE UNIQUE INDEX "partnership_categories_slug_key" ON "partnership_categories"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "partnership_submissions_reference_key" ON "partnership_submissions"("reference");

-- CreateIndex
CREATE INDEX "partnership_submissions_status_createdAt_idx" ON "partnership_submissions"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "contact_categories_key_key" ON "contact_categories"("key");

-- CreateIndex
CREATE UNIQUE INDEX "contact_categories_slug_key" ON "contact_categories"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "contact_submissions_reference_key" ON "contact_submissions"("reference");

-- CreateIndex
CREATE INDEX "contact_submissions_status_createdAt_idx" ON "contact_submissions"("status", "createdAt");

-- CreateIndex
CREATE INDEX "contact_submissions_categoryId_status_idx" ON "contact_submissions"("categoryId", "status");

-- CreateIndex
CREATE INDEX "submission_notes_jobApplicationId_idx" ON "submission_notes"("jobApplicationId");

-- CreateIndex
CREATE INDEX "submission_notes_supplierSubmissionId_idx" ON "submission_notes"("supplierSubmissionId");

-- CreateIndex
CREATE INDEX "submission_notes_propertySubmissionId_idx" ON "submission_notes"("propertySubmissionId");

-- CreateIndex
CREATE INDEX "submission_notes_contactSubmissionId_idx" ON "submission_notes"("contactSubmissionId");

-- CreateIndex
CREATE UNIQUE INDEX "form_definitions_key_key" ON "form_definitions"("key");

-- CreateIndex
CREATE UNIQUE INDEX "form_definitions_slug_key" ON "form_definitions"("slug");

-- CreateIndex
CREATE INDEX "form_fields_formId_sortOrder_idx" ON "form_fields"("formId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "form_fields_formId_name_key" ON "form_fields"("formId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "form_submissions_reference_key" ON "form_submissions"("reference");

-- CreateIndex
CREATE INDEX "form_submissions_formId_status_createdAt_idx" ON "form_submissions"("formId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "form_submission_files_submissionId_idx" ON "form_submission_files"("submissionId");

-- CreateIndex
CREATE INDEX "search_documents_locale_type_idx" ON "search_documents"("locale", "type");

-- CreateIndex
CREATE INDEX "search_documents_publishedAt_idx" ON "search_documents"("publishedAt");

-- CreateIndex
CREATE UNIQUE INDEX "search_documents_type_entityId_locale_key" ON "search_documents"("type", "entityId", "locale");

-- CreateIndex
CREATE INDEX "content_health_issues_type_resolvedAt_idx" ON "content_health_issues"("type", "resolvedAt");

-- CreateIndex
CREATE INDEX "content_health_issues_entityType_entityId_idx" ON "content_health_issues"("entityType", "entityId");

-- CreateIndex
CREATE UNIQUE INDEX "content_health_issues_type_entityType_entityId_locale_field_key" ON "content_health_issues"("type", "entityType", "entityId", "locale", "field");

-- CreateIndex
CREATE UNIQUE INDEX "publishing_jobs_idempotencyKey_key" ON "publishing_jobs"("idempotencyKey");

-- CreateIndex
CREATE INDEX "publishing_jobs_status_runAt_idx" ON "publishing_jobs"("status", "runAt");

-- CreateIndex
CREATE INDEX "publishing_jobs_entityType_entityId_idx" ON "publishing_jobs"("entityType", "entityId");

-- CreateIndex
CREATE UNIQUE INDEX "integrations_key_key" ON "integrations"("key");

-- CreateIndex
CREATE UNIQUE INDEX "preview_tokens_tokenHash_key" ON "preview_tokens"("tokenHash");

-- CreateIndex
CREATE INDEX "preview_tokens_expiresAt_idx" ON "preview_tokens"("expiresAt");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_avatarId_fkey" FOREIGN KEY ("avatarId") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "password_resets" ADD CONSTRAINT "password_resets_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "login_attempts" ADD CONSTRAINT "login_attempts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_versions" ADD CONSTRAINT "content_versions_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pages" ADD CONSTRAINT "pages_publishedVersionId_fkey" FOREIGN KEY ("publishedVersionId") REFERENCES "content_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pages" ADD CONSTRAINT "pages_contentOwnerId_fkey" FOREIGN KEY ("contentOwnerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pages" ADD CONSTRAINT "pages_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "pages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pages" ADD CONSTRAINT "pages_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pages" ADD CONSTRAINT "pages_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pages" ADD CONSTRAINT "pages_publishedById_fkey" FOREIGN KEY ("publishedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "page_blocks" ADD CONSTRAINT "page_blocks_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "page_blocks" ADD CONSTRAINT "page_blocks_definitionId_fkey" FOREIGN KEY ("definitionId") REFERENCES "block_definitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "page_seo" ADD CONSTRAINT "page_seo_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "page_seo" ADD CONSTRAINT "page_seo_ogImageId_fkey" FOREIGN KEY ("ogImageId") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "slug_history" ADD CONSTRAINT "slug_history_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "navigation_items" ADD CONSTRAINT "navigation_items_navigationId_fkey" FOREIGN KEY ("navigationId") REFERENCES "navigations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "navigation_items" ADD CONSTRAINT "navigation_items_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "pages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "navigation_items" ADD CONSTRAINT "navigation_items_featuredStoryId_fkey" FOREIGN KEY ("featuredStoryId") REFERENCES "stories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "navigation_items" ADD CONSTRAINT "navigation_items_featuredImageId_fkey" FOREIGN KEY ("featuredImageId") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "navigation_items" ADD CONSTRAINT "navigation_items_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "navigation_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_folders" ADD CONSTRAINT "media_folders_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "media_folders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "media_folders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_tags_on_assets" ADD CONSTRAINT "media_tags_on_assets_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "media_assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_tags_on_assets" ADD CONSTRAINT "media_tags_on_assets_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "media_tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_variants" ADD CONSTRAINT "media_variants_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "media_assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_usages" ADD CONSTRAINT "media_usages_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "media_assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teams" ADD CONSTRAINT "teams_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "people" ADD CONSTRAINT "people_leadershipGroupId_fkey" FOREIGN KEY ("leadershipGroupId") REFERENCES "leadership_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "people" ADD CONSTRAINT "people_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "people" ADD CONSTRAINT "people_portraitId_fkey" FOREIGN KEY ("portraitId") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "people" ADD CONSTRAINT "people_heroImageId_fkey" FOREIGN KEY ("heroImageId") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "people" ADD CONSTRAINT "people_publishedVersionId_fkey" FOREIGN KEY ("publishedVersionId") REFERENCES "content_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stories" ADD CONSTRAINT "stories_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "story_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stories" ADD CONSTRAINT "stories_heroImageId_fkey" FOREIGN KEY ("heroImageId") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stories" ADD CONSTRAINT "stories_thumbnailId_fkey" FOREIGN KEY ("thumbnailId") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stories" ADD CONSTRAINT "stories_publishedVersionId_fkey" FOREIGN KEY ("publishedVersionId") REFERENCES "content_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stories" ADD CONSTRAINT "stories_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stories" ADD CONSTRAINT "stories_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "story_tags_on_stories" ADD CONSTRAINT "story_tags_on_stories_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "stories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "story_tags_on_stories" ADD CONSTRAINT "story_tags_on_stories_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "story_tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "story_people" ADD CONSTRAINT "story_people_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "stories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "story_people" ADD CONSTRAINT "story_people_personId_fkey" FOREIGN KEY ("personId") REFERENCES "people"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "story_relations" ADD CONSTRAINT "story_relations_fromId_fkey" FOREIGN KEY ("fromId") REFERENCES "stories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "story_relations" ADD CONSTRAINT "story_relations_toId_fkey" FOREIGN KEY ("toId") REFERENCES "stories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "press_releases" ADD CONSTRAINT "press_releases_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "press_release_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "press_releases" ADD CONSTRAINT "press_releases_imageId_fkey" FOREIGN KEY ("imageId") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "press_releases" ADD CONSTRAINT "press_releases_mediaContactId_fkey" FOREIGN KEY ("mediaContactId") REFERENCES "media_contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "press_releases" ADD CONSTRAINT "press_releases_publishedVersionId_fkey" FOREIGN KEY ("publishedVersionId") REFERENCES "content_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "press_releases" ADD CONSTRAINT "press_releases_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "press_release_assets" ADD CONSTRAINT "press_release_assets_pressReleaseId_fkey" FOREIGN KEY ("pressReleaseId") REFERENCES "press_releases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "press_release_assets" ADD CONSTRAINT "press_release_assets_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "media_assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_coverage" ADD CONSTRAINT "media_coverage_logoId_fkey" FOREIGN KEY ("logoId") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_contacts" ADD CONSTRAINT "media_contacts_personId_fkey" FOREIGN KEY ("personId") REFERENCES "people"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timeline_events" ADD CONSTRAINT "timeline_events_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "awards" ADD CONSTRAINT "awards_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "AwardCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "awards" ADD CONSTRAINT "awards_imageId_fkey" FOREIGN KEY ("imageId") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cities" ADD CONSTRAINT "cities_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "regions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cities" ADD CONSTRAINT "cities_imageId_fkey" FOREIGN KEY ("imageId") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "corporate_locations" ADD CONSTRAINT "corporate_locations_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "cities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ingredients" ADD CONSTRAINT "ingredients_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ingredient_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ingredients" ADD CONSTRAINT "ingredients_imageId_fkey" FOREIGN KEY ("imageId") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "impact_metrics" ADD CONSTRAINT "impact_metrics_pillarId_fkey" FOREIGN KEY ("pillarId") REFERENCES "impact_pillars"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "impact_metric_values" ADD CONSTRAINT "impact_metric_values_metricId_fkey" FOREIGN KEY ("metricId") REFERENCES "impact_metrics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "impact_stories" ADD CONSTRAINT "impact_stories_pillarId_fkey" FOREIGN KEY ("pillarId") REFERENCES "impact_pillars"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "impact_stories" ADD CONSTRAINT "impact_stories_imageId_fkey" FOREIGN KEY ("imageId") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "report_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_coverId_fkey" FOREIGN KEY ("coverId") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_files" ADD CONSTRAINT "report_files_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_files" ADD CONSTRAINT "report_files_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "media_assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "policies" ADD CONSTRAINT "policies_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "policy_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "policies" ADD CONSTRAINT "policies_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "policies" ADD CONSTRAINT "policies_publishedVersionId_fkey" FOREIGN KEY ("publishedVersionId") REFERENCES "content_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "policy_versions" ADD CONSTRAINT "policy_versions_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "policies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "policy_versions" ADD CONSTRAINT "policy_versions_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_locations" ADD CONSTRAINT "job_locations_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "cities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "career_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "job_locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_hiringManagerId_fkey" FOREIGN KEY ("hiringManagerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_formDefinitionId_fkey" FOREIGN KEY ("formDefinitionId") REFERENCES "form_definitions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_publishedVersionId_fkey" FOREIGN KEY ("publishedVersionId") REFERENCES "content_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_applications" ADD CONSTRAINT "job_applications_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_applications" ADD CONSTRAINT "job_applications_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_application_files" ADD CONSTRAINT "job_application_files_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "job_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_application_files" ADD CONSTRAINT "job_application_files_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "media_assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_stories" ADD CONSTRAINT "employee_stories_personId_fkey" FOREIGN KEY ("personId") REFERENCES "people"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_stories" ADD CONSTRAINT "employee_stories_portraitId_fkey" FOREIGN KEY ("portraitId") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_stories" ADD CONSTRAINT "employee_stories_heroImageId_fkey" FOREIGN KEY ("heroImageId") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_submissions" ADD CONSTRAINT "supplier_submissions_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "supplier_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_submissions" ADD CONSTRAINT "supplier_submissions_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_attachments" ADD CONSTRAINT "supplier_attachments_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "supplier_submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_attachments" ADD CONSTRAINT "supplier_attachments_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "media_assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "property_submissions" ADD CONSTRAINT "property_submissions_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "property_attachments" ADD CONSTRAINT "property_attachments_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "property_submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "property_attachments" ADD CONSTRAINT "property_attachments_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "media_assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partnership_submissions" ADD CONSTRAINT "partnership_submissions_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "partnership_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partnership_submissions" ADD CONSTRAINT "partnership_submissions_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contact_categories" ADD CONSTRAINT "contact_categories_formDefinitionId_fkey" FOREIGN KEY ("formDefinitionId") REFERENCES "form_definitions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contact_submissions" ADD CONSTRAINT "contact_submissions_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "contact_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contact_submissions" ADD CONSTRAINT "contact_submissions_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submission_notes" ADD CONSTRAINT "submission_notes_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submission_notes" ADD CONSTRAINT "submission_notes_jobApplicationId_fkey" FOREIGN KEY ("jobApplicationId") REFERENCES "job_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submission_notes" ADD CONSTRAINT "submission_notes_supplierSubmissionId_fkey" FOREIGN KEY ("supplierSubmissionId") REFERENCES "supplier_submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submission_notes" ADD CONSTRAINT "submission_notes_propertySubmissionId_fkey" FOREIGN KEY ("propertySubmissionId") REFERENCES "property_submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submission_notes" ADD CONSTRAINT "submission_notes_partnershipSubmissionId_fkey" FOREIGN KEY ("partnershipSubmissionId") REFERENCES "partnership_submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submission_notes" ADD CONSTRAINT "submission_notes_contactSubmissionId_fkey" FOREIGN KEY ("contactSubmissionId") REFERENCES "contact_submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "form_fields" ADD CONSTRAINT "form_fields_formId_fkey" FOREIGN KEY ("formId") REFERENCES "form_definitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "form_submissions" ADD CONSTRAINT "form_submissions_formId_fkey" FOREIGN KEY ("formId") REFERENCES "form_definitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "form_submission_files" ADD CONSTRAINT "form_submission_files_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "form_submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "form_submission_files" ADD CONSTRAINT "form_submission_files_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "media_assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webhooks" ADD CONSTRAINT "webhooks_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "integrations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
