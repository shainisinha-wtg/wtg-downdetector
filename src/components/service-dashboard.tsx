"use client";

import { useState, useMemo } from "react";
import { Search } from "lucide-react";
import { ServiceRow } from "./service-row";
import { ReportDialog } from "./report-dialog";
import { ServiceListItem } from "@/modules/services/service-queries";

interface ServiceDashboardProps {
  services: ServiceListItem[];
}

export function ServiceDashboard({ services }: ServiceDashboardProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedServiceId, setSelectedServiceId] = useState<string | undefined>();

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

  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <h1>Service status</h1>
        <button
          className="button-primary"
          onClick={() => handleReportClick()}
          data-testid="global-report-button"
        >
          Report a problem
        </button>
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
            slug={service.slug}
            category={service.category}
            currentState={
              service.currentState as
                | "OPERATIONAL"
                | "REPORTS_RISING"
                | "INCIDENT_CONFIRMED"
            }
            reportCount={service.reportCount}
            threshold={service.threshold}
            hourlyBuckets={service.hourlyBuckets}
            latestOwnerUpdate={service.latestOwnerUpdate}
            latestOwnerUpdateAt={
              service.latestOwnerUpdateAt
                ? new Date(service.latestOwnerUpdateAt)
                : null
            }
            onReportClick={() => handleReportClick(service.id)}
          />
        ))}
      </div>

      <ReportDialog
        isOpen={isDialogOpen}
        onClose={handleCloseDialog}
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
