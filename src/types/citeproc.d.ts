declare module 'citeproc' {
  export class Engine {
    constructor(sys: { retrieveLocale: (language: string) => string; retrieveItem: (id: string) => Record<string, unknown> }, style: string, language?: string);
    setOutputFormat(format: 'text'): void;
    updateUncitedItems(ids: string[]): void;
    processCitationCluster(citation: { citationID: string; citationItems: { id: string; locator?: string; label?: string }[]; properties: { noteIndex: number } }, pre: [string, number][], post: [string, number][]): [unknown, [number, string, string?][]];
    makeBibliography(): [{ entry_ids: string[][] }, string[]] | false;
  }
}
