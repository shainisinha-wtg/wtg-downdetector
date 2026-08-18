import { ServiceDashboard } from "@/components/service-dashboard";
import { getServiceList } from "@/modules/services/service-queries";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const services = await getServiceList();

  return (
    <main>
      <header>
        <strong>WTG Downdetector</strong>
      </header>
      <ServiceDashboard services={services} />
    </main>
  );
}
