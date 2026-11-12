import type { AcademicProvider, AcademicSearchProvider } from './types';
import { OpenAlexService } from '../services/OpenAlexService';
import { SemanticScholarService } from '../services/SemanticScholarService';
import { CrossrefService } from '../services/CrossrefService';
import { CoreService } from '../services/CoreService';
import { ArxivService } from '../services/ArxivService';
import { EuropePMCService } from '../services/EuropePMCService';
import { OpenAIREService } from '../services/OpenAIREService';
import { PLOSService } from '../services/PLOSService';
import { DOABService } from '../services/DOABService';
import { DOAJService } from '../services/DOAJService';
import { DataCiteService } from '../services/DataCiteService';
import { PubMedService } from '../services/PubMedService';

const providers: Record<AcademicProvider, AcademicSearchProvider> = {
  openalex: new OpenAlexService(),
  'semantic-scholar': new SemanticScholarService(),
  crossref: new CrossrefService(),
  core: new CoreService(),
  arxiv: new ArxivService(),
  'europe-pmc': new EuropePMCService(),
  openaire: new OpenAIREService(),
  plos: new PLOSService(),
  doab: new DOABService(),
  doaj: new DOAJService(),
  datacite: new DataCiteService(),
  pubmed: new PubMedService(),
};

export function academicProvider(id: AcademicProvider) { return providers[id]; }
export function academicProviders(ids: AcademicProvider[]) { return ids.map((id) => providers[id]).filter(Boolean); }
