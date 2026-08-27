import { detectAcademicDomain, providersForDomain } from './integrations/routing';
import type { AcademicDomain, AcademicProvider } from './integrations/types';
import { ResearchSourceRegistry } from './ResearchSourceRegistry';

export type ResearchRoute = { domain: AcademicDomain; providers: AcademicProvider[]; enrichers: string[]; reason: string };

export class ResearchRouter {
  static route(query: string, specialty = ''): ResearchRoute {
    const domain = detectAcademicDomain(query, specialty);
    const registered = new Set(ResearchSourceRegistry.forDomain(domain).map((source) => source.id));
    const providers = providersForDomain(domain).filter((provider) => registered.has(provider));
    return {
      domain,
      providers,
      enrichers: ['crossref', 'unpaywall', 'opencitations', 'orcid'],
      reason: `Selected ${providers.length} discovery sources for ${domain}; DOI and access enrichment run only on shortlisted records.`,
    };
  }
}
