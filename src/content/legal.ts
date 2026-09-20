/**
 * Legal and informational content.
 *
 * Kept as structured data rather than markup so the same text can be
 * rendered in the panel, exported, or printed without duplication.
 *
 * MAINTAINER NOTE
 * The wording below describes this application's ACTUAL behaviour, verified
 * across development: all business data is stored locally in the browser,
 * there is no telemetry, and nothing is transmitted unless the operator
 * configures a sync or licence endpoint. If that behaviour changes, these
 * documents must be updated to match. Bracketed fields must be completed by
 * the operator before commercial distribution.
 */

import { APP_CONFIG, CURRENCY } from '@/config/app.config';

/** Vendor identity. Kept in one place so branding is never scattered. */
export const VENDOR = {
  name: 'SERVIXA',
  tagline: 'Point of sale software',
  poweredBy: 'Powered by SERVIXA',
} as const;

/** Fields the operator must complete for their own business. */
export const LEGAL_PLACEHOLDERS = {
  company: '[Your registered business name]',
  contactEmail: '[your contact email]',
  jurisdiction: '[your province / country]',
} as const;

export interface LegalSection {
  heading: string;
  /** Paragraphs of body text. */
  body?: string[];
  /** Bulleted points rendered under the body. */
  bullets?: string[];
}

export interface LegalDocument {
  id: 'privacy' | 'terms';
  title: string;
  /** Shown under the title. */
  summary: string;
  /** Last substantive revision. */
  updated: string;
  sections: LegalSection[];
}

const LAST_UPDATED = '3 September 2026';

export const PRIVACY_POLICY: LegalDocument = {
  id: 'privacy',
  title: 'Privacy Policy',
  summary:
    'How this point of sale application handles information. In short: your data stays on your device.',
  updated: LAST_UPDATED,
  sections: [
    {
      heading: '1. Overview',
      body: [
        `This Privacy Policy explains how the ${VENDOR.name} point of sale application ("the Application") handles information. The Application is operated by ${LEGAL_PLACEHOLDERS.company} ("the Operator", "we", "us").`,
        'The Application is designed to run entirely on the device it is installed on. It is an offline-first system: it is built to work without an internet connection, and it does not require one to take orders, print receipts or record sales.',
      ],
    },
    {
      heading: '2. Information stored on your device',
      body: [
        'The Application stores the following categories of information in the local database of the browser or device on which it runs:',
      ],
      bullets: [
        'Restaurant profile details you enter, such as business name, address, telephone number, email address and logo.',
        'Menu items, categories, sizes, prices, images and deals you configure.',
        'Inventory records, including stock quantities and availability.',
        'Orders and sales records, including line items, quantities, prices, totals, taxes and timestamps.',
        'Administrator account credentials. Passwords are never stored in readable form; only a salted cryptographic hash is retained.',
        'Application preferences, such as receipt paper width and order number prefix.',
        'Licence activation state, where a licence key has been entered.',
      ],
    },
    {
      heading: '3. Information we do not collect',
      body: [
        'The Application contains no analytics, no advertising, no tracking pixels and no third-party telemetry. We do not collect usage statistics, device identifiers, location data or behavioural profiles.',
        'The Application does not require you to create an online account, and it does not transmit your business data to us as part of normal operation.',
      ],
    },
    {
      heading: '4. When data leaves your device',
      body: [
        'Business data is transmitted only in the following circumstances, each of which is under your control:',
      ],
      bullets: [
        'Synchronisation. If a synchronisation endpoint is configured by the Operator, orders and configuration changes are uploaded to that endpoint so they can be shared between terminals or backed up. Synchronisation is disabled unless such an endpoint is configured.',
        'Licence activation. If a licence server is configured, a licence key you enter may be sent to that server for validation. Where no licence server is configured, licence keys are verified on the device and are not transmitted.',
        'Printing. Receipt data is sent to a printer you select, either through your operating system or directly to a connected thermal printer.',
      ],
    },
    {
      heading: '5. Customer information',
      body: [
        'Where you choose to record information about your own customers, you are the controller of that information. You are responsible for handling it in accordance with the laws that apply to your business, including obtaining any consent those laws require.',
        'The Application provides no facility for sharing customer information with us or with any third party.',
      ],
    },
    {
      heading: '6. Data retention and deletion',
      body: [
        'Data is retained on your device until you delete it. You may remove business data at any time from within the Application, and you may clear all stored data by clearing the site data for the Application in your browser or device settings.',
        'Clearing site data is irreversible. Because data is stored locally, deleting it removes the only copy unless you have configured synchronisation or made your own backup.',
      ],
    },
    {
      heading: '7. Security',
      body: [
        'Administrator passwords are protected using PBKDF2 key derivation with a random salt, and are never stored in readable form.',
        'The security of the stored data ultimately depends on the security of the device it is held on. We recommend that you protect the device with a screen lock, restrict physical access to the terminal, and change the default administrator password before putting the Application into service.',
      ],
    },
    {
      heading: '8. Children',
      body: [
        'The Application is business software intended for use by traders and their staff. It is not directed at children and does not knowingly collect information from them.',
      ],
    },
    {
      heading: '9. Changes to this policy',
      body: [
        'This policy may be updated when the Application changes. The revision date shown at the top of this document indicates when it was last substantively revised.',
      ],
    },
    {
      heading: '10. Contact',
      body: [
        `Questions about this policy may be directed to ${LEGAL_PLACEHOLDERS.contactEmail}.`,
      ],
    },
  ],
};

export const TERMS: LegalDocument = {
  id: 'terms',
  title: 'Terms & Regulations',
  summary:
    'The terms on which this point of sale application is provided and may be used.',
  updated: LAST_UPDATED,
  sections: [
    {
      heading: '1. Agreement',
      body: [
        `These Terms & Regulations ("Terms") govern your use of the ${VENDOR.name} point of sale application ("the Application"), provided by ${LEGAL_PLACEHOLDERS.company} ("we", "us").`,
        'By installing or using the Application you agree to these Terms. If you do not agree to them, you should not use the Application.',
      ],
    },
    {
      heading: '2. Licence to use',
      body: [
        'Subject to these Terms, you are granted a non-exclusive, non-transferable right to use the Application to operate your own business.',
        'You may not resell, sublicense, rent or redistribute the Application, nor remove or obscure any proprietary notices it contains.',
      ],
    },
    {
      heading: '3. Activation',
      body: [
        'Some deployments require a licence key to be activated. A licence key is issued for the terminal or organisation it was supplied to and may not be shared beyond that scope.',
        'Attempting to circumvent activation, or using a key that was not issued to you, terminates your right to use the Application.',
      ],
    },
    {
      heading: '4. Your responsibilities',
      body: [
        'You are responsible for how the Application is used in your business. In particular you agree that:',
      ],
      bullets: [
        'You will keep administrator credentials confidential and change the default password before putting the Application into service.',
        'You are responsible for the accuracy of the menu items, prices, taxes and deals you configure.',
        'You are responsible for issuing receipts and keeping records as required by the tax and consumer protection laws that apply to your business.',
        'You are responsible for maintaining your own backups of business data.',
        'You will not use the Application for any unlawful purpose.',
      ],
    },
    {
      heading: '5. Records, tax and pricing',
      body: [
        'The Application records the transactions you enter and calculates totals from the prices and tax rate you configure. It does not determine what tax rate applies to your business, and it does not file returns on your behalf.',
        'You remain responsible for verifying that prices, tax settings and receipts meet the requirements of your jurisdiction.',
      ],
    },
    {
      heading: '6. Local data storage',
      body: [
        'The Application stores business data on the device on which it runs. This design allows it to operate without an internet connection.',
        'Because data is held locally, it can be lost if the device fails, if the application data is cleared, or if the browser removes stored data to reclaim space. You are responsible for maintaining backups appropriate to the value of your records.',
      ],
    },
    {
      heading: '7. Hardware and printing',
      body: [
        'Printing depends on your operating system, browser and printer. Direct thermal printing additionally requires a browser that supports the necessary device interfaces and a printer that accepts the relevant command set.',
        'We do not warrant compatibility with any particular printer or peripheral.',
      ],
    },
    {
      heading: '8. Availability and updates',
      body: [
        'The Application may be updated from time to time to correct defects, improve performance or add functionality. Updates may change or remove features.',
        'Where a synchronisation or licence service is provided, we do not warrant that it will be available without interruption.',
      ],
    },
    {
      heading: '9. Disclaimer of warranties',
      body: [
        'The Application is provided "as is" and "as available". To the fullest extent permitted by law, we disclaim all warranties, whether express or implied, including any implied warranties of merchantability, fitness for a particular purpose and non-infringement.',
        'We do not warrant that the Application will be uninterrupted, error free, or that it will meet every requirement of your business.',
      ],
    },
    {
      heading: '10. Limitation of liability',
      body: [
        'To the fullest extent permitted by law, we shall not be liable for any indirect, incidental, special or consequential loss, nor for any loss of profits, revenue, goodwill or data, arising out of or in connection with your use of the Application.',
        'Nothing in these Terms excludes or limits liability that cannot lawfully be excluded or limited.',
      ],
    },
    {
      heading: '11. Termination',
      body: [
        'These Terms apply for as long as you use the Application. Your rights under them end if you breach them. On termination you must stop using the Application; data held on your device remains yours.',
      ],
    },
    {
      heading: '12. Governing law',
      body: [
        `These Terms are governed by the laws of ${LEGAL_PLACEHOLDERS.jurisdiction}, and the courts of that jurisdiction shall have exclusive jurisdiction over any dispute arising from them.`,
      ],
    },
    {
      heading: '13. Contact',
      body: [
        `Questions about these Terms may be directed to ${LEGAL_PLACEHOLDERS.contactEmail}.`,
      ],
    },
  ],
};

/** Facts about this build, shown in About. */
export function applicationInformation(): { label: string; value: string }[] {
  return [
    { label: 'Application', value: 'Point of Sale' },
    { label: 'Version', value: APP_CONFIG.version },
    { label: 'Currency', value: `Pakistani Rupees (${CURRENCY.symbol})` },
    { label: 'Currency code', value: CURRENCY.code },
    { label: 'Locale', value: APP_CONFIG.locale },
    { label: 'Time zone', value: APP_CONFIG.timezone },
    { label: 'Data storage', value: 'Local device (offline-first)' },
    { label: 'Provider', value: VENDOR.name },
  ];
}
