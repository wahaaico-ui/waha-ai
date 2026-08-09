# WAHA Idea Verification Engine

## Overview

The **Idea Verification Engine** is the first real backend component of WAHA's research pipeline. It validates research ideas for meaningfulness and prepares them for downstream analysis.

## Architecture

```
User Input (Research Idea)
    ↓
[API Endpoint] /api/analyze-idea
    ↓
[Service Layer] IdeaAnalysisService
    ↓
[Engine] IdeaVerificationEngine
    ↓
[Validator] MeaningfulnessValidator
    ↓
[Output] Verification Result (Success/Error)
```

## Components

### 1. **Meaningfulness Validator** (`lib/validators/meaningfulness.validator.ts`)

Detects if input text contains meaningful research content or is nonsense.

**Checks:**
- Empty or too short content (< 10 characters)
- All numbers (e.g., "12345")
- Only symbols (no alphanumeric content)
- Gibberish patterns (repeating characters)
- Lack of meaningful keywords (only stop words)
- Research context indicators

**Usage:**
```typescript
import { MeaningfulnessValidator } from '@/lib/validators/meaningfulness.validator';

const result = MeaningfulnessValidator.validate("Your research idea...");
if (!result.isMeaningful) {
  console.log(result.reason); // Why it failed
}
```

### 2. **Idea Verification Engine** (`lib/engines/IdeaVerificationEngine.ts`)

Core orchestrator for idea verification. Runs validation and generates verification IDs for tracking.

**Returns:**
- `VerificationSuccess` if input is valid
- `VerificationError` if input is invalid

**Usage:**
```typescript
import { IdeaVerificationEngine } from '@/lib/engines/IdeaVerificationEngine';

const result = IdeaVerificationEngine.verify(ideaText);
if (result.isValid) {
  console.log(result.success.id); // Verification ID
  console.log(result.success.status); // pending_analysis
}
```

### 3. **Idea Analysis Service** (`services/ai/idea-analysis.service.ts`)

API-level service that coordinates verification and prepares next steps.

**Features:**
- Handles HTTP request/response formatting
- Determines next analysis steps
- Integrates with validators and engines

**Usage:**
```typescript
import { IdeaAnalysisService } from '@/services/ai/idea-analysis.service';

const response = await IdeaAnalysisService.processRequest({
  ideaText: "User's research idea"
});
```

### 4. **API Endpoint** (`app/api/analyze-idea/route.ts`)

Next.js API route that handles POST requests for idea analysis.

**Request:**
```json
POST /api/analyze-idea
{
  "ideaText": "Your research idea..."
}
```

**Response (Success):**
```json
{
  "success": true,
  "verificationId": "idea_1234567_abc123",
  "message": "Idea verified successfully. Ready for semantic analysis.",
  "data": {
    "rawInput": "Your research idea...",
    "inputLength": 45,
    "nextSteps": [
      "Extract semantic concepts and variables",
      "Query OpenAlex for related publications",
      "Query Semantic Scholar for similar research",
      "Validate research methodology patterns"
    ]
  }
}
```

**Response (Error):**
```json
{
  "success": false,
  "verificationId": "",
  "message": "This idea cannot be analyzed because the content is not meaningful.",
  "error": {
    "code": "INVALID_INPUT",
    "message": "Content contains only numbers"
  }
}
```

## Research Evidence Integration (Placeholders)

### OpenAlex Provider (`lib/evidence/OpenAlexProvider.ts`)

Structured placeholder for OpenAlex API integration. Currently supports work search; additional methods are prepared:

- `searchWorks()` - Search papers by keywords
- `getWorksByConceptId()` - TODO: Concept-based discovery
- `getTrendingTopics()` - TODO: Trend analysis

### Semantic Scholar Provider (`lib/evidence/SemanticScholarProvider.ts`)

Structured placeholder for Semantic Scholar API integration. Prepared methods:

- `searchPapers()` - TODO: Query academic papers
- `getCitationContext()` - TODO: Citation analysis
- `findSimilarPapers()` - TODO: Semantic similarity

## Next Steps in Pipeline

Once an idea passes verification, the following analysis steps are queued:

1. **Extract Semantic Concepts** - Extract variables, keywords, research questions
2. **Query OpenAlex** - Find related publications in global research
3. **Query Semantic Scholar** - Find similar studies and research gaps
4. **Validate Methodology** - Check research methodology patterns

## No Fake Data Policy

✅ **What's Real:**
- Input validation logic
- Error detection
- Verification IDs (timestamped, unique)
- Architecture and service layers

❌ **What's NOT Implemented (Placeholders):**
- AI-based content analysis
- Fake scores or percentages
- Dummy field/discipline detection
- Mock research gap analysis
- Hallucinated evaluation metrics

These will be implemented when:
- Real semantic analysis engines are ready
- OpenAlex API integration is complete
- Semantic Scholar API credentials are available
- NLP models are deployed

## Testing

### Test 1: Meaningful Input
```
Input: "تأثير استخدام الذكاء الاصطناعي على الإنتاجية في شركات التكنولوجيا"
Expected: Verification success with next steps
```

### Test 2: Numbers Only
```
Input: "123456789"
Expected: Error - "Content contains only numbers"
```

### Test 3: Gibberish
```
Input: "aaaabbbbcccc"
Expected: Error - "Content appears to be random characters"
```

### Test 4: Too Short
```
Input: "hi"
Expected: Error - "Input too short"
```

## File Structure

```
lib/
├── validators/
│   └── meaningfulness.validator.ts    # Input validation logic
├── engines/
│   └── IdeaVerificationEngine.ts      # Core verification engine
└── evidence/
    ├── OpenAlexProvider.ts            # OpenAlex integration (placeholder)
    └── SemanticScholarProvider.ts     # Semantic Scholar integration (placeholder)

services/
└── ai/
    └── idea-analysis.service.ts       # Service orchestration layer

app/
└── api/
    └── analyze-idea/
        └── route.ts                   # API endpoint
```

## Development Roadmap

- [ ] Implement semantic concept extraction
- [ ] Integrate OpenAlex API for publication search
- [ ] Integrate Semantic Scholar API for similarity analysis
- [ ] Add research methodology validation
- [ ] Build research gap detection engine
- [ ] Create hypothesis validation module
- [ ] Implement citation analysis

## Error Codes

| Code | Meaning | Status |
|------|---------|--------|
| `INVALID_REQUEST` | Missing/invalid request body | 400 |
| `INVALID_INPUT` | Input fails validation | 400 |
| `INTERNAL_SERVER_ERROR` | Server error | 500 |
| `CONNECTION_ERROR` | Client-side connection failure | 500 |

## Debugging

Enable logging by checking console output:

```typescript
// Placeholders log what would be called:
console.log('[PLACEHOLDER] OpenAlex: Searching for papers...');
console.log('[PLACEHOLDER] SemanticScholar: Getting papers...');
```

This helps track when real implementations should be activated.
