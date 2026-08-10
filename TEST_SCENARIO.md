# Manual Test Scenario: Academic MVP Flow

## Objective
To verify the end-to-end integration of user login, project creation, university onboarding, PDF analysis, citation generation, and project export.

## Test Steps

### Step 1: User Login / Creation
* **Action:** Navigate to the auth/login page, enter credentials or use a test user account to log in.
* **Expected Result:** Successful authentication and redirection to the workspace or dashboard.

### Step 2: Create a New Project
* **Action:** In the workspace dashboard, click on "New Project", provide a title, and submit.
* **Expected Result:** A new project record is created in the Supabase `projects` table, and the project interface loads.

### Step 3: University Onboarding
* **Action:** Upon opening the new project, the mandatory onboarding modal appears. Select a university from the dropdown list or upload a manual PDF policy, then click save.
* **Expected Result:** The `university_policy` column in the `projects` table is successfully updated via `/api/academic/projects/policy`.

### Step 4: Upload PDF and Analyze
* **Action:** Navigate to the PDF analyzer section, input sample academic text/PDF content, and trigger analysis.
* **Expected Result:** The system invokes `geminiClient.ts` through `/api/academic/pdf-analyzer`, extracts insights, and inserts a new record into the `sources` table linked to the `project_id`, returning a valid `sourceId`.

### Step 5: Generate Formatted Citation
* **Action:** Trigger the citation generator using the returned `sourceId`.
* **Expected Result:** The `/api/academic/citations` route updates the same record in the `sources` table with `parsed_citation_apa` and `parsed_citation_ieee`.

### Step 6: Export Project Content
* **Action:** Click the export button in the project view.
* **Expected Result:** The `/api/academic/export` route gathers project details, latest document versions, and sources from Supabase, returning a downloadable export file containing real persisted data.
