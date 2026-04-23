"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { API_BASE } from "../../lib/api";
import { getSessionToken } from "../../lib/session";

async function authenticatedJsonPost(path: string, body: Record<string, unknown>) {
  const token = await getSessionToken();
  if (!token) {
    redirect("/login");
  }

  return fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });
}

export async function uploadSourceAction(tenantSlug: string, formData: FormData) {
  const token = await getSessionToken();
  if (!token) {
    redirect("/login");
  }

  const mode = String(formData.get("mode") || "MASKED_SAMPLE");
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    redirect(`/workspace/${tenantSlug}/sources?error=source-upload`);
  }

  const payload = new FormData();
  payload.set("mode", mode);
  payload.set("file", file);

  const response = await fetch(`${API_BASE}/portal/${tenantSlug}/sources/upload`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: payload,
    cache: "no-store",
  });

  if (!response.ok) {
    redirect(`/workspace/${tenantSlug}/sources?error=source-upload`);
  }

  revalidatePath(`/workspace/${tenantSlug}/sources`);
  revalidatePath(`/workspace/${tenantSlug}/dashboard`);
  redirect(`/workspace/${tenantSlug}/sources?uploaded=source`);
}

export async function uploadEvidenceAction(tenantSlug: string, formData: FormData) {
  const token = await getSessionToken();
  if (!token) {
    redirect("/login");
  }

  const linkedRecord = String(formData.get("linkedRecord") || "").trim();
  const classification = String(formData.get("classification") || "UPLOADED");
  const label = String(formData.get("label") || "").trim();
  const file = formData.get("file");

  if (!(file instanceof File) || file.size === 0 || !linkedRecord) {
    redirect(`/workspace/${tenantSlug}/evidence?error=evidence-upload`);
  }

  const payload = new FormData();
  payload.set("linkedRecord", linkedRecord);
  payload.set("classification", classification);
  payload.set("label", label);
  payload.set("file", file);

  const response = await fetch(`${API_BASE}/portal/${tenantSlug}/evidence/upload`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: payload,
    cache: "no-store",
  });

  if (!response.ok) {
    redirect(`/workspace/${tenantSlug}/evidence?error=evidence-upload`);
  }

  revalidatePath(`/workspace/${tenantSlug}/evidence`);
  revalidatePath(`/workspace/${tenantSlug}/dashboard`);
  redirect(`/workspace/${tenantSlug}/evidence?uploaded=evidence`);
}

export async function approveSourceAction(tenantSlug: string, sourceId: string) {
  const response = await authenticatedJsonPost(`/portal/${tenantSlug}/sources/${sourceId}/approve`, {});
  if (!response.ok) {
    redirect(`/workspace/${tenantSlug}/sources?error=source-approve`);
  }
  revalidatePath(`/workspace/${tenantSlug}/sources`);
  revalidatePath(`/workspace/${tenantSlug}/register`);
  revalidatePath(`/workspace/${tenantSlug}/dashboard`);
  redirect(`/workspace/${tenantSlug}/sources?updated=source`);
}

export async function updateSetupProfileAction(tenantSlug: string, formData: FormData) {
  const descriptor = String(formData.get("descriptor") || "");
  const operationalStory = String(formData.get("operationalStory") || "");
  const publicDomain = String(formData.get("publicDomain") || "");
  const primaryColor = String(formData.get("primaryColor") || "");
  const accentColor = String(formData.get("accentColor") || "");
  const response = await authenticatedJsonPost(`/portal/${tenantSlug}/setup/profile`, {
    descriptor,
    operationalStory,
    publicDomain,
    primaryColor,
    accentColor,
  });
  if (!response.ok) {
    redirect(`/workspace/${tenantSlug}/setup?error=setup-profile`);
  }
  revalidatePath(`/workspace/${tenantSlug}/setup`);
  revalidatePath(`/workspace/${tenantSlug}/dashboard`);
  revalidatePath(`/public/${tenantSlug}/rights`);
  revalidatePath(`/public/${tenantSlug}/notice`);
  redirect(`/workspace/${tenantSlug}/setup?updated=setup-profile`);
}

export async function addDepartmentAction(tenantSlug: string, formData: FormData) {
  const name = String(formData.get("name") || "");
  const ownerTitle = String(formData.get("ownerTitle") || "");
  const obligationFocus = String(formData.get("obligationFocus") || "");
  const response = await authenticatedJsonPost(`/portal/${tenantSlug}/setup/departments`, {
    name,
    ownerTitle,
    obligationFocus,
  });
  if (!response.ok) {
    redirect(`/workspace/${tenantSlug}/setup?error=setup-department`);
  }
  revalidatePath(`/workspace/${tenantSlug}/setup`);
  redirect(`/workspace/${tenantSlug}/setup?updated=setup-department`);
}

export async function addSourceSystemAction(tenantSlug: string, formData: FormData) {
  const name = String(formData.get("name") || "");
  const systemType = String(formData.get("systemType") || "");
  const owner = String(formData.get("owner") || "");
  const status = String(formData.get("status") || "PLANNED");
  const response = await authenticatedJsonPost(`/portal/${tenantSlug}/setup/source-systems`, {
    name,
    systemType,
    owner,
    status,
  });
  if (!response.ok) {
    redirect(`/workspace/${tenantSlug}/setup?error=setup-system`);
  }
  revalidatePath(`/workspace/${tenantSlug}/setup`);
  revalidatePath(`/workspace/${tenantSlug}/sources`);
  redirect(`/workspace/${tenantSlug}/setup?updated=setup-system`);
}

export async function inviteUserAction(tenantSlug: string, formData: FormData) {
  const email = String(formData.get("email") || "");
  const role = String(formData.get("role") || "REVIEWER");
  const title = String(formData.get("title") || "");
  const response = await authenticatedJsonPost(`/portal/${tenantSlug}/setup/invite`, {
    email,
    role,
    title,
  });
  if (!response.ok) {
    redirect(`/workspace/${tenantSlug}/setup?error=setup-invite`);
  }
  revalidatePath(`/workspace/${tenantSlug}/setup`);
  redirect(`/workspace/${tenantSlug}/setup?updated=setup-invite`);
}

export async function updateRegisterLifecycleAction(tenantSlug: string, entryId: string, formData: FormData) {
  const lifecycle = String(formData.get("lifecycle") || "IN_REVIEW");
  const response = await authenticatedJsonPost(`/portal/${tenantSlug}/register/${entryId}/lifecycle`, { lifecycle });
  if (!response.ok) {
    redirect(`/workspace/${tenantSlug}/register?error=register-update`);
  }
  revalidatePath(`/workspace/${tenantSlug}/register`);
  revalidatePath(`/workspace/${tenantSlug}/dashboard`);
  redirect(`/workspace/${tenantSlug}/register?updated=register`);
}

export async function updateNoticeStatusAction(tenantSlug: string, noticeId: string, formData: FormData) {
  const status = String(formData.get("status") || "IN_REVIEW");
  const response = await authenticatedJsonPost(`/portal/${tenantSlug}/notices/${noticeId}/status`, { status });
  if (!response.ok) {
    redirect(`/workspace/${tenantSlug}/notices?error=notice-update`);
  }
  revalidatePath(`/workspace/${tenantSlug}/notices`);
  revalidatePath(`/workspace/${tenantSlug}/dashboard`);
  revalidatePath(`/public/${tenantSlug}/notice`);
  redirect(`/workspace/${tenantSlug}/notices?updated=notice`);
}

export async function updateRightsCaseAction(tenantSlug: string, caseId: string, formData: FormData) {
  const status = String(formData.get("status") || "IN_PROGRESS");
  const evidenceLinked = formData.get("evidenceLinked") === "on";
  const refusalNote = String(formData.get("refusalNote") || "");
  const response = await authenticatedJsonPost(`/portal/${tenantSlug}/rights/${caseId}/update`, {
    status,
    evidenceLinked,
    refusalNote,
  });
  if (!response.ok) {
    redirect(`/workspace/${tenantSlug}/rights?error=rights-update`);
  }
  revalidatePath(`/workspace/${tenantSlug}/rights`);
  revalidatePath(`/workspace/${tenantSlug}/retention`);
  revalidatePath(`/workspace/${tenantSlug}/dashboard`);
  redirect(`/workspace/${tenantSlug}/rights?updated=rights`);
}

export async function updateDeletionTaskAction(tenantSlug: string, taskId: string, formData: FormData) {
  const status = String(formData.get("status") || "READY_FOR_PROOF");
  const proofLinked = formData.get("proofLinked") === "on";
  const processorAcknowledged = formData.get("processorAcknowledged") === "on";
  const exceptionNote = String(formData.get("exceptionNote") || "");
  const response = await authenticatedJsonPost(`/portal/${tenantSlug}/retention/${taskId}/update`, {
    status,
    proofLinked,
    processorAcknowledged,
    exceptionNote,
  });
  if (!response.ok) {
    redirect(`/workspace/${tenantSlug}/retention?error=retention-update`);
  }
  revalidatePath(`/workspace/${tenantSlug}/retention`);
  revalidatePath(`/workspace/${tenantSlug}/dashboard`);
  redirect(`/workspace/${tenantSlug}/retention?updated=retention`);
}

export async function updateIncidentAction(tenantSlug: string, incidentId: string, formData: FormData) {
  const status = String(formData.get("status") || "ASSESSMENT");
  const evidenceLinked = formData.get("evidenceLinked") === "on";
  const remediationOwner = String(formData.get("remediationOwner") || "");
  const response = await authenticatedJsonPost(`/portal/${tenantSlug}/incidents/${incidentId}/update`, {
    status,
    evidenceLinked,
    remediationOwner,
  });
  if (!response.ok) {
    redirect(`/workspace/${tenantSlug}/incidents?error=incident-update`);
  }
  revalidatePath(`/workspace/${tenantSlug}/incidents`);
  revalidatePath(`/workspace/${tenantSlug}/dashboard`);
  redirect(`/workspace/${tenantSlug}/incidents?updated=incident`);
}

/* ── Agentic AI Actions ─────────────────────────────────────── */

export async function triggerBreachAgentAction(tenantSlug: string, incidentId: string) {
  const response = await authenticatedJsonPost(`/portal/${tenantSlug}/agents/breach/${incidentId}/trigger`, {});
  if (!response.ok) {
    redirect(`/workspace/${tenantSlug}/incidents?error=agent-trigger`);
  }
  revalidatePath(`/workspace/${tenantSlug}/incidents`);
  revalidatePath(`/workspace/${tenantSlug}/dashboard`);
  redirect(`/workspace/${tenantSlug}/incidents?updated=agent-triggered`);
}

export async function triggerRightsAgentAction(tenantSlug: string, caseId: string) {
  const response = await authenticatedJsonPost(`/portal/${tenantSlug}/agents/rights/${caseId}/trigger`, {});
  if (!response.ok) {
    redirect(`/workspace/${tenantSlug}/rights?error=agent-trigger`);
  }
  revalidatePath(`/workspace/${tenantSlug}/rights`);
  revalidatePath(`/workspace/${tenantSlug}/dashboard`);
  redirect(`/workspace/${tenantSlug}/rights?updated=agent-triggered`);
}

export async function reviewAgentActionAction(tenantSlug: string, actionId: string, formData: FormData) {
  const state = String(formData.get("state") || "REVIEWED");
  const editedBody = String(formData.get("editedBody") || "");
  const approvalNote = String(formData.get("approvalNote") || "");
  const returnModule = String(formData.get("returnModule") || "incidents");
  const response = await authenticatedJsonPost(`/portal/${tenantSlug}/agents/actions/${actionId}/review`, {
    state,
    editedBody: editedBody || undefined,
    approvalNote: approvalNote || undefined,
  });
  if (!response.ok) {
    redirect(`/workspace/${tenantSlug}/${returnModule}?error=agent-review`);
  }
  revalidatePath(`/workspace/${tenantSlug}/${returnModule}`);
  revalidatePath(`/workspace/${tenantSlug}/dashboard`);
  redirect(`/workspace/${tenantSlug}/${returnModule}?updated=agent-reviewed`);
}

export async function updateProcessorAction(tenantSlug: string, processorId: string, formData: FormData) {
  const dpaStatus = String(formData.get("dpaStatus") || "IN_REVIEW");
  const purgeAckStatus = String(formData.get("purgeAckStatus") || "PENDING");
  const response = await authenticatedJsonPost(`/portal/${tenantSlug}/processors/${processorId}/update`, {
    dpaStatus,
    purgeAckStatus,
  });
  if (!response.ok) {
    redirect(`/workspace/${tenantSlug}/processors?error=processor-update`);
  }
  revalidatePath(`/workspace/${tenantSlug}/processors`);
  revalidatePath(`/workspace/${tenantSlug}/dashboard`);
  redirect(`/workspace/${tenantSlug}/processors?updated=processor`);
}

export async function updateNoticeContentAction(tenantSlug: string, noticeId: string, formData: FormData) {
  const title = String(formData.get("title") || "");
  const content = String(formData.get("content") || "");
  const audience = String(formData.get("audience") || "");
  const response = await authenticatedJsonPost(`/portal/${tenantSlug}/notices/${noticeId}/update`, {
    title,
    content,
    audience,
  });
  if (!response.ok) {
    redirect(`/workspace/${tenantSlug}/notices?error=notice-update`);
  }
  revalidatePath(`/workspace/${tenantSlug}/notices`);
  redirect(`/workspace/${tenantSlug}/notices?updated=notice`);
}

export async function createNoticeAction(tenantSlug: string, formData: FormData) {
  const title = String(formData.get("title") || "");
  const content = String(formData.get("content") || "");
  const audience = String(formData.get("audience") || "");
  const response = await authenticatedJsonPost(`/portal/${tenantSlug}/notices`, {
    title,
    content,
    audience,
  });
  if (!response.ok) {
    redirect(`/workspace/${tenantSlug}/notices?error=notice-create`);
  }
  revalidatePath(`/workspace/${tenantSlug}/notices`);
  redirect(`/workspace/${tenantSlug}/notices?updated=notice`);
}
