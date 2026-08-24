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
  { pattern: /rent|mortgage|landlord|property|housing/i, category: 'Housing', priority: 10 },
  { pattern: /uber|lyft|bolt|bus|train|metro|fuel|petrol|gas station|parking|taxi/i, category: 'Transport', priority: 10 },
  { pattern: /woolworths|coles|aldi|lidl|tesco|kroger|safeway|shoprite|spar|grocery|supermarket/i, category: 'Groceries', priority: 10 },
  { pattern: /electric|water|gas bill|internet|phone bill|airtime|data bundle/i, category: 'Utilities', priority: 10 },
  { pattern: /netflix|spotify|disney|hbo|youtube premium|apple music|amazon prime|gym membership/i, category: 'Subscriptions', priority: 10 },
  { pattern: /restaurant|cafe|coffee|starbucks|mcdonald|kfc|pizza|takeout|delivery/i, category: 'Dining', priority: 8 },
  { pattern: /cinema|movie|concert|theatre|game|steam|playstation|xbox|betting/i, category: 'Entertainment', priority: 8 },
  { pattern: /pharmacy|doctor|hospital|dentist|physio|medical|clinic|prescription/i, category: 'Health', priority: 8 },
  { pattern: /amazon|ebay|zara|h&m|target|mall|clothes|shoes|electronics/i, category: 'Shopping', priority: 6 },
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
