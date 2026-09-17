import type { Permission } from '@cheezious/permissions';

/**
 * Submission queues.
 *
 * The five inboxes the business runs on: job applications, supplier proposals,
 * property offers, partnership enquiries and general contact. They share one
 * implementation because they are the same job — triage, assign, progress,
 * annotate — and differ only in the fields each form collects.
 *
 * Every one of these records is personal data belonging to someone outside the
 * company. Three rules follow from that and are encoded here rather than left to
 * each screen:
 *
 *   1. The list shows the minimum needed to triage. Everything else lives behind
 *      the record, where opening it is audited.
 *   2. Internal notes are never anything but internal, and are labelled as such
 *      where they are written.
 *   3. Each queue states its retention position, because the person who fills in
 *      the form is entitled to have it honoured and the person working the queue
 *      is the one who can.
 */

export interface QueueField {
  name: string;
  label: string;
  /** Rendered as a paragraph rather than a line. */
  long?: boolean;
  /** Shown in the list as well as the record. */
  inList?: boolean;
  type?: 'text' | 'email' | 'phone' | 'url' | 'date' | 'list' | 'boolean' | 'number';
}

export interface QueueDescriptor {
  /** Segment beneath /api/cms/submissions. */
  path: string;
  /** Where the queue lives in the CMS. */
  href: string;
  label: string;
  labelPlural: string;
  /** The heading each row is identified by. */
  titleField: string;
  subtitleField?: string;
  statuses: string[];
  fields: QueueField[];
  /** Named explicitly rather than derived: the applications queue predates the
   *  others and its permissions do not follow from its path. */
  readPermission: Permission;
  managePermission: Permission;
  exportPermission?: Permission;
  hasAttachments: boolean;
  /** Displayed under the list; says plainly what this queue holds. */
  privacyNote: string;
  searchPlaceholder: string;
}

const CONSENT_FIELDS: QueueField[] = [
  { name: 'consentGivenAt', label: 'Consent given', type: 'date' },
  { name: 'consentText', label: 'Consented to', long: true },
];

export const QUEUES: Record<string, QueueDescriptor> = {
  applications: {
    path: 'applications',
    href: '/careers/applications',
    label: 'Application',
    labelPlural: 'Applications',
    titleField: 'firstName',
    statuses: [
      'NEW',
      'REVIEWING',
      'SHORTLISTED',
      'INTERVIEW',
      'OFFER',
      'HIRED',
      'REJECTED',
      'WITHDRAWN',
    ],
    readPermission: 'applications.read',
    managePermission: 'applications.manage',
    exportPermission: 'applications.export',
    hasAttachments: true,
    searchPlaceholder: 'Search by name, email or reference',
    privacyNote:
      'Applications contain personal data. Access is restricted by permission and every record opened is recorded in the audit log.',
    fields: [
      { name: 'firstName', label: 'First name', inList: true },
      { name: 'lastName', label: 'Last name', inList: true },
      { name: 'email', label: 'Email', type: 'email' },
      { name: 'phone', label: 'Phone', type: 'phone' },
      { name: 'city', label: 'City', inList: true },
      { name: 'linkedinUrl', label: 'LinkedIn', type: 'url' },
      { name: 'portfolioUrl', label: 'Portfolio', type: 'url' },
      { name: 'coverNote', label: 'Cover note', long: true },
      ...CONSENT_FIELDS,
    ],
  },

  suppliers: {
    path: 'suppliers',
    href: '/partners/suppliers',
    label: 'Supplier submission',
    labelPlural: 'Supplier submissions',
    titleField: 'companyName',
    subtitleField: 'contactName',
    statuses: ['NEW', 'REVIEWING', 'QUALIFIED', 'CONTACTED', 'APPROVED', 'REJECTED', 'ARCHIVED'],
    readPermission: 'suppliers.read',
    managePermission: 'suppliers.manage',
    exportPermission: 'suppliers.export',
    hasAttachments: true,
    searchPlaceholder: 'Search by company, contact, email or reference',
    privacyNote:
      'Supplier submissions carry contact details and commercial information. They are visible only to Procurement and administrators.',
    fields: [
      { name: 'companyName', label: 'Company', inList: true },
      { name: 'website', label: 'Website', type: 'url' },
      { name: 'contactName', label: 'Contact', inList: true },
      { name: 'email', label: 'Email', type: 'email' },
      { name: 'phone', label: 'Phone', type: 'phone' },
      { name: 'citiesServed', label: 'Cities served', type: 'list', inList: true },
      { name: 'productsServices', label: 'Products and services', long: true },
      { name: 'certifications', label: 'Certifications', long: true },
      { name: 'productionCapacity', label: 'Production capacity', long: true },
      { name: 'companyProfile', label: 'Company profile', long: true },
      { name: 'notes', label: 'Notes from the supplier', long: true },
      ...CONSENT_FIELDS,
    ],
  },

  properties: {
    path: 'properties',
    href: '/partners/properties',
    label: 'Property submission',
    labelPlural: 'Property submissions',
    titleField: 'cityName',
    subtitleField: 'contactName',
    statuses: ['NEW', 'REVIEWING', 'INTERESTING', 'SITE_VISIT', 'ACCEPTED', 'REJECTED', 'ARCHIVED'],
    readPermission: 'properties.read',
    managePermission: 'properties.manage',
    exportPermission: 'properties.export',
    hasAttachments: true,
    searchPlaceholder: 'Search by contact, email, city or reference',
    privacyNote:
      'Property submissions carry the owner or agent’s contact details and an address. They are visible only to Expansion and administrators.',
    fields: [
      { name: 'cityName', label: 'City', inList: true },
      { name: 'area', label: 'Area', inList: true },
      { name: 'address', label: 'Address', long: true },
      { name: 'propertyType', label: 'Property type', inList: true },
      { name: 'totalAreaSqft', label: 'Total area (sq ft)', type: 'number', inList: true },
      { name: 'groundFloorSqft', label: 'Ground floor (sq ft)', type: 'number' },
      { name: 'frontageFeet', label: 'Frontage (ft)', type: 'number' },
      { name: 'parkingSpaces', label: 'Parking spaces', type: 'number' },
      { name: 'driveThroughFeasible', label: 'Drive-through feasible', type: 'boolean' },
      { name: 'ownership', label: 'Ownership' },
      { name: 'expectedRent', label: 'Expected rent' },
      { name: 'availableFrom', label: 'Available from', type: 'date' },
      { name: 'contactName', label: 'Contact' },
      { name: 'company', label: 'Company' },
      { name: 'email', label: 'Email', type: 'email' },
      { name: 'phone', label: 'Phone', type: 'phone' },
      { name: 'notes', label: 'Notes from the sender', long: true },
      ...CONSENT_FIELDS,
    ],
  },

  partnerships: {
    path: 'partnerships',
    href: '/partners/partnerships',
    label: 'Partnership enquiry',
    labelPlural: 'Partnership enquiries',
    titleField: 'organisationName',
    subtitleField: 'contactName',
    statuses: ['NEW', 'REVIEWING', 'IN_DISCUSSION', 'ACCEPTED', 'DECLINED', 'ARCHIVED'],
    readPermission: 'partnerships.read',
    managePermission: 'partnerships.manage',
    hasAttachments: false,
    searchPlaceholder: 'Search by organisation, contact, email or reference',
    privacyNote:
      'Partnership enquiries carry contact details and commercial proposals. Treat the proposal as confidential to the sender.',
    fields: [
      { name: 'organisationName', label: 'Organisation', inList: true },
      { name: 'website', label: 'Website', type: 'url' },
      { name: 'contactName', label: 'Contact', inList: true },
      { name: 'role', label: 'Role' },
      { name: 'email', label: 'Email', type: 'email' },
      { name: 'phone', label: 'Phone', type: 'phone' },
      { name: 'proposal', label: 'Proposal', long: true },
      { name: 'notes', label: 'Notes from the sender', long: true },
      ...CONSENT_FIELDS,
    ],
  },

  contact: {
    path: 'contact',
    href: '/forms/contact',
    label: 'Contact submission',
    labelPlural: 'Contact submissions',
    titleField: 'name',
    subtitleField: 'subject',
    statuses: ['NEW', 'IN_PROGRESS', 'ANSWERED', 'CLOSED', 'SPAM'],
    readPermission: 'contact.read',
    managePermission: 'contact.manage',
    hasAttachments: false,
    searchPlaceholder: 'Search by name, email, subject or reference',
    privacyNote:
      'Contact submissions carry personal data and are routed by category. Internal routing addresses are never exposed publicly.',
    fields: [
      { name: 'name', label: 'Name', inList: true },
      { name: 'email', label: 'Email', type: 'email' },
      { name: 'phone', label: 'Phone', type: 'phone' },
      { name: 'city', label: 'City' },
      { name: 'subject', label: 'Subject', inList: true },
      { name: 'message', label: 'Message', long: true },
      ...CONSENT_FIELDS,
    ],
  },
};

export interface SubmissionNote {
  id: string;
  body: string;
  createdAt: string;
  author: { id: string; name: string } | null;
}

export interface SubmissionAttachment {
  id: string;
  label?: string | null;
  asset: { id: string; originalName: string; mimeType: string; byteSize: number };
}

export type SubmissionRecord = Record<string, unknown> & {
  id: string;
  reference: string;
  status: string;
  createdAt: string;
  assignee?: { id: string; name: string; email?: string } | null;
  notesLog?: SubmissionNote[];
  attachments?: SubmissionAttachment[];
};

export function humanizeStatus(value: string): string {
  return value
    .toLowerCase()
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
