export interface TableColumn<T> {
  field: string;
  header: string;
  type?: 'text' | 'boolean' | 'date' | 'number' | 'custom';
  isSortable?: boolean;
  isEditable?: boolean;
  isSwitchable?: boolean;
  isDisabled?: boolean | ((row: T) => boolean);
  format?: (value: any) => string;
}
  
export interface TableAction<T> {
  icon: string;
  callback: (row: T) => void;
  tooltip?: string;
  confirmDialog?: boolean;
  confirmMessage?: string;
  isDisabled?: boolean | ((row: T) => boolean);
}

export interface TableConfig<T> {
  columns: TableColumn<T>[];
  data: T[];
  actions?: TableAction<T>[];
  showPaginator?: boolean;
  rowsPerPage?: number;
  totalRecords?: number;
  currentPage?: number;
  onPageChange?: (event: any) => void;
  totalPages?: number;
  isLoading?: boolean;
} 