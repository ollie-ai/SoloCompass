import CurrencyConverter from './CurrencyConverter';
import BudgetChart from './BudgetChart';

export default function BudgetOverview({ categoryData = [], budget, formatCurrency }) {
  return (
    <div className="space-y-4">
      <BudgetChart data={categoryData} currency={budget?.currency || 'GBP'} formatCurrency={formatCurrency} />
      <CurrencyConverter
        defaultFrom={budget?.currency || 'GBP'}
        defaultTo="GBP"
        initialAmount={Math.max(1, Math.round(Number(budget?.remaining ?? 100) || 100))}
      />
    </div>
  );
}
