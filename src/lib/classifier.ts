import { Category } from '@/models/category';

/**
 * Result of classifying a transaction description.
 */
export interface ClassificationResult {
  category: Category;
  source: 'rule' | 'llm' | 'fallback' | 'user-correction';
}

/**
 * A classification rule mapping a regex pattern to a category.
 */
export interface ClassificationRule {
  pattern: RegExp;
  category: Category;
  priority: number;
}

/**
 * Default regex-based classification rules for all 10 categories.
 * Rules are evaluated in order; first match wins.
 */
export const DEFAULT_RULES: ClassificationRule[] = [
  { pattern: /rent|mortgage|landlord|property|housing|service charge|caretaker/i, category: 'Housing', priority: 10 },
  { pattern: /uber|lyft|bolt|indrive|rida|okada|keke|danfo|brt|bus|train|metro|fuel|petrol|diesel|filling station|total energies|mobil|oando|conoil|ardova|gas station|parking|taxi|toll/i, category: 'Transport', priority: 10 },
  { pattern: /shoprite|spar|justrite|market square|ebeano|prince ebeano|addide|mile ?12|mile 12 market|oyingbo|balogun market|foodco|grocer(y|ies)|supermarket|provisions|foodstuff|woolworths|coles|aldi|lidl|tesco|kroger|safeway/i, category: 'Groceries', priority: 10 },
  { pattern: /ekedc|ikedc|aedc|phed|eedc|bedc|electric|prepaid meter|nepa|water board|waste|lawma|internet|spectranet|smile|starlink|phone bill|airtime|data bundle|recharge|vtu|mtn|glo\b|airtel|9mobile|etisalat/i, category: 'Utilities', priority: 10 },
  { pattern: /netflix|spotify|showmax|disney|hbo|youtube premium|apple music|amazon prime|audiomack|boomplay|dstv|gotv|startimes|gym membership|i-?fitness|subscription/i, category: 'Subscriptions', priority: 10 },
  { pattern: /chowdeck|glovo|jumia food|chicken republic|the place|kilimanjaro|mr ?biggs|tantalizers|sweet sensation|domino|cold stone|jollof|suya|buka|restaurant|cafe|coffee|starbucks|mcdonald|kfc|pizza|takeout|eatery|lunch|dinner|delivery/i, category: 'Dining', priority: 8 },
  { pattern: /filmhouse|silverbird|genesis cinema|ebonylife|cinema|movie|concert|theatre|game|steam|playstation|xbox|betting|bet9ja|sportybet|nairabet|club/i, category: 'Entertainment', priority: 8 },
  { pattern: /healthplus|medplus|alpha pharmacy|pharmacy|chemist|doctor|hospital|clinic|dentist|physio|medical|prescription|hmo|lab test|diagnostics/i, category: 'Health', priority: 8 },
  { pattern: /jumia|konga|slot\b|pointek|jiji|temu|shein|amazon|ebay|zara|h&m|target|mall|boutique|clothes|shoes|electronics|gadget/i, category: 'Shopping', priority: 6 },
];

/**
 * Classify a transaction description using a three-tier strategy:
 * 1. User corrections (highest priority) — exact match lookup
 * 2. Rule-based matching — regex patterns
 * 3. LLM fallback — external classifier function
 *
 * If all tiers fail, returns "Other" with source "fallback".
 *
 * @param description - The transaction description to classify
 * @param userCorrections - Optional map of description → category from user corrections
 * @param llmClassify - Optional async function for LLM-based classification
 * @returns ClassificationResult with the assigned category and its source
 */
export async function classify(
  description: string,
  userCorrections?: Map<string, Category>,
  llmClassify?: (desc: string) => Promise<Category | null>
): Promise<ClassificationResult> {
  // Tier 1: User corrections — exact match (case-insensitive)
  if (userCorrections) {
    const normalised = description.toLowerCase().trim();
    for (const [key, category] of Array.from(userCorrections.entries())) {
      if (key.toLowerCase().trim() === normalised) {
        return { category, source: 'user-correction' };
      }
    }
  }

  // Tier 2: Rule-based matching — first match by priority order
  for (const rule of DEFAULT_RULES) {
    if (rule.pattern.test(description)) {
      return { category: rule.category, source: 'rule' };
    }
  }

  // Tier 3: LLM fallback
  if (llmClassify) {
    try {
      const result = await llmClassify(description);
      if (result) {
        return { category: result, source: 'llm' };
      }
    } catch {
      // LLM failed — fall through to default
    }
  }

  // Default fallback: "Other"
  return { category: 'Other', source: 'fallback' };
}
