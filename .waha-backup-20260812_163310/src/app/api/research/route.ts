import { NextResponse } from 'next/server';
import { ResearchPipelineService } from '../../../services/research-pipeline.service';
import { AcademicDecisionEngine } from '../../../services/academic-decision-engine.service';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { idea, selectedTitle } = body;
    
    if (!idea || idea.trim() === '') {
      return NextResponse.json({ type: 'ERROR', message: 'يرجى كتابة فكرة بحثية أولاً.' }, { status: 400 });
    }

    const trimmedIdea = idea.trim();
    const isEnglish = /[a-zA-Z]/.test(trimmedIdea);

    const decisionResult = AcademicDecisionEngine.analyze(trimmedIdea);
    const { academicThinking, decision } = decisionResult;
    if (!academicThinking.valid) {
      return NextResponse.json({
        type: 'INVALID_RESEARCH_INPUT',
        message: '❌ هذا النص لا يمثل فكرة بحثية.\n\nيرجى إدخال عنوان أو مشكلة أو فكرة بحث علمية.',
        academicThinking,
      });
    }

    if (selectedTitle && academicThinking.valid) {
      const { research, intelligence, gap } = await ResearchPipelineService.search(
        selectedTitle,
        15,
        academicThinking
      );
      const papers = research.papers;
      const processedPapers = papers.map(p => {
        const isQ1 = p.citationCount > 20;
        return {
          title: p.title,
          year: p.publicationYear,
          citationCount: p.citationCount,
          journal: p.journal,
          source: p.source,
          isTopTier: isQ1,
        };
      }).sort((a, b) => b.citationCount - a.citationCount);

      const saturationStatus = gap.potentialResearchGap === 'Globally mature but locally underexplored.'
        ? 'Globally mature but locally underexplored.'
        : 'Metadata-based literature coverage';
      const saturationWarning = gap.potentialResearchGap;
      const independentVariable = academicThinking.structure.independentVariable;
      const dependentVariable = academicThinking.structure.dependentVariable;

      const simplifiedExplanation = isEnglish
        ? `Simply put: You want to explore how changing (${independentVariable}) will directly impact and alter (${dependentVariable}) in real-world application.`
        : `ببساطة شديدة: أنت تريد معرفة كيف ستقوم خطط وعوامل (${independentVariable}) بالتأثير بشكل مباشر (سواءً بالإيجاب أو السلب) على مخرجات ونتائج (${dependentVariable}) في الميدان العملي.`;

      const scope = trimmedIdea.includes('فلسطين') ? 'البيئة المؤسسية في فلسطين' : 'البيئة التنظيمية المحلية';
      const suggestedTitles = [
        `الأبعاد الاستراتيجية لتطبيق (${independentVariable}) وأثرها في تعزيز كفاءة (${dependentVariable}) في ${scope}`,
        `نموذج مقترح لحوكمة (${independentVariable}) لرفع جودة الأداء التشغيلي لـ (${dependentVariable})`
      ];

      const academicFramework = {
        independentVariable,
        dependentVariable,
        simplifiedExplanation,
        problemStatement: `تتبلور المشكلة في وجود فجوة حوكمة إجرائية وتنظيمية حول آليات تطبيق (${independentVariable})، مما يؤثر طردياً على استقرار واستدامة مؤشرات الجودة الخاصة بـ (${dependentVariable}).`,
        researchGap: `رغم وفرة التأصيل النظري، إلا أن هناك ندرة واضحة في الدراسات الميدانية التي تقيس الارتباط الهيكلي الحركي بين المتغيرين في ظل التحديات التشغيلية المعاصرة.`
      };

      return NextResponse.json({
        type: 'SUCCESS',
        saturationStatus,
        saturationWarning,
        academicFramework,
        suggestedTitles,
        academicThinking,
        decision,
        selectedTitle,
        papers: processedPapers.slice(0, 10),
        research: {
          semanticScholarPapers: research.semanticScholarPapers,
          searchSources: research.searchSources,
          mergedTotalPapers: research.mergedTotalPapers,
          duplicatesRemoved: research.duplicatesRemoved,
        },
        intelligence,
        gap
      });
    }

    if (decision.route === 'idea-analysis') {
      return NextResponse.json({
        type: 'DECISION_REPORT',
        message: 'تم بناء تقرير أكاديمي حقيقي يتضمن تقييم الفكرة، نقاط القوة والضعف، والتوصية بأفضل العناوين.',
        decision,
        academicThinking,
      });
    }

    if (decision.route === 'weak-title') {
      return NextResponse.json({
        type: 'WEAK_TITLE',
        message: 'العنوان المكتوب ضعيف ويحتاج إلى تحسين.',
        decision,
        academicThinking,
      });
    }

    if (decision.route === 'title-evaluation') {
      return NextResponse.json({
        type: 'TITLE_EVALUATION',
        message: 'تم التعرف على عنوان بحثي. سيتم تقييمه وفق معايير الرسائل.',
        decision,
        academicThinking,
      });
    }

    if (!academicThinking.readyForSearch) {
      return NextResponse.json({
        type: 'NEED_CLARIFICATION',
        message: 'الفكرة أكاديمية، لكنها تفتقد مكونات بحثية مطلوبة.',
        missingComponents: academicThinking.missingComponents,
        academicThinking,
        decision,
      });
    }

    const { research, intelligence, gap } = await ResearchPipelineService.search(
      trimmedIdea,
      15,
      academicThinking
    );
    const papers = research.papers;

    // 2. ميزة [خارج الصندوق]: فرز وتصنيف المراجع النخبوية Q1 & High Citation
    const processedPapers = papers.map(p => {
      const isQ1 = p.citationCount > 20;
      return {
        title: p.title,
        year: p.publicationYear,
        citationCount: p.citationCount,
        journal: p.journal,
        source: p.source,
        isTopTier: isQ1,
      };
    }).sort((a, b) => b.citationCount - a.citationCount);

    // 3. توصيف التغطية دون مساواة كثرة الدراسات العالمية باستهلاك الموضوع محليًا
    const saturationStatus = gap.potentialResearchGap === 'Globally mature but locally underexplored.'
      ? 'Globally mature but locally underexplored.'
      : 'Metadata-based literature coverage';
    const saturationWarning = gap.potentialResearchGap;

    // 4. مشرح المتغيرات اللغوي الذكي والتنظيف
    const independentVariable = academicThinking.structure.independentVariable;
    const dependentVariable = academicThinking.structure.dependentVariable;

    // 5. ميزة [خارج الصندوق]: الشرح التفسيري المبسط "بالبلدي / العامية البسيطة" للابتعاد عن التعقيد
    const simplifiedExplanation = isEnglish 
      ? `Simply put: You want to explore how changing (${independentVariable}) will directly impact and alter (${dependentVariable}) in real-world application.`
      : `ببساطة شديدة: أنت تريد معرفة كيف ستقوم خطط وعوامل (${independentVariable}) بالتأثير بشكل مباشر (سواءً بالإيجاب أو السلب) على مخرجات ونتائج (${dependentVariable}) في الميدان العملي.`;

    const scope = trimmedIdea.includes("فلسطين") ? "البيئة المؤسسية في فلسطين" : "البيئة التنظيمية المحلية";

    const suggestedTitles = [
      `الأبعاد الاستراتيجية لتطبيق (${independentVariable}) وأثرها في تعزيز كفاءة (${dependentVariable}) في ${scope}`,
      `نموذج مقترح لحوكمة (${independentVariable}) لرفع جودة الأداء التشغيلي لـ (${dependentVariable})`
    ];

    const academicFramework = {
      independentVariable,
      dependentVariable,
      simplifiedExplanation,
      problemStatement: `تتبلور المشكلة في وجود فجوة حوكمة إجرائية وتنظيمية حول آليات تطبيق (${independentVariable})، مما يؤثر طردياً على استقرار واستدامة مؤشرات الجودة الخاصة بـ (${dependentVariable}).`,
      researchGap: `رغم وفرة التأصيل النظري، إلا أن هناك ندرة واضحة في الدراسات الميدانية التي تقيس الارتباط الهيكلي الحركي بين المتغيرين في ظل التحديات التشغيلية المعاصرة.`
    };

    return NextResponse.json({
      type: 'SUCCESS',
      saturationStatus,
      saturationWarning,
      academicFramework,
      suggestedTitles,
      academicThinking,
      decision,
      papers: processedPapers.slice(0, 10),
      research: {
        semanticScholarPapers: research.semanticScholarPapers,
        searchSources: research.searchSources,
        mergedTotalPapers: research.mergedTotalPapers,
        duplicatesRemoved: research.duplicatesRemoved,
      },
      intelligence,
      gap
    });

  } catch (error: unknown) {
    console.error('Core Engine Panic:', error);
    return NextResponse.json(
      {
        type: 'ERROR',
        message: 'تعذر الاتصال بمصادر البحث الأكاديمية الرسمية حاليًا.',
      },
      { status: 502 }
    );
  }
}
