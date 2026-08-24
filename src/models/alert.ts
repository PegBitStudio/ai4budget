import { Category } from './category';

export interface SpendingAlert {
  id: string;
  user_id: string;
  category: Category;
  type: 'warning' | 'exceeded';
  amount_spent: number;
  budgeted_amount: number;
  period_start: string;
  created_at: string;
}
