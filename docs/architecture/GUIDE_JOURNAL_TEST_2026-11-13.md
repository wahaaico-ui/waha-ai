# اختبار 20 دليلًا جامعيًا و10 مجلات — 13 نوفمبر 2026 (البند 3.4، DOC-45-02)

## ماذا اختُبر وكيف

**الأدلة:**
- عشرون دليلًا منشورًا للعموم لكتابة الرسائل: تسعة عربية وأحد عشر إنجليزيًا، من السعودية والأردن وقطر والإمارات ومصر وبريطانيا وكندا والولايات المتحدة.
- مرّ كل دليل بقارئ الأدلة نفسه الذي يقرأ ما يرفعه الطالب في «تعليمات الجامعة» (`extractUniversityGuide`، ثم `guideRuleCandidates`).
- قورنت كل قاعدة مستخرجة بالجملة التي أُخذت منها في الدليل.
- لم تُحفظ ملفات الأدلة في المستودع، فهي ليست ملكنا. حُفظت روابطها هنا، والجمل التي كشفت الأخطاء في الاختبارات.

**المجلات:**
- قُرئت تعليمات المؤلفين لعشر مجلات من صفحاتها.
- حُوِّلت إلى قوالب مجلات يختارها الباحث في «جاهزية النشر» (`src/lib/journal-catalog.ts`).
- لكل مجلة: مصدرها، وتاريخ قراءتها، والقواعد التي لا يفحصها القالب.

## الأدلة: النتيجة

| الدليل | الصفحات | النتيجة | القواعد المستخرجة بعد الإصلاح |
| --- | --- | --- | --- |
| [جامعة مؤتة (الأردن)](https://www.mutah.edu.jo/ar/GraduateStudies/Forms/) | 20 | قُرئ | 10: خطا العربية والإنجليزية وحجماهما، والهوامش الأربعة، وAPA، وحد الملخص 250 كلمة |
| [جامعة حمد بن خليفة، عربي (قطر)](https://www.hbku.edu.qa/sites/default/files/ph/thesis_formatting_and_submission_guidelines_arabic.pdf) | 30 | قُرئ | 2: Simplified Arabic بحجم 14 |
| [جامعة حمد بن خليفة، إنجليزي](https://www.hbku.edu.qa/sites/default/files/ph/thesis_formatting_and_submission_guidelines_english.pdf) | 29 | قُرئ | 5: الخط وحجمه، والتباعد 1.5، وترقيم الصفحات |
| [جامعة الملك فيصل، كلية التربية](https://www.kfu.edu.sa/ar/Colleges/Education/Departments/Documents/) | 42 | قُرئ | 3: Traditional Arabic وTimes New Roman وAPA |
| [جامعة الملك سعود، كلية الآداب](https://arts.ksu.edu.sa/sites/arts.ksu.edu.sa/files/imce_images/dlyl_ktb_kht_lbhth_wlrsyl_llmy_1.pdf) | 35 | قُرئ | 2: Times New Roman والتباعد المزدوج |
| [جامعة عمّان الأهلية](https://www.ahu.edu.jo/Admin_Site/Files/PDF/d1da9103-16d5-45a4-9d72-2f7bbc7a4cb1.pdf) | 21 | قُرئ جزئيًا | 2: Times New Roman، وحد الملخص 300 كلمة |
| [جامعة الأميرة سمية للتكنولوجيا](https://psut.edu.jo/uploads/2022/05/dlyl-adad-alrsayl-walatrwhat-aljamyt-ljamt-alamyrt-smyt-lltknwlwjya-2019-1.pdf) | 43 | **رُفض برسالة واضحة** | النص العربي مخزّن بترتيب حروف لا يُقرأ. كان يُستخرج منه قبل الإصلاح ما لا معنى له |
| [جامعة الأميرة نورة: دليل الخطة 1446](https://pnu.edu.sa/ar/Deanship/postgraduate/Lists/Guidelines/Attachments/8/) | — | **رُفض** | حجمه 4.5 ميجابايت، أكبر من حد الرفع (4 ميجابايت) |
| [جامعة الأميرة نورة: دليل إعداد الخطة](https://pnu.edu.sa/ar/Deanship/postgraduate/Documents/) | — | **رُفض** | حجمه 14.7 ميجابايت |
| [جامعة أسيوط (مصر)](https://life.aun.edu.eg/post/sites/default/files/pdf/tanzemRsael.pdf) | — | **رُفض** | أكثر من 50 صفحة، وهو حد الأدلة |
| [جامعة الشارقة (الإمارات)](https://sharjah.ac.ae/-/media/project/uos/sites/uos/graduate-studies/graduate-studies-documentation/thesis-handbook.pdf) | 45 | قُرئ | 7: الخط وحجمه، والتباعد المزدوج، والهوامش، وAPA |
| [جامعة غلاسكو (بريطانيا)](https://www.gla.ac.uk/media/media_186120_en.pdf) | 6 | قُرئ | 7: الخط وحجمه، والتباعد 1.5، والهوامش، وحد 100,000 كلمة |
| [جامعة كولومبيا البريطانية (كندا)](https://wiki.ubc.ca/images/8/87/UBC_Thesis_Formatting_Checklist.pdf) | 3 | قُرئ | 5: الخط، والتباعد، وحد الملخص 350 كلمة، وترقيم الصفحات |
| [جامعة ولاية كاليفورنيا، لونغ بيتش](https://csulb.edu/sites/default/files/2025/documents/) | 45 | قُرئ | 7: الخط وحجمه، والهوامش الأربعة، وترقيم الصفحات |
| [جامعة توليدو](https://www.utoledo.edu/graduate/forms/ETDFormat.pdf) | 4 | قُرئ | 5 |
| [جامعة ولاية فالدوستا](https://www.valdosta.edu/academics/graduate-school/documents/pre-submission-guidelines.pdf) | 3 | قُرئ | 8 |
| [جامعة ولاية ميدل تينيسي: دليل الأسلوب](https://mtsu.edu/graduate/wp-content/uploads/sites/45/2024/08/MTSUStyleGuide_April2024_final4.4.24.pdf) | 10 | قُرئ | 7 |
| [جامعة ولاية ميدل تينيسي: قائمة التحقق](https://honors.mtsu.edu/wp-content/uploads/sites/41/2024/08/ThesisFormattingChecklist.pdf) | 2 | قُرئ | 7: منها هامش التجليد 3.81 سم وحد الملخص 150 كلمة |
| [كلية إيفرغرين](https://www.evergreen.edu/sites/default/files/2023-05/Thesis%20Format%20Instructions.pdf) | 8 | قُرئ | 2 |
| [جامعة واشنطن: دليل إعداد الوثيقة](https://depts.washington.edu/csscr/pdf/companion.pdf) | 14 | قُرئ | 6 |

**الخلاصة:**
- **قُرئت 16 دليلًا من 20.** رُفضت أربعة: ثلاثة لحجمها أو عدد صفحاتها، وواحد لأن نصه العربي غير مقروء.
- **صار القارئ يستخرج 85 قاعدة بعد الإصلاح، مقابل 67 قبله.** كانت ثمانٍ على الأقل من الـ67 خاطئة. وراجعنا كل قاعدة من الـ85 مقابل جملتها في الدليل، وما بقي فيها من نقص مذكور أدناه.

## أخطاء القارئ التي كشفتها الأدلة، وأُصلحت

لكل إصلاح اختبار، بجملة الدليل نفسها، في `academic-style-profile.test.ts` و`university-guide.test.ts`.

1. **نص عربي مخزّن بترتيب حروف لا يُقرأ:** يُرفض الآن برسالة تطلب لصق النص بدل استخراج قواعد خاطئة منه.
2. **حروف عربية مخزّنة بأشكالها الموصولة،** وحرف «ѧ» في موضع الكشيدة: تُقرأ الآن حروفًا عادية.
3. **عبارات هوامش لم تكن مفهومة:**
   - "All margins should be 1 inch"
   - "Margins Top 1.8cm"
   - علامة البوصة المائلة (1”)
   - القيمة قبل الجهة: 1.5" left
   - الفاصلة العشرية: 2,5 سم
   - الهامش الإضافي للتجليد (gutter) مقابل حافة التجليد الكلية
4. **حجم الخط بشرطة:** 12-pt و12-point صارت تُقرأ.
5. **حدود كلمات مكتوبة بعد الرقم:**
   - "350 word maximum"
   - "(150 words or less)"
   - "should not normally exceed"
   - «في حده الأعلى»
   - «الم لخص» بعد أن فصل الملف الكلمة
6. **أخطاء كانت تُستخرج قواعد:**
   - مقاس الورق «8 ½ by 11» قُرئ حجم خط 8.
   - سطر مرجع نموذجي قُرئ اسم جامعة.
   - «مثل APA» و"for instance APA" قُرئا نمط توثيق مطلوبًا.
   - «APA أو MLA» قُرئ نمطًا واحدًا مطلوبًا.
   - "referenced in the text" قُرئ نمط توثيق.
   - مسافة بين الفقرات قُرئت تباعد أسطر.
   - تعليمات برنامج Word قُرئت موضع ترقيم الصفحات.
   - هامش أول صفحة في الفصل قُرئ هامش الصفحة.
   - حجم الكلمات غير العربية قُرئ حجم المتن العربي.
   - "lower right; … top right are also" قُرئ أعلى الوسط.

## ما بقي ناقصًا في الأدلة

**قواعد في الأدلة لا يستخرجها القارئ بعد:**
- هوامش جامعة الملك فيصل، لأن الرقم مقسوم بين سطرين في الملف.
- تباعد 1.5 في دليل حمد بن خليفة العربي.
- حجم خط جامعة الملك سعود، لأن الأقواس معكوسة في ملفها.

**دليل يسمح بأكثر من خيار:** في بعض الأدلة يُستخرج خيار واحد من عدة خيارات مسموحة، مثل Calibri من بين ثلاثة خطوط. والطالب يراجع كل قاعدة قبل اعتمادها كما هو قائم.

**أنواع قواعد لا مكان لها في القارئ:**
- مقاس الورق
- لون الغلاف
- حجم خط الحواشي والعناوين الفرعية
- حد الصفحات
- طول العنوان
- عدد النسخ
- موضع تعليقات الجداول والأشكال

**الأدلة الكبيرة:** حدّا 4 ميجابايت و50 صفحة رفضا ثلاثة أدلة حقيقية. رفع الحدين قرار تكلفة وأمان، فلم يُغيَّر.

## المجلات

| المجلة | الصفحة | ما يفحصه القالب | ما لا يفحصه |
| --- | --- | --- | --- |
| PLOS ONE | [تعليمات المجلة](https://journals.plos.org/plosone/s/submission-guidelines) | الملخص 300 كلمة، والأقسام | نمط Vancouver، ولا كلمات مفتاحية |
| Scientific Reports | [تعليمات المجلة](https://www.nature.com/srep/author-instructions/submission-guidelines) | 4500 كلمة، والملخص 200، وحتى 6 كلمات مفتاحية، و60 مرجعًا، وترتيب الأقسام | استثناء المنهجية من العد، وطول العنوان |
| Frontiers in Psychology | [أنواع المقالات](https://www.frontiersin.org/journals/psychology/for-authors/article-types) | 12000 كلمة، و5–8 كلمات مفتاحية | حد 15 شكلًا وجدولًا |
| eLife | [دليل المؤلف](https://reviewer.elifesciences.org/author-guide/full) | ترتيب الأقسام | الطول المقترح والملخص غير ملزمين |
| JMIR | [تعليمات المؤلفين](https://www.jmir.org/author-information/instructions-for-authors) | الأقسام | أسلوب AMA، والحدود في صفحة أخرى |
| Jordan Journal of Nursing Research | [تعليمات المؤلفين](https://jjnr.just.edu.jo/jjnr/home/instructions_to_authors.aspx) | 4000 كلمة، والملخص 250، وحتى 6 كلمات مفتاحية، و30 مرجعًا | عناوين الملخص المهيكل، والجداول والأشكال، وترقيم الأسطر |
| مجلة العمارة والتخطيط، جامعة الملك سعود | [الضوابط](https://jap.ksu.edu.sa/sites/jap.ksu.edu.sa/files/attach/jap_regulation_ar.pdf) | الملخص 200، وحتى 10 كلمات مفتاحية | حد 25 صفحة |
| Journal of Nursing & Interprofessional Leadership in Quality & Safety | [دليل الأسلوب](https://digitalcommons.library.tmc.edu/uthoustonjqualsafe/styleguide.html) | 3500 كلمة، والملخص 250، و4–6 كلمات مفتاحية | صيغة SQUIRE 2.0 |
| مجلة العلوم الإنسانية، جامعة الحدود الشمالية | [ضوابط النشر](https://www.nbu.edu.sa/sites/default/files/2022-08/) | الملخص 200، وحتى 6 كلمات مفتاحية | حد 45 صفحة، والنتائج والمناقشة قسم واحد |
| Nurse Education Today | [مصدر ناقل](https://bimhse.med.hku.hk/wp-content/uploads/2026/03/Medical-Education-Type-of-Articles.pdf) | 6000 كلمة | صفحة المجلة منعت القراءة الآلية، فبقية الحدود لم تُقرأ |

**ما تغيّر في القالب نفسه:**
- **عدد الكلمات المفتاحية صار اختياريًا.** بعض المجلات لا تطلب كلمات مفتاحية (PLOS ONE)، وبعضها تجعلها اختيارية بحد أعلى فقط (حتى 6). كان القالب يفرض حدًا أدنى لا يقل عن 1، وهذا رقم مختلق.
- **ترتيب الأقسام:** يحتفظ القالب بترتيب المجلة نفسه، مثل المنهجية في آخر Scientific Reports.

**ثلاث مجلات أخرى أردنا إضافتها** (BMC Nursing وSustainability من MDPI وNurse Education Today من صفحتها نفسها): منعت صفحاتها القراءة الآلية. لم تُضَف إلا من مصدر يمكن تتبعه.
