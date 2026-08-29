export type DocumentBranding = {
  company_name: string;
  company_address: string;
  gst_number: string;
  pan: string;
  phone: string;
  email: string;
  bank_name: string;
  bank_branch: string;
  bank_account_holder: string;
  bank_account_number: string;
  bank_ifsc_code: string;
  upi_id: string;
  terms_conditions: string;
  logo_url: string;
  seal_url: string;
  signature_url: string;
};

export type FabricaCustomer = {
  name?: string;
  company?: string | null;
  phone?: string;
  email?: string | null;
  address?: string | null;
  billingAddress?: string | null;
  gstin?: string | null;
};

export type DocumentLineItem = {
  description: string;
  quantity: string | number;
  unit?: string;
  unit_price: string | number;
  discount_pct?: string | number;
  tax_pct?: string | number;
  total: string | number;
};

export type FabricaDocument = {
  id?: string;
  number?: string;
  createdAt?: string;
  dueDate?: string | null;
  validUntil?: string | null;
  notes?: string | null;
  line_items?: DocumentLineItem[];
  subtotal?: string | number;
  discount_total?: string | number;
  tax_total?: string | number;
  cgst?: string | number;
  sgst?: string | number;
  igst?: string | number;
  total_amount?: string | number;
  scope?: {
    included?: string | null;
    excluded?: string | null;
    warranty?: string | null;
    paymentTerms?: string | null;
    assumptions?: string | null;
  };
  customer?: FabricaCustomer | null;
  site?: { name?: string; address?: string } | null;
  branding?: DocumentBranding;
};

export function resolveDocumentBranding(doc: FabricaDocument): DocumentBranding {
  const b = doc.branding;
  return {
    company_name: b?.company_name || "",
    company_address: b?.company_address || "",
    gst_number: b?.gst_number || "",
    pan: b?.pan || "",
    phone: b?.phone || "",
    email: b?.email || "",
    bank_name: b?.bank_name || "",
    bank_branch: b?.bank_branch || "",
    bank_account_holder: b?.bank_account_holder || "",
    bank_account_number: b?.bank_account_number || "",
    bank_ifsc_code: b?.bank_ifsc_code || "",
    upi_id: b?.upi_id || "",
    terms_conditions: b?.terms_conditions || "",
    logo_url: b?.logo_url || "",
    seal_url: b?.seal_url || "",
    signature_url: b?.signature_url || "",
  };
}
