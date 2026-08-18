"use client";

import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { ServiceRow } from "./service-row";
import { ReportDialog } from "./report-dialog";
import { ServiceListItem } from "@/modules/services/service-queries";

type ServiceDashboardProps = Readonly<{
  services: ServiceListItem[];
}>;

export function ServiceDashboard({ services }: ServiceDashboardProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedServiceId, setSelectedServiceId] = useState<string | undefined>();
  const [reportCountOverrides, setReportCountOverrides] = useState<Record<string, number>>({});
  const [currentTime, setCurrentTime] = useState<Date | null>(null);

  useEffect(() => {
    const updateTime = () => setCurrentTime(new Date());
    updateTime();
    const intervalId = window.setInterval(updateTime, 1000);
    return () => window.clearInterval(intervalId);
  }, []);

  // Extract unique categories
  const categories = useMemo(() => {
    const unique = new Set(services.map((s) => s.category));
    return Array.from(unique).sort();
  }, [services]);

  // Filter services
  const filteredServices = useMemo(() => {
    let result = services;

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter((s) => s.name.toLowerCase().includes(query));
    }

    if (categoryFilter) {
      result = result.filter((s) => s.category === categoryFilter);
    }

    return result;
  }, [services, searchQuery, categoryFilter]);

  const handleReportClick = (serviceId?: string) => {
    setSelectedServiceId(serviceId);
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setSelectedServiceId(undefined);
  };

  const handleReportSubmitted = (serviceId: string) => {
    const service = services.find((item) => item.id === serviceId);

    if (!service) return;

    setReportCountOverrides((currentOverrides) => ({
      ...currentOverrides,
      [serviceId]: (currentOverrides[serviceId] ?? service.reportCount) + 1,
    }));
  };

  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <div>
          <p className="dashboard-kicker">Operational overview</p>
          <h1>Service status</h1>
          <p className="dashboard-summary">
            {services.length} {services.length === 1 ? "service" : "services"} monitored
          </p>
        </div>
        <div className="dashboard-header__actions">
          <div className="dashboard-clock" aria-live="off">
            <span className="dashboard-clock__label">Local time</span>
            <strong suppressHydrationWarning>
              {currentTime
                ? currentTime.toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                  })
                : "--:--:--"}
            </strong>
            <span suppressHydrationWarning>
              {currentTime
                ? `${currentTime.toLocaleDateString([], {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })} · ${Intl.DateTimeFormat().resolvedOptions().timeZone}`
                : "Loading date and time zone"}
            </span>
          </div>
          <button
            type="button"
            className="button-primary"
            onClick={() => handleReportClick()}
            data-testid="global-report-button"
          >
            Report a problem
          </button>
        </div>
      </div>

      <div className="dashboard-filters">
        <div className="search-box">
          <Search size={20} aria-hidden="true" />
          <input
            type="search"
            placeholder="Search services..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Search services"
            data-testid="search-input"
          />
        </div>

        <div className="category-filters" role="group" aria-label="Category filters">
          <button
            className={categoryFilter === "" ? "filter-active" : ""}
            onClick={() => setCategoryFilter("")}
            data-testid="filter-all"
          >
            All
          </button>
          {categories.map((category) => (
            <button
              key={category}
              className={categoryFilter === category ? "filter-active" : ""}
              onClick={() => setCategoryFilter(category)}
              data-testid={`filter-${category}`}
            >
              {category}
            </button>
          ))}
        </div>
      </div>

      <div className="services-list">
        {filteredServices.length === 0 && (
          <div className="empty-state">
            <p>No services found matching your filters.</p>
          </div>
        )}

        {filteredServices.map((service) => (
          <ServiceRow
            key={service.id}
            name={service.name}
            category={service.category}
            currentState={
              service.currentState as
                | "OPERATIONAL"
                | "REPORTS_RISING"
                | "INCIDENT_CONFIRMED"
            }
            reportCount={reportCountOverrides[service.id] ?? service.reportCount}
            hourlyBuckets={service.hourlyBuckets}
            latestOwnerUpdate={service.latestOwnerUpdate}
            latestOwnerUpdateAt={
              service.latestOwnerUpdateAt
                ? new Date(service.latestOwnerUpdateAt)
                : null
            }
              ownerUpdates={service.ownerUpdates}
            onReportClick={() => handleReportClick(service.id)}
          />
        ))}
      </div>

      <ReportDialog
        isOpen={isDialogOpen}
        onClose={handleCloseDialog}
        onReportSubmitted={handleReportSubmitted}
        services={services.map((service) => ({
          id: service.id,
          name: service.name,
          issueTypes: service.issueTypes,
        }))}
        preselectedServiceId={selectedServiceId}
      />
    </div>
  );
}
