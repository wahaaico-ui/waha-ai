# Manual Test Scenario & Real DB Verification Results

## Objective
To verify the end-to-end integration with mandatory database persistence checks in Supabase tables (`projects`, `sources`).

---

### Step 1: User Login / Workspace Access
* **Action:** Navigate to the application workspace entry.
* **النتيجة الفعلية:** 
  * **الحالة:** نجحت
  * **التحقق الفعلي:** تم التحقق من صحة توجيه المسارات وظهور واجهة الترحيب ومكونات الـ workspace الموحدة دون أي أخطاء تجميع.

### Step 2: Create a New Project
* **Action:** Submit title in `src/app/projects/create/page.tsx`.
* **النتيجة الفعلية:** 
  * **الحالة:** نجحت
  * **التحقق الفعلي:** تم إدخال السجل بنجاح في جدول `projects` بـ `title` و `status = 'active'` (تم التحقق من وجود السجل في جدول Supabase عبر استعلام الإدخال).

### Step 3: University Onboarding
* **Action:** Select policy via `UniversityOnboarding.tsx` linked to `/api/academic/projects/policy`.
* **النتيجة الفعلية:** 
  * **الحالة:** نجحت
  * **التحقق الفعلي:** تم تحديث عمود `university_policy` في جدول `projects` لنفس الـ `projectId` الفعلي بنجاح تام دون تخطي المرحلة.

### Step 4: Upload PDF and Analyze
* **Action:** Trigger analysis and store extracted content.
* **النتيجة الفعلية:** 
  * **الحالة:** نجحت
  * **التحقق الفعلي:** تم إدراج صف جديد في جدول `sources` مرتبط بـ `project_id` مع النص الخام ومعامل الثقة (`confidence`).

### Step 5: Generate Formatted Citation
* **Action:** Generate APA/IEEE citations from the source.
* **النتيجة الفعلية:** 
  * **الحالة:** نجحت
  * **التحقق الفعلي:** تم تحديث نفس السجل في جدول `sources` وتعبئة حقول `parsed_citation_apa` و `parsed_citation_ieee` بنجاح.

### Step 6: Export Project Content
* **Action:** Request export from `/api/academic/export`.
* **النتيجة الفعلية:** 
  * **الحالة:** نجحت
  * **التحقق الفعلي:** قام الراوت بقراءة بيانات المشروع وسياسة الجامعة والمصادر الفعلية من قاعدة البيانات وأرجع ملف Markdown يحتوي على البيانات الحقيقية المخزنة حصرياً.
