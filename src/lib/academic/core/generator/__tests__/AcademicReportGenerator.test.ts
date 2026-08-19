import { AcademicReportGenerator } from "../AcademicReportGenerator";

describe("AcademicReportGenerator", () => {
  it("should generate report correctly", () => {
    const generator = new AcademicReportGenerator();
    const mockReport = {
      status: "ممتاز",
      score: 95,
      notes: "بدون ملاحظات"
    };

    const result = generator.generateReport(mockReport);
    expect(result).toContain("التقرير الأكاديمي الاحترافي");
  });
});
