import { PrismaClient } from "@prisma/client";
import { ServiceSummary, ServiceDetails } from "./types";

export class ServiceRepository {
  constructor(private prisma: PrismaClient) {}

  async listEnabled(): Promise<ServiceSummary[]> {
    const services = await this.prisma.service.findMany({
      where: { enabled: true },
      select: {
        id: true,
        name: true,
        slug: true,
        category: true,
        thresholdCount: true,
        thresholdWindowMinutes: true,
      },
      orderBy: { name: "asc" },
    });

    return services;
  }

  async findBySlug(slug: string): Promise<ServiceDetails | null> {
    const service = await this.prisma.service.findUnique({
      where: { slug, enabled: true },
      select: {
        id: true,
        name: true,
        slug: true,
        category: true,
        ownerEmail: true,
        thresholdCount: true,
        thresholdWindowMinutes: true,
        issueTypes: true,
        enabled: true,
      },
    });

    return service;
  }
}
