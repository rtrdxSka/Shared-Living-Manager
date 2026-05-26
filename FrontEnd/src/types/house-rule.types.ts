export interface HouseRuleResponse {
  _id: string;
  householdId: string;
  sourceVoteId: string;
  title: string;
  text: string;
  passedAt: string;
  archivedAt?: string;
  archivedBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface HouseRuleListResponse {
  items: HouseRuleResponse[];
}
