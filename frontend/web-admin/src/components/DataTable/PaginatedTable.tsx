'use client';
import Table from '@mui/material/Table';
import TableContainer from '@mui/material/TableContainer';
import TablePagination from '@mui/material/TablePagination';
import Card from '@mui/material/Card';
import { alpha, useTheme } from '@mui/material/styles';

export const PAGE_SIZE_OPTIONS = [10, 20, 50] as const;
export type PageSizeOption = (typeof PAGE_SIZE_OPTIONS)[number];

interface PaginatedTableProps {
  count: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  children: React.ReactNode;
}

export function PaginatedTable({
  count,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
  children,
}: PaginatedTableProps) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  return (
    <Card>
      <TableContainer>
        <Table>{children}</Table>
      </TableContainer>
      <TablePagination
        component="div"
        count={count}
        page={page}
        rowsPerPage={pageSize}
        rowsPerPageOptions={[...PAGE_SIZE_OPTIONS]}
        onPageChange={(_, p) => onPageChange(p)}
        onRowsPerPageChange={(e) => onPageSizeChange(Number(e.target.value))}
        sx={{
          borderTop: `1px solid ${isDark ? alpha('#94A3B8', 0.08) : '#F1F5F9'}`,
          '& .MuiTablePagination-toolbar': { minHeight: 52 },
        }}
      />
    </Card>
  );
}
