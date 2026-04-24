export interface Citation {
  id: string;
  title: string;
  refLink?: string;
  citation_url?: string;
}

export type AnalysisResultKind =
  | 'likely_applicable'
  | 'needs_check'
  | 'likely_not_applicable'
  | 'unknown'
  | 'skipped';

export interface StandardAnalysisResult {
  result: AnalysisResultKind;
  basis: Citation[];
  assumptions: string[];
  limits: string[];
  needsHumanReview: true;
}

export type ScopingRuleCategory = 'eia_target' | 'small_eia' | 'forest_conversion';

export type ScopingSkipReason =
  | 'input_undefined'
  | 'zone_mismatch'
  | 'condition_not_met';

export interface ScopingResult extends StandardAnalysisResult {
  ruleId: string;
  title: string;
  category: ScopingRuleCategory;
  rule_pack_version: string;
  triggered: boolean;
  skip_reason?: ScopingSkipReason;
}
