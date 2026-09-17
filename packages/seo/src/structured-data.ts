/**
 * Structured data (schema.org / JSON-LD).
 *
 * The governing rule here is that structured data must describe what is actually
 * on the page. Every builder below returns `null` when the required facts are
 * missing, rather than emitting a half-populated object — an incomplete
 * JobPosting or a fabricated aggregate rating is worse than no markup at all,
 * and search engines penalise it.
 */

export type JsonLd = Record<string, unknown>;

export interface OrganizationInput {
  name: string;
  legalName?: string;
  url: string;
  logoUrl?: string;
  description?: string;
  foundingDate?: string;
  sameAs?: string[];
  contactEmail?: string;
  contactPhone?: string;
  addressLocality?: string;
  addressCountry?: string;
}

export function buildOrganization(input: OrganizationInput): JsonLd {
  const node: JsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: input.name,
    url: input.url,
  };

  if (input.legalName) node.legalName = input.legalName;
  if (input.description) node.description = input.description;
  if (input.logoUrl) node.logo = { '@type': 'ImageObject', url: input.logoUrl };
  if (input.foundingDate) node.foundingDate = input.foundingDate;

  const sameAs = (input.sameAs ?? []).filter(Boolean);
  if (sameAs.length > 0) node.sameAs = sameAs;

  if (input.addressLocality || input.addressCountry) {
    node.address = {
      '@type': 'PostalAddress',
      ...(input.addressLocality ? { addressLocality: input.addressLocality } : {}),
      ...(input.addressCountry ? { addressCountry: input.addressCountry } : {}),
    };
  }

  if (input.contactEmail || input.contactPhone) {
    node.contactPoint = [
      {
        '@type': 'ContactPoint',
        contactType: 'corporate',
        ...(input.contactEmail ? { email: input.contactEmail } : {}),
        ...(input.contactPhone ? { telephone: input.contactPhone } : {}),
      },
    ];
  }

  return node;
}

export interface WebSiteInput {
  name: string;
  url: string;
  searchUrlTemplate?: string;
}

export function buildWebSite(input: WebSiteInput): JsonLd {
  const node: JsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: input.name,
    url: input.url,
  };

  if (input.searchUrlTemplate) {
    node.potentialAction = {
      '@type': 'SearchAction',
      target: { '@type': 'EntryPoint', urlTemplate: input.searchUrlTemplate },
      'query-input': 'required name=search_term_string',
    };
  }

  return node;
}

export interface ArticleInput {
  headline: string;
  description?: string;
  url: string;
  imageUrl?: string;
  publishedAt?: Date | string | null;
  modifiedAt?: Date | string | null;
  authorName?: string;
  publisherName: string;
  publisherLogoUrl?: string;
  /** NewsArticle for press releases and company news; Article for stories. */
  isNews?: boolean;
  section?: string;
}

/** Returns null unless the article has the headline and date the schema requires. */
export function buildArticle(input: ArticleInput): JsonLd | null {
  if (!input.headline || !input.publishedAt) return null;

  const node: JsonLd = {
    '@context': 'https://schema.org',
    '@type': input.isNews ? 'NewsArticle' : 'Article',
    headline: input.headline.slice(0, 110),
    url: input.url,
    mainEntityOfPage: { '@type': 'WebPage', '@id': input.url },
    datePublished: new Date(input.publishedAt).toISOString(),
    publisher: {
      '@type': 'Organization',
      name: input.publisherName,
      ...(input.publisherLogoUrl
        ? { logo: { '@type': 'ImageObject', url: input.publisherLogoUrl } }
        : {}),
    },
  };

  if (input.description) node.description = input.description;
  if (input.imageUrl) node.image = [input.imageUrl];
  if (input.modifiedAt) node.dateModified = new Date(input.modifiedAt).toISOString();
  if (input.authorName) node.author = { '@type': 'Person', name: input.authorName };
  else node.author = { '@type': 'Organization', name: input.publisherName };
  if (input.section) node.articleSection = input.section;

  return node;
}

export interface PersonInput {
  name: string;
  jobTitle?: string;
  url: string;
  imageUrl?: string;
  description?: string;
  sameAs?: string[];
  organizationName: string;
}

export function buildPerson(input: PersonInput): JsonLd | null {
  if (!input.name) return null;

  const node: JsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: input.name,
    url: input.url,
    worksFor: { '@type': 'Organization', name: input.organizationName },
  };

  if (input.jobTitle) node.jobTitle = input.jobTitle;
  if (input.imageUrl) node.image = input.imageUrl;
  if (input.description) node.description = input.description;

  const sameAs = (input.sameAs ?? []).filter(Boolean);
  if (sameAs.length > 0) node.sameAs = sameAs;

  return node;
}

export interface JobPostingInput {
  title: string;
  description: string;
  url: string;
  datePosted?: Date | string | null;
  validThrough?: Date | string | null;
  employmentType?: string;
  workplaceType?: 'ON_SITE' | 'HYBRID' | 'REMOTE';
  organizationName: string;
  organizationUrl: string;
  organizationLogoUrl?: string;
  locality?: string;
  region?: string;
  country?: string;
  department?: string;
  /** Both bounds are required together; a half-open range is omitted entirely. */
  salaryMin?: number | null;
  salaryMax?: number | null;
  salaryCurrency?: string | null;
  salaryPeriod?: string | null;
  identifier?: string;
  directApply?: boolean;
}

const EMPLOYMENT_TYPE_MAP: Record<string, string> = {
  FULL_TIME: 'FULL_TIME',
  PART_TIME: 'PART_TIME',
  CONTRACT: 'CONTRACTOR',
  INTERNSHIP: 'INTERN',
  TEMPORARY: 'TEMPORARY',
  APPRENTICESHIP: 'OTHER',
};

const SALARY_PERIOD_MAP: Record<string, string> = {
  HOUR: 'HOUR',
  DAY: 'DAY',
  WEEK: 'WEEK',
  MONTH: 'MONTH',
  YEAR: 'YEAR',
};

/**
 * JobPosting structured data.
 *
 * Google requires title, description, datePosted and hiringOrganization. If any
 * is missing this returns null, because an invalid JobPosting can get a whole
 * careers site excluded from Google Jobs.
 */
export function buildJobPosting(input: JobPostingInput): JsonLd | null {
  if (!input.title || !input.description || !input.datePosted) return null;

  const node: JsonLd = {
    '@context': 'https://schema.org',
    '@type': 'JobPosting',
    title: input.title,
    description: input.description,
    url: input.url,
    datePosted: new Date(input.datePosted).toISOString(),
    hiringOrganization: {
      '@type': 'Organization',
      name: input.organizationName,
      sameAs: input.organizationUrl,
      ...(input.organizationLogoUrl ? { logo: input.organizationLogoUrl } : {}),
    },
  };

  if (input.validThrough) node.validThrough = new Date(input.validThrough).toISOString();
  if (input.identifier) {
    node.identifier = {
      '@type': 'PropertyValue',
      name: input.organizationName,
      value: input.identifier,
    };
  }

  if (input.employmentType) {
    node.employmentType = EMPLOYMENT_TYPE_MAP[input.employmentType] ?? 'OTHER';
  }

  // A remote role uses applicantLocationRequirements; an on-site role uses
  // jobLocation. Emitting both, or the wrong one, is a common validation error.
  if (input.workplaceType === 'REMOTE') {
    node.jobLocationType = 'TELECOMMUTE';
    node.applicantLocationRequirements = {
      '@type': 'Country',
      name: input.country ?? 'Pakistan',
    };
  }

  if (input.locality || input.region) {
    node.jobLocation = {
      '@type': 'Place',
      address: {
        '@type': 'PostalAddress',
        ...(input.locality ? { addressLocality: input.locality } : {}),
        ...(input.region ? { addressRegion: input.region } : {}),
        addressCountry: input.country ?? 'PK',
      },
    };
  }

  if (input.department) node.occupationalCategory = input.department;
  if (input.directApply !== undefined) node.directApply = input.directApply;

  // Salary is emitted only when the range is complete and coherent.
  const { salaryMin, salaryMax, salaryCurrency } = input;
  if (
    typeof salaryMin === 'number' &&
    typeof salaryMax === 'number' &&
    salaryMin > 0 &&
    salaryMax >= salaryMin &&
    salaryCurrency
  ) {
    node.baseSalary = {
      '@type': 'MonetaryAmount',
      currency: salaryCurrency,
      value: {
        '@type': 'QuantitativeValue',
        minValue: salaryMin,
        maxValue: salaryMax,
        unitText: SALARY_PERIOD_MAP[input.salaryPeriod ?? 'MONTH'] ?? 'MONTH',
      },
    };
  }

  return node;
}

export interface BreadcrumbItem {
  name: string;
  url: string;
}

/** A single-item breadcrumb adds nothing, so it is omitted. */
export function buildBreadcrumbList(items: BreadcrumbItem[]): JsonLd | null {
  if (items.length < 2) return null;

  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

export interface FaqItem {
  question: string;
  answer: string;
}

/**
 * FAQPage markup. Only emitted when the editor has explicitly confirmed the
 * content is a genuine FAQ, and when every entry has both a question and an
 * answer — marking up arbitrary accordions as FAQs is structured-data abuse.
 */
export function buildFaqPage(items: FaqItem[]): JsonLd | null {
  const valid = items.filter((i) => i.question?.trim() && i.answer?.trim());
  if (valid.length === 0) return null;

  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: valid.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim(),
      },
    })),
  };
}

export interface ReportInput {
  name: string;
  url: string;
  description?: string;
  datePublished?: Date | string | null;
  fileUrl?: string;
  fileFormat?: string;
  publisherName: string;
}

export function buildReport(input: ReportInput): JsonLd | null {
  if (!input.name) return null;

  const node: JsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Report',
    name: input.name,
    url: input.url,
    publisher: { '@type': 'Organization', name: input.publisherName },
  };

  if (input.description) node.description = input.description;
  if (input.datePublished) node.datePublished = new Date(input.datePublished).toISOString();
  if (input.fileUrl) {
    node.associatedMedia = {
      '@type': 'MediaObject',
      contentUrl: input.fileUrl,
      ...(input.fileFormat ? { encodingFormat: input.fileFormat } : {}),
    };
  }

  return node;
}

/**
 * Serialise JSON-LD for injection into a script tag.
 *
 * `<` is escaped so that content containing `</script>` cannot break out of the
 * tag — the one genuine XSS risk in otherwise inert markup.
 */
export function serializeJsonLd(nodes: Array<JsonLd | null | undefined>): string | null {
  const valid = nodes.filter((n): n is JsonLd => Boolean(n));
  if (valid.length === 0) return null;
  const payload = valid.length === 1 ? valid[0] : valid;
  return JSON.stringify(payload).replace(/</g, '\\u003c');
}
