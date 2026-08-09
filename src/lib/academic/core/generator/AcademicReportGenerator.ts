export class AcademicReportGenerator {
  generateReport(analysis: any): string {
    return `التقرير الأكاديمي الاحترافي:\n- الحالة: ${analysis.status}\n- درجة الجودة: ${analysis.score}/100\n- الملاحظات: ${analysis.notes}`;
  }
}
