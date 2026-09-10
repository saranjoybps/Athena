from enum import StrEnum


class Permission(StrEnum):
    WILDCARD = "*"
    CUSTOMER_READ = "customer.read"
    CUSTOMER_CREATE = "customer.create"
    CUSTOMER_UPDATE = "customer.update"
    SITE_READ = "site.read"
    SITE_CREATE = "site.create"
    SITE_UPDATE = "site.update"
    SURVEY_READ = "survey.read"
    SURVEY_CREATE = "survey.create"
    MEASUREMENT_CREATE = "measurement.create"
    MEASUREMENT_READ = "measurement.read"
    ESTIMATE_READ = "estimate.read"
    ESTIMATE_CREATE = "estimate.create"
    ESTIMATE_APPROVE = "estimate.approve"
    QUOTE_CREATE = "quote.create"
    QUOTE_SEND = "quote.send"
    QUOTE_APPROVE = "quote.approve"
    QUOTE_READ = "quote.read"
    PROJECT_READ = "project.read"
    PROJECT_CREATE = "project.create"
    PROJECT_UPDATE = "project.update"
    PROJECT_CLOSE = "project.close"
    LABOUR_READ = "labour.read"
    LABOUR_MANAGE = "labour.manage"
    ATTENDANCE_CREATE = "attendance.create"
    ATTENDANCE_READ = "attendance.read"
    MATERIAL_READ = "material.read"
    MATERIAL_MANAGE = "material.manage"
    MATERIAL_ISSUE = "material.issue"
    PURCHASE_CREATE = "purchase.create"
    PURCHASE_APPROVE = "purchase.approve"
    PURCHASE_READ = "purchase.read"
    INVOICE_CREATE = "invoice.create"
    INVOICE_SEND = "invoice.send"
    INVOICE_READ = "invoice.read"
    PAYMENT_CREATE = "payment.create"
    PAYMENT_VIEW = "payment.view"
    EXPENSE_CREATE = "expense.create"
    EXPENSE_READ = "expense.read"
    REPORT_VIEW = "report.view"
    USER_MANAGE = "user.manage"
    SETTINGS_MANAGE = "settings.manage"
    PROFIT_VIEW = "profit.view"
    CHANGE_ORDER_MANAGE = "change_order.manage"
    SNAG_MANAGE = "snag.manage"
    DOCUMENT_READ = "document.read"
    NOTIFICATION_READ = "notification.read"
    INVENTORY_MANAGE = "inventory.manage"
    AI_USE = "ai.use"
    FORMULA_MANAGE = "formula.manage"
    CREW_MANAGE = "crew.manage"
    ACCOUNTING_READ = "accounting.read"
    SEARCH = "search.use"
    VEHICLE_MANAGE = "vehicle.manage"
    SYNC_WRITE = "sync.write"


OWNER = [
    Permission.WILDCARD,
]

ADMIN = [p.value for p in Permission if p != Permission.WILDCARD]

PM = [
    Permission.CUSTOMER_READ,
    Permission.CUSTOMER_CREATE,
    Permission.CUSTOMER_UPDATE,
    Permission.SITE_READ,
    Permission.SITE_CREATE,
    Permission.SITE_UPDATE,
    Permission.SURVEY_READ,
    Permission.SURVEY_CREATE,
    Permission.MEASUREMENT_CREATE,
    Permission.MEASUREMENT_READ,
    Permission.ESTIMATE_READ,
    Permission.ESTIMATE_CREATE,
    Permission.QUOTE_READ,
    Permission.QUOTE_CREATE,
    Permission.QUOTE_SEND,
    Permission.PROJECT_READ,
    Permission.PROJECT_CREATE,
    Permission.PROJECT_UPDATE,
    Permission.LABOUR_READ,
    Permission.LABOUR_MANAGE,
    Permission.ATTENDANCE_CREATE,
    Permission.ATTENDANCE_READ,
    Permission.MATERIAL_READ,
    Permission.MATERIAL_MANAGE,
    Permission.MATERIAL_ISSUE,
    Permission.PURCHASE_CREATE,
    Permission.PURCHASE_READ,
    Permission.INVOICE_READ,
    Permission.PAYMENT_VIEW,
    Permission.EXPENSE_CREATE,
    Permission.EXPENSE_READ,
    Permission.REPORT_VIEW,
    Permission.PROFIT_VIEW,
    Permission.CHANGE_ORDER_MANAGE,
    Permission.SNAG_MANAGE,
    Permission.DOCUMENT_READ,
    Permission.CREW_MANAGE,
    Permission.SEARCH,
    Permission.SYNC_WRITE,
    Permission.FORMULA_MANAGE,
]

ESTIMATOR = [
    Permission.CUSTOMER_READ,
    Permission.CUSTOMER_CREATE,
    Permission.SITE_READ,
    Permission.SITE_CREATE,
    Permission.SURVEY_READ,
    Permission.SURVEY_CREATE,
    Permission.MEASUREMENT_CREATE,
    Permission.MEASUREMENT_READ,
    Permission.ESTIMATE_READ,
    Permission.ESTIMATE_CREATE,
    Permission.QUOTE_READ,
    Permission.QUOTE_CREATE,
    Permission.QUOTE_SEND,
    Permission.MATERIAL_READ,
    Permission.LABOUR_READ,
    Permission.DOCUMENT_READ,
    Permission.SEARCH,
    Permission.FORMULA_MANAGE,
]

ACCOUNTANT = [
    Permission.CUSTOMER_READ,
    Permission.SITE_READ,
    Permission.PROJECT_READ,
    Permission.INVOICE_CREATE,
    Permission.INVOICE_SEND,
    Permission.INVOICE_READ,
    Permission.PAYMENT_CREATE,
    Permission.PAYMENT_VIEW,
    Permission.EXPENSE_CREATE,
    Permission.EXPENSE_READ,
    Permission.PURCHASE_CREATE,
    Permission.PURCHASE_READ,
    Permission.PURCHASE_APPROVE,
    Permission.ACCOUNTING_READ,
    Permission.REPORT_VIEW,
    Permission.PROFIT_VIEW,
    Permission.DOCUMENT_READ,
    Permission.SEARCH,
]

SUPERVISOR = [
    Permission.PROJECT_READ,
    Permission.SITE_READ,
    Permission.CUSTOMER_READ,
    Permission.ATTENDANCE_CREATE,
    Permission.ATTENDANCE_READ,
    Permission.MATERIAL_READ,
    Permission.MATERIAL_ISSUE,
    Permission.EXPENSE_CREATE,
    Permission.EXPENSE_READ,
    Permission.SNAG_MANAGE,
    Permission.DOCUMENT_READ,
    Permission.SYNC_WRITE,
    Permission.SURVEY_CREATE,
    Permission.SURVEY_READ,
    Permission.MEASUREMENT_CREATE,
]

WORKER = [
    Permission.PROJECT_READ,
    Permission.ATTENDANCE_CREATE,
    Permission.SYNC_WRITE,
    Permission.DOCUMENT_READ,
]

CUSTOMER = [
    Permission.QUOTE_READ,
    Permission.QUOTE_APPROVE,
    Permission.PROJECT_READ,
    Permission.INVOICE_READ,
    Permission.PAYMENT_VIEW,
    Permission.DOCUMENT_READ,
    Permission.SNAG_MANAGE,
]

# Module access sets used by Users UI checkboxes (admin / home / accounts / inventory / field).
HOME = [
    Permission.CUSTOMER_READ,
    Permission.CUSTOMER_CREATE,
    Permission.CUSTOMER_UPDATE,
    Permission.SITE_READ,
    Permission.SITE_CREATE,
    Permission.SITE_UPDATE,
    Permission.PROJECT_READ,
    Permission.PROJECT_CREATE,
    Permission.PROJECT_UPDATE,
    Permission.SURVEY_READ,
    Permission.SURVEY_CREATE,
    Permission.MEASUREMENT_READ,
    Permission.MEASUREMENT_CREATE,
    Permission.ESTIMATE_READ,
    Permission.ESTIMATE_CREATE,
    Permission.QUOTE_READ,
    Permission.QUOTE_CREATE,
    Permission.QUOTE_SEND,
    Permission.DOCUMENT_READ,
    Permission.SEARCH,
    Permission.SNAG_MANAGE,
]

INVENTORY = [
    Permission.MATERIAL_READ,
    Permission.MATERIAL_MANAGE,
    Permission.MATERIAL_ISSUE,
    Permission.LABOUR_READ,
    Permission.LABOUR_MANAGE,
    Permission.CREW_MANAGE,
    Permission.INVENTORY_MANAGE,
    Permission.DOCUMENT_READ,
    Permission.SEARCH,
]

FIELD = [
    Permission.PROJECT_READ,
    Permission.SITE_READ,
    Permission.CUSTOMER_READ,
    Permission.ATTENDANCE_CREATE,
    Permission.ATTENDANCE_READ,
    Permission.SNAG_MANAGE,
    Permission.EXPENSE_CREATE,
    Permission.EXPENSE_READ,
    Permission.DOCUMENT_READ,
    Permission.SYNC_WRITE,
    Permission.SURVEY_CREATE,
    Permission.SURVEY_READ,
    Permission.MEASUREMENT_CREATE,
    Permission.MEASUREMENT_READ,
]

ROLE_PERMISSIONS: dict[str, list[str]] = {
    "owner": [Permission.WILDCARD],
    "admin": ADMIN,
    "home": HOME,
    "accounts": ACCOUNTANT,
    "inventory": INVENTORY,
    "field": FIELD,
    # Legacy role keys kept for existing memberships
    "project_manager": PM,
    "manager": PM,
    "estimator": ESTIMATOR,
    "accountant": ACCOUNTANT,
    "supervisor": SUPERVISOR,
    "worker": WORKER,
    "customer": CUSTOMER,
}

MODULE_ACCESS = ["admin", "home", "accounts", "inventory", "field"]

DEFAULT_ROLES = list(ROLE_PERMISSIONS.keys())
