/**
 * 🧠 WAHA AI — Academic Prompt Engine & Rules Compiler (Production Grade)
 * Enforces rigid scientific methodologies to prevent hallucinations or chat-like responses.
 */

export interface ProjectContext {
  title: string;
  description: string;
  university: string;
  faculty: string;
  citationStyle: string;
  degreeLevel: string;
  language: string;
}

export const PromptEngine = {
  compileModulePrompt: (moduleName: string, context: ProjectContext): string => {
    const lang = context.language || "العربية";
    
    const coreAcademicRules = `
[STRICT ACADEMIC OPERATING DIRECTIVES - WAHA AI]:
Act exclusively as an elite senior research professor, structural methodologist, and journal editor.
1. Output content strictly in (${lang}) with an advanced, precise, and authoritative academic tone.
2. Completely prohibit conversational fillers, pleasantries, introductory statements, or chat references.
3. Enforce strict adherence to the (${context.citationStyle}) formatting guidelines.
4. Structure paragraphs with dense thematic coherence, avoiding shallow bullet points unless requested.
5. All citations and contextual parameters must be realistic, highly probable, and soundly structured.
`;

    const modules: { [key: string]: string } = {
      'Idea': `Structure three breakthrough, high-impact research directions under the scope of: "${context.title}". 
University Parameters: ${context.university} - Faculty of ${context.faculty} (${context.degreeLevel}).
Provide for each direction: A precise scientific title, core problem statement gap, and primary hypothesis.`,
      
      'Proposal': `Compile an exhaustive, rigorous Research Proposal framework for: "${context.title}".
Contextual Objectives: ${context.description}.
Generate exactly: Structural Introduction, Justification of Significance, and formal Research Questions compiled for ${context.degreeLevel} evaluation.`,
      
      'Writing': `Generate full academic manuscript drafts for the current chapter sequence of: "${context.title}".
Enforce rigid empirical writing. Structural context to synthesize: "${context.description}". Include formal theoretical framing.`,
      
      'Review': `Perform an advanced peer-review validation scan on the text payload: "${context.description}".
Assess against: Methodology compliance, internal alignment, and (${context.citationStyle}) compliance. Output a formalized critical review matrix.`,
      
      'Methodology': `Synthesize a strict scientific Methodology blueprint for: "${context.title}".
Determine appropriate quantitative/qualitative designs based on description: "${context.description}". 
Formulate sampling parameters, instrument metrics, and reliability benchmarks.`,
      
      'References': `Compile an optimized bibliographic registry for: "${context.title}" based on field definitions: "${context.description}".
Format exactly to ${context.citationStyle} guidelines, sorted alphabetically.`,
      
      'Analysis': `Generate formal statistical/thematic interpretive matrices for project: "${context.title}".
Process raw metadata matrices described in: "${context.description}". Output clean tabular breakdowns.`
    };

    const basePrompt = modules[moduleName] || `Generate high-fidelity structured data for the academic domain (${moduleName}) respecting project context: "${context.title}".`;
    return `${coreAcademicRules}\n${basePrompt}`;
  }
};
