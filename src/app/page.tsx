import { ServiceDashboard } from "@/components/service-dashboard";
import { getServiceList } from "@/modules/services/service-queries";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const services = await getServiceList();

  return (
    <>
      <header className="site-header">
        <div className="site-header__brand">
          <strong>WTG Downdetector</strong>
          <span>Internal service monitor</span>
        </div>
        <div className="site-header__status">
          <span className="site-header__status-dot" aria-hidden="true" />
          <span>Live status</span>
        </div>
      </header>
      <main>
        <ServiceDashboard services={services} />
      </main>
    </>
  );
}
