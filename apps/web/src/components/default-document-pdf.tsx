"use client";

import type { CSSProperties } from "react";
import { formatCurrency, formatDate } from "@/lib/format";
import type { DocumentBranding, FabricaCustomer, FabricaDocument } from "@/lib/documentBranding";

type Props = {
  doc: FabricaDocument;
  branding: DocumentBranding;
  customer?: FabricaCustomer | null;
  kind?: "quotation" | "invoice";
  contentId?: string;
};

function buyerAddress(customer?: FabricaCustomer | null): string {
  if (!customer) return "";
  return customer.billingAddress || customer.address || "";
}

export function DefaultDocumentPdf({
  doc,
  branding,
  customer,
  kind = "quotation",
  contentId = "document-pdf-content",
}: Props) {
  const docLabel = kind === "invoice" ? "Tax Invoice" : "Quotation";
  const serial = doc.number || doc.id?.slice(0, 8).toUpperCase() || "N/A";
  const accent = "#1e3a5f";
  const scope = doc.scope || {};
  const hasIgst = Number(doc.igst || 0) > 0;

  return (
    <div id={contentId} className="bg-white" style={{ width: "800px", padding: 0, fontFamily: "Inter, Arial, sans-serif" }}>
      <div style={{ height: "5px", backgroundColor: accent }} />

      <div style={{ padding: "24px 32px 16px 32px" }}>
        <div style={{ display: "flex", gap: "24px", alignItems: "flex-start" }}>
          <div style={{ flexShrink: 0 }}>
            {branding.logo_url ? (
              <img
                src={branding.logo_url}
                alt="Company logo"
                crossOrigin="anonymous"
                style={{ width: "140px", height: "auto", maxHeight: "72px", objectFit: "contain", display: "block" }}
              />
            ) : null}
          </div>
          <div style={{ flex: 1, minWidth: 0, textAlign: "center", paddingTop: "4px" }}>
            <h1 style={{ margin: 0, fontSize: "22px", fontWeight: 800, color: accent, letterSpacing: "0.5px" }}>
              {branding.company_name || "Company"}
            </h1>
            {branding.company_address ? (
              <p style={{ margin: "6px 0 0 0", fontSize: "12px", color: "#475569", lineHeight: 1.45, whiteSpace: "pre-line" }}>
                {branding.company_address}
              </p>
            ) : null}
          </div>
          <div style={{ flexShrink: 0, width: "72px" }} />
        </div>
      </div>

      <div style={{ padding: "0 32px 16px 32px" }}>
        <p style={{ margin: "0 0 8px 0", fontSize: "12px", fontWeight: 700, color: accent, textTransform: "uppercase", letterSpacing: "0.5px" }}>
          Company Details
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px 24px", fontSize: "12px" }}>
          {branding.gst_number ? (
            <p style={{ margin: 0, color: "#1e293b" }}>
              <span style={{ color: "#64748b" }}>GSTIN: </span>
              {branding.gst_number}
            </p>
          ) : null}
          {branding.pan ? (
            <p style={{ margin: 0, color: "#1e293b" }}>
              <span style={{ color: "#64748b" }}>PAN: </span>
              {branding.pan}
            </p>
          ) : null}
          {branding.phone ? (
            <p style={{ margin: 0, color: "#1e293b" }}>
              <span style={{ color: "#64748b" }}>Phone: </span>
              {branding.phone}
            </p>
          ) : null}
          {branding.email ? (
            <p style={{ margin: 0, color: "#1e293b" }}>
              <span style={{ color: "#64748b" }}>Email: </span>
              {branding.email}
            </p>
          ) : null}
        </div>
      </div>

      <div style={{ padding: "16px 32px", display: "flex", gap: "40px", borderTop: "1px solid #e2e8f0" }}>
        <div style={{ flex: 1 }}>
          <p style={{ margin: "0 0 6px 0", fontSize: "12px", fontWeight: 700, color: accent, textTransform: "uppercase", letterSpacing: "0.5px" }}>
            Bill To
          </p>
          {customer ? (
            <>
              <p style={{ margin: 0, fontSize: "14px", fontWeight: 600, color: "#1e293b" }}>{customer.name}</p>
              {customer.company ? <p style={{ margin: "2px 0", fontSize: "12px", color: "#475569" }}>{customer.company}</p> : null}
              {customer.phone ? <p style={{ margin: "2px 0", fontSize: "12px", color: "#475569" }}>Phone: {customer.phone}</p> : null}
              {customer.email ? <p style={{ margin: "2px 0", fontSize: "12px", color: "#475569" }}>{customer.email}</p> : null}
              {customer.gstin ? <p style={{ margin: "2px 0", fontSize: "12px", color: "#475569" }}>GSTIN: {customer.gstin}</p> : null}
              {buyerAddress(customer) ? <p style={{ margin: "2px 0", fontSize: "12px", color: "#475569", whiteSpace: "pre-line" }}>{buyerAddress(customer)}</p> : null}
            </>
          ) : (
            <p style={{ margin: 0, fontSize: "12px", color: "#94a3b8" }}>No customer details</p>
          )}
        </div>
        <div style={{ flexShrink: 0, textAlign: "right" }}>
          <p style={{ margin: "0 0 4px 0", fontSize: "12px", fontWeight: 700, color: accent, textTransform: "uppercase", letterSpacing: "0.5px" }}>
            {docLabel}
          </p>
          <p style={{ margin: 0, fontSize: "14px", fontWeight: 600, color: "#1e293b" }}>#{serial}</p>
          <p style={{ margin: "8px 0 0 0", fontSize: "11px", color: "#64748b" }}>Date: {formatDate(doc.createdAt)}</p>
          {kind === "quotation" && doc.validUntil ? (
            <p style={{ margin: "2px 0 0 0", fontSize: "11px", color: "#64748b" }}>Valid Until: {formatDate(doc.validUntil)}</p>
          ) : null}
          {kind === "invoice" && doc.dueDate ? (
            <p style={{ margin: "2px 0 0 0", fontSize: "11px", color: "#64748b" }}>Due Date: {formatDate(doc.dueDate)}</p>
          ) : null}
        </div>
      </div>

      <div style={{ padding: "0 32px" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
          <thead>
            <tr style={{ backgroundColor: accent }}>
              <th style={thStyle}>#</th>
              <th style={thStyle}>Description</th>
              <th style={{ ...thStyle, textAlign: "right" }}>Qty</th>
              <th style={{ ...thStyle, textAlign: "right" }}>Rate</th>
              <th style={{ ...thStyle, textAlign: "right" }}>Disc %</th>
              <th style={{ ...thStyle, textAlign: "right" }}>GST %</th>
              <th style={{ ...thStyle, textAlign: "right" }}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {doc.line_items?.length ? (
              doc.line_items.map((item, i) => (
                <tr key={i} style={{ borderBottom: "1px solid #f1f5f9" }}>
                  <td style={tdStyle}>{i + 1}</td>
                  <td style={tdStyle}>
                    {item.description}
                    {item.unit ? <span style={{ color: "#94a3b8" }}> ({item.unit})</span> : null}
                  </td>
                  <td style={{ ...tdStyle, textAlign: "right" }}>{item.quantity}</td>
                  <td style={{ ...tdStyle, textAlign: "right" }}>{formatCurrency(item.unit_price)}</td>
                  <td style={{ ...tdStyle, textAlign: "right" }}>{item.discount_pct || 0}</td>
                  <td style={{ ...tdStyle, textAlign: "right" }}>{item.tax_pct || 0}</td>
                  <td style={{ ...tdStyle, textAlign: "right", fontWeight: 600 }}>{formatCurrency(item.total)}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={7} style={{ padding: "12px 10px", color: "#94a3b8", fontSize: "12px", textAlign: "center" }}>
                  No line items
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div style={{ padding: "16px 32px", display: "flex", justifyContent: "flex-end" }}>
        <table style={{ width: "280px", fontSize: "12px", borderCollapse: "collapse" }}>
          <tbody>
            <tr>
              <td style={totLabel}>Subtotal</td>
              <td style={totValue}>{formatCurrency(doc.subtotal)}</td>
            </tr>
            {Number(doc.discount_total || 0) > 0 ? (
              <tr>
                <td style={totLabel}>Discount</td>
                <td style={totValue}>{formatCurrency(doc.discount_total)}</td>
              </tr>
            ) : null}
            {hasIgst ? (
              <tr>
                <td style={totLabel}>IGST</td>
                <td style={totValue}>{formatCurrency(doc.igst)}</td>
              </tr>
            ) : (
              <>
                <tr>
                  <td style={totLabel}>CGST</td>
                  <td style={totValue}>{formatCurrency(doc.cgst)}</td>
                </tr>
                <tr>
                  <td style={totLabel}>SGST</td>
                  <td style={totValue}>{formatCurrency(doc.sgst)}</td>
                </tr>
              </>
            )}
            <tr>
              <td style={{ ...totLabel, borderTop: "2px solid #1e293b", fontWeight: 700, color: "#0f172a", paddingTop: 8 }}>Total</td>
              <td style={{ ...totValue, borderTop: "2px solid #1e293b", fontWeight: 700, color: "#0f172a", fontSize: "14px", paddingTop: 8 }}>
                {formatCurrency(doc.total_amount || doc.subtotal)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {(scope.included || scope.excluded || scope.warranty || scope.paymentTerms) ? (
        <div style={{ padding: "16px 32px", borderTop: "1px solid #e2e8f0", fontSize: "12px" }}>
          {scope.included ? (
            <p style={{ margin: "0 0 8px 0", color: "#475569" }}>
              <strong>Included:</strong> {scope.included}
            </p>
          ) : null}
          {scope.excluded ? (
            <p style={{ margin: "0 0 8px 0", color: "#475569" }}>
              <strong>Excluded:</strong> {scope.excluded}
            </p>
          ) : null}
          {scope.warranty ? (
            <p style={{ margin: "0 0 8px 0", color: "#475569" }}>
              <strong>Warranty:</strong> {scope.warranty}
            </p>
          ) : null}
          {scope.paymentTerms ? (
            <p style={{ margin: 0, color: "#475569" }}>
              <strong>Payment Terms:</strong> {scope.paymentTerms}
            </p>
          ) : null}
        </div>
      ) : null}

      <div style={{ padding: "20px 32px 8px 32px", display: "flex", gap: "40px" }}>
        <div style={{ flex: 1 }}>
          <p style={{ margin: "0 0 8px 0", fontSize: "12px", fontWeight: 700, color: accent, textTransform: "uppercase", letterSpacing: "0.5px" }}>
            Company Seal
          </p>
          {branding.seal_url ? (
            <img src={branding.seal_url} alt="Company seal" crossOrigin="anonymous" style={{ height: "96px", width: "auto", maxWidth: "160px", objectFit: "contain" }} />
          ) : (
            <div style={{ width: "140px", height: "80px" }} />
          )}
        </div>
        <div style={{ flexShrink: 0, textAlign: "right", minWidth: "180px" }}>
          <p style={{ margin: "0 0 8px 0", fontSize: "12px", fontWeight: 700, color: accent, textTransform: "uppercase", letterSpacing: "0.5px" }}>
            Authorized Signature
          </p>
          {branding.signature_url ? (
            <img
              src={branding.signature_url}
              alt="Authorized signature"
              crossOrigin="anonymous"
              style={{ height: "64px", width: "auto", maxWidth: "160px", objectFit: "contain", display: "block", marginLeft: "auto" }}
            />
          ) : (
            <div style={{ height: "64px" }} />
          )}
          <div style={{ width: "160px", borderBottom: "1px solid #94a3b8", margin: "8px 0 0 auto" }} />
          <p style={{ margin: "6px 0 0 0", fontSize: "12px", fontWeight: 600, color: "#1e293b" }}>Authorised Signatory</p>
        </div>
      </div>

      {(branding.bank_name || branding.bank_ifsc_code || branding.upi_id) ? (
        <div style={{ padding: "16px 32px", borderTop: "1px solid #e2e8f0" }}>
          <p style={{ margin: "0 0 6px 0", fontSize: "12px", fontWeight: 700, color: accent, textTransform: "uppercase", letterSpacing: "0.5px" }}>
            Bank Details
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "4px", fontSize: "12px" }}>
            {branding.bank_account_holder ? <p style={{ margin: 0, color: "#1e293b" }}><span style={{ color: "#64748b" }}>Account Holder: </span>{branding.bank_account_holder}</p> : null}
            {branding.bank_name ? <p style={{ margin: 0, color: "#1e293b" }}><span style={{ color: "#64748b" }}>Bank: </span>{branding.bank_name}</p> : null}
            {branding.bank_branch ? <p style={{ margin: 0, color: "#1e293b" }}><span style={{ color: "#64748b" }}>Branch: </span>{branding.bank_branch}</p> : null}
            {branding.bank_account_number ? <p style={{ margin: 0, color: "#1e293b" }}><span style={{ color: "#64748b" }}>Account Number: </span>{branding.bank_account_number}</p> : null}
            {branding.bank_ifsc_code ? <p style={{ margin: 0, color: "#1e293b" }}><span style={{ color: "#64748b" }}>IFSC: </span>{branding.bank_ifsc_code}</p> : null}
            {branding.upi_id ? <p style={{ margin: 0, color: "#1e293b" }}><span style={{ color: "#64748b" }}>UPI (GPay): </span>{branding.upi_id}</p> : null}
          </div>
        </div>
      ) : null}

      {branding.terms_conditions ? (
        <div style={{ padding: "16px 32px", borderTop: "1px solid #e2e8f0" }}>
          <p style={{ margin: "0 0 4px 0", fontSize: "11px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Terms &amp; Conditions</p>
          <p style={{ margin: 0, fontSize: "12px", color: "#475569", whiteSpace: "pre-line" }}>{branding.terms_conditions}</p>
        </div>
      ) : null}

      {doc.notes ? (
        <div style={{ padding: "16px 32px", borderTop: "1px solid #e2e8f0" }}>
          <p style={{ margin: "0 0 4px 0", fontSize: "11px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Notes</p>
          <p style={{ margin: 0, fontSize: "12px", color: "#475569", whiteSpace: "pre-line" }}>{doc.notes}</p>
        </div>
      ) : null}

      <div style={{ backgroundColor: accent, padding: "10px 32px", textAlign: "center" }}>
        <p style={{ margin: 0, fontSize: "10px", color: "#94a3b8" }}>
          {[branding.company_name, branding.company_address, branding.phone, branding.email].filter(Boolean).join(" | ")}
        </p>
      </div>
    </div>
  );
}

const thStyle: CSSProperties = {
  padding: "8px 10px",
  textAlign: "left",
  color: "#fff",
  fontWeight: 600,
  fontSize: "11px",
  textTransform: "uppercase",
  letterSpacing: "0.3px",
};

const tdStyle: CSSProperties = {
  padding: "7px 10px",
  color: "#334155",
  fontSize: "12px",
};

const totLabel: CSSProperties = {
  padding: "4px 0",
  color: "#64748b",
  textAlign: "left",
};

const totValue: CSSProperties = {
  padding: "4px 0",
  color: "#1e293b",
  textAlign: "right",
  fontWeight: 500,
};
