/**
 *  Data Processing Agreement (DPA) generator — DPDP §8 + Rule 6.
 *
 *  When you connect a Processor (a vendor that handles personal data on your
 *  behalf), DPDP §8 makes the Data Fiduciary responsible for governance —
 *  written DPA, sub-processor disclosure, purge acknowledgment.
 *
 *  This module produces a Markdown DPA tailored to:
 *    - the connector's category (CRM, payments, helpdesk, …)
 *    - the connector's known DPDP context (RBI 5y, GST 8y, etc. from
 *      CONNECTOR_DEFINITIONS.dpdpNotes)
 *    - the connector's data residency (so cross-border §16 disclosure is
 *      auto-emitted where applicable)
 *
 *  Output is plain Markdown so the operator can paste into DocuSign /
 *  e-Sign / Razorpay e-sign without conversion. The generator never claims
 *  to be a finalised legal contract — every output ends with a "review by
 *  counsel" disclaimer.
 */

import type {
  ConnectorCategory,
  ConnectorDefinition,
  ConnectorType,
  Processor,
  TenantWorkspace,
} from "@prooflyt/contracts";

export interface DpaGeneratorInput {
  /** Workspace tenant — for fiduciary identity */
  tenantName: string;
  tenantIndustry: string;
  /** Address shown on the DPA — operator passes it in */
  fiduciaryAddress: string;
  /** Named contact at the Data Fiduciary */
  fiduciaryDpoName: string;
  fiduciaryDpoEmail: string;
  /** Processor record from the workspace */
  processor: Processor;
  /** Optional connector definition for richer per-vendor context */
  connectorDefinition?: ConnectorDefinition;
  /** Effective date of the DPA */
  effectiveDate: string;
  /** Term (months) */
  termMonths?: number;
}

export interface DpaGeneratorOutput {
  /** Stable id for evidence tracking */
  id: string;
  generatedAt: string;
  /** Markdown body — paste into e-sign */
  markdown: string;
  /** Metadata for audit */
  meta: {
    processorId: string;
    processorName: string;
    category: ConnectorCategory | "UNKNOWN";
    crossBorder: boolean;
    legalBasisFloor: string | null;
  };
}

const CATEGORY_PROCESSING_TYPE: Record<ConnectorCategory, string> = {
  CRM: "Customer relationship management — contact, lead, deal, opportunity records",
  PAYMENTS: "Payment processing — customer identifier, transaction, settlement records",
  HELPDESK: "Customer support — ticket, contact, attachment, conversation logs",
  ECOMMERCE: "Order and customer management — buyer, order, shipment, payment-status records",
  DATABASE: "Application database — user, transactional, and audit records",
  OBJECT_STORAGE: "Object storage — uploaded documents, exports, KYC scans, backups",
  IDENTITY: "Identity and access management — user account, session, factor enrolment records",
  MARKETING: "Marketing engagement — profile, segment, opt-in, campaign event records",
  COMMS: "Programmable communications — message, call, recipient records",
  ANALYTICS: "Behavioural analytics — pseudonymised event, session, user-property records",
  MARKETPLACE: "Marketplace operations — buyer-restricted PII for fulfilment",
  LOGISTICS: "Shipping and logistics — consignee identity, address, COD records",
  HR: "HR and payroll — employee identity, payroll, performance, exit records",
  COLLABORATION: "Internal collaboration — user account, message, file metadata records",
  DATA_WAREHOUSE: "Analytical warehouse — denormalised user and event records for BI",
  STORAGE_DOC: "Document storage — uploaded files, sheets, shared metadata",
};

export function generateDpa(input: DpaGeneratorInput): DpaGeneratorOutput {
  const def = input.connectorDefinition;
  const cat: ConnectorCategory | "UNKNOWN" = (def?.category as ConnectorCategory) || "UNKNOWN";
  const processingType = cat !== "UNKNOWN" ? CATEGORY_PROCESSING_TYPE[cat] : "Processing of personal data on behalf of the Data Fiduciary";

  const crossBorder = !!def?.dpdpNotes.dataResidency && /(US|EU|Canada|UK|Singapore|outside india|cross[- ]border)/i.test(def.dpdpNotes.dataResidency);
  const legalBasisFloor = def?.dpdpNotes.legalBasisFloor ?? null;

  const term = input.termMonths || 12;
  const id = `dpa_${input.processor.id}_${Date.now()}`;
  const generatedAt = new Date().toISOString();

  const lines: string[] = [];
  lines.push(`# Data Processing Agreement`);
  lines.push(``);
  lines.push(`This Data Processing Agreement (the **"DPA"**) is entered into on **${input.effectiveDate}** between:`);
  lines.push(``);
  lines.push(`**Data Fiduciary** (the **"Fiduciary"**)`);
  lines.push(`- **Name:** ${input.tenantName}`);
  lines.push(`- **Industry:** ${input.tenantIndustry}`);
  lines.push(`- **Address:** ${input.fiduciaryAddress}`);
  lines.push(`- **DPO / Grievance Officer:** ${input.fiduciaryDpoName} (${input.fiduciaryDpoEmail})`);
  lines.push(``);
  lines.push(`**Data Processor** (the **"Processor"**)`);
  lines.push(`- **Name:** ${input.processor.name}`);
  if (def) lines.push(`- **Vendor entity:** ${def.vendor}`);
  lines.push(`- **Service:** ${input.processor.service}`);
  if (def?.apiBaseUrl) lines.push(`- **API endpoint:** ${def.apiBaseUrl}`);
  lines.push(``);
  lines.push(`The parties agree to the terms below, made under the **Digital Personal Data Protection Act, 2023** ("DPDP Act") and the rules thereunder.`);
  lines.push(``);

  lines.push(`## 1. Subject matter and duration`);
  lines.push(``);
  lines.push(`The Processor will process Personal Data on behalf of the Fiduciary as part of the service described above. This DPA is effective from **${input.effectiveDate}** and runs for **${term} months**, automatically renewing for successive 12-month periods unless terminated in writing.`);
  lines.push(``);

  lines.push(`## 2. Nature, purpose and types of personal data`);
  lines.push(``);
  lines.push(`**Type of processing:** ${processingType}.`);
  lines.push(``);
  lines.push(`**Purposes:** carrying out the service requested by the Fiduciary; meeting statutory obligations of the Fiduciary; preventing fraud; resolving complaints under DPDP §15.`);
  lines.push(``);

  lines.push(`## 3. Obligations of the Processor (DPDP §8)`);
  lines.push(``);
  lines.push(`The Processor shall:`);
  lines.push(`1. Process Personal Data only on documented instructions from the Fiduciary and only for the purposes stated above.`);
  lines.push(`2. Implement reasonable security safeguards under DPDP §8(5) and Rule 6 — encryption-at-rest, encryption-in-transit, access controls, periodic vulnerability testing.`);
  lines.push(`3. Notify the Fiduciary without undue delay (and in any event within 24 hours) of becoming aware of a personal-data breach. The Fiduciary remains responsible for §29 board notification.`);
  lines.push(`4. Permit and contribute to audits, including inspections, conducted by the Fiduciary or its mandated auditor on reasonable notice.`);
  lines.push(`5. Make available to the Fiduciary all information necessary to demonstrate compliance with DPDP obligations.`);
  lines.push(`6. Assist the Fiduciary, taking into account the nature of the processing, in fulfilling its obligation to respond to data principal requests under DPDP §11–§15.`);
  lines.push(`7. Acknowledge purge/erasure requests within 5 business days and provide a deletion certificate.`);
  lines.push(``);

  lines.push(`## 4. Sub-processors`);
  lines.push(``);
  lines.push(`The Processor currently engages **${input.processor.subProcessorCount}** sub-processor(s) for the service. The Processor will:`);
  lines.push(`- Maintain a current list of named sub-processors and provide it to the Fiduciary on request.`);
  lines.push(`- Notify the Fiduciary at least 30 days in advance of adding or replacing a sub-processor.`);
  lines.push(`- Bind every sub-processor by written agreement to terms equivalent to this DPA.`);
  lines.push(``);

  if (legalBasisFloor) {
    lines.push(`## 5. Statutory retention floor`);
    lines.push(``);
    lines.push(`The parties acknowledge that this Service is subject to the following statutory retention obligations under Indian law that may override an erasure request from a data principal:`);
    lines.push(``);
    lines.push(`> ${legalBasisFloor}`);
    lines.push(``);
    lines.push(`Where the Fiduciary forwards an erasure request that conflicts with the above floor, the Processor will (a) anonymise customer-facing PII fields where possible, (b) preserve transactional records for the regulatory window, and (c) issue a written confirmation to the Fiduciary that the erasure has been processed under DPDP §17(2)(a) (compliance with Indian law exemption).`);
    lines.push(``);
  }

  if (crossBorder) {
    lines.push(`## 6. Cross-border transfer (DPDP §16 + Rule 15)`);
    lines.push(``);
    lines.push(`The parties acknowledge that the Service involves transfer of Personal Data outside India:`);
    lines.push(``);
    lines.push(`> ${def?.dpdpNotes.dataResidency || "See Service documentation."}`);
    lines.push(``);
    lines.push(`The Processor confirms that all transfer destinations are on the list of permitted countries notified by the Government of India under DPDP §16 at the time of transfer. The Processor will notify the Fiduciary in writing if any destination is removed from that list.`);
    lines.push(``);
  }

  const sectionN = (n: number) => `## ${n}.`;
  let n = legalBasisFloor && crossBorder ? 7 : legalBasisFloor || crossBorder ? 6 : 5;

  lines.push(`${sectionN(n)} Liability and indemnity`);
  lines.push(``);
  lines.push(`Each party indemnifies the other against losses arising from its own breach of this DPA, including penalties imposed by the Data Protection Board of India under DPDP Schedule. Liability for fines arising from the Processor's breach is uncapped.`);
  lines.push(``);
  n += 1;

  lines.push(`${sectionN(n)} Termination and return / deletion of data`);
  lines.push(``);
  lines.push(`On termination of the underlying service or this DPA, whichever is later, the Processor will, at the Fiduciary's choice:`);
  lines.push(`1. Return all Personal Data to the Fiduciary in a structured, commonly used, machine-readable format within 30 days; or`);
  lines.push(`2. Delete all Personal Data and provide a written deletion certificate within 30 days,`);
  lines.push(``);
  lines.push(`subject to the statutory retention floor in §5 above (where applicable).`);
  lines.push(``);
  n += 1;

  lines.push(`${sectionN(n)} Governing law and dispute resolution`);
  lines.push(``);
  lines.push(`This DPA is governed by the laws of India. The courts at the location of the Fiduciary's registered office have exclusive jurisdiction. Disputes will first be referred to mediation per the DPDP Act, 2023.`);
  lines.push(``);

  lines.push(`---`);
  lines.push(``);
  lines.push(`**Signed for the Fiduciary:** ___________________`);
  lines.push(`**Name:** ${input.fiduciaryDpoName}`);
  lines.push(`**Designation:** Data Protection Officer`);
  lines.push(`**Date:** ${input.effectiveDate}`);
  lines.push(``);
  lines.push(`**Signed for the Processor:** ___________________`);
  lines.push(`**Name:** [REPLACE]`);
  lines.push(`**Designation:** [REPLACE]`);
  lines.push(`**Date:** [REPLACE]`);
  lines.push(``);
  lines.push(`---`);
  lines.push(``);
  lines.push(`*This DPA was generated by Prooflyt's DPA generator from the Data Fiduciary's connector and processor records on **${generatedAt}**. It is a starting template, not a finalised legal contract — review by counsel before signing.*`);

  return {
    id,
    generatedAt,
    markdown: lines.join("\n"),
    meta: {
      processorId: input.processor.id,
      processorName: input.processor.name,
      category: cat,
      crossBorder,
      legalBasisFloor,
    },
  };
}

/**
 *  Persist the generated DPA on the workspace as evidence so it appears in
 *  the Compliance Pack and the Vendor record links to the latest version.
 */
export function persistDpaOutput(workspace: TenantWorkspace, output: DpaGeneratorOutput): void {
  workspace.evidence.unshift({
    id: `ev-${output.id}`,
    label: `DPA template — ${output.meta.processorName} (generated)`,
    classification: "ATTESTATION",
    linkedRecord: output.meta.processorId,
    createdAt: output.generatedAt,
    contentIndexed: false,
  });
  const ws = workspace as TenantWorkspace & { dpaTemplates?: DpaGeneratorOutput[] };
  if (!ws.dpaTemplates) ws.dpaTemplates = [];
  ws.dpaTemplates!.unshift(output);
  if (ws.dpaTemplates!.length > 50) ws.dpaTemplates = ws.dpaTemplates!.slice(0, 50);
}

export function findConnectorDefForProcessor(
  processor: Processor,
  connectorDefinitions: Record<ConnectorType, ConnectorDefinition>,
): ConnectorDefinition | undefined {
  // Heuristic: match Processor.name against ConnectorDefinition.name. If a
  // tenant has multiple processors per name, the operator can override by
  // passing connectorType explicitly to the route.
  const lower = processor.name.toLowerCase();
  return Object.values(connectorDefinitions).find((d) => d.name.toLowerCase() === lower)
    || Object.values(connectorDefinitions).find((d) => lower.includes(d.name.toLowerCase()));
}
