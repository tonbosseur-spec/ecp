export type ExcelChartType = 'column' | 'line' | 'bar' | 'pie';

export interface ExcelChartConfig {
  id: string;
  type: ExcelChartType;
  sourceRange: string;
  title?: string;
}

export interface ExcelChartSeries {
  name: string;
  values: (number | null)[];
}

export interface ExcelChartParsedData {
  categories: string[];
  series: ExcelChartSeries[];
  rechartsData: Record<string, string | number>[];
  seriesKeys: string[];
  isValid: boolean;
  errorMessage?: string;
}
