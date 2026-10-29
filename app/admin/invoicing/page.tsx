"use client";

import { useState } from "react";
import { FilePlus2 } from "lucide-react";
import { AdminProtectedPage } from "../components/AdminProtectedPage";
import { ADMIN_SUBJECTS } from "../../lib/abilities/admin-subjects";
import { Button, PageHeader, Tabs, TabsContent, TabsList, TabsTrigger } from "../ui";
import { useInvoices } from "./hooks/useInvoices";
import { useProfitability } from "./hooks/useProfitability";
import { InvoicingLedger } from "./components/InvoicingLedger";
import { ProfitabilityTab } from "./components/ProfitabilityTab";

export default function InvoicingPage() {
  return (
    <AdminProtectedPage permission="invoicing" subject={ADMIN_SUBJECTS.invoicing}>
      <InvoicingPageContent />
    </AdminProtectedPage>
  );
}

function InvoicingPageContent() {
  const [tab, setTab] = useState("ledger");
  const inv = useInvoices();
  // The companies picker is already loaded for the ledger, so the profit tab reuses it.
  const profit = useProfitability(tab === "profitability");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Invoicing"
        description={
          tab === "ledger"
            ? "General ledger of company invoices, payments and PDFs."
            : "What each invoice billed, what the trip behind it cost, and the profit left over."
        }
        actions={
          tab === "ledger" ? (
            <Button leftIcon={<FilePlus2 />} onClick={() => inv.setShowShuttleModal(true)} disabled={!inv.canUpdate}>
              Generate shuttle invoice
            </Button>
          ) : undefined
        }
      />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="ledger">Ledger</TabsTrigger>
          <TabsTrigger value="profitability">Profitability</TabsTrigger>
        </TabsList>
        <TabsContent value="ledger">
          <InvoicingLedger inv={inv} />
        </TabsContent>
        <TabsContent value="profitability">
          <ProfitabilityTab profit={profit} companies={inv.companies} companiesTruncated={inv.companiesTruncated} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
